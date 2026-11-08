#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const BASE_BRANCH = "demo";

export const BRANCH_TYPES = new Set([
  "feat",
  "fix",
  "refactor",
  "perf",
  "docs",
  "test",
  "build",
  "ci",
  "chore",
]);

function git(cwd, ...args) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const message = error.stderr?.toString().trim() || error.message;
    throw new Error(`git ${args.join(" ")} failed: ${message}`);
  }
}

function resolveCommit(cwd, ref) {
  try {
    return git(cwd, "rev-parse", "--verify", `${ref}^{commit}`);
  } catch {
    return null;
  }
}

function isAncestor(cwd, ancestor, descendant) {
  try {
    git(cwd, "merge-base", "--is-ancestor", ancestor, descendant);
    return true;
  } catch {
    return false;
  }
}

function parseArguments(argv) {
  const values = {};
  const dependencies = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--") || index + 1 === argv.length) {
      throw new Error(`Invalid argument: ${argument}`);
    }
    const key = argument.slice(2);
    const value = argv[(index += 1)];
    if (key === "dependency") {
      const [branch, sha, extra] = value.split(":");
      dependencies.push({ branch: extra ? "" : branch, sha });
    } else values[key] = value;
  }

  return {
    issue: values.issue,
    type: values.type,
    slug: values.slug,
    dependencies,
  };
}

export function validatePrepareOptions(options) {
  if (!/^\d+$/.test(options.issue) || Number(options.issue) < 1) {
    throw new Error("--issue must be a positive integer");
  }
  if (!BRANCH_TYPES.has(options.type)) {
    throw new Error(`--type must be one of: ${[...BRANCH_TYPES].join(", ")}`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(options.slug)) {
    throw new Error("--slug must use lowercase words separated by hyphens");
  }
  for (const dependency of options.dependencies ?? []) {
    if (!dependency.branch || !/^[0-9a-f]{40}$/.test(dependency.sha)) {
      throw new Error("--dependency must use <branch>:<full-sha>");
    }
  }
}

export function prepareIssueBranches(options, cwd = process.cwd()) {
  validatePrepareOptions(options);
  if (git(cwd, "status", "--porcelain")) {
    throw new Error("The checkout must be clean");
  }

  const baseRevision = resolveCommit(cwd, `refs/heads/${BASE_BRANCH}`);
  if (!baseRevision) {
    throw new Error(`The local ${BASE_BRANCH} branch must exist`);
  }

  const dependencies = options.dependencies ?? [];
  // ponytail: dependency delivery is one linear list; add DAG merging when a real issue needs parallel roots.
  let featureBase = baseRevision;
  for (const dependency of dependencies) {
    git(cwd, "check-ref-format", "--branch", dependency.branch);
    const branchRevision = resolveCommit(cwd, dependency.branch);
    const requiredRevision = resolveCommit(cwd, dependency.sha);
    if (
      !branchRevision ||
      requiredRevision !== dependency.sha ||
      !isAncestor(cwd, dependency.sha, branchRevision)
    ) {
      throw new Error(
        `Dependency ${dependency.sha} is not on ${dependency.branch}`,
      );
    }
    if (!isAncestor(cwd, featureBase, dependency.sha)) {
      throw new Error("Dependencies must form one ordered ancestry path");
    }
    featureBase = dependency.sha;
  }

  const suffix = `${options.issue}-${options.slug}`;
  const feature = `${options.type}/${suffix}`;
  if (resolveCommit(cwd, `refs/heads/${feature}`)) {
    throw new Error(`Local branch already exists: ${feature}; continue in its checkout`);
  }
  git(cwd, "check-ref-format", "--branch", feature);
  git(cwd, "switch", "-c", feature, featureBase);

  if (git(cwd, "status", "--porcelain")) {
    throw new Error("Branch preparation did not finish cleanly");
  }

  return {
    strategy: "direct",
    feature,
    baseBranch: BASE_BRANCH,
    baseRevision,
    featureBase,
    dependencies,
  };
}

function usage() {
  return [
    "Usage:",
    "  prepareIssueBranches.mjs --issue <n> --type <type> --slug <slug>",
    "    [--dependency <branch>:<full-sha>]...",
    `  Branches from the latest local ${BASE_BRANCH} tip.`,
  ].join("\n");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    if (process.argv.includes("--help")) {
      console.log(usage());
    } else {
      const options = parseArguments(process.argv.slice(2));
      console.log(JSON.stringify(prepareIssueBranches(options), null, 2));
    }
  } catch (error) {
    console.error(error.message);
    console.error(usage());
    process.exitCode = 1;
  }
}
