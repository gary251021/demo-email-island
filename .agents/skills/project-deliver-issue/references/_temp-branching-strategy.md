# GitLab Issue Branching Strategy

Temporary reference only. These fixed refs and preparation rules are pending the workflow reconciliation TODO in `project.md`; use [the active branching guidance](branching-strategy.md) meanwhile.

## Branch roles

| Ref                                  | Role                                    |
| ------------------------------------ | --------------------------------------- |
| issue-recorded `vX.Y.Z`              | Immutable production root               |
| ordered dependency branches and SHAs | Coupled or stacked feature path         |
| `<type>/<n>-<slug>`                  | Current issue's MR source               |
| `feature/harness`                    | Maintained workflow source, merged into dev |

## Feature branch

Select `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `build`,
`ci`, or `chore` from the issue's primary responsibility. Resolve the recorded
production tag, then traverse the issue's dependency list in order. Pin every
dependency feature branch to a required full SHA, require each revision to
descend from the previous one, and use the last revision as the feature base.
Without dependencies, the production revision is the feature base. Create
`<type>/<number>-<slug>` there.

## Direct feature work

Use [phase 01's preparation operation](01_prepare.md#executable-operation)
with the issue's selected type, slug, production tag and pinned dependencies.
It creates and selects the issue feature branch. Continue an existing issue
on its existing feature branch; preserve its recorded production and dependency
pins. Commit implementation and corrections directly there.

Require each assigned worker checkout to be clean at dispatch under
[phase 02](02_handoff.md#dispatch-evidence). A sole worker uses the feature
checkout. Parallel workers use detached worktrees and integrate their commits
serially onto the feature. Review and preview that same feature revision.

Use the configured workflow under [delivery policy](../../../../docs/agents/issue-delivery-policy.md#direct-implementation).
Record the workflow source path/revision separately from application ancestry.

## Merge-request preview

For coupled delivery, target the configured development branch immediately; the
source contains the dependency path even when GitLab omits dependencies already
present on the target from the visible diff.

For an explicit separate-delivery override, inspect the configured development
branch. Target it when it contains the required dependency SHA; otherwise target
the dependency feature branch for review only, do not merge there, and retarget
after its MR merges. Keep any conflict-reducing dependency adjustment in that
dependency's branch and MR, then refresh the current feature.

Prove the resulting MR patch is compatible with its selected target and prepare
the complete MR preview with the ordered delivery relationship.

Explicitly approved permanent harness or release infrastructure also previews
the same feature patch against `feature/harness`. A `.gitlab-ci.yml` change
includes a successful live GitLab 17 CI lint result.
