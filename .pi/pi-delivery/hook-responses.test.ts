import { describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import { runHook, type HookScript } from "./hooks.ts";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
  execFileSync: vi.fn(),
}));
const scripts: HookScript[] = ["approval", "gitlab", "integration", "workflow", "ponytail", "budget", "lint", "impeccable"];

describe("hook protocol translation", () => {
  it.each(scripts)("maps block/allow and records the correct command for %s", (script) => {
    const spawn = vi.mocked(spawnSync);
    spawn.mockReturnValueOnce({ status: 0, stdout: JSON.stringify({ decision: "block", reason: "Denied" }), stderr: "" } as ReturnType<typeof spawnSync>);
    expect(runHook(script, { hook_event_name: "Stop", session_id: "s" })).toEqual({ decision: "block", reason: "Denied", context: undefined });
    expect(spawn.mock.lastCall?.[1]?.[0]).toContain(script === "impeccable" ? "hook.mjs" : script === "approval" ? "require-harness-managed-edit-approval.py" : script === "gitlab" ? "enforce-gitlab-guardrails.py" : script === "integration" ? "enforce-issue-integration.py" : script === "workflow" ? "workflow-state.mjs" : script === "ponytail" ? "request-ponytail-review.mjs" : script === "budget" ? "checkAgentsMdSize.mjs" : "lint-changed-file.mjs");
    spawn.mockReturnValueOnce({ status: 0, stdout: "", stderr: "" } as ReturnType<typeof spawnSync>);
    expect(runHook(script, { hook_event_name: "Stop", session_id: "s" }).decision).toBe("allow");
  });
  it("maps Codex denies and additional context into Pi follow-ups", () => {
    const spawn = vi.mocked(spawnSync);
    spawn.mockReturnValueOnce({ status: 0, stdout: JSON.stringify({ hookSpecificOutput: { permissionDecision: "deny", permissionDecisionReason: "No" } }), stderr: "" } as ReturnType<typeof spawnSync>);
    expect(runHook("approval", {}).decision).toBe("block");
    spawn.mockReturnValueOnce({ status: 0, stdout: JSON.stringify({ hookSpecificOutput: { additionalContext: "Check this UI" } }), stderr: "" } as ReturnType<typeof spawnSync>);
    expect(runHook("impeccable", {}).context).toBe("Check this UI");
    spawn.mockReturnValueOnce({ status: 2, stdout: "", stderr: "failure" } as ReturnType<typeof spawnSync>);
    expect(runHook("budget", {}).decision).toBe("block");
  });
});
