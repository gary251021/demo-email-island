#!/usr/bin/env python3
"""Tests for the minimal GitLab integration gates."""

from __future__ import annotations

import importlib.util
import io
import json
import subprocess
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch


HOOK_PATH = Path(__file__).with_name("enforce-issue-integration.py")
SPEC = importlib.util.spec_from_file_location("enforce_issue_integration", HOOK_PATH)
assert SPEC is not None and SPEC.loader is not None
HOOK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(HOOK)


class IssueIntegrationHookTest(unittest.TestCase):
    """Cover the task-launch and integration-push interfaces."""

    @staticmethod
    def task_event(
        prompt: str = (
            "Implement issue.\n"
            "Implementation strategy: harness-integration\n"
            "Feature: feat/42-example\n"
            "ISSUE_IMPL=42"
        ),
        *,
        cwd: str = "/tmp/project",
        title: str = "Implementation · #42 · Example",
    ) -> dict[str, object]:
        return {
            "hook_event_name": "PreToolUse",
            "tool_name": "create_thread",
            "tool_input": {
                "prompt": f"{title}\n{prompt}",
                "model": "gpt-6-luna",
            },
            "cwd": cwd,
        }

    @staticmethod
    def denial_reason(event: dict[str, object]) -> str | None:
        output = io.StringIO()
        with redirect_stdout(output), patch.object(HOOK, "validate_worker_dispatch", return_value=None):
            HOOK.handle_pre_tool_use(event)
        if not output.getvalue():
            return None
        payload = json.loads(output.getvalue())
        return payload["hookSpecificOutput"]["permissionDecisionReason"]

    @staticmethod
    def bash_event(command: str) -> dict[str, object]:
        return {
            "hook_event_name": "PreToolUse",
            "tool_name": "Bash",
            "tool_input": {"command": command},
            "cwd": "/tmp/project",
        }

    def launch_reason(
        self,
        event: dict[str, object] | None = None,
        *,
        branch: str = "local/int/42-example",
        harness: str | None = "a" * 40,
        ancestor: bool = True,
        production_reason: str | None = None,
    ) -> str | None:
        with (
            patch.object(HOOK, "current_branch", return_value=branch),
            patch.object(HOOK, "harness_revision", return_value=harness),
            patch.object(HOOK, "harness_is_ancestor", return_value=ancestor),
            patch.object(
                HOOK,
                "validate_production_context",
                return_value=production_reason,
            ),
        ):
            return self.denial_reason(event or self.task_event())

    def test_allows_unmarked_subagent(self) -> None:
        self.assertIsNone(self.launch_reason(self.task_event("Start an unrelated task")))

    def test_implementation_requires_visible_chat(self) -> None:
        for tool in ("spawn_agent", "collaboration.spawn_agent"):
            event = self.task_event()
            event["tool_name"] = tool
            with self.subTest(tool=tool):
                self.assertEqual(self.launch_reason(event), HOOK.VISIBLE_TASK_REASON)

    def test_allows_unmarked_subagent_without_model(self) -> None:
        event = self.task_event("Review documentation")
        event["tool_input"].pop("model", None)
        self.assertIsNone(self.launch_reason(event))

    def test_rejects_malformed_or_duplicate_marker(self) -> None:
        for prompt in (
            "ISSUE_IMPL=abc",
            "ISSUE_IMPL=0",
            "ISSUE_IMPL=42\nISSUE_IMPL=42",
        ):
            with self.subTest(prompt=prompt):
                self.assertEqual(
                    self.launch_reason(self.task_event(prompt)),
                    HOOK.INVALID_MARKER_REASON,
                )

    def test_rejects_wrong_integration_branch(self) -> None:
        self.assertEqual(
            self.launch_reason(branch="local/int/43-example"),
            HOOK.WRONG_BRANCH_REASON,
        )

    def test_rejects_invalid_strategy(self) -> None:
        self.assertEqual(
            self.launch_reason(
                self.task_event(
                    "Implementation strategy: unknown\n"
                    "Feature: feat/42-example\n"
                    "ISSUE_IMPL=42"
                )
            ),
            HOOK.INVALID_STRATEGY_REASON,
        )

    def test_direct_feature_launch_needs_no_harness(self) -> None:
        self.assertIsNone(
            self.launch_reason(
                self.task_event(
                    "Implementation strategy: direct\n"
                    "Feature: feat/42-example\n"
                    "ISSUE_IMPL=42"
                ),
                branch="feat/42-example",
                harness=None,
                ancestor=False,
            )
        )

    def test_rejects_untraceable_implementation_title(self) -> None:
        for title in (
            "Implementation · #43 · Example",
            "Implementation #42 Example",
            "Implementation · #42 · ",
        ):
            with self.subTest(title=title):
                self.assertEqual(
                    self.launch_reason(self.task_event(title=title)),
                    HOOK.INVALID_TITLE_REASON,
                )

    def test_rejects_missing_local_harness(self) -> None:
        self.assertEqual(
            self.launch_reason(harness=None),
            HOOK.MISSING_HARNESS_REASON,
        )

    def test_rejects_integration_without_latest_local_harness(self) -> None:
        self.assertEqual(
            self.launch_reason(ancestor=False),
            HOOK.STALE_HARNESS_REASON,
        )

    def test_allows_valid_local_integration_launch(self) -> None:
        self.assertIsNone(self.launch_reason())

    def test_rejects_launch_without_a_valid_production_tag_base(self) -> None:
        self.assertEqual(
            self.launch_reason(production_reason=HOOK.INVALID_PRODUCTION_BASE_REASON),
            HOOK.INVALID_PRODUCTION_BASE_REASON,
        )

    def test_real_checkout_accepts_pinned_base_after_production_advances(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            checkout = Path(directory)
            self.run_git(checkout, "init")
            self.run_git(checkout, "config", "user.email", "hook@example.test")
            self.run_git(checkout, "config", "user.name", "Hook Test")
            (checkout / "tracked.txt").write_text("base\n", encoding="utf-8")
            self.run_git(checkout, "add", "tracked.txt")
            self.run_git(checkout, "commit", "-m", "base")
            base = self.run_git(checkout, "rev-parse", "HEAD")
            self.run_git(checkout, "tag", "v1.0.0")
            self.run_git(checkout, "branch", "feat/42-example")
            self.run_git(checkout, "branch", HOOK.HARNESS_REF)
            self.run_git(checkout, "switch", "-c", "origin/deploy/prod")
            (checkout / "production.txt").write_text(
                "new production\n", encoding="utf-8"
            )
            self.run_git(checkout, "add", "production.txt")
            self.run_git(checkout, "commit", "-m", "advance production")
            self.run_git(checkout, "switch", "feat/42-example")
            self.run_git(checkout, "switch", "-c", "local/int/42-example")

            event = self.task_event(
                "Implement issue.\n"
                "Implementation strategy: harness-integration\n"
                "Feature: feat/42-example\n"
                "Production tag: v1.0.0\n"
                f"Production base: {base}\n"
                f"Feature base: {base}\n"
                "Dependency refs: None\n"
                "ISSUE_IMPL=42",
                cwd=directory,
            )
            self.assertIsNone(self.denial_reason(event))

            self.run_git(checkout, "switch", HOOK.HARNESS_REF)
            (checkout / "tracked.txt").write_text("new harness\n", encoding="utf-8")
            self.run_git(checkout, "add", "tracked.txt")
            self.run_git(checkout, "commit", "-m", "advance harness")
            self.run_git(checkout, "switch", "local/int/42-example")

            self.assertEqual(
                self.denial_reason(event),
                HOOK.STALE_HARNESS_REASON,
            )

    def test_real_checkout_accepts_an_ordered_dependency(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            checkout = Path(directory)
            self.run_git(checkout, "init")
            self.run_git(checkout, "config", "user.email", "hook@example.test")
            self.run_git(checkout, "config", "user.name", "Hook Test")
            (checkout / "tracked.txt").write_text("base\n", encoding="utf-8")
            self.run_git(checkout, "add", "tracked.txt")
            self.run_git(checkout, "commit", "-m", "base")
            base = self.run_git(checkout, "rev-parse", "HEAD")
            self.run_git(checkout, "tag", "v1.0.0")
            self.run_git(checkout, "branch", HOOK.HARNESS_REF)
            self.run_git(checkout, "switch", "-c", "fix/21-dependency")
            (checkout / "dependency.txt").write_text(
                "dependency\n", encoding="utf-8"
            )
            self.run_git(checkout, "add", "dependency.txt")
            self.run_git(checkout, "commit", "-m", "dependency")
            dependency = self.run_git(checkout, "rev-parse", "HEAD")
            self.run_git(checkout, "branch", "feat/42-example")
            self.run_git(checkout, "switch", "-c", "local/int/42-example")

            event = self.task_event(
                "Implement issue.\n"
                "Implementation strategy: harness-integration\n"
                "Feature: feat/42-example\n"
                "Production tag: v1.0.0\n"
                f"Production base: {base}\n"
                f"Feature base: {dependency}\n"
                f"Dependency refs: fix/21-dependency:{dependency}\n"
                "ISSUE_IMPL=42",
                cwd=directory,
            )
            self.assertIsNone(self.denial_reason(event))

            invalid_event = self.task_event(
                event["tool_input"]["prompt"].replace(
                    "fix/21-dependency:", f"{HOOK.HARNESS_REF}:"
                ),
                cwd=directory,
            )
            self.assertEqual(
                self.denial_reason(invalid_event),
                HOOK.INVALID_PRODUCTION_BASE_REASON,
            )

    def test_rejects_push_from_integration_branch(self) -> None:
        with patch.object(
            HOOK,
            "current_branch",
            return_value="local/int/42-example",
        ):
            self.assertEqual(
                self.denial_reason(self.bash_event("git push origin HEAD")),
                HOOK.INTEGRATION_PUSH_REASON,
            )

    def test_rejects_explicit_integration_refspec(self) -> None:
        with patch.object(HOOK, "current_branch", return_value="deploy/dev"):
            self.assertEqual(
                self.denial_reason(
                    self.bash_event("git push origin local/int/42-example")
                ),
                HOOK.INTEGRATION_PUSH_REASON,
            )

    def test_rejects_push_all_when_integration_refs_exist(self) -> None:
        with (
            patch.object(HOOK, "current_branch", return_value="deploy/dev"),
            patch.object(HOOK, "has_local_integration_refs", return_value=True),
        ):
            self.assertEqual(
                self.denial_reason(self.bash_event("git push --all origin")),
                HOOK.INTEGRATION_PUSH_REASON,
            )

    def test_allows_feature_push(self) -> None:
        with patch.object(
            HOOK,
            "current_branch",
            return_value="feat/42-example",
        ):
            self.assertIsNone(
                self.denial_reason(self.bash_event("git push origin HEAD"))
            )

    @staticmethod
    def run_git(checkout: Path, *arguments: str) -> str:
        """Run a required Git setup command for a real-checkout test."""
        result = subprocess.run(
            ["git", "-C", str(checkout), *arguments],
            check=True,
            capture_output=True,
            text=True,
        )
        return result.stdout.strip()


if __name__ == "__main__":
    unittest.main()
