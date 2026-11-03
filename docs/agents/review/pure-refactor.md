# Pure refactor quality review

Use only when the accepted task explicitly aims to improve code quality while
preserving behavior. Read its goals and scope, [code principles](../../code-principle.md),
and the relevant [architecture contracts](../project-architecture.md).

## Quality and behavior

Compare before and after against the accepted goals. Look for fewer concepts,
branches and unnecessary layers, clearer responsibility, lower coupling and
direct, readable flow. Support each claimed improvement with before/after
evidence tied to the accepted goals.

Use smells to guide evidence gathering:

- Misleading names, duplicated domain decisions, repeated switches and scattered
  changes: identify the shared responsibility before suggesting extraction.
- Feature envy, data clumps and responsibility mixing: find the actual owner;
  justify any new types, classes or polymorphism by that responsibility.
- Pass-through wrappers, message chains and speculative options: prefer deleting
  indirection to adding another abstraction.
- Bespoke helpers: reuse existing code, standard library, native features or an
  installed dependency only when it preserves the required semantics.
- Casts, optionality and defaults: establish the real data contract. Preserve
  validation, legacy handling and legitimate unknown input at trust boundaries.

Compare observable outputs, side effects and their ordering, error paths,
missing-value handling and affected callers. Relevant tests and characterization
evidence must support behavior preservation.
Preserve security, error handling, accessibility and meaningful test coverage.

## Findings

Return FAIL for a contract violation, behavior regression or demonstrated
failure to meet an accepted quality goal. Cite the goal, before/after evidence,
practical impact and a concrete remedy within scope. Report high-confidence
findings grounded in these criteria.
Return BLOCKED for missing goals or evidence needed to judge preservation;
otherwise PASS with evidence of the requested improvement.

The structural-simplification and high-confidence-finding ideas draw on
[Cursor's quality review](https://github.com/cursor/plugins/blob/main/cursor-team-kit/skills/thermo-nuclear-code-quality-review/SKILL.md).
Repository contracts and this task's accepted goals determine the approval bar.
