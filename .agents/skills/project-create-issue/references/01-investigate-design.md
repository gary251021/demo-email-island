# Investigate and Design

## Investigate

Start from the recorded scope baseline. Investigate only what changes how the
slice is built. Follow the repository's
[external-context routing](../../../../docs/agents/external-context.md) when this
repository does not own a decision-changing fact; sibling inspection remains
read-only context unless the user expands implementation scope.

Resolve the source revision through
[`docs/agents/issue-delivery-policy.md`](../../../../docs/agents/issue-delivery-policy.md)
and record its ref and full commit SHA. Read
[`docs/agents/project-architecture.md`](../../../../docs/agents/project-architecture.md)
and every architecture contract it routes to for the layers this slice touches.
Those contracts decide placement; do not invent a layout they already define.

Establish:

- the current code: existing owners, modules, helpers and patterns to reuse,
  identified by revision, path and symbol — or that the area is greenfield;
- installed dependencies and their versions (`package.json`), so new libraries
  fit the stack instead of duplicating it;
- capabilities the slice needs that nothing installed provides (persistence,
  auth/session, external API clients, rendering, validation, …), with 1–3
  candidate libraries each, checked against current official docs for
  compatibility with the framework and runtime in use;
- contracts sibling tickets need from this slice, and contracts it consumes from
  blocking tickets.

### Dependency selection criteria

Prefer existing repository code and standard-library capabilities when they
cover the requirement. For uncovered capabilities, check mature third-party
libraries and their official plugins or configuration before proposing custom
code. When an existing solution fits, use its supported capability rather than
reimplementing it.

Compare candidates against the specific required behavior: out-of-box coverage,
framework/runtime compatibility, integration and operational cost, maintenance,
security, and licensing. Verify decision-changing claims through current official
documentation or source. A library's additional optional features alone are not
a reason to reject it; establish whether they impose an actual cost or constraint
on the required use case.

For any custom implementation of a capability available in a library, record the
candidate evaluated, the concrete gap or cost that justifies custom code, and the
maintenance and security responsibilities the project would assume. "Too broad",
"overkill", or "only a demo" without that evidence is insufficient. Unverified
capabilities remain open questions, not rejection reasons.

Stop when those points are recorded. Investigation is complete when the source
baseline, architecture contracts, affected owners, sibling-ticket contracts,
library candidates and selection evidence are in the checkpoint.

## Propose the implementation design

Present one concrete design revision, following the
[working style](../SKILL.md#working-style-propose-dont-interview). Cover each
point below that the slice touches; mark every default not forced by the ticket,
code or contracts as `(proposed)`.

1. **Approach.** One paragraph: how the slice is built end to end, through which
   layers, and why this shape fits the ticket.
2. **Libraries to introduce.** For each: package, exact version to pin, the
   capability it owns, why it fits the existing stack, and the main alternative
   rejected in one line. State explicitly when no new library is needed and what
   installed code covers the need.
3. **Modules and layers.** The module × layer matrix defined in
   [architecture axes](architecture-layers.md): the functional modules the slice
   adds or changes, the architectural layers each touches with path and
   responsibility, each module's public interface, and the dependency direction
   between modules. Follow that reference's positive and negative cases.
4. **Data and contracts.** Persisted entities and fields, schemas shared across
   the client/server boundary, server function or API signatures, and key types
   — sketched as short type or schema snippets, not prose.
5. **Data flow.** The main path for the ticket's primary flow, from user action
   to persistence and back, including where validation, authorization and caching
   happen. Use a sequence diagram when the path crosses more than two modules.
6. **Prefactoring.** Changes to existing code that should land first to make the
   slice easy.
7. **Foundations for later tickets.** Which modules, schemas or seams later
   tickets will extend, and what this slice deliberately leaves out for them.
8. **Testing seams.** Where behavior is verified (unit, integration, end to end)
   and which boundaries are faked.
9. **Risks.** Unverified library behavior or integration points, the available
   [source evidence](03-code-design-validation.md), and runtime checks to perform
   during delivery.

Accompany every design revision with review-layer illustrations (see
[two output layers](../SKILL.md#two-output-layers)): at least one picture of the
deliverable, plus an architecture or data-flow graph when the slice touches more
than one module, and a comparison chart when choosing between libraries.
Regenerate the affected illustrations with each revision.

When a point has meaningfully different viable options (for example, two
persistence libraries, or server-side versus client-side state), recommend one
and name the alternatives in a line each with why they lost. A single-module
change that follows an existing pattern only needs points 1, 3 and 8, citing the
pattern it follows.

Wait for the user to accept or correct the revision before dependent work,
including validation and drafting; independent read-only investigation may
continue. Apply corrections, present the next revision showing only what changed,
and record each revision and the accepted design in the checkpoint.

Use [code-design validation](03-code-design-validation.md) to distinguish
source-backed claims from runtime questions deferred to delivery. Use
[UI-design validation](04-ui-design-validation.md) for existing UI inspection
and static visual proposals. Both follow the documentation-only boundary;
requests for executable proof belong to a separate task outside this skill.
If inspected evidence invalidates part of the accepted design, present a revised
design before drafting.

Design is complete when two reasonable implementers would add the same
libraries, put code in the same places, and respect the same contracts and
module boundaries, and the user has accepted that revision.
