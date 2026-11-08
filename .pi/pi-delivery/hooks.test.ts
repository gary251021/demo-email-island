import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { codexInput, runHook, traceDecision, lastHookDecision } from "./hooks.ts";

const repo = resolve(import.meta.dirname, "../..");
const session = `pi-hook-test-${process.pid}-${Date.now()}`;
const event = (name: string, tool_name: string, tool_input: Record<string, unknown>) => ({
  hook_event_name: name, tool_name, tool_input, cwd: repo, session_id: session, turn_id: "turn", stop_hook_active: false,
});
const cleanup: string[] = [];
afterEach(() => { for (const path of cleanup.splice(0)) rmSync(path, { recursive: true, force: true }); });

describe("Codex hook adapter with real scripts", () => {
  it("translates Pi edits into Codex edit payloads", () => {
    expect(codexInput("edit", { path: ".codex/hooks.json", edits: [] })).toMatchObject({ tool_name: "Edit", tool_input: { file_path: ".codex/hooks.json" } });
  });
  it("blocks bad GitLab commands and integration pushes, allows harmless Bash", () => {
    expect(runHook("gitlab", event("PreToolUse", "Bash", { command: "glab issue create --title bad" })).decision).toBe("block");
    expect(runHook("gitlab", event("PreToolUse", "Bash", { command: "echo safe" })).decision).toBe("allow");
    expect(runHook("integration", event("PreToolUse", "Bash", { command: "git push origin local/int/42" })).reason).toContain("must never be pushed");
    expect(runHook("integration", event("PreToolUse", "Bash", { command: "echo safe" })).decision).toBe("allow");
    expect(runHook("integration", event("PreToolUse", "subagent", { task: "ISSUE_IMPL=oops", agent: "worker" })).decision).toBe("block");
    expect(runHook("integration", event("PreToolUse", "subagent", { task: "Review docs", agent: "reviewer", context: "fresh" })).decision).toBe("allow");
  });
  it("injects one feedback reminder from workflow-state after a Bash tool result", () => {
    execFileSync(process.execPath, [resolve(repo, ".codex/hooks/workflow-state.mjs"), "set", "investigation", "awaiting_feedback"], {
      env: { ...process.env, CODEX_SESSION_ID: session }, encoding: "utf8",
    });
    const payload = event("PostToolUse", "Bash", { command: "node .codex/hooks/workflow-state.mjs set investigation awaiting_feedback" });
    expect(runHook("workflow", payload).context).toContain("Propose, don't interview");
    expect(runHook("workflow", payload).decision).toBe("allow");
  });
  it("marks reviewable changes and translates a Stop block", () => {
    const marker = join(tmpdir(), `codex-ponytail-review-${session}-turn`);
    cleanup.push(marker);
    writeFileSync(marker, "");
    expect(runHook("ponytail", event("Stop", "agent", {})).reason).toContain("reviewer");
    expect(runHook("ponytail", event("Stop", "agent", {})).decision).toBe("allow");
    expect(runHook("ponytail", event("PostToolUse", "Edit", { file_path: "docs/notes.md" })).decision).toBe("allow");
  });
  it("checks AGENTS.md budget and lint status without losing script failures", () => {
    expect(runHook("budget", event("PostToolUse", "Edit", { file_path: "src/routes/index.tsx" })).decision).toBe("allow");
    // The budget script only reads the root file when this edit targets it.
    const root = resolve(repo, "AGENTS.md");
    const budget = runHook("budget", event("PostToolUse", "Edit", { command: `*** Update File: ${root}` }));
    expect(budget.decision).toBe("block");
    expect(runHook("lint", event("PostToolUse", "Edit", { file_path: "docs/notes.md" })).decision).toBe("allow");
    expect(runHook("lint", { ...event("PostToolUse", "Edit", { file_path: "src/routes/index.tsx" }), cwd: "/not-a-git-checkout" }).decision).toBe("block");
  });
  it("keeps a chronological trace with the last decision", () => {
    const directory = mkdtempSync(join(tmpdir(), "pi-hook-trace-")); cleanup.push(directory);
    const path = join(directory, "hook-events.jsonl");
    traceDecision(path, "tool_call", "bash", "integration", { decision: "block", reason: "no push" });
    expect(lastHookDecision(directory)).toContain("no push");
  });
});
