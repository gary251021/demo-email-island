import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { getLintHookResponse } from "./lint-changed-file.mjs";

test("injects ESLint warnings on the initial Stop", () => {
  const response = getLintHookResponse({
    isStopHook: true,
    status: 0,
    stdout: "warning  Responsibility budget exceeded",
  });

  assert.equal(response?.decision, "block");
  assert.match(response?.reason ?? "", /Review the reported ESLint warnings/);
  assert.match(
    response?.hookSpecificOutput.additionalContext ?? "",
    /Responsibility budget exceeded/,
  );
});

test("does not inject warnings after the Stop continuation starts", () => {
  const response = getLintHookResponse({
    isStopHook: true,
    status: 0,
    stdout: "warning  Responsibility budget exceeded",
    stopHookActive: true,
  });

  assert.equal(response, undefined);
});

test("keeps PostToolUse warnings advisory and quiet", () => {
  const response = getLintHookResponse({
    isStopHook: false,
    status: 0,
    stdout: "warning  Responsibility budget exceeded",
  });

  assert.equal(response, undefined);
});

test("continues to block ESLint errors during a Stop continuation", () => {
  const response = getLintHookResponse({
    isStopHook: true,
    status: 1,
    stdout: "error  Parsing failed",
    stopHookActive: true,
  });

  assert.equal(response?.decision, "block");
  assert.match(response?.reason ?? "", /Fix every reported ESLint error/);
});

test("Stop lints only this turn's edited files, including on retry", () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "codex-lint-scope-")));
  const hook = fileURLToPath(
    new URL("./lint-changed-file.mjs", import.meta.url),
  );
  const edited = join(root, "edited file.ts");
  const later = join(root, "later.ts");
  const calls = join(root, "calls.jsonl");
  const event = { cwd: root, session_id: "session", turn_id: "turn" };
  const run = (input, stop = false, output = "") =>
    execFileSync(process.execPath, [hook, ...(stop ? ["--stop"] : [])], {
      cwd: root,
      input: JSON.stringify(input),
      encoding: "utf8",
      env: { ...process.env, TMPDIR: root, LINT_OUTPUT: output },
    });
  const invocations = () =>
    readFileSync(calls, "utf8").trim().split("\n").map(JSON.parse);

  try {
    execFileSync("git", ["init", "-q", root]);
    mkdirSync(join(root, "node_modules/.bin"), { recursive: true });
    writeFileSync(
      join(root, "node_modules/.bin/eslint"),
      `#!/usr/bin/env node
require("node:fs").appendFileSync("calls.jsonl", JSON.stringify(process.argv.slice(2)) + "\\n");
process.stdout.write(process.env.LINT_OUTPUT || "");
`,
      { mode: 0o700 },
    );
    writeFileSync(join(root, "unrelated.ts"), "pre-existing dirty file");
    writeFileSync(edited, "edited");
    writeFileSync(later, "later");

    assert.equal(run(event, true), "");
    run({ ...event, tool_input: { file_path: edited } });
    run({ ...event, tool_input: { path: later } });
    assert.equal(invocations().length, 2);
    assert.equal(run({ ...event, turn_id: "another-turn" }, true), "");
    assert.equal(run({ ...event, session_id: "another-session" }, true), "");
    assert.equal(run({ cwd: root }, true), "");
    assert.equal(invocations().length, 2);

    const response = JSON.parse(
      run(event, true, "warning  Review this change"),
    );
    assert.equal(response.decision, "block");
    assert.deepEqual(invocations().at(-1), [
      "--no-warn-ignored",
      edited,
      later,
    ]);
    assert.equal(run({ ...event, stop_hook_active: true }, true), "");
    assert.deepEqual(invocations().at(-1), [
      "--no-warn-ignored",
      edited,
      later,
    ]);
    assert.equal(invocations().length, 4);
    assert.equal(run(event, true), "");
    assert.equal(invocations().length, 4);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
