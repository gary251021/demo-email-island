import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { deliveryLifecycle, nextDeliveryStep } from "./graph.ts";
import { getRunDir, loadGraph } from "./store.ts";
import { loadProfile } from "./resources.ts";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const scripts = {
  gitlab: ".codex/hooks/enforce-gitlab-guardrails.py",
  integration: ".codex/hooks/enforce-issue-integration.py",
  workflow: ".codex/hooks/workflow-state.mjs",
  ponytail: ".codex/hooks/request-ponytail-review.mjs",
  overdefensive: ".codex/hooks/check-overdefensive.mjs",
  overdefensiveDocs: ".codex/hooks/check-overdefensive.mjs",
  budget: ".agents/scripts/checkAgentsMdSize.mjs",
  lint: ".codex/hooks/lint-changed-file.mjs",
  impeccable: ".agents/skills/impeccable/scripts/hook.mjs",
} as const;
export type HookScript = keyof typeof scripts;
export type HookDecision = { decision: "allow" | "block" | "context"; reason: string; context?: string };

function deliveryDir(ctx: ExtensionContext): string | undefined {
  const activation = ctx.sessionManager.getBranch().findLast((entry) =>
    entry.type === "custom" && entry.customType === "delivery-activation"
  );
  const data = activation?.type === "custom" ? activation.data : undefined;
  const active = data && typeof data === "object" ? data as { issue?: number; repo?: string } : undefined;
  const cwd = realpathSync(ctx.cwd);
  const issue = active?.issue ?? (process.env.PI_DELIVERY_REPO === cwd
    ? Number(process.env.PI_DELIVERY_ISSUE) : undefined);
  if (!Number.isSafeInteger(issue) || !issue || issue < 1 || (active?.repo && active.repo !== cwd)) return;
  return getRunDir(ctx.cwd, issue);
}

export function tracePath(ctx: ExtensionContext): string {
  const runDir = deliveryDir(ctx);
  if (runDir) return join(runDir, "hook-events.jsonl");
  const id = ctx.sessionManager.getSessionId();
  return join(tmpdir(), `pi-hooks-${createHash("sha256").update(id).digest("hex")}.jsonl`);
}

export function traceDecision(path: string, event: string, tool: string, script: string, decision: HookDecision): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  appendFileSync(path, JSON.stringify({ timestamp: new Date().toISOString(), event, tool, script, decision: decision.decision, reason: decision.reason }) + "\n", { mode: 0o600 });
}

export function lastHookDecision(runDir: string): string | undefined {
  try {
    const lines = readFileSync(join(runDir, "hook-events.jsonl"), "utf8").trim().split("\n");
    const last = JSON.parse(lines.at(-1)!) as { event: string; tool: string; script: string; decision: string; reason: string };
    return `${last.event} ${last.tool} / ${last.script}: ${last.decision}${last.reason ? ` (${last.reason})` : ""}`;
  } catch { return; }
}

/** Translate one Codex hook invocation. Script exit failures fail closed, rather than silently dropping a guardrail. */
export function runHook(script: HookScript, event: Record<string, unknown>): HookDecision {
  const file = resolve(repo, scripts[script]);
  const args = script === "workflow" ? ["--hook"] : script === "overdefensiveDocs" ? ["--document"] : (script === "ponytail" || script === "overdefensive") && event.hook_event_name === "PostToolUse" ? ["--mark"]
    : script === "budget" ? ["--hook"] : script === "lint" && event.hook_event_name === "Stop" ? ["--stop"] : [];
  const runner = file.endsWith(".py") ? "python3" : process.execPath;
  const output = spawnSync(runner, [file, ...args], {
    cwd: repo, input: JSON.stringify(event), encoding: "utf8",
    timeout: script === "lint" || (script === "impeccable" && event.hook_event_name === "Stop") ? 30_000
      : script === "overdefensive" && event.hook_event_name === "Stop" ? 15_000
      : script === "integration" || script === "gitlab" ? 10_000
      : script === "workflow" ? 3_000 : 5_000,
    env: { ...process.env, CODEX_SESSION_ID: String(event.session_id) },
  });
  if (output.error || output.status !== 0)
    return { decision: "block", reason: `${scripts[script]} failed: ${output.error?.message ?? output.stderr?.trim() ?? `exit ${output.status}`}` };
  const text = output.stdout?.trim();
  if (!text) return { decision: "allow", reason: "" };
  try {
    const response = JSON.parse(text) as { decision?: string; reason?: string; hookSpecificOutput?: { permissionDecision?: string; permissionDecisionReason?: string; additionalContext?: string } };
    const reason = response.reason ?? response.hookSpecificOutput?.permissionDecisionReason ?? "";
    const context = response.hookSpecificOutput?.additionalContext;
    if (response.decision === "block" || response.hookSpecificOutput?.permissionDecision === "deny")
      return { decision: "block", reason: reason || `${scripts[script]} denied the operation`, context };
    if (context) return { decision: "context", reason: reason || context, context };
    return { decision: "allow", reason: "" };
  } catch {
    // Some post-edit checks write a plain acknowledgment; stderr/status are the gate.
    return { decision: "allow", reason: "" };
  }
}

/** Codex scripts expect one path per edit. A Pi edit can contain several replacements of one file. */
export function codexInput(tool: string, input: Record<string, unknown>): { tool_name: string; tool_input: Record<string, unknown> } {
  if (tool === "bash") return { tool_name: "Bash", tool_input: input };
  if (tool === "edit" || tool === "write")
    return { tool_name: tool === "edit" ? "Edit" : "Write", tool_input: {
      ...input, file_path: input.path,
      // The Codex budget hook only inspects apply_patch headers.
      command: typeof input.path === "string" ? `*** Update File: ${input.path}` : undefined,
    } };
  if (tool === "apply_patch") return { tool_name: "apply_patch", tool_input: { ...input, command: input.command ?? input.patch ?? input.input } };
  return { tool_name: tool, tool_input: input };
}

const editTools = new Set(["edit", "write", "apply_patch"]);

export default function registerHooks(pi: ExtensionAPI): void {
  let turn = randomUUID();
  let stopActive = false;
  let lastMessage = "";
  let remindedRevision = -1;
  let rawPrompt: string | undefined;
  const previousCodexSessionId = process.env.CODEX_SESSION_ID;
  pi.on("session_start", (_event, ctx) => {
    // The workflow-state CLI invoked from Pi Bash uses this same key as its PostToolUse hook.
    process.env.CODEX_SESSION_ID = ctx.sessionManager.getSessionId();
  });
  pi.on("session_shutdown", () => {
    if (previousCodexSessionId === undefined) delete process.env.CODEX_SESSION_ID;
    else process.env.CODEX_SESSION_ID = previousCodexSessionId;
  });
  const base = (ctx: ExtensionContext, hook_event_name: string) => ({
    hook_event_name, cwd: ctx.cwd, session_id: ctx.sessionManager.getSessionId(), turn_id: turn,
    stop_hook_active: stopActive, last_assistant_message: lastMessage,
  });
  const invoke = (script: HookScript, event: Record<string, unknown>, ctx: ExtensionContext, tool: string): HookDecision => {
    const decision = runHook(script, event);
    traceDecision(tracePath(ctx), String(event.hook_event_name), tool, scripts[script], decision);
    return decision;
  };
  pi.on("input", (event, ctx) => {
    if (event.source === "extension") return;
    turn = randomUUID();
    stopActive = false;
    rawPrompt = event.text;
  });
  pi.on("before_agent_start", (event, ctx) => {
    if (event.messageType !== "user" || !event.prompt) return;
    if (event.prompt === rawPrompt) { rawPrompt = undefined; return; }
    // sendUserMessage (including /deliver) can bypass the raw input event.
    turn = randomUUID();
    stopActive = false;
  });
  pi.on("tool_call", (event, ctx) => {
    const mapped = codexInput(event.toolName, event.input);
    const payload = { ...base(ctx, "PreToolUse"), ...mapped, delivery_active: !!deliveryDir(ctx) };
    const scriptsToRun: HookScript[] = event.toolName === "bash" ? ["gitlab", "integration"]
      : event.toolName === "subagent" ? ["integration"] : [];
    for (const script of scriptsToRun) {
      const decision = invoke(script, payload, ctx, event.toolName);
      if (decision.decision === "block") return { block: true, reason: decision.reason };
    }
  });
  pi.on("tool_result", (event, ctx) => {
    if (event.isError) return;
    const mapped = codexInput(event.toolName, event.input);
    const payload = { ...base(ctx, "PostToolUse"), ...mapped };
    const scriptsToRun: HookScript[] = editTools.has(event.toolName) ? ["ponytail", "overdefensive", "overdefensiveDocs", "budget", "lint", "impeccable"]
      : event.toolName === "bash" ? ["workflow"] : [];
    const notes: string[] = [];
    for (const script of scriptsToRun) {
      const decision = invoke(script, payload, ctx, event.toolName);
      if (decision.decision !== "allow") notes.push(decision.context ?? decision.reason);
    }
    if (notes.length) return { content: [...event.content, { type: "text" as const, text: `Hook checks:\n${notes.join("\n\n")}` }] };
  });
  pi.on("turn_end", (event) => {
    if (event.message.role === "assistant")
      lastMessage = event.message.content.filter((item) => item.type === "text").map((item) => item.text).join("\n");
  });
  pi.on("agent_before_settle", (event, ctx) => {
    if (event.continue || event.outcome !== "completed") return;
    const payload = { ...base(ctx, "Stop") };
    const notes: string[] = [];
    for (const script of ["lint", "overdefensive", "impeccable", "ponytail"] as const) {
      const decision = invoke(script, payload, ctx, "agent");
      if (decision.decision !== "allow") notes.push(decision.context ?? decision.reason);
    }
    const runDir = deliveryDir(ctx);
    if (runDir) {
      const graph = loadGraph(runDir, ctx.cwd, Number(runDir.match(/issue-(\d+)$/)?.[1]));
      if (deliveryLifecycle(graph) === "active" && graph.revision !== remindedRevision) {
        remindedRevision = graph.revision; // A follow-up without new reports must not loop forever.
        const reason = nextDeliveryStep(graph, loadProfile(resolve(repo, ".pi/pi-delivery")).maxReviewRounds);
        traceDecision(tracePath(ctx), "agent_before_settle", "delivery", "delivery-next-step", { decision: "block", reason });
        notes.push(reason);
      }
    }
    if (!notes.length) return;
    stopActive = true;
    return { entries: [...event.entries, { type: "custom_message" as const, customType: "pi-hook-follow-up", content: notes.join("\n\n"), display: true }], continue: true };
  });
}
