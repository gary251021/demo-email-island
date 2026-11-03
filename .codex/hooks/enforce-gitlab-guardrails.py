#!/usr/bin/env python3
"""Enforce repository-scoped GitLab command and issue-creation guardrails.

The hook keeps four policies separate: origin repository context, explicit GitLab
project targeting, bracketed issue-title scope, and the required ownership
label on agent-created issues.
"""

import json
import re
import shlex
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse


REPO_ROOT = Path(__file__).resolve().parents[2]


def origin_project_path() -> str | None:
    """Return the `group/project` path of this clone's origin remote."""
    result = subprocess.run(
        ["git", "-C", str(REPO_ROOT), "remote", "get-url", "origin"],
        capture_output=True, text=True, check=False,
    )
    url = result.stdout.strip()
    if result.returncode != 0 or not url:
        return None
    # https://host/group/app.git, ssh://git@host:22/group/app, git@host:group/app.git
    path = urlparse(url).path if "://" in url else url.partition(":")[2]
    path = path.strip("/").removesuffix(".git")
    return path if "/" in path else None


# Without an origin remote, glab stays blocked: nothing matches this placeholder.
EXPECTED_PROJECT = origin_project_path() or "<no-origin-remote>"
SHELL_CONTROL_TOKENS = {"&", "&&", ";", "|", "||"}

WRONG_PROJECT_CONTEXT_REASON = f"glab is restricted to the {EXPECTED_PROJECT} repository."
CONTEXT_CHANGE_REASON = (
    "glab commands cannot change repository context from this project."
)
WRONG_EXPLICIT_PROJECT_REASON = f"glab may only target {EXPECTED_PROJECT}."
WRONG_API_PROJECT_REASON = f"glab api is restricted to {EXPECTED_PROJECT}."
MISSING_TITLE_SCOPE_REASON = (
    "GitLab issue title must include at least one non-empty [scope]."
)
MISSING_OWNERSHIP_LABEL_REASON = (
    "GitLab issue creation must include --label ai-agent."
)
INVALID_PRODUCTION_MR_SOURCE_REASON = (
    "Agent-created merge requests to deploy/prod must come from release/vX.Y.Z."
)


# Hook input and output


def deny(reason: str) -> None:
    """Emit a Codex PreToolUse denial with the supplied reason."""
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": reason,
                }
            }
        )
    )


def read_hook_event() -> dict[str, object] | None:
    """Read a hook event, returning None when the input is not valid JSON."""
    try:
        event = json.load(sys.stdin)
    except (json.JSONDecodeError, OSError):
        return None

    return event if isinstance(event, dict) else None


def bash_command(event: dict[str, object]) -> str | None:
    """Return the Bash command from a relevant hook event."""
    if event.get("tool_name") != "Bash":
        return None

    tool_input = event.get("tool_input")
    if not isinstance(tool_input, dict):
        return None

    command = tool_input.get("command")
    return command if isinstance(command, str) else None


# Git and shell parsing


def command_output(*args: str) -> str | None:
    """Run a read-only command in the repository and return stripped output."""
    try:
        return subprocess.check_output(
            args,
            cwd=REPO_ROOT,
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return None


def command_segments(command: str) -> list[list[str]]:
    """Split a shell command into argument lists at shell control operators."""
    try:
        lexer = shlex.shlex(command, posix=True, punctuation_chars=";&|")
        lexer.whitespace_split = True
        lexer.commenters = ""
        tokens = list(lexer)
    except ValueError:
        return []

    segments: list[list[str]] = [[]]
    for token in tokens:
        if token in SHELL_CONTROL_TOKENS:
            if segments[-1]:
                segments.append([])
            continue
        segments[-1].append(token)

    return [segment for segment in segments if segment]


def is_glab_command(command: str) -> bool:
    """Return whether the command text invokes or references glab."""
    return re.search(r"\bglab\b", command) is not None


# Origin repository context


def is_origin_project(cwd: object) -> bool:
    """Return whether cwd resolves to this clone and its origin project."""
    if not isinstance(cwd, str) or not cwd:
        return False

    current_root = command_output("git", "-C", cwd, "rev-parse", "--show-toplevel")
    if current_root is None or Path(current_root).resolve() != REPO_ROOT:
        return False

    return origin_project_path() == EXPECTED_PROJECT


def validate_project_context(cwd: object) -> str | None:
    """Reject glab use outside this repository's origin project."""
    return None if is_origin_project(cwd) else WRONG_PROJECT_CONTEXT_REASON


# Explicit GitLab project targeting


def explicit_repos(command: str) -> list[str]:
    """Extract repositories supplied through glab --repo or -R options."""
    return re.findall(
        r"(?:^|\s)(?:--repo|-R)(?:=|\s+)(?:['\"]?)([^'\"\s]+)",
        command,
    )


def validate_repository_target(command: str) -> str | None:
    """Reject context changes and explicit targets outside this project."""
    if re.search(r"\b(?:cd|pushd|git\s+-C)\b", command):
        return CONTEXT_CHANGE_REASON

    if any(repo != EXPECTED_PROJECT for repo in explicit_repos(command)):
        return WRONG_EXPLICIT_PROJECT_REASON

    return None


def validate_api_target(command: str) -> str | None:
    """Require glab API calls to name this project."""
    if not re.search(r"\bglab\s+(?:[^;&|]+\s+)?api\b", command):
        return None

    project_references = (
        f"projects/{EXPECTED_PROJECT}",
        f"projects/{EXPECTED_PROJECT.replace('/', '%2F')}",
    )
    return (
        None
        if any(reference in command for reference in project_references)
        else WRONG_API_PROJECT_REASON
    )


# Issue-creation title scope


def issue_create_titles(command: str) -> list[str | None]:
    """Extract title arguments from glab issue-create command segments."""
    titles: list[str | None] = []

    for segment in command_segments(command):
        glab_indexes = [
            index for index, token in enumerate(segment) if Path(token).name == "glab"
        ]
        for glab_index in glab_indexes:
            create_index = next(
                (
                    index + 1
                    for index in range(glab_index + 1, len(segment) - 1)
                    if segment[index : index + 2] == ["issue", "create"]
                ),
                None,
            )
            if create_index is None:
                continue

            arguments = segment[create_index + 1 :]
            title = None
            for index, argument in enumerate(arguments):
                if argument in {"--title", "-t"}:
                    title = arguments[index + 1] if index + 1 < len(arguments) else None
                    break
                if argument.startswith("--title=") or argument.startswith("-t="):
                    title = argument.split("=", 1)[1]
                    break

            titles.append(title)
            break

    return titles


def has_scoped_issue_title(title: str | None) -> bool:
    """Return whether a title contains at least one non-empty bracketed scope."""
    if title is None:
        return False

    return any(scope.strip() for scope in re.findall(r"\[([^\[\]]*)\]", title))


def validate_issue_title_scopes(titles: list[str | None]) -> str | None:
    """Require every issue-create title to contain a bracketed scope."""
    return (
        None
        if all(has_scoped_issue_title(title) for title in titles)
        else MISSING_TITLE_SCOPE_REASON
    )


# Issue-creation ownership label


def has_required_ownership_label(command: str) -> bool:
    """Return whether the issue command includes the ai-agent label."""
    return (
        re.search(
            r"(?<!\S)--label(?:=|\s+)['\"]?ai-agent['\"]?(?=\s|$)",
            command,
        )
        is not None
    )


def validate_issue_ownership_label(command: str) -> str | None:
    """Require agent-created GitLab issues to carry the ai-agent label."""
    return (
        None if has_required_ownership_label(command) else MISSING_OWNERSHIP_LABEL_REASON
    )


def validate_issue_creation(command: str) -> str | None:
    """Validate title and ownership metadata for issue-create commands."""
    titles = issue_create_titles(command)
    if not titles:
        return None

    return validate_issue_title_scopes(titles) or validate_issue_ownership_label(command)


# Production merge-request source


def option_value(arguments: list[str], names: set[str]) -> str | None:
    """Return a CLI option value supplied as two tokens or with equals."""
    for index, argument in enumerate(arguments):
        if argument in names:
            return arguments[index + 1] if index + 1 < len(arguments) else None
        for name in names:
            if argument.startswith(f"{name}="):
                return argument.split("=", 1)[1]
    return None


def merge_request_sources_and_targets(command: str) -> list[tuple[str | None, str | None]]:
    """Extract source and target branches from glab mr create segments."""
    requests: list[tuple[str | None, str | None]] = []
    for segment in command_segments(command):
        for index, token in enumerate(segment):
            if Path(token).name != "glab":
                continue
            if segment[index + 1 : index + 3] != ["mr", "create"]:
                continue
            arguments = segment[index + 3 :]
            source = option_value(arguments, {"--source-branch", "-s"})
            target = option_value(arguments, {"--target-branch", "-b"})
            requests.append((source, target))
            break
    return requests


def validate_production_merge_request(command: str) -> str | None:
    """Reserve deploy/prod merge requests for SemVer release branches."""
    for source, target in merge_request_sources_and_targets(command):
        if target == "deploy/prod" and not (
            source and re.fullmatch(r"release/v\d+\.\d+\.\d+", source)
        ):
            return INVALID_PRODUCTION_MR_SOURCE_REASON
    return None


# Guardrail orchestration


def validate_glab_command(command: str, cwd: object) -> str | None:
    """Return the first policy violation while preserving enforcement order."""
    if reason := validate_project_context(cwd):
        return reason
    if reason := validate_repository_target(command):
        return reason
    if reason := validate_api_target(command):
        return reason

    return validate_issue_creation(command) or validate_production_merge_request(command)


def main() -> None:
    """Evaluate a Codex PreToolUse event and deny GitLab policy violations."""
    event = read_hook_event()
    if event is None:
        return

    command = bash_command(event)
    if command is None or not is_glab_command(command):
        return

    if reason := validate_glab_command(command, event.get("cwd")):
        deny(reason)


if __name__ == "__main__":
    main()
