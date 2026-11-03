import { readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Type } from "typebox";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  acquireRunLock,
  getRunDir,
  loadGraph,
  saveGraph,
  workflowProgress,
} from "./store.ts";
import { correctionGate, deliveryLifecycle, previewGate, renderDeliverySummary } from "./graph.ts";
import { traceDecision } from "./hooks.ts";
import { loadProfile } from "./resources.ts";
import { deliveryCompletions, showDeliveryGraph, stageColors } from "./ui.ts";
import type { Phase, Report, RunState, Status } from "./types.ts";

const text = () => Type.String({ minLength: 1 });
const revision = () =>
  Type.String({ pattern: "^(?:[0-9a-f]{40}|[0-9a-f]{64})$" });
const status = Type.Union([
  Type.Literal("waiting"),
  Type.Literal("running"),
  Type.Literal("completed"),
  Type.Literal("blocked"),
]);
const outcome = Type.Union([
  Type.Literal("passed"),
  Type.Literal("failed"),
  Type.Literal("blocked"),
  Type.Literal("skipped"),
]);
const common = {
  status: Type.Optional(status),
  revision: Type.Optional(revision()),
  summary: Type.Optional(text()),
  blocker: Type.Optional(text()),
  evidence: Type.Optional(Type.Array(text())),
};
const test = Type.Object({
  command: text(),
  outcome,
  artifact: Type.Optional(text()),
  revision: Type.Optional(revision()),
});
const check = Type.Object({
  name: text(),
  kind: Type.Union([
    Type.Literal("automated"),
    Type.Literal("live"),
    Type.Literal("visual"),
  ]),
  outcome,
  command: Type.Optional(text()),
  artifact: Type.Optional(text()),
});
function report<T extends { status?: Status; evidence?: string[] }>(
  input: T,
  initial: Status = "completed",
): T & Report {
  const next = {
    ...input,
    status: input.status ?? initial,
    evidence: input.evidence ?? [],
  };
  if (
    next.status === "blocked" &&
    !("blocker" in input) &&
    !("summary" in input)
  )
    throw new Error("Describe the precise blocker or blocked outcome.");
  return next;
}

export interface DeliveryRuntime {
  activate(issue: number, repo: string, ctx: ExtensionContext): void;
}

export function registerDeliveryRuntime(
  pi: ExtensionAPI,
  runtimeRoot = dirname(fileURLToPath(import.meta.url)),
): DeliveryRuntime {
  let issue: number | undefined;
  let repo: string | undefined;
  let runDir: string;
  let release: (() => void) | undefined;
  let context: ExtensionContext | undefined;
  let state: RunState | undefined;
  let visible = true;
  let toolsRegistered = false;
  const gate = (tool: string, reason: string | undefined) => {
    traceDecision(join(runDir, "hook-events.jsonl"), "report", tool, "delivery-gate", {
      decision: reason ? "block" : "allow", reason: reason ?? "",
    });
    if (reason) throw new Error(reason);
  };
  const roundCap = () => loadProfile(runtimeRoot).maxReviewRounds;
  const capReason = () => correctionGate(getState(), roundCap());
  const getState = () => {
    if (!state) throw new Error("Delivery reports have not initialized.");
    return state;
  };
  const result = (value: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
    details: value,
  });
  const render = () => {
    if (!context?.hasUI || !state) return;
    context.ui.setStatus("command:/delivery toggle", "Delivery graph");
    context.ui.setWidget(
      "delivery",
      visible
        ? (_tui, theme) => ({
            render: (width: number) =>
              state
                ? [
                    theme.bold(
                      theme.fg(
                        stageColors[state.phase],
                        renderDeliverySummary(state, width),
                      ),
                    ),
                  ]
                : [],
            invalidate() {},
          })
        : undefined,
    );
  };
  const save = (phase: Phase, mutate: (next: RunState) => void) => {
    const previous = getState();
    const next = structuredClone(previous);
    next.phase = phase;
    delete next.stopped;
    mutate(next);
    state = saveGraph(runDir, previous, next);
    render();
    return result(state);
  };
  const activate = (
    nextIssue: number,
    nextRepo: string,
    ctx: ExtensionContext,
  ) => {
    if (!Number.isSafeInteger(nextIssue) || nextIssue < 1)
      throw new Error("Issue number must be a positive safe integer.");
    const canonicalRepo = realpathSync(nextRepo);
    if (realpathSync(ctx.cwd) !== canonicalRepo)
      throw new Error(
        "Delivery repository differs from the active working directory.",
      );
    if (state) {
      if (issue !== nextIssue || repo !== canonicalRepo)
        throw new Error(`This session is already delivering issue ${issue}.`);
      context = ctx;
      render();
      return;
    }
    const nextRunDir = getRunDir(canonicalRepo, nextIssue);
    const nextRelease = acquireRunLock(nextRunDir);
    try {
      issue = nextIssue;
      repo = canonicalRepo;
      runDir = nextRunDir;
      release = nextRelease;
      context = ctx;
      state = loadGraph(runDir, repo, issue);
      registerTools();
      render();
    } catch (error) {
      nextRelease();
      issue = undefined;
      repo = undefined;
      release = undefined;
      context = undefined;
      state = undefined;
      throw error;
    }
  };

  pi.on("before_agent_start", (event) => {
    if (!state) return;
    return {
      systemPrompt: `${event.systemPrompt}\n\n${readFileSync(resolve(runtimeRoot, "instructions.md"), "utf8")}`,
      message: {
        customType: "delivery-state",
        content: JSON.stringify(state),
        display: false,
      },
    };
  });
  pi.on("session_shutdown", () => {
    context?.ui.setStatus("command:/delivery toggle", undefined);
    context?.ui.setWidget("delivery", undefined);
    release?.();
    release = undefined;
  });

  const registerTools = () => {
    if (toolsRegistered) return;
    toolsRegistered = true;

    pi.registerTool({
      name: "delivery_status",
      label: "Delivery reports",
      description:
        "Read reported delivery facts and evidence, task dependencies, revision-scoped checks, review history and local preview. Reporting does not certify execution or acceptance.",
      parameters: Type.Object({}),
      async execute() {
        return result(getState());
      },
    });
    pi.registerTool({
      name: "delivery_lifecycle",
      label: "Report delivery lifecycle",
      description:
        "Report delivery actually stopped, resumed, or an MR successfully created in the tracker. Domain blockers during repair/review are not delivery stops. Publication requires a confirmed MR URL and evidence, not an attempt or approval. Saves facts only; never publishes or certifies acceptance.",
      parameters: Type.Object({
        state: Type.Union([
          Type.Literal("active"),
          Type.Literal("blocked"),
          Type.Literal("published"),
        ]),
        blocker: Type.Optional(text()),
        mrUrl: Type.Optional(text()),
        evidence: Type.Optional(Type.Array(text(), { minItems: 1 })),
      }),
      async execute(_id, input) {
        if (input.state !== "active" && !input.evidence?.length)
          throw new Error(
            "Stopped or published delivery needs evidence references.",
          );
        if (input.state === "blocked") {
          if (!input.blocker?.trim())
            throw new Error("Stopped delivery needs its precise blocker.");
          if (deliveryLifecycle(getState()) === "finished")
            throw new Error(
              "Completed local preview is finished; report reopened work before a delivery stop.",
            );
        }
        if (input.state === "published") {
          if (!input.mrUrl || !/^https?:\/\//.test(input.mrUrl))
            throw new Error("Publication needs the confirmed tracker MR URL.");
          new URL(input.mrUrl);
        }
        return save(getState().phase, (next) => {
          if (input.state === "blocked")
            next.stopped = {
              blocker: input.blocker!,
              evidence: input.evidence!,
            };
          if (input.state === "published")
            next.publication = {
              mrUrl: input.mrUrl!,
              evidence: input.evidence!,
            };
        });
      },
    });
    pi.registerTool({
      name: "delivery_preparation",
      label: "Report preparation",
      description:
        "Report baseline/dependency pins and branch preparation already performed with ordinary tools. Saves evidence only; never runs Git or prepares branches.",
      parameters: Type.Object({
        ...common,
        pins: Type.Optional(
          Type.Object({
            productionTag: text(),
            productionBase: revision(),
            featureBase: revision(),
            featureBranch: text(),
            integrationBranch: Type.Optional(text()),
            integrationBase: Type.Optional(revision()),
            harnessRevision: Type.Optional(revision()),
            dependencies: Type.Array(
              Type.Object({ branch: text(), revision: revision() }),
            ),
          }),
        ),
      }),
      async execute(_id, input) {
        const value = report(input);
        if (
          value.status === "completed" &&
          (!value.pins || !value.evidence.length)
        )
          throw new Error(
            "Completed preparation needs pins and evidence references.",
          );
        return save("prepare", (next) => {
          next.preparation = value;
        });
      },
    });
    pi.registerTool({
      name: "delivery_plan",
      label: "Describe delivery plan",
      description:
        "Describe implementation tasks, acceptance expectations, ownership contracts and dependency edges. Implementers own application code AND tests. No dispatch or execution.",
      parameters: Type.Object({
        ...common,
        tasks: Type.Array(
          Type.Object({
            id: Type.String({ pattern: "^[a-zA-Z0-9][a-zA-Z0-9_-]*$" }),
            title: text(),
            acceptance: Type.Array(text(), { minItems: 1 }),
            dependsOn: Type.Array(text()),
            ownedPaths: Type.Optional(Type.Array(text())),
            contract: Type.Optional(text()),
          }),
          { minItems: 1 },
        ),
      }),
      async execute(_id, input) {
        const ids = new Set(input.tasks.map((task) => task.id));
        if (
          ids.size !== input.tasks.length ||
          input.tasks.some((task) =>
            task.dependsOn.some((id) => id === task.id || !ids.has(id)),
          )
        )
          throw new Error(
            "Tasks need unique IDs and dependencies on other described tasks.",
          );
        const { tasks, ...details } = input;
        return save("planning", (next) => {
          next.plan = report(details);
          next.tickets = tasks;
        });
      },
    });
    pi.registerTool({
      name: "delivery_implementation",
      label: "Report implementation",
      description:
        "Report per-task implementation/correction status, native pi-subagents run ID, full revision, summary and test/evidence references. Does not delegate, edit, commit or integrate. Omit agentRunId for direct/historical work; custom SDK sessions are not native run IDs.",
      parameters: Type.Object({
        ...common,
        taskId: text(),
        agentRunId: Type.Optional(text()),
        tests: Type.Optional(Type.Array(test)),
      }),
      async execute(_id, input) {
        if (!getState().tickets.some((task) => task.id === input.taskId))
          throw new Error("Describe the task in delivery_plan first.");
        const value = { ...report(input), tests: input.tests ?? [] };
        if (
          value.status === "completed" &&
          (!value.revision ||
            !(
              value.evidence.length || value.tests.some((test) => test.artifact)
            ))
        )
          throw new Error(
            "Completed implementation needs its revision and evidence.",
          );
        const correcting = workflowProgress(getState()).correctionPending;
        gate("delivery_implementation", capReason());
        return save(correcting ? "corrections" : "building", (next) => {
          next.implementations.push(value);
          if (value.revision) next.head = value.revision;
        });
      },
    });
    pi.registerTool({
      name: "delivery_verification",
      label: "Report verification",
      description:
        "Report automated/live/visual outcomes and evidence for a full checkout revision. Does not run commands or a browser. A completed report requires passing reported checks; the coordinator owns scope and actual acceptance.",
      parameters: Type.Object({
        ...common,
        agentRunId: Type.Optional(text()),
        checks: Type.Array(check),
      }),
      async execute(_id, input) {
        const value = report(input);
        if (!value.revision)
          throw new Error(
            "Verification needs the exact full checkout revision.",
          );
        if (
          value.status === "completed" &&
          (!value.checks.length ||
            value.checks.some(
              (check) => check.outcome !== "passed" || !check.artifact,
            ))
        )
          throw new Error(
            "Completed verification needs passing check outcomes with artifact references.",
          );
        gate("delivery_verification", capReason());
        return save("verification", (next) => {
          next.verifications.push(value);
          next.head = value.revision;
        });
      },
    });
    pi.registerTool({
      name: "delivery_review",
      label: "Report review axis",
      description:
        "Report an independent Standards or Spec review, native run ID, exact revision, verdict and structured finding ledger. Retain resolved/unresolved finding IDs through corrections. Optional round joins explicit axis reports; omitted round groups the next two-axis pass. No reviewer launch or acceptance execution.",
      parameters: Type.Object({
        ...common,
        axis: Type.Union([Type.Literal("standards"), Type.Literal("spec")]),
        agentRunId: Type.Optional(text()),
        round: Type.Optional(Type.Integer({ minimum: 1 })),
        verdict: Type.Union([
          Type.Literal("passed"),
          Type.Literal("changes_requested"),
          Type.Literal("blocked"),
        ]),
        findings: Type.Array(
          Type.Object({
            id: text(),
            severity: Type.Union([
              Type.Literal("T1"),
              Type.Literal("T2"),
              Type.Literal("T3"),
            ]),
            taskId: text(),
            requirement: text(),
            evidence: text(),
            disposition: Type.Optional(
              Type.Union([
                Type.Literal("unresolved"),
                Type.Literal("resolved"),
              ]),
            ),
          }),
        ),
      }),
      async execute(_id, input) {
        const value = report(
          input,
          input.verdict === "blocked" ? "blocked" : "completed",
        );
        if (!value.revision)
          throw new Error("Review needs the exact full reviewed revision.");
        if (
          input.findings.some(
            (finding) =>
              !getState().tickets.some((task) => task.id === finding.taskId),
          )
        )
          throw new Error("Findings must identify a described task.");
        const last = getState().reviews.at(-1);
        const members = getState().reviews.filter(
          (review) => review.round === last?.round,
        );
        const joined =
          last?.revision === input.revision &&
          !members.some((review) => review.axis === input.axis);
        const round =
          input.round ?? (joined ? last!.round : (last?.round ?? 0) + 1);
        gate("delivery_review", capReason() ?? (round > roundCap()
          ? `Review hard cap (${roundCap()} rounds) reached. Report delivery_lifecycle blocked with evidence for the human.`
          : undefined));
        return save("review", (next) => {
          next.reviews.push({
            ...value,
            round,
            findings: input.findings.map((finding) => ({
              ...finding,
              disposition: finding.disposition ?? "unresolved",
            })),
          });
        });
      },
    });
    pi.registerTool({
      name: "delivery_preview",
      label: "Report local preview",
      description:
        "Report an already prepared local MR draft, source/target and reviewed revisions, patch equality/target compatibility and evidence. Does not transfer commits, write the draft, push or create an MR. Reporting is not publication approval.",
      parameters: Type.Object({
        ...common,
        artifact: Type.Optional(text()),
        sourceBranch: Type.Optional(text()),
        targetBranch: Type.Optional(text()),
        reviewedRevision: Type.Optional(revision()),
        targetRevision: Type.Optional(revision()),
        patchEqual: Type.Optional(Type.Boolean()),
        targetCompatible: Type.Optional(Type.Boolean()),
      }),
      async execute(_id, input) {
        const value = report(input);
        if (
          value.status === "completed" &&
          (!value.revision ||
            !value.artifact ||
            !value.sourceBranch ||
            !value.targetBranch ||
            value.patchEqual === false ||
            value.targetCompatible === false)
        )
          throw new Error(
            "Completed preview needs its full source revision, artifact and branches without failed compatibility/equality claims.",
          );
        if (value.status === "completed") {
          gate("delivery_preview", !value.reviewedRevision || value.reviewedRevision !== getState().head
            ? "Completed preview needs the exact current reviewed revision."
            : previewGate(getState(), value.reviewedRevision));
        }
        return save("preview", (next) => {
          next.previews.push(value);
        });
      },
    });
  };

  pi.registerCommand("delivery", {
    description: "Show delivery progress or manage its display/session",
    getArgumentCompletions: deliveryCompletions,
    handler: async (args, ctx) => {
      const action = args.trim() || "graph";
      if (!state) {
        ctx.ui.notify("Start delivery with /deliver issue N first.", "error");
        return;
      }
      if (action === "clear") {
        if (!ctx.isIdle() || !process.send || !process.connected) {
          ctx.ui.notify(
            "Clear requires an idle delivery launched with /deliver issue N. Workers must be stopped.",
            "error",
          );
          return;
        }
        await new Promise<void>((resolve, reject) => {
          process.send!({ type: "delivery-clear" }, (error: Error | null) =>
            error ? reject(error) : resolve(),
          );
        });
        ctx.shutdown();
        return;
      }
      if (action === "exit") {
        ctx.shutdown();
        return;
      }
      if (action === "hide" || action === "show") {
        visible = action === "show";
        render();
        return;
      }
      if (action !== "graph" && action !== "toggle") {
        ctx.ui.notify(
          "Usage: /delivery graph|toggle|hide|show|exit|clear",
          "error",
        );
        return;
      }
      await showDeliveryGraph(ctx, getState, runDir);
    },
  });

  return { activate };
}
