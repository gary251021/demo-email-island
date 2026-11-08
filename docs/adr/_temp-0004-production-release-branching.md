# Production versions come from human-selected release branches

Temporary reference only. The fixed branch, version, build and release conventions below are not adopted for this project. See the workflow reconciliation TODO in `project.md`.

Status: Not adopted here

Date: 2026-08-06

Supersedes: [ADR 0003](0003-deployment-versioning.md)

## Context

The previous model used release-relative values such as `1.1.0(3)` for dev
artifacts and fell back to `package.json.version` outside tagged builds. That
made package metadata, development source identity, production application
version, changelog grouping, and Git history overlap. It also left direct
feature-to-production delivery available even though a human must decide what a
release contains.

## Decision

A production application version exists only as a SemVer Git tag `vX.Y.Z` on
the final `deploy/prod` commit. `package.json.version` remains package metadata
and has no release, changelog, branch-base, artifact, or image-naming role.

Dev artifacts expose the technical identity `dev-<full source SHA>` and the
source SHA. They do not expose an application version.

Ordinary feature and fix branches follow the pinned production and dependency
bases in [delivery policy](../agents/issue-delivery-policy.md). Since 2026-10-16,
agents implement and commit directly on the feature branch under that policy.
The ordinary issue MR targets `deploy/dev` and closes the issue there. Retain the
feature branch for subsequent changes and possible release selection.

A human controls every production operation: choosing the source branch,
selecting the release contents and version, building the production image,
creating and merging any production MR, tagging, and deploying. Agents must not
initiate these operations. They may preview an exact proposed operation and
perform it only after explicit human approval of that preview. These controls
are not enforced by repository policy scripts.

The existing `npm run docker:prod` command remains the approval-gated production
build entrypoint and builds from the human-selected checkout. The existing
`npm run git-tag:prod` command remains available for its timestamped `prod-*`
operational tag. That operational tag is not an application-version source. A
`vX.Y.Z` tag may separately be placed on the final production commit with
explicit human approval when a versioned production release is created.

`feature/harness` is mandatory release infrastructure. Production flows into
the harness, and the pinned harness flows into dev and each release. Dev never
flows back into the harness.

## Consequences

- Production version, source identity, and package metadata each have one role.
- Production branch and release selection remain explicit human decisions.
- Agents do not choose production inputs and may validate, build, tag, merge, or
  deploy production only after previewing the exact operation and receiving
  explicit human approval for it.
- Release-candidate fixes use dedicated branches and record an equivalent dev
  application. An urgent current-production fix uses a separate release with
  a new greater patch version; active later releases then incorporate the new
  production tip.

No production deployment script is introduced until destination, credentials,
rollback, and health-verification contracts are confirmed.
