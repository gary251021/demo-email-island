---
name: analyze-static-false-positive
description: Analyze a user-pasted ESLint log or named custom rule after the user labels it FP, FN, unknown, or diagnose. Use only when the user explicitly invokes `$analyze-static-false-positive`; independently assess FP, FN, and unknown findings, or accept a diagnose finding as correct and improve its warning for agent understanding. Explain the root cause, identify the detection boundary, and recommend a non-applied rule/config/test change within the selected route. Read-only: leaves code, lint configuration, suppressions, and repository state unchanged.
argument-hint: "Pass FP, FN, unknown, or diagnose; then provide an ESLint log or rule name."
disable-model-invocation: true
---

Analyze a static-analysis finding to assess rule quality and recommend a bounded correction.

## Inputs

Require:

- one user verdict: `FP`, `FN`, `unknown`, or `diagnose`;
- either an ESLint log/tracing diagnostic or an exact custom rule name/ID; and
- optionally, the intended policy or a valid/invalid-code explanation.

Treat `FP`, `FN`, and `unknown` as hypotheses. Treat `diagnose` as the user's
premise that the rule and finding are correct. If the verdict is missing, ask
for it.

## Operating boundary

Use read-only inspection with autofix disabled. Preserve repository state,
including production code, lint configuration, rules, tests, suppressions,
package scripts, and documentation. Return recommendations in chat and end
with `No changes applied.`

If the user asks to apply a recommendation, finish this analysis first. Wait
for a separate explicit request before making any change.

## Reference router

Read the selected references completely.

1. Always read
   [`references/input-evidence.md`](references/input-evidence.md).
2. Read exactly one verdict route:

   | User verdict | Required reference |
   | --- | --- |
   | `FP` | [`references/verdicts/false-positive.md`](references/verdicts/false-positive.md) |
   | `FN` | [`references/verdicts/false-negative.md`](references/verdicts/false-negative.md) |
   | `unknown` | [`references/verdicts/unknown.md`](references/verdicts/unknown.md) |
   | `diagnose` | [`references/verdicts/diagnose.md`](references/verdicts/diagnose.md) |

3. Before proposing diagnostic text, read
   [`references/warning-messages.md`](references/warning-messages.md).
4. Before identifying or correcting the analysis boundary, read
   [`references/detection-boundaries.md`](references/detection-boundaries.md).
5. For React, TSX, component-module, component-factory, or HOC rules, also read
   [`references/component-module-rules.md`](references/component-module-rules.md).

## Core workflow

1. Route by input form and user verdict.
2. Restate only observable evidence: rule, implementation file, configured
   scope, finding files, message, source shape, and proven decision path. For a
   rule identifier, actively establish current finding files or report that none
   could be established.
3. Reconstruct the rule's decision model and state its assumption plainly.
4. Describe the rule's purpose in human-readable language.
5. For `FP`, `FN`, and `unknown`, independently verify or revise the user's
   hypothesis. For `diagnose`, accept the rule and finding as correct and assess
   only the warning's usefulness to an agent.
6. Give one analysis verdict:
   - **False positive**;
   - **False negative**;
   - **Expected finding**; or
   - **Insufficient evidence**.
7. Identify the cheapest reliable detection boundary.
8. Recommend the narrowest correction. In `diagnose`, limit it to warning
   metadata, message wording, and message regression fixtures.
9. Propose an agent-actionable diagnostic grounded in the verdict and root
   cause.
10. Specify a valid, invalid, and close boundary regression fixture.

## Output format

Use this exact structure.

```markdown
# Static finding analysis

## Verdict

False positive | False negative | Expected finding | Insufficient evidence

## Input interpreted

- User verdict: FP | FN | unknown | diagnose
- Input form: ESLint log | Rule name
- Tool and rule: ...
- Rule implementation file: ... | Not established
- Finding files: ... | No current findings | Not established
- Location and reported condition: ... | No current findings | Not established
- Human-readable rule description: ...
- Policy supplied or assumed: ...

## Rule decision model

Explain the observable or detectable condition and the assumption the rule
made. When only a rule name was supplied, distinguish behavior proven by its
implementation from behavior that would require a concrete source example.

## Why the result is wrong or correct

Explain the gap between the rule model and the valid/invalid code shape. For a
false negative, explain the missing forbidden shape. For insufficient evidence,
state the minimum missing input. If the user verdict was `unknown`, explain what
evidence resolves the uncertainty or why it remains unresolved. If it was
`diagnose`, explain both the legitimate violation and why the original warning
does not give an agent enough information to fix it correctly.

## Detection boundary

State whether a local AST, typed, graph, configuration, or non-static solution
is appropriate, and why.

## Recommended correction

Describe the smallest change to the rule or its scope. Include the intended
post-change behavior. Providing or applying a patch requires a separate request.
For `diagnose`, describe only the warning-message and message-fixture change
because rule correctness is an input premise.

## Proposed warning message

- Emission: Emit | Do not emit for this case | Advisory only | Undetermined
- Emission reason: Explain why this case should or should not produce a lint
  diagnostic.
- Original message gap: ...
- Message: `...`
- Guidance:
  - Detected shape: ...
  - Readability or predictability impact: ...
  - Preferred code shape: ...
- Rationale: Explain how the message reflects the analysis verdict and root
  cause without exceeding the detection boundary.

## Alternatives and trade-offs

List only materially different alternatives, including false-positive and
false-negative consequences.

## Regression fixtures

- Valid case: ...
- Invalid case: ...
- Boundary case: ...

## Status

No changes applied.
```
