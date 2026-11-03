# Production release workflow

This is the human-readable sequence for preparing a production release.
Tracked-issue baselines and development targets are owned by
[`docs/agents/issue-delivery-policy.md`](issue-delivery-policy.md); this document starts from the later human
release-selection decision.

## Future migration (not active)

For planning the future workflow (adoption version TBC), see the
[GitLab Flow migration plan and illustrated examples](one-off/2026-09-10-gitlab-flow-migration-plan.md).
The release sequence below remains active until the coordinated migration is
implemented and a human explicitly approves its activation.

## Version signals

| Signal                                 | Purpose                                              |
| -------------------------------------- | ---------------------------------------------------- |
| `vX.Y.Z` on final `deploy/prod` commit | Production application version and changelog release |
| `dev-<full SHA>`                       | Dev artifact/image identity                          |
| build/source SHA                       | Deployment and health-verification identity          |
| `package.json.version`                 | npm package metadata only                            |

## Release sequence

1. Identify the latest SemVer tag on the current `deploy/prod` tip.
2. A human chooses the next version and creates `release/vX.Y.Z` from that tag.
3. The human records the exact `feature/harness` commit and the feature/fix
   branches selected for this release.
4. Verify every selected feature commit already reached `deploy/dev`. Do not
   derive the selected set by merging all of dev.
5. Merge the pinned harness and each selected feature/fix branch individually
   into the release branch.
6. Run the desired quality and test checks. Record included features, fixes,
   intentional exclusions, and verification in the human release notes.
7. After explicit publication confirmation, push the release branch and create
   one MR from `release/vX.Y.Z` to `deploy/prod`.
8. A human evaluates the release set and squash-merges the MR.
9. A human tags the resulting production commit with the matching `vX.Y.Z`.
10. The human may build the selected checkout with `npm run docker:prod`, save
    and gzip the image, and perform the remaining deployment operations.

Production operations, including this sequence, start with the human. Agents
present the exact proposed operation as a preview and act only after explicit
approval of that preview;
branch choice and release contents remain human decisions.

## CI compatibility

The live server is GitLab 17. Validate CI configuration changes against its
live CI lint endpoint before publication.

## Human release notes

The production MR includes:

- version and production base tag;
- pinned harness full SHA;
- selected feature branches/commits and their dev MRs;
- release fixes and equivalent dev application;
- known exclusions; and
- exact verification results.

These notes are human review material. No repository script parses or enforces
their contents.

## Fixes

A release-candidate fix uses a dedicated `fix/*` branch, merges into the release,
and records how the same behavior reaches dev. An urgent fix for current
production uses a separate release with a new greater patch version from the
latest production tag. Any active later release incorporates the new
production tip before continuing.

## Long-lived harness

`feature/harness` is mandatory in every release. Merge production into the
harness as releases advance; merge the pinned harness into dev and releases.
Keep `deploy/dev` out of the harness; merging it would import unselected
features and bypass release selection.
