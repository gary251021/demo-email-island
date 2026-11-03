#!/usr/bin/env python3

import importlib.util
import io
import json
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch


HOOK_PATH = Path(__file__).with_name("enforce-gitlab-guardrails.py")
SPEC = importlib.util.spec_from_file_location("enforce_gitlab_guardrails", HOOK_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Unable to load hook from {HOOK_PATH}")

HOOK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(HOOK)


class GitLabGuardrailsTest(unittest.TestCase):
    def run_hook(
        self,
        command: str,
        *,
        is_origin_project: bool = True,
    ) -> dict[str, object] | None:
        event = {
            "tool_name": "Bash",
            "tool_input": {"command": command},
            "cwd": str(HOOK.REPO_ROOT),
        }
        output = io.StringIO()
        with (
            patch.object(HOOK, "is_origin_project", return_value=is_origin_project),
            patch.object(HOOK.sys, "stdin", io.StringIO(json.dumps(event))),
            redirect_stdout(output),
        ):
            HOOK.main()

        result = output.getvalue().strip()
        return json.loads(result) if result else None

    def denial_reason(self, command: str, **kwargs: bool) -> str | None:
        result = self.run_hook(command, **kwargs)
        if result is None:
            return None
        return result["hookSpecificOutput"]["permissionDecisionReason"]

    def test_rejects_glab_outside_origin_project(self) -> None:
        self.assertEqual(
            self.denial_reason("glab issue list", is_origin_project=False),
            HOOK.WRONG_PROJECT_CONTEXT_REASON,
        )

    def test_rejects_commands_that_change_repository_context(self) -> None:
        self.assertEqual(
            self.denial_reason("cd /tmp && glab issue list"),
            HOOK.CONTEXT_CHANGE_REASON,
        )

    def test_rejects_explicit_other_repository(self) -> None:
        self.assertEqual(
            self.denial_reason("glab issue list --repo other/project"),
            HOOK.WRONG_EXPLICIT_PROJECT_REASON,
        )

    def test_rejects_api_call_without_origin_project(self) -> None:
        self.assertEqual(
            self.denial_reason("glab api projects/other%2Fproject/issues"),
            HOOK.WRONG_API_PROJECT_REASON,
        )

    def test_allows_api_call_for_encoded_origin_project(self) -> None:
        self.assertIsNone(
            self.run_hook(
                "glab api "
                f"projects/{HOOK.EXPECTED_PROJECT.replace('/', '%2F')}/issues/6"
            )
        )

    def test_accepts_one_scope_in_long_title_option(self) -> None:
        command = (
            'glab issue create --title "[Location] Fix unmatched history" '
            '--label ai-agent'
        )

        self.assertEqual(
            HOOK.issue_create_titles(command),
            ["[Location] Fix unmatched history"],
        )
        self.assertIsNone(self.run_hook(command))

    def test_accepts_multiple_scopes_in_short_title_option(self) -> None:
        command = (
            "glab issue create -t='[Location][Accessibility] Fix history' "
            "--label ai-agent"
        )

        self.assertEqual(
            HOOK.issue_create_titles(command),
            ["[Location][Accessibility] Fix history"],
        )
        self.assertIsNone(self.run_hook(command))

    def test_accepts_non_empty_brackets_anywhere_in_title(self) -> None:
        self.assertTrue(HOOK.has_scoped_issue_title("Fix [Location] history"))

    def test_rejects_title_without_scope(self) -> None:
        self.assertEqual(
            self.denial_reason(
                'glab issue create --title "Fix unmatched history" --label ai-agent'
            ),
            HOOK.MISSING_TITLE_SCOPE_REASON,
        )

    def test_rejects_empty_or_whitespace_only_brackets(self) -> None:
        self.assertFalse(HOOK.has_scoped_issue_title("[] Fix unmatched history"))
        self.assertFalse(HOOK.has_scoped_issue_title("[   ] Fix unmatched history"))

    def test_does_not_use_description_brackets_as_title_scope(self) -> None:
        command = (
            'glab issue create --title "Fix unmatched history" '
            '--description "Handle [Location] rows" --label ai-agent'
        )

        self.assertEqual(HOOK.issue_create_titles(command), ["Fix unmatched history"])
        self.assertEqual(
            self.denial_reason(command),
            HOOK.MISSING_TITLE_SCOPE_REASON,
        )

    def test_rejects_issue_without_ownership_label(self) -> None:
        self.assertEqual(
            self.denial_reason(
                'glab issue create --title "[Location] Fix unmatched history"'
            ),
            HOOK.MISSING_OWNERSHIP_LABEL_REASON,
        )

    def test_ignores_creation_text_inside_another_command_argument(self) -> None:
        command = "rg 'glab issue create --title example' .codex"

        self.assertEqual(HOOK.issue_create_titles(command), [])
        self.assertIsNone(self.run_hook(command))

    def test_rejects_non_release_merge_request_to_production(self) -> None:
        self.assertEqual(
            self.denial_reason(
                "glab mr create --source-branch feat/issue-42-example "
                "--target-branch deploy/prod"
            ),
            HOOK.INVALID_PRODUCTION_MR_SOURCE_REASON,
        )

    def test_allows_release_merge_request_to_production(self) -> None:
        self.assertIsNone(
            self.run_hook(
                "glab mr create --source-branch release/v1.2.0 "
                "--target-branch deploy/prod"
            )
        )

    def test_allows_feature_merge_request_to_development(self) -> None:
        self.assertIsNone(
            self.run_hook(
                "glab mr create --source-branch feat/issue-42-example "
                "--target-branch deploy/dev"
            )
        )


if __name__ == "__main__":
    unittest.main()
