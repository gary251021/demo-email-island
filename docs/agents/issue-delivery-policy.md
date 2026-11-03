# Tracked-Issue Delivery Policy

This project records an ordinary issue's publishable baseline when the issue is
created, then delivers that fixed business patch to the current development
target.

## Pinned production baseline

At issue creation, resolve the current `origin/deploy/prod` tip and require
exactly one SemVer tag `vX.Y.Z` at that commit. Record that tag in the issue's
`Delivery` section.

The recorded tag is the issue's immutable production root. Delivery resolves it
to a full commit SHA and records that SHA in its delivery evidence and MR
preview. A missing or non-commit tag requires a human decision.

## Issue dependencies

An issue dependency is coupled. Ask about separate delivery only when accepted
evidence indicates that override or conflicts about shipment intent; only an
explicit human decision records `Delivery override: separate`. Show the human an
ordered delivery relationship from the production root through each coupled
feature branch to the current feature and MR target.

Record dependencies in that traversal order with their issue and feature branch.
Before implementation, pin each branch to a required full commit SHA. The branch
locates the work; the SHA is authoritative. Require each SHA to be on its named
branch and descend from the previous production or dependency revision. The last
revision is the feature base.

A coupled issue feature starts from that feature base and may coexist with a
standalone MR for its dependency. Its MR targets the configured development
branch and carries the dependency chain. If the target already contains a
dependency, GitLab naturally omits that dependency from the visible diff.

For explicit separate delivery, base the implementation on the dependency but
target its feature branch until the required SHA reaches the configured
development branch; then retarget there. This keeps the dependent MR limited to
its own patch. Before preparing the dependent feature, place any
conflict-reducing change within the dependency's accepted contract on that
dependency branch, keep it in the dependency MR, and pin the resulting SHA. A
change to the dependency's accepted behavior requires a human decision.

## Development target

Ordinary coupled issues target the current `deploy/dev`. Before publication,
verify that the issue patch is compatible with its current tip. An explicit
separate delivery temporarily targets its dependency feature as described above.
Production promotion remains human-controlled outside the agent workflow.

Mandatory long-lived harness or release infrastructure may additionally target
`feature/harness` only when both the issue and human explicitly classify it as
the project workflow's infrastructure exception.

## Direct implementation

Create the issue feature at its pinned production-or-dependency feature base,
then implement and commit directly on that branch. Continue subsequent changes
for the same issue on that feature branch. Review the complete issue delta from
its recorded feature base and verify compatibility with the development target.

Harness maintenance follows [AGENTS.md](../../AGENTS.md): edit and commit verified
workflow changes directly on the linked `feature/harness` checkout, then merge
that branch into `deploy/dev`. Issue delivery consumes the configured workflow;
it does not merge or copy harness changes into feature branches or create a
`local/int` branch. Pin the workflow source path and revision in the handoff when
an older production baseline contains older instructions, and read/run the current
workflow from that source while passing the issue checkout as `repo`.

The pinned production root, dependency relationship and publication gate remain
unchanged. Detached worker or baseline worktrees are needed only for actual
parallel work or isolated verification.
