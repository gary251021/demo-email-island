import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  getReviewRequest,
  hasReviewableCodeFileChange,
} from "./request-ponytail-review.mjs";

const hookPath = fileURLToPath(
  new URL("./request-ponytail-review.mjs", import.meta.url),
);

function runHook(event, argument) {
  return execFileSync(
    process.execPath,
    [hookPath, ...(argument ? [argument] : [])],
    {
      encoding: "utf8",
      input: JSON.stringify(event),
    },
  );
}

test("requests one reviewer on the initial Stop", () => {
  const result = getReviewRequest({ stop_hook_active: false }, 1);

  assert.equal(result?.decision, "block");
  assert.match(result?.reason, /agent_type: "reviewer"/);
  assert.match(result?.reason, /project custom agent/);
  assert.match(result?.reason, /do not merely give a default agent/);
  assert.match(result?.reason, /spawn_agent/);
  assert.match(result?.reason, /high-priority recommendation/i);
  assert.match(result?.reason, /follow valid findings by default/i);
  assert.match(
    result?.reason,
    /specific instruction or functional requirement/i,
  );
  assert.match(result?.reason, /Review: changed/);
  assert.match(result?.reason, /Review: unchanged/);
});

test("allows Stop when the turn did not change files", () => {
  assert.equal(getReviewRequest({ stop_hook_active: false }, 0), null);
});

test("allows the Stop continuation to finish", () => {
  assert.equal(getReviewRequest({ stop_hook_active: true }, 1), null);
});

test("stores and enforces the original Stop response", () => {
  const event = {
    session_id: `test-${process.pid}-${Date.now()}`,
    turn_id: "turn",
  };

  runHook(
    {
      ...event,
      tool_input: {
        file_path: ".codex/hooks/request-ponytail-review.mjs",
      },
    },
    "--mark",
  );

  assert.equal(
    JSON.parse(
      runHook({
        ...event,
        last_assistant_message: "Original result",
        stop_hook_active: false,
      }),
    ).decision,
    "block",
  );
  assert.equal(
    JSON.parse(
      runHook({
        ...event,
        last_assistant_message: "Review completed",
        stop_hook_active: true,
      }),
    ).decision,
    "block",
  );
  assert.equal(
    runHook({
      ...event,
      last_assistant_message:
        "Original result\n\nReview: unchanged — no valid finding.",
      stop_hook_active: true,
    }),
    "",
  );
});

test("stops after one failed response-correction attempt", () => {
  const event = {
    session_id: `test-retry-${process.pid}-${Date.now()}`,
    turn_id: "turn",
  };

  runHook(
    {
      ...event,
      tool_input: {
        file_path: ".codex/hooks/request-ponytail-review.mjs",
      },
    },
    "--mark",
  );
  runHook({
    ...event,
    last_assistant_message: "Original result",
    stop_hook_active: false,
  });

  assert.equal(
    JSON.parse(
      runHook({
        ...event,
        last_assistant_message: "Review completed",
        stop_hook_active: true,
      }),
    ).decision,
    "block",
  );
  assert.equal(
    runHook({
      ...event,
      last_assistant_message: "Still not the original result",
      stop_hook_active: true,
    }),
    "",
  );
});

test("requires a changed outcome after review edits production code", () => {
  const event = {
    session_id: `test-changed-${process.pid}-${Date.now()}`,
    turn_id: "turn",
  };

  runHook(
    {
      ...event,
      tool_input: {
        file_path: ".codex/hooks/request-ponytail-review.mjs",
      },
    },
    "--mark",
  );
  runHook({
    ...event,
    last_assistant_message: "Original result",
    stop_hook_active: false,
  });
  runHook(
    {
      ...event,
      tool_input: {
        file_path: ".codex/hooks/request-ponytail-review.mjs",
      },
    },
    "--mark",
  );

  assert.equal(
    JSON.parse(
      runHook({
        ...event,
        last_assistant_message: "Updated result",
        stop_hook_active: true,
      }),
    ).decision,
    "block",
  );
  assert.equal(
    runHook({
      ...event,
      last_assistant_message:
        "Updated result\n\nReview: changed — removed one-use helper.",
      stop_hook_active: true,
    }),
    "",
  );
});

test("skips a review request for test-only edits", () => {
  assert.equal(
    hasReviewableCodeFileChange({
      file_path: ".codex/hooks/request-ponytail-review.test.mjs",
    }),
    false,
  );
});

test("skips a review request for documentation edits", () => {
  assert.equal(
    hasReviewableCodeFileChange({ file_path: "docs/agents/issue-tracker.md" }),
    false,
  );
});

test("skips a review request for code outside the repository", () => {
  assert.equal(
    hasReviewableCodeFileChange({ file_path: "/tmp/example.ts" }),
    false,
  );
});

test("skips a review request for untracked repository code", () => {
  assert.equal(
    hasReviewableCodeFileChange({
      file_path: ".codex/hooks/not-version-controlled.ts",
    }),
    false,
  );
});

test("requests a review for a tracked production code file", () => {
  assert.equal(
    hasReviewableCodeFileChange({
      file_path: ".codex/hooks/request-ponytail-review.mjs",
    }),
    true,
  );
});

test("requests a review when an edit includes a production code file", () => {
  assert.equal(
    hasReviewableCodeFileChange({
      command:
        "*** Update File: .codex/hooks/request-ponytail-review.test.mjs\n*** Update File: .codex/hooks/request-ponytail-review.mjs",
    }),
    true,
  );
});
