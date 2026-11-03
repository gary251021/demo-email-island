#!/usr/bin/env python3
"""Enforce GitLab implementation-task and integration-publication gates."""

from __future__ import annotations

import json
import re
import shlex
import subprocess
import sys
from pathlib import Path
from typing import Any


LAUNCH_MARKER = "ISSUE_IMPL"
STRATEGY_FIELD = "Implementation strategy"
FEATURE_BASE_FIELD = "Feature base"
DEPENDENCY_REFS_FIELD = "Dependency refs"
DIRECT_STRATEGY = "direct"
INTEGRATION_STRATEGY = "harness-integration"
HARNESS_REF = "feature/harness"
INTEGRATION_PREFIX = "local/int/"
CONTROL_TOKENS = {"&", "&&", ";", "|", "||", "\n"}

INVALID_MARKER_REASON = "The GitLab implementation task marker is invalid."
WRONG_BRANCH_REASON = (
    "GitLab implementation tasks must start on the branch selected by their strategy."
)
INVALID_STRATEGY_REASON = "The GitLab implementation strategy is invalid."
INVALID_TITLE_REASON = (
    "GitLab implementation tasks must use the traceable Implementation · #<issue> · <title> format."
)
REVIEW_CONTEXT_REASON = "Reviewer subagents must use fork_turns: none."
VISIBLE_TASK_REASON = "Use native implementation delegation with the selected model and assigned checkout; retained sessions keep their context. Legacy marked chat dispatch uses phase 02 buildDispatch."
DISPATCH_REASON = "Worker dispatch must match the phase 02 generated payload."
MISSING_HARNESS_REASON = f"The local harness branch {HARNESS_REF} is unavailable."
STALE_HARNESS_REASON = (
    f"The integration branch does not contain the current local {HARNESS_REF} tip."
)
INTEGRATION_PUSH_REASON = "Local integration branches must never be pushed."
INVALID_PRODUCTION_BASE_REASON = (
    "The feature branch must follow the issue-pinned production and dependency path."
)


def deny(reason: str) -> None:
    """Emit a Codex PreToolUse denial."""
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


def read_event() -> dict[str, Any] | None:
    """Read one hook event from standard input."""
    try:
        event = json.load(sys.stdin)
    except (json.JSONDecodeError, OSError):
        return None
    return event if isinstance(event, dict) else None


def git_result(cwd: object, *arguments: str) -> subprocess.CompletedProcess[str] | None:
    """Run a Git command in the hook checkout."""
    if not isinstance(cwd, str) or not cwd:
        return None
    try:
        return subprocess.run(
            ["git", "-C", cwd, *arguments],
            check=False,
            capture_output=True,
            text=True,
        )
    except OSError:
        return None


def current_branch(cwd: object) -> str | None:
    """Return the current branch name."""
    result = git_result(cwd, "branch", "--show-current")
    if result is None or result.returncode != 0:
        return None
    return result.stdout.strip() or None


def harness_revision(cwd: object) -> str | None:
    """Resolve the current local harness branch tip."""
    result = git_result(
        cwd,
        "rev-parse",
        "--verify",
        "--end-of-options",
        f"{HARNESS_REF}^{{commit}}",
    )
    if result is None or result.returncode != 0:
        return None
    return result.stdout.strip() or None


def harness_is_ancestor(cwd: object, harness: str) -> bool:
    """Return whether the local harness tip is contained by checkout HEAD."""
    result = git_result(cwd, "merge-base", "--is-ancestor", harness, "HEAD")
    return result is not None and result.returncode == 0


def prompt_value(prompt: object, label: str) -> str | None:
    """Read one exact prompt context field."""
    if not isinstance(prompt, str):
        return None
    matches = re.findall(rf"(?m)^{re.escape(label)}:\s*(\S+)\s*$", prompt)
    return matches[0] if len(matches) == 1 else None


def resolve_commit(cwd: object, ref: str) -> str | None:
    """Resolve a ref to its commit in the hook checkout."""
    result = git_result(cwd, "rev-parse", "--verify", f"{ref}^{{commit}}")
    if result is None or result.returncode != 0:
        return None
    return result.stdout.strip() or None


def is_ancestor(cwd: object, ancestor: str, descendant: str) -> bool:
    """Return whether one commit is an ancestor of another."""
    result = git_result(cwd, "merge-base", "--is-ancestor", ancestor, descendant)
    return result is not None and result.returncode == 0


def dependency_refs(prompt: object) -> list[tuple[str, str]] | None:
    """Parse one ordered, comma-separated branch:SHA prompt field."""
    value = prompt_value(prompt, DEPENDENCY_REFS_FIELD)
    if value == "None":
        return []
    if value is None:
        return None
    refs: list[tuple[str, str]] = []
    for item in value.split(","):
        branch, separator, sha = item.rpartition(":")
        if not separator or not branch or not re.fullmatch(r"[0-9a-f]{40}", sha):
            return None
        refs.append((branch, sha))
    return refs


def validate_production_context(cwd: object, prompt: object) -> str | None:
    """Require a feature branch pinned to its production and dependency path."""
    feature = prompt_value(prompt, "Feature")
    production_tag = prompt_value(prompt, "Production tag")
    production_base = prompt_value(prompt, "Production base")
    feature_base = prompt_value(prompt, FEATURE_BASE_FIELD)
    dependencies = dependency_refs(prompt)
    if not (
        feature
        and production_tag
        and re.fullmatch(r"v\d+\.\d+\.\d+", production_tag)
        and production_base
        and re.fullmatch(r"[0-9a-f]{40}", production_base)
        and feature_base
        and re.fullmatch(r"[0-9a-f]{40}", feature_base)
        and dependencies is not None
    ):
        return INVALID_PRODUCTION_BASE_REASON

    feature_revision = resolve_commit(cwd, feature)
    valid_feature = (
        feature_revision is not None
        and is_ancestor(cwd, feature_base, feature_revision)
        if prompt_value(prompt, STRATEGY_FIELD) == DIRECT_STRATEGY
        else feature_revision == feature_base
    )
    if not valid_feature or resolve_commit(cwd, production_tag) != production_base:
        return INVALID_PRODUCTION_BASE_REASON

    current_base = production_base
    for branch, sha in dependencies:
        branch_revision = resolve_commit(cwd, branch)
        if (
            resolve_commit(cwd, sha) != sha
            or branch_revision is None
            or not is_ancestor(cwd, sha, branch_revision)
        ):
            return INVALID_PRODUCTION_BASE_REASON
        if not is_ancestor(cwd, current_base, sha):
            return INVALID_PRODUCTION_BASE_REASON
        current_base = sha
    if current_base != feature_base:
        return INVALID_PRODUCTION_BASE_REASON
    if not is_ancestor(cwd, feature_base, "HEAD"):
        return INVALID_PRODUCTION_BASE_REASON
    return None


def launch_issue(prompt: object) -> int | None:
    """Extract one positive issue number from the launch marker."""
    if not isinstance(prompt, str):
        return None
    matches = re.findall(
        rf"(?m)^{re.escape(LAUNCH_MARKER)}=([^\r\n]*)$",
        prompt,
    )
    if len(matches) != 1 or not matches[0].isdigit():
        return None
    issue = int(matches[0])
    return issue if issue > 0 else None


def marker_is_mentioned(prompt: object) -> bool:
    """Return whether a task prompt attempts to use the workflow marker."""
    return isinstance(prompt, str) and LAUNCH_MARKER in prompt


def branch_matches_issue(branch: str | None, issue: int) -> bool:
    """Return whether an integration branch belongs to the marked issue."""
    expected = f"{INTEGRATION_PREFIX}{issue}"
    return branch == expected or bool(branch and branch.startswith(f"{expected}-"))


def title_matches_issue(title: object, issue: int) -> bool:
    """Return whether the implementation task title identifies its issue."""
    prefix = f"Implementation · #{issue} · "
    if not isinstance(title, str) or not title.startswith(prefix):
        return False
    short_title = title.removeprefix(prefix)
    return bool(short_title) and short_title == short_title.strip()


def validate_worker_dispatch(tool_name: str, tool_input: dict[str, Any], prompt: str) -> str | None:
    """Regenerate the actual chat payload against live checkout and context state."""
    values = re.findall(r"(?m)^Dispatch input: (.+)$", prompt)
    if len(values) != 1:
        return DISPATCH_REASON
    script = Path(__file__).resolve().parents[2] / ".agents/skills/project-deliver-issue/references/02_handoff.mjs"
    try:
        result = subprocess.run(
            ["node", str(script), "buildDispatch", values[0]],
            capture_output=True, text=True, check=False, timeout=8,
        )
        payload = json.loads(result.stdout)
        if result.returncode or not payload.get("ok"):
            return f"Worker dispatch rejected: {payload.get('error', {}).get('message', result.stderr.strip())}"
        dispatch = payload["data"]
        if not tool_name.endswith(dispatch["tool"]) or tool_input != dispatch["arguments"]:
            return DISPATCH_REASON
    except (OSError, ValueError, KeyError, subprocess.TimeoutExpired) as error:
        return f"Worker dispatch could not be verified: {error}"
    return None


def validate_task_launch(event: dict[str, Any]) -> str | None:
    """Validate direct ticket chats and isolated reviewers before dispatch."""
    tool_input = event.get("tool_input")
    if not isinstance(tool_input, dict):
        return None
    tool_name = str(event.get("tool_name", ""))
    review = tool_input.get("agent_type") == "reviewer" or str(tool_input.get("task_name", "")).startswith("code_review_")
    if review and tool_input.get("fork_turns") != "none":
        return REVIEW_CONTEXT_REASON
    if str(tool_input.get("task_name", "")).startswith("code_review_") and (
        tool_input.get("agent_type") != "default"
        or tool_input.get("model") is not None
        or tool_input.get("reasoning_effort") is not None
    ):
        return "Use agent_type: default and omit model and reasoning_effort so delivery reviewer subagents inherit their coordinator settings."
    prompt = tool_input.get("prompt", tool_input.get("message"))
    if not marker_is_mentioned(prompt):
        return None
    issue = launch_issue(prompt)
    if issue is None:
        return INVALID_MARKER_REASON
    strategy = prompt_value(prompt, STRATEGY_FIELD)
    if strategy not in {DIRECT_STRATEGY, INTEGRATION_STRATEGY}:
        return INVALID_STRATEGY_REASON
    if not title_matches_issue(prompt.splitlines()[0], issue):
        return INVALID_TITLE_REASON
    if not tool_name.endswith(("create_thread", "send_message_to_thread")) or "Implementation scope: entire issue" in prompt.splitlines():
        return VISIBLE_TASK_REASON
    cwd = event.get("cwd")
    branch = current_branch(cwd)
    feature = prompt_value(prompt, "Feature")
    if not (branch == feature if strategy == DIRECT_STRATEGY else branch_matches_issue(branch, issue)):
        return WRONG_BRANCH_REASON
    # buildDispatch validates the assigned worker checkout; other workers may
    # have uncommitted work in this coordinator checkout.
    if strategy == INTEGRATION_STRATEGY:
        harness = harness_revision(cwd)
        if harness is None:
            return MISSING_HARNESS_REASON
        if not harness_is_ancestor(cwd, harness):
            return STALE_HARNESS_REASON
    if reason := validate_production_context(cwd, prompt):
        return reason
    return validate_worker_dispatch(tool_name, tool_input, prompt)


def validate_pi_subagent(event: dict[str, Any]) -> str | None:
    """Pi's native subagent payload has tasks/context, not Codex chat dispatch fields."""
    tool_input = event.get("tool_input", {})
    if not isinstance(tool_input, dict):
        return None
    tasks = [tool_input]
    parallel = tool_input.get("args")
    if isinstance(parallel, dict) and isinstance(parallel.get("tasks"), list):
        tasks = parallel["tasks"]
    if event.get("delivery_active") and tool_input.get("workflow") and not isinstance(parallel, dict):
        # A dynamic delivery script cannot be checked against the launch contract here.
        return VISIBLE_TASK_REASON
    for task in tasks:
        if not isinstance(task, dict):
            return VISIBLE_TASK_REASON
        prompt = task.get("task", task.get("message", ""))
        if task.get("agent") == "reviewer" and (
            task.get("context") == "fork"
            or (event.get("delivery_active") and task.get("context") != "fresh")
        ):
            return REVIEW_CONTEXT_REASON
        if not marker_is_mentioned(prompt):
            continue
        issue = launch_issue(prompt)
        if issue is None:
            return INVALID_MARKER_REASON
        strategy = prompt_value(prompt, STRATEGY_FIELD)
        if strategy not in {DIRECT_STRATEGY, INTEGRATION_STRATEGY}:
            return INVALID_STRATEGY_REASON
        if not title_matches_issue(prompt.splitlines()[0], issue):
            return INVALID_TITLE_REASON
        cwd = task.get("cwd", event.get("cwd"))
        branch = current_branch(cwd)
        feature = prompt_value(prompt, "Feature")
        if not (branch == feature if strategy == DIRECT_STRATEGY else branch_matches_issue(branch, issue)):
            return WRONG_BRANCH_REASON
        if strategy == INTEGRATION_STRATEGY:
            harness = harness_revision(cwd)
            if harness is None:
                return MISSING_HARNESS_REASON
            if not harness_is_ancestor(cwd, harness):
                return STALE_HARNESS_REASON
        if reason := validate_production_context(cwd, prompt):
            return reason
    return None


def command_segments(command: str) -> list[list[str]]:
    """Split a shell command at common control operators."""
    try:
        lexer = shlex.shlex(command, posix=True, punctuation_chars=";&|\n")
        lexer.whitespace = " \t\r"
        lexer.whitespace_split = True
        lexer.commenters = ""
        tokens = list(lexer)
    except ValueError:
        return []
    segments: list[list[str]] = [[]]
    for token in tokens:
        if token in CONTROL_TOKENS:
            if segments[-1]:
                segments.append([])
            continue
        segments[-1].append(token)
    return [segment for segment in segments if segment]


def git_push_arguments(segment: list[str]) -> list[str] | None:
    """Return arguments for a Git push segment."""
    for index, token in enumerate(segment):
        if Path(token).name != "git":
            continue
        arguments = segment[index + 1 :]
        option_index = 0
        while option_index < len(arguments):
            argument = arguments[option_index]
            if argument in {"-C", "-c", "--git-dir", "--work-tree"}:
                option_index += 2
                continue
            if argument.startswith("-"):
                option_index += 1
                continue
            return arguments[option_index + 1 :] if argument == "push" else None
    return None


def has_local_integration_refs(cwd: object) -> bool:
    """Return whether the checkout contains a local integration branch."""
    result = git_result(
        cwd,
        "for-each-ref",
        "--format=%(refname:short)",
        "refs/heads/local/int",
    )
    return result is not None and result.returncode == 0 and bool(result.stdout.strip())


def validate_push(command: str, cwd: object) -> str | None:
    """Reject pushes that could publish a local integration branch."""
    branch = current_branch(cwd)
    for segment in command_segments(command):
        arguments = git_push_arguments(segment)
        if arguments is None:
            continue
        if branch and branch.startswith(INTEGRATION_PREFIX):
            return INTEGRATION_PUSH_REASON
        if any(INTEGRATION_PREFIX in argument for argument in arguments):
            return INTEGRATION_PUSH_REASON
        publishes_every_branch = any(
            option in arguments for option in {"--all", "--mirror"}
        )
        if publishes_every_branch and has_local_integration_refs(cwd):
            return INTEGRATION_PUSH_REASON
    return None


def handle_pre_tool_use(event: dict[str, Any]) -> None:
    """Apply implementation-task and integration-push gates."""
    tool_name = event.get("tool_name")
    tool_input = event.get("tool_input")
    if not isinstance(tool_input, dict):
        return
    if tool_name == "Bash":
        command = tool_input.get("command")
        if isinstance(command, str):
            if reason := validate_push(command, event.get("cwd")):
                deny(reason)
        return
    if tool_name == "subagent":
        if reason := validate_pi_subagent(event):
            deny(reason)
        return
    if str(tool_name).endswith(("spawn_agent", "create_thread", "send_message_to_thread")):
        if reason := validate_task_launch(event):
            deny(reason)


def main() -> None:
    """Dispatch a Codex hook event."""
    event = read_event()
    if event is None:
        return
    if event.get("hook_event_name") in {None, "PreToolUse"}:
        handle_pre_tool_use(event)


if __name__ == "__main__":
    main()
