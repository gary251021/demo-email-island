# 05 Assemble and preview the change request

## Verify the feature

Run the repository's configured checks and the required issue checks in the feature checkout.
Verify the complete publishable delta from the pinned feature base and confirm
every required dependency remains in its ancestry. Use the same feature HEAD
that passed independent review; changed patches require renewed review.

The `verifyTransfer` operation in [05_preview.mjs](05_preview.mjs) is retained
for finishing pre-existing integration deliveries. New deliveries review
and preview their feature directly.

Carry the [review stopping outcome](04_review.md#stopping-rule) into the preview:
include completed round count, final axis statuses, and every unresolved T3 with
its impact when accepted as ACCEPTED_WITH_T3. T1/T2 findings block review acceptance.

Verify the complete issue acceptance criteria using the applicable project
procedures and explicit issue exceptions. Record actual checks and outcomes in
the delivery evidence and MR preview.

Select the MR target under the branching strategy, then check the publishable
patch against it.
For an approved infrastructure exception, check the patch against each confirmed target. Validate CI changes with the project's configured CI provider before publication.

Read [the MR description](merge-request-description.md) and show the
complete change-request preview in chat: source, target, title, body, confirmed base ref and SHA,
ordered delivery relationship, dependency refs and overrides, strategy, business
commits, verification, and the workflow source path/revision.

Once the complete MR preview is prepared, the coordinator uses
[project-skill-feedback](../../project-skill-feedback/SKILL.md) to classify the run's
user steering and propose an update plan; apply it only after the user approves
that plan. Review new steering again after a later authorized publication
completes; retain the existing publication
boundary and report any unresolved artifact correction.

Stop after the preview with every branch local. Push the feature branch or create an MR only on a later explicit request.

When publication is authorized, use the repository's configured provider to create the change request with the confirmed source and target. The target is `demo` under the [delivery policy](../../../../docs/agents/issue-delivery-policy.md) unless the issue records an override. Pass it explicitly (for example `gh pr create --base demo --head <source>`), independent of the remote's default branch. Before creating, confirm the remote has the target branch at the confirmed base SHA or a descendant; otherwise report the missing target instead of creating. After creating, read back the change request's target and source (for example `gh pr view --json baseRefName,headRefName,headRefOid`) and record that they match. Retain the feature branch according to the project's policy.
