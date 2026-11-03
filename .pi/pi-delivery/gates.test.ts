import { describe, expect, it } from "vitest";
import { completedReviewRounds, correctionGate, nextDeliveryStep, previewGate } from "./graph.ts";
import type { RunState, Review } from "./types.ts";

const sha = "a".repeat(40);
const other = "b".repeat(40);
function state(): RunState {
  return {
    schemaVersion: 1, issue: 12, repo: "/tmp/repo", revision: 1, phase: "review", head: sha,
    preparation: { status: "completed", evidence: ["pins"] },
    plan: { status: "completed", evidence: ["plan"] },
    tickets: [{ id: "task", title: "Task", acceptance: ["works"], dependsOn: [] }],
    implementations: [{ taskId: "task", status: "completed", evidence: ["commit"], revision: sha, tests: [] }],
    verifications: [{ status: "completed", revision: sha, evidence: ["log"], checks: [
      { name: "unit", kind: "automated", outcome: "passed", artifact: "test.log" },
    ] }], reviews: [], previews: [], legacyEvidence: [],
  };
}
function axis(axis: Review["axis"], round = 1, revision = sha): Review {
  return { axis, round, revision, status: "completed", verdict: "passed", evidence: ["diff"], findings: [] };
}
function reviewed() {
  const value = state();
  value.reviews = [axis("standards"), axis("spec")];
  return value;
}

describe("delivery reporter gates", () => {
  it("allows a preview only after same-revision passing checks and two completed axes", () => {
    const value = reviewed();
    expect(previewGate(value, sha)).toBeUndefined();
    expect(previewGate(value, other)).toMatch(/current reviewed revision/);
    value.verifications.push({ status: "blocked", revision: sha, evidence: [], checks: [] });
    expect(previewGate(value, sha)).toMatch(/Passing verification missing/);
    value.verifications.pop();
    value.reviews[1]!.revision = other;
    expect(previewGate(value, sha)).toMatch(/Standards and Spec reviews missing/);
    value.reviews[1]!.revision = sha;
    value.reviews[1]!.round = 2;
    expect(previewGate(value, sha)).toMatch(/same round/);
  });

  it.each(["T1", "T2"] as const)("blocks unresolved %s even when current checks pass", (severity) => {
    const value = reviewed();
    value.reviews[0]!.findings.push({ id: "F1", severity, taskId: "task", requirement: "fix", evidence: "diff", disposition: "unresolved" });
    expect(previewGate(value, sha)).toMatch(/Resolve all T1\/T2/);
    value.reviews.push({ ...axis("standards", 2), findings: [{ ...value.reviews[0]!.findings[0]!, disposition: "resolved" }] }, axis("spec", 2));
    expect(previewGate(value, sha)).toBeUndefined();
  });

  it("accepts T3-only after five completed two-axis rounds, not before", () => {
    const value = reviewed();
    value.reviews[0]!.findings.push({ id: "low", severity: "T3", taskId: "task", requirement: "polish", evidence: "line 4", disposition: "unresolved" });
    expect(previewGate(value, sha)).toMatch(/five completed/);
    for (let round = 2; round <= 5; round++) value.reviews.push(axis("standards", round), axis("spec", round));
    expect(completedReviewRounds(value)).toBe(5);
    expect(previewGate(value, sha)).toBeUndefined();
  });

  it("refuses correction reports beyond a configured hard cap and directs a human stop", () => {
    const value = reviewed();
    expect(correctionGate(value, 2)).toBeUndefined();
    value.reviews.push(axis("standards", 2));
    expect(correctionGate(value, 2)).toBeUndefined();
    value.reviews.push(axis("spec", 2));
    expect(correctionGate(value, 2)).toMatch(/Report delivery_lifecycle blocked/);
    value.reviews[0]!.findings.push({ id: "urgent", severity: "T1", taskId: "task", requirement: "fix", evidence: "line 4", disposition: "unresolved" });
    expect(nextDeliveryStep(value, 2)).toMatch(/hard cap/);
  });

  it("names the missing step for an unfinished delivery", () => {
    const value = state();
    expect(nextDeliveryStep(value)).toMatch(/Standards and Spec reviews missing/);
    value.verifications = [];
    expect(nextDeliveryStep(value)).toContain(`Passing verification missing for ${sha}`);
  });
});
