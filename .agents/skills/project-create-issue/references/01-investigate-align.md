# Investigate and Align

Start from the retained feature outline. Investigate only questions that affect
the proposed behavior, scope, implementation contract or delivery. Follow the
repository's [external-context routing](../../../../docs/agents/external-context.md)
when this repository does not own a decision-changing fact; sibling inspection remains
read-only context unless the user expands implementation scope.

Resolve the source revision through
[`docs/agents/issue-delivery-policy.md`](../../../../docs/agents/issue-delivery-policy.md),
including applicable issue dependencies, and record its ref and full commit SHA.
Read affected owners and callers at that revision and identify source evidence by
revision, path and symbol. Follow the applicable contracts routed by
[`docs/agents/project-architecture.md`](../../../../docs/agents/project-architecture.md)
when ownership or dependencies change.

Establish:

- verified current behavior, distinct from inference and human decisions;
- intended behavior, scope, preserved invariants and observable completion;
- existing owners, helpers and patterns to reuse without changing domain meaning;
- issue dependencies and remaining human-owned decisions.

Stop investigating when those points are established. A dependency exists when
this issue must consume code or behavior owned by another issue; record its
feature branch and verified commit when available.

The main agent reviews the retained evidence before alignment. Investigation is
complete only when the source baseline, affected owners and callers, verified
current behavior, dependencies, decision-changing facts and remaining human
choices are recorded.

## Choose an architectural approach

After gathering the decision-changing context, classify architectural-choice
applicability. A simple change stays within one module's existing responsibility,
uses an established implementation pattern, preserves cross-module contracts and
dependencies, and leaves no consequential architectural tradeoff unresolved.
Classify by responsibility boundaries, including when the change touches multiple
files within one responsibility. For this case, cite the inspected owners,
contracts and existing implementation path that establish the fit, record the
existing approach and proceed without asking the user to pick.

For changes spanning module responsibilities or leaving consequential ownership,
data-flow, dependency or contract choices unresolved, before drafting the issue
present 2–3 viable, meaningfully different architectural approaches grounded in
the inspected source and project contracts. Compare responsibility boundaries,
data flow and dependencies, reuse, and the practical tradeoffs in complexity,
delivery effort and operational behavior. Keep each option concise and recommend
one with a reason; distinguish verified feasibility from remaining uncertainty.

Ask the user to select or revise an approach and wait for their answer before
work that depends on that choice, including dependent validation and drafting;
independent read-only investigation may continue. Record the options and selected
approach in the checkpoint, then carry the agreed boundaries into the issue's
`For Agent` design. Reuse an explicit selection already made in this run. When
only one approach is viable, explain the constraint and ask the user to accept it.
If later validation invalidates the selection, return to this choice with the
new evidence before drafting.

## Align with the user

Follow Matt Pocock's `grilling` skill for human decisions: map the decision tree,
ask the complete currently answerable frontier with recommendations, wait for the
answers, and ask dependent questions in later rounds. Ask for decisions that
change behavior, scope or a contract. Establish source facts through inspection.
Reuse retained explicit answers and confirmation covering the same scope; when a
missing source fact blocks a concrete question, investigate that fact and resume
the same alignment.

For UI or report changes, state the concrete default output: placement, initial
selection, visible labels or ranges, representative contents, relevant
missing/empty states, and action outcomes. Settle product choices with the user.

For code changes, name the source snapshot, existing owners and symbols, what is
added, changed or reused, and consequential responsibility, dependency or
abstraction choices consistent with the project contracts.

Use [code-design validation](03-code-design-validation.md) only when source
inspection and established patterns cannot settle a consequential design choice,
or when the user requests proof. Use [UI-design validation](04-ui-design-validation.md)
only when the user requests a demo or a material visual or interaction choice
must be seen or tried. Decide these independently and record their applicability
and evidence-based rationale in the checkpoint. Preserve an explicit request for
proof. When skipping conditional proof, identify the inspected source or current
UI pattern and explain how it settles the relevant choice.

A listed dependency is coupled. Record separate delivery only after an explicit
human decision supported by accepted evidence.

Alignment is complete when two reasonable implementers would produce the same
user-visible result and respect the same agreed responsibilities, contracts and
exceptions, every applicable architecture choice is accepted, required code-fit
or runnable UI proof has been completed and inspected, and no material choice is
unresolved. Complete each required proof type under its own acceptance criteria.
Present the resulting contract and wait for the user to confirm the shared
understanding before drafting, following the distinct decision responsibilities in
the [checkpoint](00-run-checkpoint.md#retained-evidence). Save the accepted decisions
and unresolved work there.
