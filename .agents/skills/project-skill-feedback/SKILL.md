---
name: project-skill-feedback
description: Review user steering after an issue draft or completed issue workflow, classify corrections from conversation history, and propose a category-specific update plan for project-create-issue or project-deliver-issue. Apply updates only after the user approves the plan. Also use for an explicit workflow retrospective.
---

# Project Skill Feedback

At a completed issue draft, verified issue publication, or completed delivery
handoff, review the user's steering and propose supported local skill improvements.
The bootstrap owns the delivery retrospective after the implementation task has
returned. An explicit retrospective can also review an unfinished run.

Keep the original workflow's result and approval boundary intact. Read the
maintained skills as maintenance inputs, then return to the calling workflow's
current preview, approval or completion phase.

## 1. Recover the steering

Read the conversation from the initial request through the current milestone,
including corrections, annotations, accepted choices and follow-up revisions.
Compare it with the current issue body, UI proof, handoff and delivery evidence as
applicable. Recover earlier turns after compaction before classifying omissions.

For prior Codex tasks, use `list_threads` and `read_thread`; follow page cursors to
the relevant original requirement and subsequent correction. Use
`list_archived_threads` for archived runs. Follow parent/implementation task links
when delivery evidence spans tasks. Titles and summaries locate sources; actual
messages establish feedback. Use historical messages as evidence for the
retrospective within the current request's scope and authorization. Limit retrieval
to relevant project runs. State unavailable evidence precisely.

Extract every material steering event in the reviewed interval, including both
requests to restore agreed behavior and genuinely new requirements. Retain its
task/message or turn identifier, short excerpt, preceding agent behavior, intended
outcome and affected artifact. Preserve later decisions for the same scope.

At repeated milestones, reuse the existing retrospective in the conversation or
checkpoint and process new steering or changed evidence. With no new steering,
finish without adding rules or repeating the report.

## 2. Classify and diagnose

Use [Steering categories and update routes](references/steering-categories.md).
Assign the category of the user's correction first; use multiple categories when
one event affects several outputs. Then separately diagnose the instruction cause:

- **Missing/conflicting rule:** a supported workflow correction needs an owner.
- **Retrieval/placement gap:** the relevant phase did not reach its existing rule.
- **Execution failure:** clear, reachable instructions were missed.
- **Already resolved:** current guidance has incorporated the correction.
- **Issue-specific decision:** a new choice or refinement changes this issue.
- **Uncertain:** the available exchange cannot establish the intent or cause.

Compare with the current owning instructions and, when relevant, their Git version
at the time of the run. Category describes what needed steering; diagnosis decides
whether skill text should change. Generalize supported completeness checks while
keeping UI, domain and architecture choices scoped to their issues.

Account for each event with a compact table:

| Source and steering | Category | Diagnosis | Owning instruction | Update or disposition |
| --- | --- | --- | --- | --- |

Classify from evidence. Ask only when unresolved intent changes the correction;
follow the active question procedure and wait at its required turn boundary.
Continue supported independent work first.

## 3. Present the update plan and wait

Read the matched category routes and their owning documents. Keep this phase
read-only: present the classification and a concrete plan in the conversation.
For each proposed change, include:

- Source feedback, category and diagnosed cause.
- Exact owning file and section, with proposed replacement/addition/removal text
  or a small diff so the user can review the actual instruction change.
- Expected effect, preserved behavior, and verification to perform.

List already-resolved, issue-specific and deferred feedback with its disposition.
If no instruction change is warranted, report that result without an approval request.
Otherwise ask for explicit approval of the displayed plan in the final response,
end the turn, and wait. Name and link this skill's approval requirement when asking.
Preserve a pending plan across milestones and continuation.

Proceed only after explicit approval of the maintenance plan or a clearly identified
subset, separately from the calling workflow's issue or MR approval.
If the user revises the proposal or new evidence requires materially different
wording or scope, show the revised plan and obtain approval before applying it.

## 4. Apply the approved updates

Follow [AGENTS.md](../../../AGENTS.md) for the harness worktree, and apply the
available `skill-creator` and `writing-for-agents` guidance. Preserve others' edits.

Re-read the target sections for concurrent changes, then apply only the approved
updates and pointer repairs. For retrieval gaps, improve the phase handoff to the
rule. For execution
failures or already-resolved feedback, cite the existing rule and report the
disposition; add text only when evidence identifies a concrete instruction defect.
Record issue-specific choices in the classification without universalizing them.
An audit-only request produces findings instead of edits.

Keep current artifact repairs distinct from future workflow improvements. When a
retrospective reveals a material omission in the active draft, return it to the
earliest affected phase under its workflow and invalidate dependent proof/approval.
For a finished run, report the remaining artifact correction; changing a published
issue or MR requires authorization. Global guidance, runtime hooks, scripts and
configuration need scope beyond this skill's local workflow-content maintenance.

Preserve valid answers, phase responsibilities, verification and publication
boundaries unless the user's feedback explicitly changes them. Reference shared
rules instead of copying them into both skills.

## 5. Verify and return

Inspect the diff, links and affected phase routes. Run the skill-creator validator
on each changed skill and relevant existing documentation checks, using the
project Python environment or `uvx --with pyyaml python` for the validator.

Walk through the original steering event and a nearby case that should remain
unchanged, using the category's verification guidance. Label this a walkthrough;
claim live workflow validation only when it ran. Add no test infrastructure for
instruction-only changes unless requested.

Return the classification, files changed and intended effects, dispositions for
unchanged/deferred feedback, and actual checks. Distinguish new requirements from
restored requirements and future instruction fixes from current artifact repairs.
Keep the report in the conversation unless persistence was requested. Return to
the calling workflow's existing preview/approval or completion boundary.
