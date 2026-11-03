# Acceptance testing

Two layers provide separate evidence. Map each issue acceptance criterion to stable
IDs and named executable tests in the issue's verification record. Record uncovered
requirements and excluded external behavior explicitly. Judge acceptance from the
executed results for those criteria. Follow [test principles](architecture/test-principles.md).

## Acceptance-first sequence

The issue defines acceptance criteria. Before dispatching a ticket, the coordinator
turns its criteria into named scenarios with inputs, user actions, expected
observable outcomes, external mock boundaries and a test owner. Prefer accessible
roles, labels and names over CSS classes, DOM nesting or internal component APIs.

1. Maintain a full issue map: criterion → user journey/scenarios → ticket/test owner.
   Assign cross-ticket journeys before their participating tickets start. Each
   handoff carries only the assigned scenarios and necessary shared contracts.
2. Assign application code and its acceptance tests to the same implementer once
   the shared contract and actual dependencies are ready. Give it explicit source
   and test ownership; assign shared scaffolding and cross-ticket journeys once.
3. The implementer writes both behavior and tests against the settled contract and
   records separate baseline/integrated evidence below. Keep assertions fixed;
   change them only for an evidenced test defect or explicitly changed requirement,
   recording the reason.
4. Integrate the owned code/test commits and run the complete acceptance E2E suite.
   Return behavior and test/setup defects to their implementer with the
   evidence/contract. An independent verifier may execute/assess results; it is
   not a separate test author.
5. After acceptance E2E passes, add focused unit coverage only for meaningful logic
   or regression risks needing it. Preserve existing tests.

The coordinator resolves contract gaps and coverage. Implementers own code, tests,
fixtures and assigned setup together; both independent review axes assess code and
tests. Infrastructure availability and live Playwright remain separate checks.

## Acceptance preparation gate

This is an evidence requirement before acceptance, not an implementation-start
barrier. Missing development URLs, live fixture IDs, service access or rendered
evidence remain outstanding for the affected live/visual gate; dispatch unrelated
ready implementation tasks. First discover live inputs from the issue, repository
documentation/configuration, existing fixture references and available authorized
read-only tools. Define deterministic acceptance scenarios from the settled
contract without requiring live fixture IDs. Ask for help only when an unresolved
input changes the assigned behavior or when the affected gate cannot proceed
without additional authority or external help. Keep required live and visual
evidence outstanding until obtained; local results do not replace it.

Pin the pre-implementation baseline SHA in the implementation assignment. Run each
scenario in a separate baseline checkout with that implementer's test changes and
only minimal scaffolding needed to reach behavioral assertions. Implementation
may already be running or complete elsewhere; baseline red describes a code
revision, not the order in which workers finish.

Record criterion ID → test file/name → baseline red or green result → behavioral
reason, plus command, baseline SHA and test/scaffolding diff. Then run the same
expectations against the integrated implementation and record its revision and
results. Keep baseline and integrated execution separate, in their own checkouts,
so an active implementer's checkout stays untouched. Expected baseline failures
remain evidence, while delivery requires integrated green.

Missing behavior fails at a behavioral assertion; already satisfied behavior
may pass. Resolve broken imports, missing dependencies and invalid test setup
first. Record any minimal scaffolding and public seams added to execute the
baseline tests; they reach the assertion without implementing the behavior being
asserted. Include the real providers, routing, loaders, server functions and
mapping on the asserted path; mock only the agreed external boundaries. A
component rendered with a mocked server function does not establish the complete
journey.

One criterion may need multiple scenarios. One test may cover several criteria
only when it asserts every outcome. Keep external-only or user-excluded criteria
in the coordinator's full map with scope reasons. All in-scope criteria need passing
executed coverage before delivery, while ticket readiness depends on its own scope.

When a shared setup defect appears, the coordinator assigns repair to its owner
and distributes the repair and updated command to affected workers. Integrate it
while keeping their work, confirm behavioral assertions are reached again, and
record setup failures separately from behavioral red. Update ticket base/commit
mappings when a shared repair changes a worker's base. Preserve expectations except
for recorded test defects or explicitly changed requirements.

## Layer 1: acceptance E2E

Exercise complete application behavior within this repository's boundary, with
mocks allowed for external dependencies such as third-party APIs, persistence
and delivery. Keep the actual UI, validation, authorization, orchestration and
mapping under test for the path being asserted. Use existing tooling and
controlled fixtures/time for deterministic success, failure, recovery and
schedule-boundary scenarios.

Assert observable results and outgoing request contracts across the relevant
path, including route loaders and server functions when part of that journey.
Tests exercise the wiring whose failure would prevent the user outcome. Unit
helper tests and components with mocked data and navigation provide supporting
coverage for parts of that journey. Name which boundaries are mocked. Real
external delivery, retries and deployment readiness are outside this layer;
simulated outcomes establish only this application's handling of them.

## Layer 2: live Playwright

Run Playwright against the development environment in a visible real browser,
with real interactions and no mocks. Exercise sign-in, navigation, forms and
results through the actual application. Verify external effects through real
readback; an accepted request establishes only that it was accepted.

Infrastructure belongs to the harness; feature journey specifications belong to the
feature's verification work. Use the explicit development URL. Record the target,
revision, scenarios, results and relevant rendered evidence. Report missing access
or backend capability as a blocker. Live write scenarios require authorization for
their effects and test data.

## Delivery and review

Dispatch the scenario plan with each ticket; retain the resulting executable-test
mapping and red/green evidence in the issue verification record.
Before review, run the selected layers and report their results separately. For each
confirmed review defect, add the smallest meaningful regression test at the owning
layer; related unit tests can supplement journey coverage. Reviewers assess both
implementation and coverage of every in-scope criterion in the mapping.

Honor explicit task scope. An E2E-only assignment creates and runs layer 1, excludes
live Playwright work, and can complete that scoped task without layer 2. Report
layer 2 as excluded by request and name any outstanding integration acceptance in
full delivery claims. Review the selected scope using the recorded layer exclusions.
