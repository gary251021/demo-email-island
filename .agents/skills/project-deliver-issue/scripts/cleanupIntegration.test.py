"""Exercise installation and cleanup against disposable Git repositories."""

import importlib.util
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


SPEC = importlib.util.spec_from_file_location(
    "cleanup", Path(__file__).with_name("cleanupIntegration.py")
)
HOOK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(HOOK)


class CleanupTest(unittest.TestCase):
    def test_install_preserves_existing_hooks_and_is_presence_only(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / ".codex").mkdir()
            path = root / ".codex/hooks.json"
            original = {"hooks": {"Stop": [{"hooks": [{"command": "existing"}]}]}}
            path.write_text(json.dumps(original))
            self.assertTrue(HOOK.install(root))
            installed = path.read_bytes()
            self.assertFalse(HOOK.install(root))
            self.assertEqual(installed, path.read_bytes())
            self.assertEqual(json.loads(installed)["hooks"]["Stop"], original["hooks"]["Stop"])

    def test_only_successful_explicit_source_creation_triggers_cleanup(self):
        event = {"hook_event_name": "PostToolUse", "tool_name": "Bash", "cwd": "/tmp",
                 "tool_input": {"command": "glab mr create --source-branch fix/42-example"},
                 "tool_response": {"exit_code": 0, "output": "created"}}
        with patch.object(HOOK, "cleanup", return_value="deleted") as cleanup:
            self.assertEqual(HOOK.handle(event), "deleted")
            cleanup.assert_called_once_with("/tmp", "fix/42-example", "created")
            for response in ({"exit_code": 1}, {}, "Process exited with code 1"):
                cleanup.reset_mock()
                event["tool_response"] = response
                self.assertIsNone(HOOK.handle(event))
                cleanup.assert_not_called()
        for command in ("glab issue create", "echo glab mr create --source-branch fix/42-example",
                        "glab mr create", "glab mr create -R other/repo -s fix/42-example",
                        "glab mr create -s fix/42-example --title example; true",
                        "glab mr create -s fix/42-example\ntrue"):
            self.assertIsNone(HOOK.creation_source(command))

    def test_retains_untransferred_checked_out_or_unpublished_branch_then_deletes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            def git(*args):
                return HOOK.run(directory, "git", *args)

            git("init", "-b", "main")
            git("config", "user.email", "test@example.test")
            git("config", "user.name", "Test")
            git("remote", "add", "origin", "https://example.test/project.git")
            (root / "base").write_text("base")
            git("add", ".")
            git("commit", "-m", "base")
            git("branch", "fix/42-example")
            git("switch", "-c", "feature/harness")
            (root / "harness").write_text("harness")
            git("add", ".")
            git("commit", "-m", "harness")
            git("switch", "-c", "local/int/42-example")
            (root / "issue").write_text("issue")
            git("add", ".")
            git("commit", "-m", "issue")
            issue = git("rev-parse", "HEAD")
            git("branch", "local/int/43-unrelated")
            git("switch", "fix/42-example")
            url = "https://example.test/project/-/merge_requests/7"
            mr = {"source_branch": "fix/42-example", "sha": git("rev-parse", "HEAD"),
                  "web_url": url, "source_project_id": 1, "target_project_id": 1}
            original_run = HOOK.run
            def run(cwd, *args):
                return json.dumps(mr) if args[0] == "glab" else original_run(cwd, *args)

            with patch.object(HOOK, "run", side_effect=run):
                self.assertIn("not all transferred", HOOK.cleanup(directory, "fix/42-example", url))
                git("cherry-pick", issue)
                self.assertIn("does not confirm", HOOK.cleanup(directory, "fix/42-example", url))
                mr["sha"] = git("rev-parse", "HEAD")
                git("worktree", "add", str(root / "worker"), "local/int/42-example")
                self.assertIn("checked out", HOOK.cleanup(directory, "fix/42-example", url))
                git("worktree", "remove", str(root / "worker"))
                self.assertIn("Deleted", HOOK.cleanup(directory, "fix/42-example", url))
                self.assertIsNone(HOOK.cleanup(directory, "fix/42-example", url))
                self.assertTrue(git("rev-parse", "refs/heads/local/int/43-unrelated"))


if __name__ == "__main__":
    unittest.main()
