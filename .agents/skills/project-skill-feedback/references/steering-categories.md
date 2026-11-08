# Steering Categories and Update Routes

Read the routes matching the observed steering. Categories describe the result the
user corrected; instruction causes and dispositions belong to the entrypoint.
Use each update route to prepare the proposed edits. Apply them only after the
user approves the plan under the entrypoint's approval gate.

## Scope and issue-contract completeness

Signals: agreed content disappears, scope expands without agreement, or the issue,
selected UI and backend handoff describe different behavior.

Owners: [checkpoint](../../project-create-issue/references/00-run-checkpoint.md),
[issue contract](../../project-create-issue/references/02-issue-contract.md), and
[preview/readback](../../project-create-issue/references/05-preview-publish.md).

Update route: locate where the requirement was lost. Strengthen reconciliation of
the full accepted scope against the draft and dependent artifacts at that handoff.
Distinguish explicit removal from silence or a later change to a neighboring control.
Require missing decisions to return to alignment; clarify readback when only the
published body lost content. Preserve the human/agent audience distinction.

Walkthrough: a layout revision retains an accepted upload flow; an explicit request to remove the flow updates every dependent contract.

## UI completeness and fidelity

Signals: missing screens, controls or states; a text preview substitutes for a UI
demo; styling diverges from the named design reference; selected interactions fail.

Owner: [UI design validation](../../project-create-issue/references/04-ui-design-validation.md).
For delivered UI, also inspect the verification handoffs in
[delivery](../../project-deliver-issue/SKILL.md).

Update route: identify the omitted agreed surface/state or source baseline. Tighten
demo coverage and rendered interaction acceptance at that point, and carry the
selected result into the issue contract. Separate proof that a demo exists from
proof that the relevant flow works. Preserve evidence-based applicability for
simple changes.

Walkthrough: a required create/edit flow includes editable and locked states and
the chosen layout; a label-only change can still use sufficient current UI evidence.

## Human-facing content and cognitive load

Signals: redundant explanations, repeated facts/counts, implementation details in
human copy, or extra panels that do not help a user act.

Owners: [issue contract / For Human](../../project-create-issue/references/02-issue-contract.md)
for issue copy; [UI design validation](../../project-create-issue/references/04-ui-design-validation.md)
for UI copy. Consult the shared generation rule in [AGENTS.md](../../../../AGENTS.md).

Update route: place the relevance check at the owning output review. Remove
duplication while retaining controls, consequential constraints and timely errors.
Keep necessary implementation contracts in For Agent. A shorter human section
must preserve decision-relevant content and the complete implementation contract.

Walkthrough: a selected row conveys its state without a repeated total; an upload can show its item count when the uploaded items are not displayed.

## Human–agent interaction

Signals: questions bypass `grilling`, appear during the agent loop, repeat settled
answers, or the agent treats its recommendation as the user's selection.

Owners: [consultation](../../project-create-issue/SKILL.md#consult-on-the-feature),
[alignment](../../project-create-issue/references/01-investigate-align.md#align-with-the-user),
and the applicable global question instructions. Delivery decision handoffs are in
[delivery](../../project-deliver-issue/SKILL.md).

Update route: repair the route to the designated question procedure at the decision
point. Retain answers and distinguish proof acceptance, shared understanding and
publication approval. Keep the existing global question policy authoritative;
report a clearly missed rule as execution failure rather than duplicating it.

Walkthrough: unresolved architecture choices stop dependent work for a question
round; an already accepted choice proceeds without asking it again.

## Architecture and domain alignment

Signals: alternatives omit consequential tradeoffs, ownership or database effects
remain unclear, scale constraints surface late, or a technical choice misstates
the user's product intent.

Owners: [investigation and architecture choice](../../project-create-issue/references/01-investigate-align.md),
[code-design proof](../../project-create-issue/references/03-code-design-validation.md),
and [For Agent](../../project-create-issue/references/02-issue-contract.md).

Update route: strengthen the decision-changing investigation or comparison that
was missing, then preserve the accepted responsibility, data-flow, persistence and
verification implications in the contract. Route cross-project facts to their
owner. Use the observed scale constraint where applicable; keep the selected
editor, batch strategy or schema specific to the issue unless explicitly generalized.

Walkthrough: high volume may warrant batching; a bounded single-record edit does not acquire an unrelated batching requirement.

## Phase sequencing and evidence

Signals: drafting starts before alignment, a phase is declared complete without
its output, conditional proof is skipped without grounds, or changed artifacts
retain stale acceptance.

Owners: [creation transitions](../../project-create-issue/SKILL.md),
[checkpoint](../../project-create-issue/references/00-run-checkpoint.md), and the
affected proof/preview reference. For implementation and review transitions, use
[delivery](../../project-deliver-issue/SKILL.md).

Update route: repair the affected transition's observable completion criterion,
evidence and responsible reviewer. Inspect the actual phase outputs.
Reopen only invalidated decisions and dependents. Preserve necessary criteria
when trimming prose, and keep phase rules with their owners.

Walkthrough: an issue HTML preview cannot satisfy a required interactive demo;
an inspected proof and valid user selection remain reusable after unrelated edits.

## Delivery coordination and verification

Signals: a handoff loses accepted requirements, ticket scope diverges, verification
misses the agreed behavior, review applies to the wrong patch, or publication
exceeds the authorized endpoint.

Owners: [delivery](../../project-deliver-issue/SKILL.md),
[ticket decomposition](../../project-deliver-issue/references/tracer-bullet-decomposition.md),
[branching](../../project-deliver-issue/references/branching-strategy.md), and
[MR description](../../project-deliver-issue/references/merge-request-description.md).

Update route: follow the issue contract through parent/child, ticket and review
handoffs to the first loss of information or proof. Correct that handoff's inputs
or acceptance check. Put missing reviewer-facing evidence in the MR description;
keep branch and commit invariants with the branching owner.

Walkthrough: an accepted correction reaches ticket checks and full-issue review;
an approved local MR preview still requires publication authorization.
