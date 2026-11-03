#!/usr/bin/env python3
"""Install the skill-owned hook or clean up after a successful MR creation."""

from __future__ import annotations

import json
import re
import shlex
import subprocess
import sys
from pathlib import Path


SCRIPT = ".agents/skills/project-deliver-issue/scripts/cleanupIntegration.py"
COMMAND = f'python3 "$(git rev-parse --show-toplevel)/{SCRIPT}"'


def install(root: Path) -> bool:
    """Register the hook if absent; trust an existing registration."""
    path = root / ".codex/hooks.json"
    config = json.loads(path.read_text()) if path.exists() else {}
    entries = config.setdefault("hooks", {}).setdefault("PostToolUse", [])
    if any(SCRIPT in hook.get("command", "") for entry in entries
           for hook in entry.get("hooks", [])):
        return False
    entries.append({"matcher": "^Bash$", "hooks": [{
        "type": "command", "command": COMMAND, "timeout": 30,
        "statusMessage": "Cleaning up the issue integration branch",
    }]})
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(config, indent=2) + "\n")
    return True


def run(cwd: str, *args: str) -> str:
    """Run a required command without a shell."""
    return subprocess.run(args, cwd=cwd, check=True, capture_output=True,
                          text=True, timeout=10).stdout.strip()


def creation_source(command: str) -> str | None:
    """Recognize the skill's standalone, explicit-source MR creation command."""
    lexer = shlex.shlex(command, posix=True, punctuation_chars=";&|<>\n")
    lexer.whitespace = " \t\r"
    lexer.whitespace_split = True
    lexer.commenters = ""
    args = list(lexer)
    if args[:3] != ["glab", "mr", "create"]:
        return None
    # ponytail: standalone local-repository calls only; add shell parsing if needed.
    if any((arg and set(arg) <= set(";&|<>\n")) or arg in {"-R", "--repo"}
           or arg.startswith(("--repo=", "-R")) for arg in args[3:]):
        return None
    sources = []
    for index, arg in enumerate(args[3:], 3):
        if arg in {"--source-branch", "-s"} and index + 1 < len(args):
            sources.append(args[index + 1])
        elif arg.startswith("--source-branch="):
            sources.append(arg.split("=", 1)[1])
    return sources[0] if len(sources) == 1 else None


def cleanup(cwd: str, source: str, output: str) -> str | None:
    """Delete only the matching, published, patch-transferred local branch."""
    match = re.fullmatch(
        r"(?:feat|fix|refactor|perf|docs|test|build|ci|chore)/([1-9]\d*-[a-z0-9]+(?:-[a-z0-9]+)*)",
        source,
    )
    if not match:
        return None
    branch = f"local/int/{match[1]}"
    ref = f"refs/heads/{branch}"
    if not run(cwd, "git", "for-each-ref", "--format=%(refname)", ref):
        return None
    if f"branch {ref}" in run(cwd, "git", "worktree", "list", "--porcelain").splitlines():
        return f"Kept {branch}: it is checked out in a worktree."
    origin = run(cwd, "git", "remote", "get-url", "origin")
    mr = json.loads(run(cwd, "glab", "mr", "view", source, "--repo", origin,
                        "--output", "json"))
    source_sha = run(cwd, "git", "rev-parse", "--verify", f"refs/heads/{source}")
    if (mr.get("source_branch") != source or mr.get("sha") != source_sha
            or not mr.get("web_url") or mr["web_url"] not in output
            or mr.get("source_project_id") != mr.get("target_project_id")):
        return f"Kept {branch}: the created MR does not confirm this local source revision."
    # The delivery skill transfers individual commits; unmatched patches retain the branch.
    cherry = run(cwd, "git", "cherry", source_sha, ref, "refs/heads/feature/harness")
    if any(line.startswith("+") for line in cherry.splitlines()):
        return f"Kept {branch}: issue commits have not all transferred."
    run(cwd, "git", "branch", "-D", "--", branch)
    return f"Deleted local integration branch {branch} after MR creation."


def handle(event: dict) -> str | None:
    """Ignore unrelated or unsuccessful tool calls."""
    if event.get("hook_event_name") != "PostToolUse" or event.get("tool_name") != "Bash":
        return None
    command = event.get("tool_input", {}).get("command", "")
    source = creation_source(command)
    if not source:
        return None
    response = event.get("tool_response", {})
    if isinstance(response, str):
        if not re.search(r"(?m)^Process exited with code 0$", response):
            return None
        output = response
    elif isinstance(response, dict) and response.get("exit_code") == 0:
        output = response.get("output", response.get("stdout", ""))
    else:
        return None
    return cleanup(event["cwd"], source, output)


if __name__ == "__main__":
    if sys.argv[1:] == ["--install"]:
        root = Path(run(str(Path.cwd()), "git", "rev-parse", "--show-toplevel"))
        print("Installed cleanup hook." if install(root) else "Cleanup hook already registered.")
    else:
        try:
            message = handle(json.load(sys.stdin))
        except (ValueError, KeyError, TypeError, OSError, subprocess.SubprocessError):
            message = "Integration cleanup could not be verified; the branch was retained."
        if message:
            print(json.dumps({"hookSpecificOutput": {
                "hookEventName": "PostToolUse", "additionalContext": message,
            }}))
