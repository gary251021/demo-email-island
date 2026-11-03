---
name: project-create-issue
description: Create one GitLab issue for a feature or bug in this application, with context from related projects. Works best when you know the relevant business context and can share even a rough desired change or observed problem; details and technical feasibility may remain unresolved.
metadata:
  routed_by: general-workflow
  configured_by: general-setup-workflow
---

# Project Create Issue

Create exactly one issue. Temporary code for design validation belongs to
alignment; product implementation and issue delivery are separate requests.
Read each stage only when entering it.

Create the [durable issue checkpoint](references/00-run-checkpoint.md) before
consultation and keep the same run through every phase.

The main agent inspects the checkpoint evidence and actual phase outputs against
the completion criteria below before accepting each transition. Read each linked
stage only when entering it.

1. [Consult on the feature](#consult-on-the-feature). Enter investigation when
   the retained feature outline includes the visible behavior, primary flow,
   scope, open product choices, every answer already supplied by the user and
   the user's shared-understanding confirmation for that scope.
2. Read [investigate and align](references/01-investigate-align.md) and investigate.
   Enter alignment when the source baseline, affected owners and callers,
   decision-changing facts, dependencies and remaining human choices are recorded.
3. Align, including the
   [architectural-choice applicability](references/01-investigate-align.md#choose-an-architectural-approach),
   using [code-design validation](references/03-code-design-validation.md) or
   [UI-design validation](references/04-ui-design-validation.md) when applicable.
   Use the standalone Storybook workspace for every required UI demo; follow
   that reference for readiness checks, issue variants and handoff.
   Enter drafting when required architecture choices are selected, validation
   applicability is justified from evidence, every required proof is accepted,
   the user confirms the resulting shared understanding, and no material behavior
   or contract choice remains unresolved.
4. Read Matt Pocock's `to-tickets` skill for outcome-based acceptance criteria,
   then [draft the issue contract](references/02-issue-contract.md). Enter preview
   when the current human and agent contract retains the complete agreed scope
   and corrections and passes the human-relevance review in that reference.
5. Read [preview, confirm and publish](references/05-preview-publish.md). Publish
   only after the complete current preview was rendered and inspected and the
   user explicitly approved that exact revision. Finish only after tracker
   readback verifies the published issue and supplies its identifier and link.

Keep desired behavior, verified current behavior, inference, and human decisions
distinct. Preserve exact identifiers and domain meaning; apply the repository's
[semantic fallback requirements](../../../docs/agents/external-context.md) when
considering another field.

If a material correction invalidates a decision or output, return to the earliest
affected stage and regenerate its dependents while preserving settled answers and
evidence that remain valid.

After producing the complete issue draft and after verified publication, use
[project-skill-feedback](../project-skill-feedback/SKILL.md) to classify new user
steering and propose an update plan; apply it only after the user approves that
plan. Preserve the current issue approval boundary; return material draft
omissions to the earliest affected stage.
Finish with the confirmed issue's identifier and link, then stop.

## Codex delegation

The main agent owns consultation, alignment, synthesis, artifact acceptance and
publication. Use fresh `gpt-6-luna` explorers at `xhigh` for independent
read-only discovery and fresh workers at the same settings for code-fit work,
UI artifacts, drafting and rendering. Give each agent a bounded question or
output, the evidence baseline, current requirements and access to the checkpoint;
inspect returned evidence before accepting it. Agents report findings; the main agent settles material
decisions and validation applicability, and publishes the issue.
If required delegation is unavailable, leave the work pending and report it;
use another model or execution path only with the user's authorization.

## Consult on the feature

The main agent reads the [product overview](../../../docs/product-overview.md)
and helps the user express incomplete ideas or details they have but cannot yet
articulate, using concrete examples or choices. Use Matt Pocock's `grilling`
skill for this product consultation: ask the currently answerable questions in
rounds, give recommendations, and wait for the user's answers. Scope the discussion
to the feature outline; continue the same questionnaire after investigation for
questions that need technical evidence. Record clear answers and finish with a
feature outline in the checkpoint: expected visible behavior, primary flow,
scope, and open product choices. Reuse explicit answers and confirmation already
provided for the same scope. Before investigation, present the resulting outline
and wait for the user to confirm the shared understanding; a substantive answer
that explicitly confirms the presented outline is sufficient.
Investigate technical feasibility for this outline in the next phase. If
essential product background is missing, use a narrowly scoped
explorer lookup before continuing consultation.
