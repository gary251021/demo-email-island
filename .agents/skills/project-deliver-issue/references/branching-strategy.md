# Issue branching strategy

Before preparing a branch, confirm the issue's tracker, delivery base, target ref, dependency revisions, branch naming rule, and publication authority against current repository guidance. Pin the chosen refs to full SHAs. Preserve an existing issue branch and any unrelated work when continuing a task.

If this repository has not configured those choices, stop before running branch-preparation scripts or creating a branch. The previous production-tag and `feature/harness` conventions are parked in [_temp-branching-strategy.md](_temp-branching-strategy.md). Their associated scripts still expect those conventions and need reconciliation before use.

## Feature branch

Use the confirmed project convention to name the issue branch. Review the complete issue delta against the confirmed base and target; report compatibility and actual verification before any remote write.
