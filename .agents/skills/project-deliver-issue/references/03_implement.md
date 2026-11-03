# 03 — Implement tickets

## Executable operations

Use sibling [03_implement.mjs](03_implement.mjs):

- `validateCheckout`: `expectedHead`, `branch` (or `null` for detached HEAD),
  `ancestors`, and optional `repo`.
- `validateTicket`: the same fields plus `start` and `ownedPaths`, with
  `expectedHead` set to the reported commit. Ownership entries are exact files
  or directory prefixes ending in `/`, without globs. It requires one linear
  commit and checks changed paths, including both sides of renames.

## Coordinator

Own shared discovery and [context preparation](02_handoff.md). Define acceptance
scenarios, shared contracts, test ownership and external mock boundaries before
dispatching each ticket. The implementer owns both feature code and acceptance
tests, with shared scaffolding owned once. Dispatch when its contract and real
dependencies are ready; obtain baseline evidence directly. Maintain the full
issue coverage map, including a named owner for cross-ticket acceptance E2E journeys.

Use [decomposition](tracer-bullet-decomposition.md) for the smallest working
foundation and independent work. UI and server work can proceed together against
settled shared interfaces; only tickets consuming prerequisite implementation
commits wait for those commits. Include real route/adapter wiring in the first
relevant working slice. Split broad UI work by independently owned behavior and
agreed interfaces. Keep work that needs no split as one ticket.

## Ticket chats

In Pi, use native implementation workers with explicit `context: "fork"` from the
delivery coordinator under [native dispatch](02_handoff.md#native-pi-dispatch).
Use configured model preferences and native run continuation.
A sole active worker may use the feature checkout exclusively. For parallel
work, prepare one detached Git worktree per worker at the current feature
HEAD, with existing verification tooling available. Include blocking commits in the assignment.
Validate each assigned checkout at launch under [phase 02](02_handoff.md#dispatch-evidence).

Assign files/modules, state that workers share the codebase and preserve
others' edits, and supply the exact checkout and ticket start SHA through the
assignment. Each implementer writes the assigned code and tests and reports;
the coordinator owns further delegation/review. Record native run IDs for corrections.

Accept Git state using `validateTicket` and record reported verification.
Trust the worker's implementation report and intervene for concrete contradictions,
failed checks or dependency conflicts. Independent correctness review belongs
to [phase 04](04_review.md).

Cherry-pick detached worker commits serially in dependency order. Record
original and integrated SHAs; use integrated SHAs for later dependencies and
review. Return fixable work and integration conflicts to its original chat
with current context. Keep issue commits linear. Preserve unfinished work and remove a temporary worktree once its clean result is integrated. Retain
its chat until delivery finishes so corrections reuse context.

## Acceptance verification

Apply [acceptance testing](../../../../docs/agents/acceptance-testing.md):
map issue criteria to tests, distinguish acceptance E2E with external mocks from live
Playwright with real development services, and honor explicit layer exclusions.
Include the selected layers and their boundaries in each relevant assignment.
Preserve the coordinator-defined expectations while the implementer writes code
and tests. Collect its separate baseline assertion evidence and integrated green. Run the complete acceptance E2E suite after integration.
Report test defects or requirement conflicts to the coordinator.
After the integrated acceptance E2E suite passes, add only warranted unit coverage.

## Ticket execution

Run all commands in the assigned `Ticket checkout`. Validate start SHA,
HEAD mode and production/dependency ancestry with `validateCheckout` before editing.
Use `validateTicket` only after the required ticket commit exists. Use the current
assignment as the unit of work and the supplied context packet as the starting
point. Reuse settled facts; investigate only a specific missing fact, changed
code or conflicting evidence. Report the gap to the coordinator for shared
resolution.

Implementers write feature code, acceptance tests, fixtures and owned setup, and
record [baseline acceptance evidence](../../../../docs/agents/acceptance-testing.md#acceptance-preparation-gate)
in a separate checkout. Preserve ongoing work. Run acceptance checks against the integrated result.
Keep expectations stable and report concrete test defects or contract gaps to the
coordinator. Check available tests, relevant lint and types on the first working
slice, and repeat when subsequent changes warrant it, so route wiring and
responsibility issues are handled during implementation.

Use the [reuse decisions](02_handoff.md#reuse-decisions) in the packet when
implementing or correcting a ticket. Compose the selected shared modules and
installed libraries. When custom code is needed, record the specific contract
mismatch and resolve only that gap. For responsibility or interface changes,
apply the codebase-design skill: put cohesive behavior behind a small interface
rather than merely moving lines into more files. Include material departures
from the supplied reuse decisions in the worker handoff to review.

Apply relevant project guidance supplied in the packet. For new files,
refactors or dependency changes, use `docs/agents/project-architecture.md`;
read repository details when changing queries, database access or mapping.
When `$implement` is available, its implementation guidance applies; this
workflow replaces per-ticket and stop-hook review with phase 04.

Finish with one non-merge commit whose sole parent is `Ticket start SHA` and a
clean assigned checkout, containing the owned code and tests. Return the
criterion → test mapping, baseline SHA/test-only diff/assertion results, actual
integrated checks and outstanding acceptance. Complete acceptance requires the
combined suite to pass. Return the commit SHA,
commands/results, any test-expectation changes with reasons, blockers, and new
findings or changed assumptions needed by other workers.
