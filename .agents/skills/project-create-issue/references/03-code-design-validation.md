# Code Design Validation

## Decide whether code-fit proof is needed

Require the minimal code experiment and inline snippet preview only when the
issue is complex enough that source inspection and existing patterns cannot
confidently settle a consequential ownership, abstraction, dependency, contract
or integration design choice. Also honor an explicit request for code-fit proof.
Judge applicability by design uncertainty.

For a simple issue, skip both the experiment and snippet preview only after
inspected sources establish the responsible owner, the existing implementation
path to reuse and preservation of the relevant contracts; record that evidence
and rationale. Pure documentation/workflow issues also skip the application
experiment. The skip is the main agent's call. Decide UI-demo applicability
separately through
[UI design validation](04-ui-design-validation.md).

When required, write the smallest real change that exercises the consequential
design boundaries before previewing the issue. Use the experiment as design
evidence; product implementation remains in the separate delivery workflow. A
worker prepares the experiment and checks; the main agent accepts the evidence or
returns material findings to alignment.

## Prepare an isolated baseline

Use a fresh temporary Git worktree at the policy-resolved source SHA. Record the
source ref and SHA, applicable harness revision and prepared experiment base.
Bring a separately configured workflow source into the disposable workspace only when the project's delivery policy requires it; identify preparation that changes a relevant application path. Compare the
experiment against the prepared base so harness work is not attributed to the
issue. Unresolved dependencies or preparation conflicts are blockers.

Use declared dependencies and project commands; keep experiments isolated from
the caller's checkout and shared branches.

## Exercise the proposed design

Put the minimal code in its intended application files and connect real imports,
callers and types across every consequential boundary claimed as validated.

Choose validation appropriate to the experiment and project contracts, including
code quality checks. Report actual results, distinguishing new findings, baseline failures
and verification limits. Return material findings to alignment and rerun affected
proof before preview.

The main agent accepts technical proof by inspecting the application experiment's
connected change and actual check results against the claimed design boundaries.
Return every new material behavior, ownership or contract choice exposed by the
proof to the grilling decision flow for the user's selection.

## Retain the evidence

Retain enough evidence outside the repository to trace the experiment and its
results through publication. In [the issue contract](02-issue-contract.md), include only final
checked excerpts that explain ownership, interfaces, reuse and caller/dependency
direction, labeled by file and symbol. Required algorithm behavior belongs in
acceptance criteria; full diffs, logs and diagnostics remain internal.

Keep the temporary implementation separate from delivery; clean up only this
run's resources after publication.

If the requirement necessarily changes an existing contract, preserve the
failure evidence and specify the smallest adjustment to the configured workflow owner, its rationale and enforcement effect in `For Agent`; explain its practical
effect in the human preview when approval depends on it. Track the adjustment
as pending implementation and the failed check as unresolved.

Resolve environment or prerequisite blockers during alignment. Follow the
delivery policy and require revalidation
when the implementation base changes a relevant owner, caller, contract or
harness rule.
