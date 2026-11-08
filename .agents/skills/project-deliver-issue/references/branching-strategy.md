# Issue branching strategy

Before preparing a branch, resolve the issue's tracker, target ref and dependency revisions using the [delivery policy's approved defaults](../../../../docs/agents/issue-delivery-policy.md#local-delivery-defaults) and explicit issue overrides. Pin the chosen refs to full SHAs. Preserve an existing issue branch and any unrelated work when continuing a task. Resolve remote publication authority when publication is requested.

The delivery base is always the latest local `demo` tip. With dependencies, pin each to a full SHA on its branch; each must descend from `demo` and from the previous dependency, and the last one becomes the feature base.

## Feature branch

Name the issue branch `<type>/<NN>-<slug>`, where `<type>` is one of `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `build`, `ci` or `chore`, and `<NN>` is the local issue number. Review the complete issue delta against the confirmed base and target; report compatibility and actual verification before any remote write.
