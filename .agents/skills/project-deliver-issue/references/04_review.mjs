import { commit, clean, ancestor, changedPaths, git, requireCondition, runCli } from "../scripts/shared.mjs";

const TEST_FILE = /(^|\/)(e2e|tests?|__tests__)\/|\.(test|spec)\.[cm]?[jt]sx?$/;
const SKIP_OR_FOCUS = /\b(?:(?:it|test|describe|suite)\.(?:skip|only|todo)|x(?:it|test|describe))\s*\(/;

export function testChanges(repo, base, head) {
  const changes = { added: [], modified: [], deleted: [], skipOrFocus: [] };
  const status = git(repo, "diff", "--no-renames", "--name-status", "-z", base, head, "--").split("\0").filter(Boolean);
  for (let index = 0; index < status.length; index += 2) {
    const [code, path] = [status[index], status[index + 1]];
    if (!TEST_FILE.test(path)) continue;
    ({ A: changes.added, D: changes.deleted }[code] ?? changes.modified).push(path);
  }
  for (const path of [...changes.added, ...changes.modified]) {
    const diff = git(repo, "diff", "-U0", base, head, "--", path);
    for (const line of diff.split("\n")) {
      if (line.startsWith("+") && !line.startsWith("+++") && SKIP_OR_FOCUS.test(line)) {
        changes.skipOrFocus.push({ path, line: line.slice(1).trim() });
      }
    }
  }
  return changes;
}

export function prepareReview({ repo = process.cwd(), base, reviewedHead }) {
  clean(repo);
  base = commit(repo, base);
  reviewedHead = commit(repo, reviewedHead);
  requireCondition(commit(repo, "HEAD") === reviewedHead, "HEAD_MISMATCH", "Checkout HEAD differs from reviewedHead.");
  ancestor(repo, base, reviewedHead);
  const paths = changedPaths(repo, base, reviewedHead);
  requireCondition(paths.length > 0, "EMPTY_DIFF", "The full issue delta is empty.");
  return { base, reviewedHead, paths,
    commits: git(repo, "rev-list", "--reverse", `${base}..${reviewedHead}`).trim().split("\n"),
    diffCommand: `git diff ${base} ${reviewedHead} --`,
    testChanges: testChanges(repo, base, reviewedHead) };
}

runCli(import.meta.url, { prepareReview });
