# Tracked-issue delivery policy

## Local delivery defaults

The default branch and change-request target are local `demo`. Deliver issues as local change-request previews only, with all branches kept local. Preserve existing workspace changes. These defaults are approved project configuration; apply them without asking for confirmation again.

Remote publication and deployment require a later explicit user request. A Git remote is optional for local delivery; record it as unconfigured when absent and continue. Resolve the remote and publication authority when publication is requested.

Before preparing an issue branch or change request, identify the tracker, base revision, target branch and dependency relationship using these defaults and any explicit issue overrides. Record exact refs and full SHAs. Ask only when a required value remains missing or ambiguous after applying the defaults.

## Direct implementation

The delivery base is always the latest local `demo` tip; ordered dependency revisions must descend from it. Keep the implementation on that base and verify it against the approved target. Show the exact change and verification results before any remote publication. Preserve unrelated work and use the repository's actual test commands.

The prior development-branch and harness-branch policy is parked in [_temp-issue-delivery-policy.md](_temp-issue-delivery-policy.md). Its branches and release rules are not configured by this document. The production-tag base rule is retired.
