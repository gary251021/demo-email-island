import { commit, linearCommits, ancestor, git, requireCondition, runCli } from "../scripts/shared.mjs";

export function verifyTransfer({ repo = process.cwd(), integrationStart, integrationHead, featureBase, featureHead, dependencies = [] }) {
  const [start, source, base, target] = [integrationStart, integrationHead, featureBase, featureHead].map(ref => commit(repo, ref));
  const sourceCommits = linearCommits(repo, start, source);
  const targetCommits = linearCommits(repo, base, target);
  requireCondition(sourceCommits.length > 0 && sourceCommits.length === targetCommits.length,
    "COMMIT_COUNT", "Source and feature must contain the same nonzero number of linear issue commits.");
  requireCondition(Array.isArray(dependencies), "INVALID_INPUT", "dependencies must be an array of refs.");
  for (const ref of dependencies) ancestor(repo, commit(repo, ref), target);
  const patch = (from, to) => git(repo, "diff", "--binary", "--full-index", "--no-ext-diff", "--no-textconv", "--no-renames", "--no-color", from, to, "--");
  requireCondition(patch(start, source) === patch(base, target), "PATCH_MISMATCH", "Integration and feature patches differ; review evidence cannot be carried forward automatically.");
  return { integrationStart: start, integrationHead: source, featureBase: base, featureHead: target, sourceCommits, targetCommits, patchEqual: true };
}

runCli(import.meta.url, { verifyTransfer });
