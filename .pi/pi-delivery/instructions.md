# Pi issue delivery

Use ordinary Pi tools and the applicable [project-deliver-issue](../../.agents/skills/project-deliver-issue/SKILL.md) guidance only after this repository has confirmed its [tracker](../../docs/agents/issue-tracker.md), [delivery policy](../../docs/agents/issue-delivery-policy.md), base and target. The existing preparation scripts and provider hooks still reflect the parked workflow; report missing configuration before invoking them. Follow applicable `AGENTS.md` instructions and [acceptance testing](../../docs/agents/acceptance-testing.md). Stop at a verified local change-request preview; publication requires a separate explicit request.

## Reports and actions

Read `delivery_status` and its preserved evidence before resuming. Legacy `state.json`, journal, commits, baseline logs, checkouts and custom SDK sessions remain historical evidence; custom sessions are not native resumable runs. Inspect their actual current state with normal tools. Resume useful work rather than recreating preparation or repeating unchanged failures.

Use exactly these domain reporters after choosing and performing actions yourself:

- `delivery_preparation`: baseline/dependency pins, branch preparation and evidence.
- `delivery_plan`: bounded tasks, acceptance scenarios, ownership contracts and dependencies.
- `delivery_implementation`: task progress/corrections, native run IDs, full checkout revisions and code/test evidence.
- `delivery_verification`: exact revision and separate automated/live/visual outcomes.
- `delivery_review`: each independent axis, full reviewed revision, native run ID, verdict and finding ledger.
- `delivery_preview`: already prepared local artifact, source/target revisions, patch equality, compatibility and evidence.

Reports only persist facts and references; they neither perform actions nor certify their claims. Use real full revisions and durable artifact references. Omit native run IDs for direct or historical work rather than relabeling custom session IDs. Running or blocked status and the precise blocker belong to the affected report. Report failed/skipped/unavailable checks honestly. Prior revision checks/reviews remain history, not acceptance for changed code. Corrections produce subsequent implementation, verification and review reports; retain finding IDs and explicitly report resolved findings rather than dropping them.

## Delivery lifecycle reporting

Use `delivery_lifecycle` for overall delivery facts separately from domain report statuses and review verdicts:

- Report `blocked` with the precise blocker and evidence only when delivery actually stops before a completed local preview. Keep delivery active while reviewing, repairing blockers, applying findings or reverifying; those blockers remain in their domain reports.
- Report `active` when resuming a stopped delivery. Any subsequent domain report also resumes delivery. Returning from preview to earlier phases reopens FINISHED; report the newly completed preview to restore it.
- FINISHED comes from the latest completed `delivery_preview` while the phase is preview, with its explicit reviewed revision current when supplied. Entering preview or reporting waiting/running/blocked preview is incomplete. Preserve source and reviewed revision distinctions.
- Report `published` only after separately authorized MR creation has succeeded in the tracker, with its confirmed `mrUrl` and durable confirmation evidence. Attempts and approval remain unpublished. PUBLISHED is final and preserves that record across reloads.

Older snapshots without explicit stop/publication facts remain active unless their current preview report establishes FINISHED. Historical domain blockers stay visible without becoming delivery stops. Reporting grants no publication authority and performs no publication or acceptance certification; follow [the preview/publication boundary](../../.agents/skills/project-deliver-issue/references/05_preview.md).

## Summary rounds and feedback

The shared GUI/TUI summary displays `DELIVERY #N | round: N | stage: PHASE | branch: CHECKOUT`, followed by the applicable lifecycle label. Git supplies the current checked-out branch at render time; detached HEAD is explicit and an unavailable Git lookup stays unavailable. Snapshot revisions and full reported hashes remain internal evidence, separate from the summary.

The workflow round starts at 1 and increments once when verification is re-entered from corrections. It is separate from the [completed two-axis review count](../../.agents/skills/project-deliver-issue/references/04_review.md#stopping-rule). `CORRECTIONS #N` uses the cumulative feedback-cycle count: one failed-check batch per workflow round and checkout revision, or one `changes_requested` review cycle per review round and reviewed revision. The two review axes share a cycle; report updates within that cycle retain its explicit review `round`. Task updates, rendering, blocked/skipped checks and lifecycle reports add no feedback. Reverification after corrections starts the next workflow round; later feedback continues the cumulative numbering.

These counters persist across resume. Older snapshots preserve their reports and recover distinct evidenced feedback cycles; their missing cross-phase chronology starts the new workflow-round counter at 1 rather than treating review rounds or snapshot saves as workflow iterations.

## Test artifact ownership

Keep all delivery-created scratch files, baseline/mutation worktrees, browser profiles, screenshots and logs inside this issue's runtime directory (the parent of `graph.json`); pass that location to children. Dedicated sessions and native run records use their existing managed locations. This makes explicit [test cleanup](README.md#test-only-local-cleanup) deterministic. `/delivery clear` is a user-requested destructive reset, never an automatic completion or recovery step.

## Native delegation

Read the installed `pi-subagents` skill and tool-reference before launch. Implementers write **application code and its tests** together; no independent test-author ticket or test-worker prerequisite is required. Define the acceptance plan and a single owner for shared/cross-task tests before dispatch. Preserve meaningful pre-implementation baseline assertion evidence and integrated results under acceptance testing. Reviewers assess both code and tests.

- Implementers: native `worker`, explicit `context: "fork"` from this delivery coordinator. A persisted parent and leaf are required; an explicit fork failure is a blocker, not permission to silently launch fresh.
- Independent verification, when useful: native Bash-capable `delegate`, explicit `context: "fresh"` and its exact target/contract/commands/evidence. Verification is not separate test authoring.
- Standards and Spec: two native `reviewer` children with explicit `context: "fresh"`, each receiving its applicable full issue contract, frozen base/reviewed revisions, diff, acceptance/baseline/check/rendered evidence and rules. Review only; preserve the checkout.

For mixed runs omit an outer context override and set context on each `runs.run` / `runs.all` child. Use `async: true`; retain native returned run IDs and output references. Continue original same-role children with native `resume` after eligibility inspection; track the latest returned ID. Legacy custom SDK sessions cannot be imported as native retained runs. Replacement reviewers start fresh with the ledger and history. Keep one writer per checkout and serialize overlapping mutations.

Consult [profile.json](profile.json) for implementer model/thinking preferences and role skills. Resolve models with native `subagent({action:"models"})` before selecting an override. Use a configured model only when available; apply configured thinking through native model suffix syntax only when supported. Omitted model/thinking uses normal active Pi/native defaults, not a hardcoded fallback. Reviewers/verifiers retain normal active defaults. Use native Pi authentication; an unavailable configured model or actual auth denial requires help, not another provider/model. No custom SDK worker, credential loader or graph-triggered delegation is involved.

## Acceptance and stopping

Prepare and maintain issue scope, ordered baseline/dependency pins, branch policy, explicit ownership and the coverage map using the owning workflow references. Honor real prerequisites, not artificial separate-author dependencies. Discover authorized development inputs through normal tools; missing live fixtures do not block independent implementation but remain outstanding for their acceptance gate. Preserve actual permission/network denials and request only the needed authority.

Run the selected automated acceptance E2E, live and visual acceptance layers on the integrated revision. Inspect actual rendered states and exercise affected journeys; local passing tests do not replace live evidence. Preserve baseline behavioral assertion outcomes, including already satisfied behavior and setup failures, without resetting an active writer. Obtain both independent review axes and apply [phase 04's finding ledger and stopping rule](../../.agents/skills/project-deliver-issue/references/04_review.md#stopping-rule): all T1/T2 need correction; retain any T3-only stop and its impact under that rule. Reverify and rereview changed code with the retained native children.

Before the local draft, perform [phase 05](../../.agents/skills/project-deliver-issue/references/05_preview.md), including patch equality, target compatibility, required harness/integrity checks and exact-revision evidence. Report the complete preview and stop. No push, remote issue update, MR creation or publication is authorized by a reporting call. Ask unresolved material decisions in the final response and wait; preserve work/evidence when blocked.
