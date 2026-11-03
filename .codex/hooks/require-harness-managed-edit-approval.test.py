#!/usr/bin/env python3

import io
import json
import subprocess
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

import importlib.util


HOOK_PATH = Path(__file__).with_name("require-harness-managed-edit-approval.py")
SPEC = importlib.util.spec_from_file_location("managed_edit_approval", HOOK_PATH)
assert SPEC is not None and SPEC.loader is not None
HOOK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(HOOK)


class ManagedEditApprovalTest(unittest.TestCase):
    def edit_event(self, command: str, *, turn_id: str = "turn") -> dict[str, object]:
        return {
            "hook_event_name": "PreToolUse",
            "tool_name": "apply_patch",
            "tool_input": {"command": command},
            "cwd": str(HOOK.REPO_ROOT),
            "session_id": "session",
            "turn_id": turn_id,
        }

    def denial_reason(
        self,
        event: dict[str, object],
        branch: str = "feat/example",
        has_harness_ancestor: bool = False,
    ) -> str | None:
        output = io.StringIO()
        with (
            patch.object(HOOK, "current_branch", return_value=branch),
            patch.object(
                HOOK,
                "has_current_harness_ancestor",
                return_value=has_harness_ancestor,
            ),
            redirect_stdout(output),
        ):
            HOOK.enforce(event)
        if not output.getvalue():
            return None
        return json.loads(output.getvalue())["hookSpecificOutput"]["permissionDecisionReason"]

    def test_allows_protected_edits_on_harness(self) -> None:
        self.assertIsNone(
            self.denial_reason(
                self.edit_event("*** Update File: .agents/skill.md"),
                HOOK.HARNESS_BRANCH,
            )
        )

    def test_allows_protected_edits_on_a_branch_from_current_harness(self) -> None:
        self.assertIsNone(
            self.denial_reason(
                self.edit_event("*** Update File: .agents/skill.md"),
                has_harness_ancestor=True,
            )
        )

    def test_requests_exact_approval_for_protected_edits_off_harness(self) -> None:
        self.assertEqual(
            self.denial_reason(self.edit_event("*** Update File: .codex/hooks.json")),
            "Protected tooling edits outside the current feature/harness lineage require explicit user approval. "
            "Ask the user to reply exactly: APPROVE_PROTECTED_EDIT .codex/hooks.json",
        )

    def test_ignores_application_edits_off_harness(self) -> None:
        self.assertIsNone(self.denial_reason(self.edit_event("*** Update File: src/routes/index.tsx")))

    def test_approval_allows_only_the_named_path_once(self) -> None:
        with tempfile.TemporaryDirectory() as directory, patch.object(HOOK, "STATE_DIR", Path(directory)):
            approval_event = {
                "hook_event_name": "UserPromptSubmit",
                "cwd": str(HOOK.REPO_ROOT),
                "session_id": "session",
                "turn_id": "turn",
                "prompt": "APPROVE_PROTECTED_EDIT .agents/skill.md",
            }
            with patch.object(HOOK, "current_branch", return_value="feat/example"):
                HOOK.capture_approval(approval_event)
                self.assertIsNone(
                    self.denial_reason(
                        self.edit_event("*** Update File: .agents/skill.md")
                    )
                )
                self.assertIsNotNone(
                    self.denial_reason(
                        self.edit_event("*** Update File: .agents/other.md")
                    )
                )

    def test_approval_does_not_cross_branches_or_turns(self) -> None:
        with tempfile.TemporaryDirectory() as directory, patch.object(HOOK, "STATE_DIR", Path(directory)):
            approval_event = {
                "hook_event_name": "UserPromptSubmit",
                "cwd": str(HOOK.REPO_ROOT),
                "session_id": "session",
                "turn_id": "turn",
                "prompt": "APPROVE_PROTECTED_EDIT .eslint/eslint.config.shared.js",
            }
            with patch.object(HOOK, "current_branch", return_value="feat/example"):
                HOOK.capture_approval(approval_event)
            self.assertIsNotNone(
                self.denial_reason(
                    self.edit_event(
                        "*** Update File: .eslint/eslint.config.shared.js",
                        turn_id="later-turn",
                    )
                )
            )
            self.assertIsNotNone(
                self.denial_reason(
                    self.edit_event("*** Update File: .eslint/eslint.config.shared.js"),
                    branch="feat/other",
                )
            )

    def test_detects_a_branch_from_current_harness(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            checkout = Path(directory)
            subprocess.run(
                ["git", "init", "-q", "-b", HOOK.HARNESS_BRANCH, directory],
                check=True,
            )
            for arguments in (
                ("config", "user.email", "hook@example.test"),
                ("config", "user.name", "Hook Test"),
            ):
                subprocess.run(["git", "-C", directory, *arguments], check=True)
            (checkout / "tracked.txt").write_text("base\n", encoding="utf-8")
            for arguments in (
                ("add", "tracked.txt"),
                ("commit", "-qm", "base"),
                ("switch", "-qc", "feat/from-harness"),
            ):
                subprocess.run(["git", "-C", directory, *arguments], check=True)

            self.assertTrue(HOOK.has_current_harness_ancestor(directory))


if __name__ == "__main__":
    unittest.main()
