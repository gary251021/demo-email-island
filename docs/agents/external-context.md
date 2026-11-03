# External Context Routing

## Purpose

Establish each fact through its owning implementation: local code for behavior
this repository owns, and the external owner (a sibling service, a third-party
API, a platform contract) for facts this application only consumes, transports
or displays. External inspection is read-only unless the user explicitly
includes another repository or system in the change scope.

## Route to external context when

Route outside this repository when a decision-changing question cannot be
answered by the owning evidence available locally. Common triggers:

- **Externally owned data:** the task depends on how a field is created,
  validated or interpreted by the service or API that writes it.
- **Externally owned semantics:** correct behavior depends on a provider,
  authentication or platform contract not defined in this repository.
- **Negative conclusions:** a field is absent or blank locally, and the
  conclusion would be that the fact is unavailable everywhere. Verify the owning
  writer first.
- **Conflicting evidence:** local types, tests, documentation or human
  descriptions disagree about the same domain fact.

Stay local when the question concerns UI, formatting, repository structure,
tooling, or another contract fully defined and verified here. Honor an explicit
scope restriction from the user.

## Choose the owning context

Locate a sibling project beside the current checkout first; otherwise use Git
metadata to find the original repository and search beside it. For third-party
APIs, use the provider's current official documentation. If the owner cannot be
reached, tell the user what cannot be established and continue work that does
not depend on it. Product intent comes from [`CONTEXT.md`](../../CONTEXT.md),
relevant ADRs/specifications, and confirmed human requirements.

## Investigation method

1. State the precise question and why its answer changes the task.
2. Inspect local code and documentation to identify the boundary, consumer, and
   likely owner.
3. Trace one narrow representative path through the owning sources, for example
   `external input → API contract → write path → stored field → read path → UI`.
4. Check focused tests or executable contracts that confirm the important
   behavior. Current code and executable configuration take precedence over
   README prose.
5. Separate the result into verified current behavior, engineering inference,
   and unresolved product decisions.
6. Stop when the decision-changing question is answered; keep inspection and
   implementation within the agreed scope.

## Interpretation rules

- Treat absence from a local type as "not represented here," not as proof the
  field is absent at its source.
- Treat a value observed in a request as available input, not as proof that it
  is stored or authoritative afterwards.
- Treat a stored field as authoritative only for the fact its owning write path
  enforces.
- Use another field as a fallback only when both represent the same domain fact
  and that equivalence is explicitly enforced.
- Prefer missing or unknown output over an unsupported inference.
- Keep production data read-only, and access it only when the task requires
  runtime evidence and the user has authorized it.
- Keep credentials, session data and personal records out of output.
