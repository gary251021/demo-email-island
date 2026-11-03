import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  writeFileSync,
  rmSync,
  openSync,
  closeSync,
  fsyncSync,
} from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import type { RunState } from "./types.ts";

export function getRunDir(repo: string, issue: number): string {
  const common = execFileSync(
    "git",
    ["-C", repo, "rev-parse", "--path-format=absolute", "--git-common-dir"],
    { encoding: "utf8" },
  ).trim();
  const identity = createHash("sha256")
    .update(realpathSync(common))
    .digest("hex");
  return join(homedir(), ".pi", "delivery", identity, `issue-${issue}`);
}
function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    if ((error as NodeJS.ErrnoException).code === "EPERM") return true;
    throw error;
  }
}

export function acquireRunLock(runDir: string): () => void {
  return acquireLock(runDir, ".runtime-lock");
}

function acquireLock(runDir: string, name = ".lock"): () => void {
  mkdirSync(runDir, { recursive: true, mode: 0o700 });
  const lockPath = join(runDir, name);
  const token = randomUUID();
  const lock = { pid: process.pid, token };
  const create = (): void => {
    mkdirSync(lockPath, { mode: 0o700 });
    const descriptor = openSync(join(lockPath, "owner.json"), "wx", 0o600);
    try {
      writeFileSync(descriptor, `${JSON.stringify(lock)}\n`, "utf8");
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
  };
  try {
    create();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    let existing: { pid?: number; token?: string };
    try {
      existing = JSON.parse(
        readFileSync(join(lockPath, "owner.json"), "utf8"),
      ) as { pid?: number; token?: string };
    } catch {
      throw new Error(`Unreadable run lock; refusing recovery: ${lockPath}`);
    }
    if (
      !Number.isSafeInteger(existing.pid) ||
      existing.pid! <= 0 ||
      typeof existing.token !== "string" ||
      processIsAlive(existing.pid!)
    ) {
      throw new Error(
        `Delivery run is locked by live process ${existing.pid}: ${lockPath}`,
      );
    }
    const claim = join(runDir, `.stale-lock-${randomUUID()}`);
    renameSync(lockPath, claim);
    try {
      const claimed = JSON.parse(
        readFileSync(join(claim, "owner.json"), "utf8"),
      ) as { pid?: number; token?: string };
      if (claimed.pid !== existing.pid || claimed.token !== existing.token)
        throw new Error(`Run lock changed during stale recovery: ${lockPath}`);
      rmSync(claim, { recursive: true });
    } catch (claimError) {
      if (existsSync(claim) && !existsSync(lockPath))
        renameSync(claim, lockPath);
      throw claimError;
    }
    create();
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const claim = join(runDir, `.release-lock-${randomUUID()}`);
    try {
      renameSync(lockPath, claim);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    try {
      const current = JSON.parse(
        readFileSync(join(claim, "owner.json"), "utf8"),
      ) as { pid?: number; token?: string };
      if (current.pid === lock.pid && current.token === token)
        rmSync(claim, { recursive: true });
      else if (!existsSync(lockPath)) renameSync(claim, lockPath);
    } catch (error) {
      if (existsSync(claim) && !existsSync(lockPath))
        renameSync(claim, lockPath);
      throw error;
    }
  };
}

/** Older snapshots lack cross-phase chronology: retain evidence, start round 1. */
export function workflowProgress(
  state: RunState,
): NonNullable<RunState["workflow"]> {
  if (state.workflow) return state.workflow;
  const feedbackCycles = new Set<string>();
  for (const report of state.verifications)
    if (report.checks.some((check) => check.outcome === "failed"))
      feedbackCycles.add(`verification:1:${report.revision}`);
  for (const report of state.reviews)
    if (report.verdict === "changes_requested")
      feedbackCycles.add(`review:${report.round}:${report.revision}`);
  const verification = state.verifications.at(-1);
  const review = state.reviews.at(-1);
  return {
    round: 1,
    feedbackCycles: [...feedbackCycles],
    correctionPending:
      state.phase === "corrections" ||
      (verification?.revision === state.head &&
        !!verification?.checks.some((check) => check.outcome === "failed")) ||
      state.reviews.some(
        (report) =>
          report.round === review?.round &&
          report.revision === state.head &&
          report.verdict === "changes_requested",
      ),
  };
}

export function loadGraph(
  runDir: string,
  repo: string,
  issue: number,
): RunState {
  const path = join(runDir, "graph.json");
  if (existsSync(path)) {
    const state = JSON.parse(readFileSync(path, "utf8")) as RunState;
    if (
      state.schemaVersion !== 1 ||
      state.issue !== issue ||
      state.repo !== repo ||
      !Number.isSafeInteger(state.revision) ||
      !Array.isArray(state.tickets) ||
      !Array.isArray(state.implementations) ||
      !Array.isArray(state.verifications) ||
      !Array.isArray(state.reviews) ||
      !Array.isArray(state.previews)
    )
      throw new Error(`Invalid delivery reports: ${path}`);
    state.workflow ??= workflowProgress(state);
    return state;
  }
  const legacy = join(runDir, "state.json");
  if (existsSync(legacy)) {
    const old = JSON.parse(readFileSync(legacy, "utf8"));
    if (
      old.pending?.length ||
      old.tickets?.some(
        (ticket: { status: string }) => ticket.status === "running",
      )
    )
      throw new Error(
        "Legacy delivery still has pending work; reach a safe boundary first.",
      );
  }
  return {
    schemaVersion: 1,
    issue,
    repo,
    revision: 0,
    phase: "prepare",
    workflow: { round: 1, feedbackCycles: [], correctionPending: false },
    tickets: [],
    implementations: [],
    verifications: [],
    reviews: [],
    previews: [],
    legacyEvidence: ["state.json", "events.jsonl"]
      .map((name) => join(runDir, name))
      .filter(existsSync),
  };
}

/** The only write is the separate reporting snapshot, under the session's lease. */
export function saveGraph(
  runDir: string,
  previous: RunState,
  next: RunState,
): RunState {
  if (previous.publication)
    throw new Error(
      "Published delivery reports are final; confirmed MR evidence is preserved.",
    );
  next.workflow = structuredClone(workflowProgress(previous));
  if (previous.phase === "corrections" && next.phase === "verification") {
    next.workflow.round++;
    next.workflow.correctionPending = false;
  }
  const feedback = (cycle: string) => {
    if (!next.workflow!.feedbackCycles.includes(cycle)) {
      next.workflow!.feedbackCycles.push(cycle);
      next.workflow!.correctionPending = true;
    }
  };
  for (const report of next.verifications.slice(previous.verifications.length))
    if (report.checks.some((check) => check.outcome === "failed"))
      feedback(`verification:${next.workflow.round}:${report.revision}`);
  for (const report of next.reviews.slice(previous.reviews.length))
    if (report.verdict === "changes_requested")
      feedback(`review:${report.round}:${report.revision}`);
  next.revision = previous.revision + 1;
  const temporary = join(runDir, `.graph-${randomUUID()}.tmp`);
  const descriptor = openSync(temporary, "wx", 0o600);
  try {
    writeFileSync(descriptor, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  renameSync(temporary, join(runDir, "graph.json"));
  return next;
}
