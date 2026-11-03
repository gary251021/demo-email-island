import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { prepareIssueBranches } from "./prepareIssueBranches.mjs";

const SCRIPT_PATH = fileURLToPath(
  new URL("./prepareIssueBranches.mjs", import.meta.url),
);

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function repository(withHarness) {
  const cwd = mkdtempSync(join(tmpdir(), "prepare-issue-branches-"));
  git(cwd, "init", "-b", "main");
  git(cwd, "config", "user.email", "test@example.com");
  git(cwd, "config", "user.name", "Test");
  writeFileSync(join(cwd, "base.txt"), "base\n");
  git(cwd, "add", "base.txt");
  git(cwd, "commit", "-m", "base");
  const base = git(cwd, "rev-parse", "HEAD");
  git(cwd, "tag", "v1.0.0");

  if (withHarness) {
    git(cwd, "switch", "-c", "feature/harness");
    writeFileSync(join(cwd, "harness.txt"), "harness\n");
    git(cwd, "add", "harness.txt");
    git(cwd, "commit", "-m", "harness");
    git(cwd, "switch", "main");
  }

  return { cwd, base };
}

function options() {
  return {
    issue: "42",
    type: "fix",
    slug: "example",
    productionTag: "v1.0.0",
  };
}

function dependency(cwd) {
  git(cwd, "switch", "-c", "fix/21-dependency");
  writeFileSync(join(cwd, "dependency.txt"), "dependency\n");
  git(cwd, "add", "dependency.txt");
  git(cwd, "commit", "-m", "dependency");
  const sha = git(cwd, "rev-parse", "HEAD");
  git(cwd, "switch", "main");
  return { branch: "fix/21-dependency", sha };
}

test("prepares only the feature branch without importing harness commits", () => {
  const { cwd, base } = repository(true);
  const result = prepareIssueBranches(options(), cwd);
  assert.equal(result.strategy, "direct");
  assert.equal(result.feature, "fix/42-example");
  assert.equal(result.productionBase, base);
  assert.equal(git(cwd, "branch", "--show-current"), result.feature);
  assert.equal(git(cwd, "rev-parse", "HEAD"), base);
  assert.equal(git(cwd, "for-each-ref", "--format=%(refname)", "refs/heads/local/int/"), "");
  assert.equal(git(cwd, "status", "--porcelain"), "");
});

test("prepares direct feature work without a local harness", () => {
  const { cwd, base } = repository(false);
  const result = prepareIssueBranches(options(), cwd);
  assert.equal(result.featureBase, base);
  assert.equal(git(cwd, "branch", "--show-current"), result.feature);
});

test("stops when the production tag does not resolve", () => {
  const { cwd } = repository(true);

  assert.throws(
    () => prepareIssueBranches({ ...options(), productionTag: "v1.0.1" }, cwd),
    /production tag must resolve to a commit/,
  );
  assert.equal(git(cwd, "branch", "--show-current"), "main");
  assert.throws(() => git(cwd, "rev-parse", "fix/42-example"));
});

test("CLI prepares from an ordered dependency", () => {
  const { cwd } = repository(true);
  const required = dependency(cwd);
  const result = JSON.parse(
    execFileSync(
      process.execPath,
      [
        SCRIPT_PATH,
        "--issue",
        "42",
        "--type",
        "fix",
        "--slug",
        "example",
        "--production-tag",
        "v1.0.0",
        "--dependency",
        `${required.branch}:${required.sha}`,
      ],
      { cwd, encoding: "utf8" },
    ),
  );

  assert.equal(result.featureBase, required.sha);
  assert.deepEqual(result.dependencies, [required]);
  assert.equal(git(cwd, "rev-parse", result.feature), required.sha);
  assert.doesNotThrow(() =>
    git(cwd, "merge-base", "--is-ancestor", required.sha, "HEAD"),
  );
  assert.equal(git(cwd, "branch", "--show-current"), result.feature);
});

test("rejects a required SHA outside its dependency branch", () => {
  const { cwd } = repository(true);
  const required = dependency(cwd);

  assert.throws(
    () =>
      prepareIssueBranches(
        {
          ...options(),
          dependencies: [{ branch: "feature/harness", sha: required.sha }],
        },
        cwd,
      ),
    /is not on feature\/harness/,
  );
  assert.equal(git(cwd, "branch", "--show-current"), "main");
});
