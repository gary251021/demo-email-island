<!-- documentation-origin: Matt Pocock workflow configuration; project-specific -->

# Domain Docs

How engineering skills should consume this repo's domain documentation.

## Retrieval routes

- [Product overview](../product-overview.md) introduces the core concepts,
  capabilities, and surrounding projects for product consultation.
- [`CONTEXT.md`](../../CONTEXT.md) defines current domain vocabulary and boundaries.
- `docs/adr/` contains accepted and superseded decisions.
- `docs/specs/` contains dated design contracts.
- `docs/plans/` contains implementation plans and progress records.
- `docs/reports/` contains dated evidence snapshots. Individual reports are
  intentionally not linked from agent guidance.

## File structure

This is a single-context documentation layout:

```text
/
├── CONTEXT.md
└── docs/
    └── adr/
        ├── 0001-example-decision.md
        └── 0002-example-decision.md
```

## Use the glossary's vocabulary

When output names a domain concept, use the term defined in [`CONTEXT.md`](../../CONTEXT.md). If the concept isn't documented yet, note the gap for domain modeling.

## Flag ADR conflicts

If output contradicts an existing ADR, surface the conflict explicitly.
