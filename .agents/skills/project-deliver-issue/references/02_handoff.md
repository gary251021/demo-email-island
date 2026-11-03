# 02 — Prepare context and dispatch

The main coordinator gathers the issue's complete `For Agent` contract and
accepted comments once. Resolve applicable guidance, shared interfaces and
ownership needed by each ticket before its dispatch. Define acceptance scenarios
and their test owner under [acceptance testing](../../../../docs/agents/acceptance-testing.md#acceptance-first-sequence).
Dispatch each ready ticket while preparing independent tickets: a ready server
contract can start server work while UI references are being checked, and vice versa. Use
[decomposition](tracer-bullet-decomposition.md) to define a small working
foundation and independent follow-on tickets.

## Native Pi dispatch

Use native pi-subagents, with a persisted delivery coordinator session. Launch
implementation workers with explicit `context: "fork"`; verifiers and each review
axis use explicit `context: "fresh"`. These runtime options establish context;
role prompts do not. A mixed workflow sets context on each child and omits the
outer context override. Native fork is strict when the parent/leaf is unavailable.

Give each implementer its bounded code **and test** ownership, accepted scenarios,
checkout/ref, baseline and verification requirements. Use native model/skill options under [model selection](../SKILL.md#model-selection-and-context).
Retain returned native run IDs, session/output references and commit mappings.
Resume the original same-role native child for corrections after eligibility
inspection; use the latest returned run ID. Legacy SDK sessions remain evidence,
not native resumable children.

## Existing UI references

For UI work, the coordinator reads the issue's design references, including
references outside `For Agent`, and the existing preview README, story definitions,
component/style sources and review specifications. Follow the
[Storybook workspace](../../../../.storybook-preview/README.md) to locate them;
use the issue's named stories and remote URL or its documented local-build fallback.
Inspect the applicable rendered states, controls and interactions before defining
UI test expectations and dispatching UI work. Carry their
exact URLs, story IDs, source paths, applicable requirements and observed states
in the existing packet's `guidance` and `verification` fields. Reuse the supplied
specification. Keep the distinction between visual/interaction references and
the issue's authoritative backend behavior contract.

## Reuse decisions

Before dispatch, the coordinator checks the task-relevant installed dependencies,
shared modules and existing usage examples once. In `codeMap`, name the selected
imports and example paths; in `decisions`, map each relevant responsibility to
that existing capability or record the concrete gap requiring custom code.
For UI work, include applicable shared UI primitives and form/date utilities.
Select by contract fit and the referenced design, not package presence alone.
Carry these decisions into corrections; revisit only changed requirements or a
specific incompatibility. This is part of the existing packet, not a separate
repository-wide discovery phase.

## Context packet

The coordinator retains the complete issue contract, accepted comments and shared
context and the complete criterion → journey → test-owner map. Define the assigned
acceptance scenarios before dispatch; each implementer receives the relevant
code/test contract under [acceptance testing](../../../../docs/agents/acceptance-testing.md).

Generate a separate UTF-8 JSON packet for each assignment outside tracked files
(for example in `/private/tmp`). For tickets and corrections, keep the six required nonempty string fields:

- `issueContract`: the assigned acceptance criteria and IDs, plus shared invariants
  and cross-task constraints that can change this task's implementation. Include
  the authoritative issue reference for gaps; omit unrelated feature requirements.
- `acceptedComments`: only comments affecting those criteria or shared contracts;
  use `None` when none apply.
- `guidance`: applicable rules and the exact Storybook states relevant to this task.
- `decisions`: settled decisions, dependencies, ownership and explicit exclusions
  needed for this assignment, including constraints imposed by consumers.
- `codeMap`: owned source/test files, public interfaces, exact dependency signatures,
  payload semantics and source revisions needed to implement without broad rediscovery.
- `verification`: selected test layers, runnable commands or setup requirements,
  existing test references, and integration checks. The structured acceptance plan
  below supplies the scenarios. Implementation assignments pin the pre-implementation
  baseline SHA and identify their owned tests and any shared-test owner.
  Record baseline and integrated results separately.

Include necessary source excerpts and exact paths. Scope by relevance: preserve
shared payload schemas, authorization, recovery semantics or downstream
expectations when this task depends on them.
The coordinator checks that every assigned criterion and dependency is represented.
Workers report a specific missing fact; the coordinator supplies the relevant
context. The issue and owning documents remain authoritative.

For each first ticket include a ticket-scoped `acceptance` plan:

```json
{
  "owner": "01",
  "criteria": [
    {
      "id": "AC-CREATE",
      "scenarios": [
        {
          "name": "Admin creates a notification and sees the saved result",
          "inputs": "Authenticated admin, valid content and selected recipients",
          "actions": "Open create route, fill the form, submit, observe completion",
          "expected": "The island view shows the archived thread and updates its unread count",
          "mockBoundary": "External email provider API; real route, loader, server function, authorization and mapping"
        }
      ]
    }
  ]
}
```

`owner` identifies the ticket responsible for writing and maintaining these tests.
The coordinator checks scenarios against the issue and assigns each cross-ticket
user journey an explicit owner before its participating tickets start. Keep the
full coverage map with the coordinator; send each worker only its relevant plan.
`validateAcceptance` validates the plan shape and unique criterion IDs; semantic
coverage and the external mock boundary remain coordinator/reviewer judgments.
Supply this plan in the native worker assignment. The same implementer writes
code/tests and obtains baseline evidence in a separate baseline checkout, without
resetting active work. Identify source/test ownership and any shared scaffolding
in the assignment.

Shared contracts include exact schemas, signatures, semantics and pinned source
references. Pass confirmed facts once; read backend internals only to resolve a
specific shared-contract gap or unexpected integration behavior. Workers read
owned code and investigate concrete gaps, changes or contradictory evidence.

Refresh affected task packets when contracts or dependencies change. Corrections
resume the original implementation chat with the scoped packet, findings and
intervening changes. Reviewers still receive the complete issue contract under
phase 04. Keep credentials out of packets. The dispatch builder validates field
presence and the ticket acceptance plan for its legacy transport. Native Pi
assignments carry the same semantic contract without that transport restriction.

## Dispatch evidence

Use native `subagent` directly for one task or `runs.run` / `runs.all` for a
coordinated wave. Read the installed tool reference; prefer `async: true`, explicit
per-child context and one writer per checkout. Supply the actual checkout and
full start revision, production/dependency/feature pins and workflow source, owned paths,
scenario plan, selected imports and relevant guidance. Child task text stays
bounded; output artifacts are bound with native `output`, not filename prose.

Record task → native run ID → checkout → original/integrated commit mappings.
On a timeout, use native status and resumability checks to reuse the existing child. Existing checkout/return validators below remain useful. Native Pi calls follow the native dispatch path; the legacy
`buildDispatch` generator and its create-thread/preload/payload hook protocol do not apply. Ordinary
tools perform actions; delivery reports only describe their outcome/evidence.

## Workflow source

Use the workflow source path and revision recorded under
[delivery policy](../../../../docs/agents/issue-delivery-policy.md#direct-implementation).
Keep application ancestry pinned to the production/dependency/feature revisions;
harness updates are maintained on `feature/harness` and consumed as workflow
guidance without replaying issue commits or changing the feature base. Refresh
changed guidance before the next assignment and rerun only affected checks.

`validateCheckout` and `validateReturn` remain available for Git checks;
`validateReturn` additionally takes `start` and returns the linear commit list.
