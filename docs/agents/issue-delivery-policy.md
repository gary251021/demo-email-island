# Tracked-issue delivery policy

Before preparing an issue branch or change request, identify the tracker, Git remote, base revision, target branch, dependency relationship, and publication authority from this repository's current configuration and the issue. Record exact refs and full SHAs. If a required value is missing or ambiguous, ask for the project decision instead of deriving it from another repository's policy.

## Direct implementation

Keep the implementation on the approved base and verify it against the approved target. Show the exact change and verification results before any remote publication. Preserve unrelated work and use the repository's actual test commands.

The prior production-tag, development-branch, and harness-branch policy is parked in [_temp-issue-delivery-policy.md](_temp-issue-delivery-policy.md). Its branches and release rules are not configured by this document. Do not run preparation scripts that assume those values until they are reconciled with the current project.
