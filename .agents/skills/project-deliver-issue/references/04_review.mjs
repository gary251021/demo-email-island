import { commit, clean, ancestor, changedPaths, git, requireCondition, runCli } from "../scripts/shared.mjs";

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
    diffCommand: `git diff ${base} ${reviewedHead} --` };
}

runCli(import.meta.url, { prepareReview });
