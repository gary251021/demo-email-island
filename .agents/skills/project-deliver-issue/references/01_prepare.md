# 01 — Prepare the feature branch

## Executable operation

Run sibling [01_prepare.mjs](01_prepare.mjs) `prepare` for fresh delivery.
JSON input: `issue` (string), `type`, `slug`, `productionTag`, optional `repo`,
and optional `dependencies: [{ branch, sha }]`. This delegates to the existing
branch-preparation implementation and returns its pinned metadata. It mutates
Git; on failure, inspect the reported repository state before retrying.
Direct continuation uses the existing feature branch and phase 02 validation.

Use `For Agent` as the issue specification, independently of `For Human`.
Discover applicable project guidance and existing implementations before
decomposition. Project rules supply engineering procedures; explicit
issue-specific overrides govern the stated exception.

Resolve the recorded production tag to a full SHA and prepare the issue branches
using [the branching strategy](branching-strategy.md). Continue on
the existing feature branch when continuing that same issue.

Resolve and pin the issue's ordered dependencies under the delivery policy and
branching strategy. Complete any approved dependency-branch adjustment before
preparing the current issue; an unresolved or mismatched branch/SHA is a
readiness failure.

For explicitly approved permanent harness or release infrastructure, record
`feature/harness` as an additional preview target. Ordinary issue delivery has
only the configured development target.
