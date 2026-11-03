# Code Change Principles

Apply to application code and tests. Documentation and harness tooling under
`.agents/**` and `.codex/**` are outside this scope; see
[ADR 0007](adr/0007-human-audit-and-harness-lint-boundary.md).
Preserve runtime behavior except for the changes requested by the task.

## Source-backed types

Derive types from the owning model, validated input schema, API contract, or
component props. Repair a weak contract at its source rather than hiding it in
callers with `any`, broad objects, or assertions. `unknown` is appropriate for
unvalidated input; narrow or validate it before use.

For example, `(response as Record<string, unknown>).data as UserSummary[]`
hides a contract gap. Use the existing response contract, or validate unknown
external input at its boundary and infer the type from that schema.

Intentionally incomplete sources such as an untyped third-party payload may require a local
assertion. Base it on an established contract and keep its scope narrow.
After changing a source contract, revisit affected callers and remove obsolete
casts, guards, or duplicate types only when their behavior is still covered.
A field read, branch, or side effect missing from a declared type may represent
persisted or compatibility behavior; establish its meaning before removing it.

## Defensive code

Guard where the contract allows the state: unvalidated input, external I/O, and
documented optional fields. Inside that boundary, trust typed and validated
values and let errors propagate to the layer that handles them. A fallback such
as `?? []`, a `catch` that logs or returns a default, or a second null check
needs a named reason in the owning contract; otherwise remove it. The
[overdefensive-review](../.agents/skills/overdefensive-review/SKILL.md) skill
applies this rule; `.codex/hooks/check-overdefensive.mjs` triggers it at stop.

## Readable implementation

- Keep each unit focused on its owning responsibility. Give domain values and
  steps names that expose their meaning to the caller.
- Keep control flow direct: use clear conditions and early exits where they
  simplify reading; avoid deeply nested branches and hidden side effects.
- Keep short cohesive logic together. Extract a private method for a named step
  owned by the same class; separate a module when it owns a distinct responsibility.
- Add abstractions for actual responsibilities or consumers. Avoid pass-through
  layers and indirection that make the reader jump between files without adding
  meaning.

Use the [architecture router](agents/project-architecture.md) for
frontend ownership and backend class/utility rules. Readability checks are a
final gate for possible problems; these principles guide the initial design.
Resolve findings within the requested scope instead of mechanically splitting
code or refactoring unrelated legacy code.

## Retire removed surfaces

After a removal, tests, comments, and names describe the remaining contract.
For example, assert the expected remaining columns rather than only
`not.toContain("rules")`, which can pass while those remaining columns are wrong.
Keep an absence assertion when absence is itself a live requirement, such as
access control, sensitive-data exclusion, or an intentionally withdrawn API.
