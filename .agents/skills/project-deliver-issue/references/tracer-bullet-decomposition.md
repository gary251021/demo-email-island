# Tracer-Bullet Decomposition

Split by dependencies and independent ownership, starting with the smallest
working foundation that unlocks the rest. Use one ticket when splitting adds
coordination without useful parallel work.

The foundation establishes shared contracts with a minimal working path that
exercises them. A shared interface is sufficient when its behavior is independently
verifiable; otherwise include a thin end-to-end implementation to expose integration
assumptions. Keep enabling prefactoring limited to what that path needs.

Then identify work that can proceed concurrently against those contracts.
Each ticket fits one bounded implementation assignment, delivers a verifiable outcome, and
owns explicit files/modules. Add blocking edges for real data, interface or
ownership dependencies. Keep shared-file changes in prerequisites or serialize
the affected tickets. Dispatch work against settled public contracts as soon as
its own inputs are ready. Each implementer owns application code and its tests;
assign shared/cross-ticket test ownership once. Test completion and baseline red
are acceptance evidence, not an independent test-author prerequisite.
Wait for the integrated foundation only where executable
prerequisite code is required. The final combined issue must satisfy the full acceptance criteria.

For a wide mechanical refactor, use expand-contract: establish the new form,
migrate independent callers in parallel green batches, then remove the old form
after every migration. Batches that cannot stay green independently remain coupled.

Return each ticket with:

- **Title**
- **Blocked by**
- **Owned files/modules**
- **What it delivers**, including shared contracts it establishes or consumes
- **Acceptance scenarios**: criterion IDs, inputs/actions/expected outcomes and mock boundaries
- **Test owner and owned test paths**, including cross-ticket acceptance E2E journeys
- **Readiness**: required contracts and actual prerequisite commits

Show the foundation and the subsequent ready groups. Recompute readiness as
prerequisite commits integrate; execution and worktree handling belong to
[Ticket chats](03_implement.md#ticket-chats).
