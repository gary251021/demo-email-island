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
  git(cwd, "init", "-b", "demo");
  git(cwd, "config", "user.email", "test@example.com");
  git(cwd, "config", "user.name", "Test");
  writeFileSync(join(cwd, "base.txt"), "base\n");
  git(cwd, "add", "base.txt");
  git(cwd, "commit", "-m", "base");
  const base = git(cwd, "rev-parse", "HEAD");

  if (withHarness) {
    git(cwd, "switch", "-c", "feature/harness");
    writeFileSync(join(cwd, "harness.txt"), "harness\n");
    git(cwd, "add", "harness.txt");
    git(cwd, "commit", "-m", "harness");
    git(cwd, "switch", "demo");
  }

  return { cwd, base };
}

function options() {
  return {
    issue: "42",
    type: "fix",
    slug: "example",
  };
}

function dependency(cwd) {
  git(cwd, "switch", "-c", "fix/21-dependency");
  writeFileSync(join(cwd, "dependency.txt"), "dependency\n");
  git(cwd, "add", "dependency.txt");
  git(cwd, "commit", "-m", "dependency");
  const sha = git(cwd, "rev-parse", "HEAD");
  git(cwd, "switch", "demo");
  return { branch: "fix/21-dependency", sha };
}

test("prepares only the feature branch without importing harness commits", () => {
  const { cwd, base } = repository(true);
  const result = prepareIssueBranches(options(), cwd);
  assert.equal(result.strategy, "direct");
  assert.equal(result.feature, "fix/42-example");
  assert.equal(result.baseBranch, "demo");
  assert.equal(result.baseRevision, base);
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

test("branches from the latest demo tip", () => {
  const { cwd } = repository(false);
  writeFileSync(join(cwd, "later.txt"), "later\n");
  git(cwd, "add", "later.txt");
  git(cwd, "commit", "-m", "later");
  const latest = git(cwd, "rev-parse", "HEAD");
  git(cwd, "switch", "--detach", "HEAD~1");

  const result = prepareIssueBranches(options(), cwd);
  assert.equal(result.baseRevision, latest);
  assert.equal(git(cwd, "rev-parse", "HEAD"), latest);
});

test("stops when the demo branch does not exist", () => {
  const { cwd } = repository(false);
  git(cwd, "branch", "-m", "demo", "other");

  assert.throws(
    () => prepareIssueBranches(options(), cwd),
    /local demo branch must exist/,
  );
  assert.equal(git(cwd, "branch", "--show-current"), "other");
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
  assert.equal(git(cwd, "branch", "--show-current"), "demo");
});
