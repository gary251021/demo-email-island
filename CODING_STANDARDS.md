# Coding Standards

## Owning contracts

- [Code change principles](docs/code-principle.md) own source-backed types,
  readable implementation, and retirement of removed surfaces.
- [Project architecture](docs/agents/project-architecture.md) routes frontend,
  and backend ownership and dependency rules.
- [Test principles](docs/agents/architecture/test-principles.md) own test scope
  and style; [acceptance testing](docs/agents/acceptance-testing.md) owns
  rendered-state and journey evidence when applicable.

## Existing-pattern consistency

For new files or classes, compare the closest existing equivalent's structure,
name, location, dependency injection, validation, logging, and error handling.
Reuse existing services and helpers. Documented contracts take precedence over
inconsistent legacy code; within those contracts, existing patterns are the
primary style criterion. Justify deviations with a concrete requirement.

For added local helpers or utilities, search beyond the diff for equivalent
functionality in existing project helpers, standard APIs, and installed
dependencies. Flag unnecessary reimplementation when an existing option
satisfies the same behavior; cite that option and any relevant semantic
differences.

## Shared contracts

For changes to shared payloads or persisted data, follow
[external context routing](docs/agents/external-context.md). Compare the owning
producer and relevant consumers field by field, including names, enums,
statuses, and state transitions. Record mismatches or unavailable evidence
before relying on that contract.

## Correctness risks

Check reachable failure paths in the affected flow and callers: empty-object
query matches, merged operators, claim/update races, idempotency, missing awaits,
rejected promises, pagination boundaries, provider batch limits, empty-array
calls, and timezone/date handling. Tie each applicable risk to a concrete input
or state and observable result.
