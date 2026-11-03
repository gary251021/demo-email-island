import { validateCheckout, commit, linearCommits, changedPaths, requireCondition, runCli } from "../scripts/shared.mjs";

export { validateCheckout };

export function validateTicket(input) {
  const { head, branch } = validateCheckout(input);
  const repo = input.repo ?? process.cwd();
  const start = commit(repo, input.start);
  const commits = linearCommits(repo, start, head);
  requireCondition(commits.length === 1, "COMMIT_COUNT", `Expected one ticket commit; found ${commits.length}.`);
  requireCondition(Array.isArray(input.ownedPaths) && input.ownedPaths.length > 0 && input.ownedPaths.every(p => typeof p === "string" && p.length > 0 && !p.startsWith("/") && !p.split("/").includes("..")),
    "INVALID_INPUT", "ownedPaths must contain repository-relative file paths or directory prefixes ending in /. No globs.");
  const paths = changedPaths(repo, start, head);
  const outside = paths.filter(path => !input.ownedPaths.some(owned => owned.endsWith("/") ? path.startsWith(owned) : path === owned));
  requireCondition(!outside.length, "OWNERSHIP_MISMATCH", `Changes outside assigned paths: ${outside.join(", ")}.`);
  return { head, branch, start, paths };
}

runCli(import.meta.url, { validateCheckout, validateTicket });
