#!/usr/bin/env python3
"""Require exact approval outside the current feature/harness lineage."""

import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
HARNESS_BRANCH = "feature/harness"
PROTECTED_ROOTS = {".agents", ".codex", ".eslint", ".husky", "semgrep-rules"}
APPROVAL_PREFIX = "APPROVE_PROTECTED_EDIT "
PATCH_PATH = re.compile(r"^\*\*\* (?:Add|Update|Delete) File: (.+)$|^\*\*\* Move to: (.+)$")
STATE_DIR = Path(tempfile.gettempdir()) / "codex-protected-edit-approvals"


def hook_event() -> dict[str, object] | None:
    try:
        event = json.load(sys.stdin)
    except (json.JSONDecodeError, OSError):
        return None
    return event if isinstance(event, dict) else None


def current_branch(cwd: object) -> str | None:
    if not isinstance(cwd, str) or not cwd:
        return None
    try:
        return subprocess.check_output(
            ["git", "-C", cwd, "branch", "--show-current"], text=True
        ).strip() or None
    except (OSError, subprocess.CalledProcessError):
        return None


def has_current_harness_ancestor(cwd: object) -> bool:
    if not isinstance(cwd, str) or not cwd:
        return False
    try:
        return (
            subprocess.run(
                ["git", "-C", cwd, "merge-base", "--is-ancestor", HARNESS_BRANCH, "HEAD"],
                check=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            ).returncode
            == 0
        )
    except OSError:
        return False


def relative_path(path: object, cwd: object) -> str | None:
    if not isinstance(path, str) or not path:
        return None
    base = Path(cwd) if isinstance(cwd, str) and cwd else REPO_ROOT
    try:
        return str((base / path).resolve().relative_to(REPO_ROOT)).replace(os.sep, "/")
    except ValueError:
        return None


def protected_paths(event: dict[str, object]) -> set[str]:
    tool_input = event.get("tool_input")
    if not isinstance(tool_input, dict):
        return set()
    paths = [tool_input.get("file_path"), tool_input.get("path")]
    command = tool_input.get("command")
    if isinstance(command, str):
        paths.extend(match.group(1) or match.group(2) for line in command.splitlines() if (match := PATCH_PATH.match(line)))
    return {
        relative
        for path in paths
        if (relative := relative_path(path, event.get("cwd")))
        and relative.split("/", 1)[0] in PROTECTED_ROOTS
    }


def state_path(session_id: object) -> Path | None:
    if not isinstance(session_id, str) or not session_id:
        return None
    return STATE_DIR / hashlib.sha256(session_id.encode()).hexdigest()


def load_grant(session_id: object) -> dict[str, object] | None:
    path = state_path(session_id)
    if path is None:
        return None
    try:
        grant = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return grant if isinstance(grant, dict) else None


def save_grant(session_id: object, grant: dict[str, object]) -> None:
    path = state_path(session_id)
    if path is None:
        return
    STATE_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
    temporary = path.with_suffix(f".{os.getpid()}.tmp")
    temporary.write_text(json.dumps(grant), encoding="utf-8")
    temporary.chmod(0o600)
    temporary.replace(path)


def consume_grant(session_id: object, paths: set[str]) -> None:
    grant = load_grant(session_id)
    path = state_path(session_id)
    if grant is None or path is None:
        return
    approved = set(grant.get("paths", []))
    remaining = approved - paths
    if remaining:
        grant["paths"] = sorted(remaining)
        save_grant(session_id, grant)
    else:
        path.unlink(missing_ok=True)


def approval_paths(prompt: object, cwd: object) -> set[str]:
    if not isinstance(prompt, str) or not prompt.startswith(APPROVAL_PREFIX):
        return set()
    return {
        relative
        for path in prompt.removeprefix(APPROVAL_PREFIX).split(",")
        if (relative := relative_path(path.strip(), cwd))
        and relative.split("/", 1)[0] in PROTECTED_ROOTS
    }


def capture_approval(event: dict[str, object]) -> None:
    paths = approval_paths(event.get("prompt"), event.get("cwd"))
    if not paths or not isinstance(event.get("turn_id"), str):
        return
    save_grant(
        event.get("session_id"),
        {
            "branch": current_branch(event.get("cwd")),
            "paths": sorted(paths),
            "turn_id": event["turn_id"],
        },
    )


def approved(event: dict[str, object], paths: set[str], branch: str | None) -> bool:
    grant = load_grant(event.get("session_id"))
    return bool(
        grant
        and grant.get("turn_id") == event.get("turn_id")
        and grant.get("branch") == branch
        and paths <= set(grant.get("paths", []))
    )


def deny(paths: set[str]) -> None:
    approval = f"{APPROVAL_PREFIX}{', '.join(sorted(paths))}"
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": (
                        "Protected tooling edits outside the current feature/harness lineage require explicit user approval. "
                        f"Ask the user to reply exactly: {approval}"
                    ),
                }
            }
        )
    )


def enforce(event: dict[str, object]) -> None:
    paths = protected_paths(event)
    if not paths:
        return
    branch = current_branch(event.get("cwd"))
    if branch == HARNESS_BRANCH or has_current_harness_ancestor(event.get("cwd")):
        return
    if approved(event, paths, branch):
        consume_grant(event.get("session_id"), paths)
        return
    deny(paths)


def main() -> None:
    event = hook_event()
    if event is None:
        return
    if "--capture-approval" in sys.argv:
        capture_approval(event)
    elif event.get("hook_event_name") in {None, "PreToolUse"}:
        enforce(event)


if __name__ == "__main__":
    main()
