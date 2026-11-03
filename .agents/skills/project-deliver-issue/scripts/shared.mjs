import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export function requireCondition(condition, code, message) {
  if (!condition) throw Object.assign(new Error(message), { code });
}

export function git(repo, ...args) {
  try {
    return execFileSync("git", ["-C", repo, ...args], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 32 * 1024 * 1024,
    });
  } catch (error) {
    throw Object.assign(new Error(error.stderr?.toString().trim() || error.message), { code: "GIT_ERROR" });
  }
}

export function commit(repo, ref) {
  requireCondition(typeof ref === "string" && ref.length > 0, "INVALID_INPUT", "A commit ref is required.");
  return git(repo, "rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`).trim();
}

export function ancestor(repo, base, head) {
  requireCondition(git(repo, "merge-base", base, head).trim() === base,
    "ANCESTRY_MISMATCH", `${base} is not an ancestor of ${head}.`);
}

export function clean(repo) {
  const status = git(repo, "status", "--porcelain").trim();
  requireCondition(!status, "DIRTY_CHECKOUT", `Checkout contains changes:\n${status}`);
}

export function validateCheckout({ repo = process.cwd(), expectedHead, branch, ancestors = [] }) {
  const head = commit(repo, "HEAD");
  requireCondition(head === commit(repo, expectedHead), "HEAD_MISMATCH", `Expected ${expectedHead}; checkout is at ${head}.`);
  requireCondition(branch === null || typeof branch === "string", "INVALID_INPUT", "branch must be a branch name or null for detached HEAD.");
  const actualBranch = git(repo, "branch", "--show-current").trim();
  requireCondition(actualBranch === (branch ?? ""), "BRANCH_MISMATCH", `Expected ${branch ?? "detached HEAD"}; found ${actualBranch || "detached HEAD"}.`);
  requireCondition(Array.isArray(ancestors), "INVALID_INPUT", "ancestors must be an array of refs.");
  clean(repo);
  for (const ref of ancestors) ancestor(repo, commit(repo, ref), head);
  return { head, branch: actualBranch || null };
}

export function linearCommits(repo, base, head) {
  ancestor(repo, base, head);
  const lines = git(repo, "rev-list", "--reverse", "--parents", `${base}..${head}`).trim();
  let parent = base;
  const commits = [];
  for (const line of lines ? lines.split("\n") : []) {
    const [sha, ...parents] = line.split(" ");
    requireCondition(parents.length === 1 && parents[0] === parent,
      "NONLINEAR_HISTORY", `${sha} must have the sole parent ${parent}.`);
    commits.push(sha);
    parent = sha;
  }
  return commits;
}

export function changedPaths(repo, base, head) {
  return git(repo, "diff", "--no-renames", "--name-only", "-z", base, head, "--").split("\0").filter(Boolean);
}

export function runCli(url, operations) {
  if (!process.argv[1] || pathToFileURL(process.argv[1]).href !== url) return;
  try {
    const [operation, json = "{}", ...extra] = process.argv.slice(2);
    if (operation === "--help") {
      console.log(JSON.stringify({ ok: true, data: { operations: Object.keys(operations), usage: "<operation> '<JSON input>'" } }));
      return;
    }
    requireCondition(Object.hasOwn(operations, operation) && !extra.length, "INVALID_OPERATION", `Choose: ${Object.keys(operations).join(", ")}.`);
    const input = JSON.parse(json);
    requireCondition(input && typeof input === "object" && !Array.isArray(input), "INVALID_INPUT", "Input must be a JSON object.");
    console.log(JSON.stringify({ ok: true, data: operations[operation](input) }));
  } catch (error) {
    console.log(JSON.stringify({ ok: false, error: { code: error.code || "OPERATION_FAILED", message: error.message } }));
    process.exitCode = 1;
  }
}
