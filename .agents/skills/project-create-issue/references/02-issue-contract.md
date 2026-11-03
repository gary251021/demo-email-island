# Issue Contract

Apply the user-facing generation rule in `AGENTS.md` and draft one English issue.
Use the shortest body that preserves intent, affected actor and surface,
verified current behavior, expected result, scope, domain meaning, dependencies
and testable completion. Include investigation evidence only when it prevents a
plausible wrong interpretation. Repository guidance and inspection supply
routine engineering rules, locations, helpers and commands; include only
issue-specific exceptions or proof requirements.

Use the exact delivery branch type as the semantic classification. Select from
[delivery's branch types](../../project-deliver-issue/references/branching-strategy.md#feature-branch),
enforced by `BRANCH_TYPES` in the
[preparation script](../../project-deliver-issue/scripts/prepareIssueBranches.mjs):
`feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `build`, `ci`, or `chore`.
Select by the issue's primary responsibility; use `fix` for correcting behavior
that violates a known expectation. Preserve this exact value in the preview and
agent delivery contract so preparation uses it without translation.

When the cause or remedy remains unknown, retain the investigation question in
alignment. Investigation is not an additional classification candidate.

Include only reachable edge cases that change business meaning, integrity,
compatibility or acceptance. Recommend later specification only when
implementation would otherwise invent a product, API, schema, authorization,
migration or cross-module contract.

## Title and delivery

Prefix the title with the most specific owning scope, or two scopes when the
issue is genuinely cross-cutting:

```yaml
scope_list:
  # Add product-area scopes here as CONTEXT.md defines the domain.
  - General
  - UI
  - UX
  - Accessibility
  - Localization
  - Performance
  - Security
  - Privacy
  - Data
  - API
  - Documentation
  - Testing
  - Developer Experience
  - Dependency
  - Infrastructure
```

Resolve values through the issue-delivery policy. The source SHA identifies the
agreed design snapshot; harness and prepared-base SHAs remain internal evidence.
End `For Agent` with:

```markdown
### Delivery

- Production base tag: `<vX.Y.Z>`
- Development target: `<configured development target>`
- Production path: `<configured production path>`
```

## For Human

Write for a domain-familiar reviewer who does not inspect code. The section must
let that reader predict the default result and each relevant action from visible
labels, representative examples and missing/empty states. Explain engineering
choices only through practical effects the reviewer must judge. Put implementation
contracts in `For Agent` and retain validation records internally. Resolve open
choices during alignment before drafting them as agreed behavior.

Apply the user-facing selection rule in `AGENTS.md` in a final standalone read of
`For Human`: keep only information the domain-familiar reviewer needs to judge or
act. Include a role, permission, timezone or input constraint when it changes a
result or explains a consequential exception; otherwise leave that shared
technical contract to `For Agent`. Return to alignment when the pass exposes an
unresolved product choice.

**Human description:** State the capability, available actions, and consequences
the user needs to understand. When an approved interactive preview demonstrates
layout and controls, link it instead of repeating its details. Retain consequential
behaviour that interaction alone cannot reveal.

Describe background behaviour only as a user-facing guarantee—for example,
“Failed sends are retried.” Put handling, algorithms, timing policies, and recovery
mechanics in `For Agent`.

**Human verification:** Use short journeys stating an action and observable
expected result. Cover the main workflow and consequential exceptions. Identify
which checks use the preview and which require the integrated application. Put
payload, database, and implementation checks in `For Agent`.

**Consistency:** Human guarantees, agent acceptance criteria, and the approved
preview must agree. Distinguish requested behaviour from verified existing
behaviour; resolve conflicting requirements rather than retaining contradictory
instructions.

Use this structure as needed:

```markdown
## For Human

<Problem and result the user will see or achieve. Include placement, defaults,
visible labels, actions and representative outcomes.>

### <Scenario or design question>

<Agreed behavior, examples, useful diagrams, and inspected proposal screenshots.>

### Delivery relationship

<Only when another issue supplies required behavior:>

1. Production root: `<production path>` at `<production tag>`
2. Coupled dependency: `#<issue>` — `<feature branch>`
3. This issue: `#<issue>` — `<feature branch>`
4. Merge-request target: `<target branch>`

### How to verify

- <Route or output, representative data condition, action and visible result.>
```

For explicit separate delivery, identify the dependency as separate, use its
feature branch as the review-only MR target, and add the later development
target; the dependent MR merges only after retargeting. Include
negative statements when they affect the reader's decision. For an
internal-only issue, describe an observable maintainer workflow or compatibility
outcome.

## For Agent

Make this section sufficient for implementation without the conversation or
`For Human`. Agreed responsibilities, contracts and accepted exceptions constrain
implementation; candidate filenames and private details remain illustrative.
Changing an agreed boundary returns to alignment.

Wrap the section in a collapsed native HTML details block and omit optional
sections that add no task-specific information:

```markdown
<details>
<summary>For Agent</summary>

### Objective

<One-sentence desired behavior change.>

### Acceptance criteria

#### <Phase or scenario>

- **Given:** <Concrete precondition.>
- **When:** <Endpoint, method or UI action.>
- **Then:** <Observable result.>

### Essential context and constraints

<Unique scope, verified domain facts, assumptions, exceptions and rationale.>

### Agreed design

<Source ref/SHA; agreed responsibilities, owners and symbols; reuse and
dependency decisions; accepted exceptions and revalidation conditions.>

### Verification

<Only special proof requirements specific to this issue.>

### Dependencies

1. `#<issue>`
   - Feature branch: `<branch>`
   - Required SHA: `<full SHA, when available>`
   - Delivery override: `separate` <only when explicitly chosen>

### Delivery

<Required delivery fields above.>

</details>
```

When code-design proof is required, include only checked excerpts that establish
interfaces, ownership and caller/dependency direction; keep full diffs and logs
internal. Require revalidation when the implementation base changes a relevant
owner, caller, contract or harness rule. For UI changes, describe the selected
appearance and interaction contract in text; screenshots supplement it.

State whether adjacent projects are implementation scope, reference-only or
dependencies, and whether persisted fields change. The human delivery path and
agent dependency evidence must agree.

## Diagrams

Use a diagram only when it clarifies interactions, sequence, branching, timing
or responsibilities better than text or a table. Place it beside the explanation
in `For Human`; keep `For Agent` sufficient without it. Write Mermaid 11 source
with `accTitle` and `accDescr`, and inspect its rendered preview before requesting
confirmation.
