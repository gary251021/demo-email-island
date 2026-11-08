# Domain documentation

This repository uses a single-context layout:

- `project.md`: product behavior and requirements.
- `CONTEXT.md`: domain vocabulary and boundaries, when established.
- `docs/adr/`: adopted architectural decisions.

## Before exploring

Read the relevant parts of `project.md`, root `CONTEXT.md` when present,
and ADRs concerning the area being explored. Inspect current application
code when checking implemented behavior.

If `CONTEXT.md` or an ADR directory is absent, continue silently.
The domain-modeling skill creates documentation when terms or decisions
are resolved.

Files prefixed `_temp-` are pending references, as recorded in
`project.md`; treat only adopted decisions as project rules.

## Vocabulary and conflicts

Use terms defined in `CONTEXT.md` and by the current product owner.
Record unresolved vocabulary for domain-modeling. Ask for clarification
when a missing definition changes the result.

Explicitly flag conflicts between a proposal, adopted ADRs, current code,
or user requirements. Name the conflicting decision and explain why it
may need revisiting.
