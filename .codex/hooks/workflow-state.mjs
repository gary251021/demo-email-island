import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const PROMPT =
  "Use the grilling skill for clarification. Read its SKILL.md and announce its use before asking questions. Follow its question rounds and wait for the user's answers and shared-understanding confirmation before resuming dependent work.";
const scope = fileURLToPath(new URL("..", import.meta.url));

function statePath(sessionId) {
  if (!sessionId) throw new Error("CODEX_SESSION_ID is required.");
  const key = createHash("sha256")
    .update(JSON.stringify([scope, sessionId]))
    .digest("hex");
  return join(tmpdir(), `codex-workflow-state-${key}.json`);
}

function readState(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function saveState(path, value) {
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  });
  renameSync(temporary, path);
}

function setState(path, state, substate) {
  if (!/^[a-z][a-z0-9-]*$/.test(state ?? "")) {
    throw new Error(
      "State must be a lowercase phase name, such as investigation.",
    );
  }
  if (
    !["normal", "need_clarification", "awaiting_approval"].includes(substate)
  ) {
    throw new Error(
      "Substate must be normal, need_clarification or awaiting_approval.",
    );
  }
  const previous = readState(path);
  if (previous?.state === state && previous.substate === substate)
    return previous;
  const next = {
    state,
    substate,
    pendingClarification: substate === "need_clarification",
  };
  saveState(path, next);
  return next;
}

function listen(path) {
  const current = readState(path);
  if (!current?.pendingClarification) return null;
  saveState(path, { ...current, pendingClarification: false });
  return {
    systemMessage: `Workflow: ${current.state} / ${current.substate}`,
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: PROMPT,
    },
  };
}

function run() {
  const [command, state, substate = "normal"] = process.argv.slice(2);
  if (command === "--self-check") {
    const path = statePath(`self-check-${process.pid}-${Date.now()}`);
    try {
      setState(path, "investigation", "normal");
      assert.equal(listen(path), null);
      setState(path, "investigation", "need_clarification");
      assert.equal(listen(path).hookSpecificOutput.additionalContext, PROMPT);
      assert.equal(listen(path), null);
      setState(path, "investigation", "need_clarification");
      assert.equal(listen(path), null);
      setState(path, "alignment", "normal");
      setState(path, "alignment", "need_clarification");
      assert.equal(listen(path).hookSpecificOutput.additionalContext, PROMPT);
      setState(path, "preview", "awaiting_approval");
      assert.equal(listen(path), null);
      assert.throws(() => setState(path, "preview", "need_clarifaication"));
      console.log("Workflow state self-check passed.");
    } finally {
      rmSync(path, { force: true });
    }
    return;
  }
  if (command === "--hook") {
    const event = JSON.parse(readFileSync(0, "utf8"));
    // Only the state writer's completion consumes a notification; worker tools don't.
    if (
      event.hook_event_name !== "PostToolUse" ||
      !event.session_id ||
      !/workflow-state\.mjs["']?\s+set\b/.test(event.tool_input?.command ?? "")
    )
      return;
    const notification = listen(statePath(event.session_id));
    if (notification) console.log(JSON.stringify(notification));
    return;
  }
  const path = statePath(process.env.CODEX_SESSION_ID);
  if (command === "clear") {
    rmSync(path, { force: true });
    console.log(JSON.stringify({ state: null, substate: null }));
    return;
  }
  if (!["set", "show"].includes(command)) {
    throw new Error(
      "Usage: workflow-state.mjs set <state> [substate] | show | clear",
    );
  }
  const current =
    command === "set" ? setState(path, state, substate) : readState(path);
  console.log(
    JSON.stringify({
      state: current?.state ?? null,
      substate: current?.substate ?? null,
    }),
  );
}

try {
  run();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
