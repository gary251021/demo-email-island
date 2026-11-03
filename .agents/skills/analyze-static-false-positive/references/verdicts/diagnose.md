# Diagnose route

Use this route when the user supplies `diagnose`.

## Objective

Accept the rule and finding as correct. Assess message quality while keeping
the configured scope, detection model, and severity fixed. Inspect the rule
implementation to identify the violated invariant, why the detected shape
harms readability or predictability, and what bounded code shape resolves it.
Use these facts to propose guidance a coding agent can act on.

If the rule, message, or relevant implementation cannot be resolved, state the
missing evidence needed to improve the warning accurately.

## Diagnose the message gap

Identify which guidance is missing or misleading:

- the message does not name the detected code shape;
- it exposes AST or rule implementation details instead of code meaning;
- it does not explain the readability or predictability cost;
- it does not state the violated contract or ownership boundary;
- it offers no concrete preferred code shape;
- it prescribes one rewrite when multiple equivalent valid designs exist; or
- its suggested action would not resolve the detected root cause.

## Report behavior

- Analysis verdict: `Expected finding`.
- Emission: `Emit`.
- Emission reason: state the legitimate violation and why it matters.
- Original message gap: identify the exact missing or misleading guidance.
- Proposed message: give the agent the observable problem, consequence, and
  bounded corrective direction.

Recommend only warning metadata, message wording, and focused message-fixture
changes.

## Fixtures

Include:

- a valid case that remains accepted;
- the legitimate invalid case with the improved warning or stable semantic
  fragments; and
- a boundary case showing the message does not prescribe an unnecessary
  rewrite.
