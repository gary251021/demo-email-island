# 04 — Review and corrections

## Executable operation

Use sibling [04_review.mjs](04_review.mjs) `prepareReview` with `base`,
`reviewedHead`, and optional `repo`. It requires a clean checkout at the
reviewed revision and a nonempty issue delta, then returns full SHAs, changed
paths, commits and the diff command for reviewer dispatch. Run it again before
accepting a report to detect checkout changes. The coordinator evaluates the report.

### Full-issue review

Read the issue acceptance-to-test mapping and separate layer results under
[acceptance testing](../../../../docs/agents/acceptance-testing.md).
Identify coverage gaps and honor explicitly excluded layers.

Run the required issue checks, pin HEAD as the reviewed revision, and keep the
checkout frozen during review. The base is the recorded `Feature base`. Review the
complete issue delta with `git diff <base-sha> <reviewed-sha>`. Initial ticket
commits stay intact.

After implementation and verification, the coordinator reads the applicable
code-review guidance and dispatches two independent native `reviewer` children:
Standards and Spec, each with explicit `context: "fresh"`. Supply absolute checkout,
pinned base/reviewed SHAs, exact diff and commits, changed paths, the complete issue
contract/accepted comments, applicable rules, and actual baseline/automated/live/
visual evidence. Both review application code and its tests. Keep the checkout
frozen; reviewers are read-only (no implementing, committing or publishing).

Set context per child and omit an outer context override for mixed native waves.
Use normal active model/thinking defaults and native authentication under
[model selection](../SKILL.md#model-selection-and-context). Record native run IDs and
output references for both axes. The pinned two-point diff and
issue contract supply the review target; both axes remain required. Resolve
missing inputs and run available checks, reporting unavailable capabilities as
separate blockers.

Pass the packet's [reuse decisions](02_handoff.md#reuse-decisions) and worker
exceptions to the Standards reviewer. Check new custom implementations against
the named existing capabilities, and assess responsibility and interface design
using the codebase-design skill. Report avoidable duplication with the concrete
replacement and why it fits the contract; accept justified mismatches. Design compliance needs this check in addition to passing behavioral tests. Keep this check in
the existing Standards review and recheck affected decisions during corrections.

For UI changes, pass the [existing UI references](02_handoff.md#existing-ui-references)
to the review coordinator and its Spec reviewer, including issue-linked references
outside `For Agent`. Both read the applicable preview/review specifications; the
Spec reviewer independently inspects the named rendered preview states when a preview is configured and compares the corresponding application states at the same viewport. Use the project's available preview or a documented local fallback, with worker screenshots
and reports as supporting evidence. Cite the story/state and observed mismatch
in findings. Verify each required populated list, detail or editable state in
its corresponding rendered state. Report missing access or required rendered
evidence as BLOCKED for visual acceptance.

Wait for the complete report, then edit. Require separate Standards and
Spec findings and PASS/FAIL/BLOCKED statuses for the pinned reviewed SHA. PASS
means no unresolved actionable errors. Record a T3-only stop under the rule
below as ACCEPTED_WITH_T3. Optional heuristic suggestions are advisory;
required corrections follow the accepted scope.

The implementation coordinator decides how to proceed after review, including
corrections, further verification, another review, or reporting a blocker.
Delivery requires both review axes to have no unresolved T1/T2 findings on the
final revision, with either clean PASS or ACCEPTED_WITH_T3 under the stopping
rule below, and required verification to be complete.

Assign corrections to the original native implementation run through `resume`
after eligibility inspection. Supply findings/evidence, intervening changes,
current contract and checkout; preserve its configured model and inherited context.
Validate the assigned checkout for each dispatch. Serialize overlapping fixes;
independent fixes may run in separate prepared checkouts.

Create a replacement implementer when the original native run cannot resume.
Launch with explicit `context: "fork"` from the delivery coordinator and include
prior decisions, findings and evidence. Record the replacement reason.

### Cumulative correction review

After corrections, resume the same native Standards and Spec runs after native
eligibility checks. Supply previous/current revisions, correction diff, verification
and finding ledger, and track each latest returned run ID. Initial/replacement
reviewers start fresh; continuation retains only their own review history.

Maintain a finding ledger in the review evidence. Each actionable finding has an ID,
severity (T1/T2/T3), requirement or documented rule, evidence, first-seen revision, disposition and any
correction commit/test. Distinguish unresolved, resolved, newly discovered and
correction-induced findings. Optional heuristics are advisory. Reopening a resolved
finding requires evidence of an incomplete fix or regression.

For each follow-up, supply the previous and current reviewed SHAs, correction diff,
updated verification and ledger. Reviewers verify the fixes and affected paths,
including regressions and acceptance-test gaps. Keep the full issue diff available
as context; broaden inspection when a correction's impact warrants it. A concrete
new defect remains actionable even outside the correction diff; record its evidence
and whether it was previously missed or introduced by the correction. Say unknown
when provenance is unproven.

Both axes return their updated ledger and status for the current revision. Unchanged
areas retain prior evidence; affected areas require revalidation. Final acceptance
combines the initial full-issue review with subsequent correction reviews and required
checks on the final revision.

When findings recur, contradict one another or keep expanding into unrelated areas,
the implementation coordinator reassesses the disputed contract, missing acceptance
scenarios and correction scope before commissioning more work. Resolve the cause
with retained reviewers and workers.
Apply the stopping rule below after each completed round. If progress requires
external evidence or a human decision, report that precise blocker and open findings;
keep the findings unresolved and the blocked round incomplete.

Replace a reviewer only when its original agent/context is unavailable or unusable.
Give the replacement the relevant contract, ledger, previous reports, reviewed SHAs
and correction history, and record why replacement was necessary. Retain the other
available reviewers. A replacement starts isolated from implementation reasoning.

### Stopping rule

Use T1 for critical/high-severity findings, T2 for medium-severity findings and T3
for low-severity findings. Normalize legacy reviewer priorities as P0/P1 → T1,
P2 → T2 and P3 → T3 while retaining the original label and evidence. Severity
reflects impact, independent of the round limit.

Count the initial completed two-axis review as round 1. Each completed correction
review adds one round. Maintain this cumulative count across agent replacements,
new commits and new findings. Apply the first matching row after each round:

| Remaining actionable findings across both axes | Next step                                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Any unresolved T1 or T2                        | Continue corrections and review without an iteration limit until all T1/T2 findings are resolved.       |
| None                                           | Stop immediately with PASS.                                                                             |
| Only T3, fewer than five total rounds          | Continue corrections and review with the retained reviewers.                                            |
| Only T3, five or more total rounds             | Stop with ACCEPTED_WITH_T3, including immediately after T1/T2 resolution is verified beyond round five. |

List every remaining T3 finding and its impact in the final evidence and MR preview,
and keep it unresolved in the ledger. Required test, visual and external integration
gates retain their own results and completion requirements. Publication requires
the separate authorization defined in phase 05.

Record each round's base/reviewed SHAs, axis statuses, findings and verification,
plus each correction SHA and the errors it resolves. Return with a clean checkout
and unchanged reviewed HEAD. Include all commits in the reviewed feature delta, including corrections.

### Correction execution

Use the assigned checkout at `Correction start SHA`, preserving the fixed branch,
base and workflow-source metadata. Reuse retained context and read intervening changes
before addressing the assigned findings. Leave review and further delegation to
the coordinator. Commit the correction with its sole parent equal to
`Correction start SHA`; return the SHA, resolved/unresolved findings, verification
and any blockers.
