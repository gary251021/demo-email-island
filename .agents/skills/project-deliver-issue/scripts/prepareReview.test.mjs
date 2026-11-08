import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { prepareReview } from "../references/04_review.mjs";

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function write(cwd, path, content) {
  mkdirSync(join(cwd, path, ".."), { recursive: true });
  writeFileSync(join(cwd, path), content);
}

test("reports added, modified, deleted tests and new skip/focus markers", () => {
  const cwd = mkdtempSync(join(tmpdir(), "prepare-review-"));
  git(cwd, "init", "-b", "demo");
  git(cwd, "config", "user.email", "test@example.com");
  git(cwd, "config", "user.name", "Test");
  write(cwd, "src/a.ts", "a\n");
  write(cwd, "src/a.test.ts", 'it("keeps", () => {});\n');
  write(cwd, "e2e/old.ts", 'test("old", () => {});\n');
  git(cwd, "add", ".");
  git(cwd, "commit", "-m", "base");
  const base = git(cwd, "rev-parse", "HEAD");

  write(cwd, "src/a.ts", "b\n");
  write(cwd, "src/a.test.ts", 'it.skip("keeps", () => {});\n');
  write(cwd, "src/b.spec.tsx", 'describe.only("new", () => {});\n');
  rmSync(join(cwd, "e2e/old.ts"));
  git(cwd, "add", "-A");
  git(cwd, "commit", "-m", "change");
  const head = git(cwd, "rev-parse", "HEAD");

  const { testChanges } = prepareReview({ repo: cwd, base, reviewedHead: head });
  assert.deepEqual(testChanges.added, ["src/b.spec.tsx"]);
  assert.deepEqual(testChanges.modified, ["src/a.test.ts"]);
  assert.deepEqual(testChanges.deleted, ["e2e/old.ts"]);
  assert.deepEqual(testChanges.skipOrFocus.map((item) => item.path), ["src/b.spec.tsx", "src/a.test.ts"]);
});
