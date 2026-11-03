import { execFileSync } from "node:child_process";
import { workflowProgress } from "./store.ts";
import type { Finding, Phase, Report, RunState } from "./types.ts";

type Mark = "x" | ">" | "." | "!" | "~";
function clip(text: string, width: number): string {
  const plain = text.replace(/[^\x20-\x7e]/g, "?");
  return plain.length <= width
    ? plain
    : width < 4
      ? plain.slice(0, width)
      : `${plain.slice(0, width - 3)}...`;
}
function mark(report?: Report, currentRevision?: string): Mark {
  if (!report) return ".";
  if (currentRevision && report.revision && report.revision !== currentRevision)
    return "~";
  return { waiting: ".", running: ">", completed: "x", blocked: "!" }[
    report.status
  ] as Mark;
}
function node(symbol: Mark, label: string): string {
  return `[${symbol}] ${label}`;
}
function latestTasks(state: RunState) {
  return state.tickets.map((task) => ({
    task,
    report: state.implementations.findLast(
      (report) => report.taskId === task.id,
    ),
  }));
}
export function findingLedger(state: RunState): Finding[] {
  const ledger = new Map<string, Finding>();
  for (const review of state.reviews)
    for (const finding of review.findings)
      ledger.set(`${review.axis}:${finding.id}`, finding);
  return [...ledger.values()];
}
export function completedReviewRounds(state: RunState): number {
  return new Set(state.reviews.map((review) => review.round)).size === 0 ? 0 :
    [...new Set(state.reviews.map((review) => review.round))].filter((round) => {
      const standards = state.reviews.findLast((entry) => entry.round === round && entry.axis === "standards");
      const spec = state.reviews.findLast((entry) => entry.round === round && entry.axis === "spec");
      return standards?.status === "completed" && spec?.status === "completed" &&
        standards.verdict !== "blocked" && spec.verdict !== "blocked" && standards.revision === spec.revision;
    }).length;
}

export function correctionGate(state: RunState, maxReviewRounds: number): string | undefined {
  if (completedReviewRounds(state) < maxReviewRounds) return;
  return `Review hard cap (${maxReviewRounds} completed rounds) reached. Report delivery_lifecycle blocked with evidence for the human.`;
}

export function previewGate(state: RunState, revision: string | undefined): string | undefined {
  if (!revision || revision !== state.head) return "Preview must name the current reviewed revision.";
  const open = findingLedger(state).filter((finding) => finding.disposition === "unresolved");
  if (open.some((finding) => finding.severity === "T1" || finding.severity === "T2"))
    return "Resolve all T1/T2 findings in the review ledger before preview.";
  const verification = state.verifications.findLast((entry) => entry.revision === revision);
  if (verification?.status !== "completed" || !verification.checks.length ||
      verification.checks.some((check) => check.outcome !== "passed" || !check.artifact))
    return `Passing verification missing for ${revision}.`;
  const axes = (["standards", "spec"] as const).map((axis) => state.reviews.findLast((entry) => entry.axis === axis));
  if (axes.some((entry) => entry?.revision !== revision || entry.status !== "completed" || entry.verdict === "blocked") ||
      axes[0]?.round !== axes[1]?.round)
    return `Completed Standards and Spec reviews missing for ${revision} in the same round.`;
  if (axes.some((entry) => entry?.verdict === "changes_requested" && !open.length))
    return "A changes-requested review needs a resolved follow-up verdict.";
  if (open.some((finding) => finding.severity === "T3") && completedReviewRounds(state) < 5)
    return "T3 findings require correction until five completed review rounds.";
  return;
}

export function nextDeliveryStep(state: RunState, maxReviewRounds?: number): string {
  if (maxReviewRounds && correctionGate(state, maxReviewRounds) &&
      state.head && previewGate(state, state.head))
    return `Delivery active: ${correctionGate(state, maxReviewRounds)}`;
  if (state.preparation?.status !== "completed") return "Delivery active: complete preparation and pin its evidence.";
  if (state.plan?.status !== "completed") return "Delivery active: complete the task plan.";
  if (state.tickets.some((task) => state.implementations.findLast((entry) => entry.taskId === task.id)?.status !== "completed"))
    return "Delivery active: complete the outstanding implementation tasks.";
  if (!state.head) return "Delivery active: report the implemented checkout revision.";
  const gate = previewGate(state, state.head);
  return gate ? `Delivery active: ${gate}` : "Delivery active: complete and report the local MR preview.";
}

export function deliveryLifecycle(
  state: RunState,
): "active" | "blocked" | "finished" | "published" {
  if (state.publication) return "published";
  const preview = state.previews.at(-1);
  if (
    state.phase === "preview" &&
    preview?.status === "completed" &&
    (!preview.reviewedRevision || preview.reviewedRevision === state.head)
  )
    return "finished";
  return state.stopped ? "blocked" : "active";
}

export function checkoutBranch(repo: string): string {
  try {
    const branch = execFileSync(
      "git",
      ["-C", repo, "rev-parse", "--abbrev-ref", "HEAD"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    ).trim();
    return branch === "HEAD" ? "detached HEAD" : branch;
  } catch {
    return "unavailable";
  }
}

export function renderDeliverySummary(state: RunState, width = 80): string {
  const lifecycle = deliveryLifecycle(state);
  const workflow = workflowProgress(state);
  const stage = `${state.phase.toUpperCase()}${state.phase === "corrections" ? ` #${workflow.feedbackCycles.length}` : ""}`;
  return clip(
    `DELIVERY #${state.issue} | round: ${workflow.round} | stage: ${stage} | branch: ${checkoutBranch(state.repo)}${lifecycle === "active" ? "" : ` | ${lifecycle.toUpperCase()}`}`,
    Math.max(1, Math.floor(width)),
  );
}

/** Independent projection of domain reports; no execution or certification. */
export function renderDeliveryGraph(
  state: RunState,
  width = 80,
  compact = false,
  colorStage?: (phase: Phase, label: string) => string,
  lastDecision?: string,
): string[] {
  const tasks = latestTasks(state);
  const verification = state.verifications.at(-1);
  const round = state.reviews.at(-1)?.round;
  const reviews = ["standards", "spec"].map((axis) =>
    state.reviews.findLast(
      (report) => report.round === round && report.axis === axis,
    ),
  );
  const open = findingLedger(state).filter(
    (finding) => finding.disposition === "unresolved",
  );
  const completedRounds = completedReviewRounds(state);
  const preview = state.previews.at(-1);
  const stages: Record<Phase, Mark> = {
    prepare: mark(state.preparation),
    planning: mark(state.plan),
    building:
      tasks.length && tasks.every((task) => task.report?.status === "completed")
        ? "x"
        : tasks.some((task) => task.report?.status === "blocked")
          ? "!"
          : state.phase === "building"
            ? ">"
            : ".",
    verification:
      verification?.revision !== state.head && verification
        ? "~"
        : verification?.checks.some(
              (check) =>
                check.outcome === "failed" || check.outcome === "blocked",
            )
          ? "!"
          : mark(verification, state.head),
    review: reviews.some((review) => review && review.revision !== state.head)
      ? "~"
      : reviews.some(
            (review) =>
              review?.verdict === "blocked" ||
              review?.verdict === "changes_requested",
          ) || open.length
        ? "!"
        : reviews.every(
              (review) =>
                review?.status === "completed" && review.verdict === "passed",
            )
          ? "x"
          : state.phase === "review"
            ? ">"
            : ".",
    corrections:
      state.phase === "corrections"
        ? ">"
        : findingLedger(state).some(
              (finding) => finding.disposition === "resolved",
            )
          ? "x"
          : ".",
    preview:
      preview?.reviewedRevision && preview.reviewedRevision !== state.head
        ? "~"
        : mark(preview),
  };
  const label = (phase: Phase) => node(stages[phase], phase.toUpperCase());
  const lines = [renderDeliverySummary(state, width)];
  if (width >= 72)
    lines.push(
      `  ${label("prepare").padEnd(20)} --> ${label("planning").padEnd(20)} --> ${label("building")}`,
      `  ${"Issue + pins".padEnd(25)}${"Tasks + contracts".padEnd(25)}Code + tests`,
      "                                                            |",
      "                                                            v",
      `  ${label("corrections").padEnd(20)} <-- ${label("review").padEnd(20)} <-- ${label("verification")}`,
      `  ${"Fix findings".padEnd(25)}${"Standards + Spec".padEnd(25)}Acceptance checks`,
      "       |                                                    ^",
      "       +------------------ reverify -------------------------+",
      `                           PASS --> ${label("preview")} (local MR)`,
      "  Failed checks -> repair -> reverify; review findings -> rework",
    );
  else
    lines.push(
      ...(
        ["prepare", "planning", "building", "verification", "review"] as Phase[]
      ).flatMap((phase, index) =>
        index === 0
          ? [`  ${label(phase)}`]
          : ["      |", `      v  ${label(phase)}`],
      ),
      `  Findings -> ${label("corrections")}`,
      "  Corrections -> verify -> review",
      `  PASS -> ${label("preview")} (local MR)`,
    );
  lines.push(
    `  Tickets: ${tasks.filter((task) => task.report?.status === "completed").length}/${tasks.length} reported complete`,
  );
  for (const { task, report } of compact ? tasks.slice(0, 3) : tasks) {
    lines.push(
      `  +--> ${node(mark(report), task.id)}${compact ? "" : ` ${task.title}`} <- ${task.dependsOn.join(", ") || "plan"}`,
    );
    if (!compact && report?.blocker)
      lines.push(`  |    Blocker: ${report.blocker}`);
  }
  if (!tasks.length) lines.push("  +--> [.] Task contracts pending");
  lines.push(
    `Rounds: ${completedRounds} | ${["T1", "T2", "T3"].map((severity) => `${open.filter((finding) => finding.severity === severity).length} ${severity}`).join(" / ")}`,
    "  Agent-reported progress; inspect evidence before acceptance.",
    ...(lastDecision ? [`  Last hook: ${lastDecision}`] : []),
    state.publication
      ? `  Published MR: ${state.publication.mrUrl}`
      : "  Local preview only; publication needs separate approval.",
    ...(state.stopped && deliveryLifecycle(state) === "blocked"
      ? [`  Delivery stopped: ${state.stopped.blocker}`]
      : []),
  );
  if (!compact) {
    for (const check of verification?.checks ?? [])
      lines.push(
        `  ${node(check.outcome === "passed" ? (verification?.revision === state.head ? "x" : "~") : check.outcome === "skipped" ? "." : "!", `${check.kind}: ${check.name}`)}${check.artifact ? ` | ${check.artifact}` : ""}`,
      );
    for (const review of reviews)
      if (review)
        lines.push(
          `  ${node(mark(review, state.head), `${review.axis}: ${review.verdict}`)} | ${review.revision?.slice(0, 10)} | ${review.agentRunId ?? "direct/historical report"}`,
        );
    for (const finding of open)
      lines.push(
        `  ${finding.id} ${finding.severity} -> ${finding.taskId}: ${finding.requirement}`,
      );
    const reports = [
      state.preparation,
      state.plan,
      ...tasks.map((task) => task.report),
      verification,
      ...reviews,
      preview,
    ];
    for (const report of reports)
      if (report) {
        if (report.summary) lines.push(`  ${report.summary}`);
        if (report.blocker) lines.push(`  Blocker: ${report.blocker}`);
        for (const reference of report.evidence)
          lines.push(`    Evidence: ${reference}`);
      }
    if (preview?.artifact) lines.push(`  Preview: ${preview.artifact}`);
    for (const reference of [
      ...(state.stopped?.evidence ?? []),
      ...(state.publication?.evidence ?? []),
    ])
      lines.push(`    Lifecycle evidence: ${reference}`);
    for (const reference of state.legacyEvidence)
      lines.push(`  Preserved history: ${reference}`);
    lines.push(
      "[x] Reported complete  [>] Active  [.] Waiting  [!] Blocked  [~] Stale",
    );
  }
  return lines.map((line) => {
    const clipped = clip(line, Math.max(1, Math.floor(width)));
    return colorStage
      ? clipped.replace(
          /\[[x>.!~]\] (PREPARE|PLANNING|BUILDING|VERIFICATION|REVIEW|CORRECTIONS|PREVIEW)/g,
          (text, name: string) => colorStage(name.toLowerCase() as Phase, text),
        )
      : clipped;
  });
}
