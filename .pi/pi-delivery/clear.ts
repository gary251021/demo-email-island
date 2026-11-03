#!/usr/bin/env node
/** Explicit local reset for delivery experiments; never called by reporters. */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { acquireRunLock, getRunDir } from "./store.ts";

const args = process.argv.slice(2);
if (
  !/^[1-9]\d*$/.test(args[0] ?? "") ||
  !Number.isSafeInteger(Number(args[0])) ||
  args.length > 2 ||
  (args[1] !== undefined && args[1] !== "--apply")
) {
  console.error(
    "Usage: /deliver clear <issue> [--apply]\nPreview by default. --apply permanently deletes local experiment work, including uncommitted changes. Exit the delivery session and stop its workers/servers first.",
  );
  process.exit(1);
}
const issue = Number(args[0]);
const apply = args[1] === "--apply";
const git = (...args: string[]) =>
  execFileSync("git", args, { encoding: "utf8" }).trim();
const inside = (path: string, parent: string) =>
  resolve(path) === resolve(parent) ||
  resolve(path).startsWith(resolve(parent) + sep);
const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    throw error;
  }
};

let release: (() => void) | undefined;
try {
  const repo = git("rev-parse", "--show-toplevel");
  const runDir = getRunDir(repo, issue);
  const identity = basename(dirname(runDir));
  const delivery = join(homedir(), ".pi", "delivery");
  const sessions = join(delivery, "sessions", identity, `issue-${issue}`);
  const archives = join(delivery, "archives", identity, `issue-${issue}`);
  if (apply) release = acquireRunLock(runDir);
  else {
    const lock = join(runDir, ".runtime-lock", "owner.json");
    if (existsSync(lock) && alive(readJson(lock).pid))
      throw new Error("Exit the live delivery session before clearing it.");
  }

  const nativeRoot = join(
    tmpdir(),
    `pi-subagents-uid-${process.getuid!()}`,
    "async-subagent-runs",
  );
  const nativeRuns: string[] = [];
  for (const id of existsSync(nativeRoot) ? readdirSync(nativeRoot) : []) {
    const path = join(nativeRoot, id);
    const statusPath = join(path, "status.json");
    if (!existsSync(statusPath)) continue;
    const status = readJson(statusPath);
    if (
      !(
        (status.sessionId && inside(status.sessionId, sessions)) ||
        (status.cwd && inside(status.cwd, runDir))
      )
    )
      continue;
    if (
      !["complete", "failed", "cancelled"].includes(status.state) ||
      (status.processTerminal && status.processTerminal.state !== "observed")
    )
      throw new Error(`Native run is not terminal: ${id} (${status.state})`);
    nativeRuns.push(path);
  }

  const branches = git(
    "for-each-ref",
    "--format=%(refname:short)",
    "refs/heads",
  )
    .split("\n")
    .filter((branch) =>
      new RegExp(
        `^(?:local/int|feat|fix|refactor|perf|docs|test|build|ci|chore)/${issue}-[a-z0-9][a-z0-9-]*$`,
      ).test(branch),
    );
  const worktrees: string[] = [];
  for (const block of git("worktree", "list", "--porcelain").split("\n\n")) {
    const lines = block.split("\n");
    const path = lines.find((line) => line.startsWith("worktree "))?.slice(9);
    const branch = lines
      .find((line) => line.startsWith("branch refs/heads/"))
      ?.slice("branch refs/heads/".length);
    if (!path) continue;
    if (inside(path, runDir) || inside(path, archives)) {
      if (inside(process.cwd(), path))
        throw new Error(`Run cleanup outside ${path}`);
      if (branch && !branches.includes(branch))
        throw new Error(
          `Unrelated branch checked out inside delivery: ${branch}`,
        );
      worktrees.push(path);
    } else if (branch && branches.includes(branch)) {
      throw new Error(
        `Issue branch is checked out outside managed storage: ${path}. Inspect and remove that checkout explicitly first.`,
      );
    }
  }
  const paths = [sessions, archives, ...nativeRuns, runDir].filter(existsSync);
  console.log(
    JSON.stringify(
      { issue, mode: apply ? "delete" : "preview", worktrees, branches, paths },
      null,
      2,
    ),
  );
  if (apply) {
    for (const path of worktrees) git("worktree", "remove", "--force", path);
    for (const branch of branches) git("branch", "-D", "--", branch);
    for (const path of paths) rmSync(path, { recursive: true, force: true });
    console.log(
      `Cleared local delivery ${issue}. Remote state and unrelated work are unchanged.`,
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  release?.();
}
