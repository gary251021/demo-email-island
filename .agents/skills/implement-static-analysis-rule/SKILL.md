---
name: implement-static-analysis-rule
description: Implement a repository-local static-analysis rule from a defined policy and a positive code example that must warn. Use only when the user explicitly invokes `$implement-static-analysis-rule`; select the cheapest reliable analyzer boundary, add focused fixtures, and emit an actionable console diagnostic that tells coding agents how to correct the detected shape. Applies to implementation requests only.
argument-hint: "Provide the policy and a positive code example that must warn."
disable-model-invocation: true
---

# Implement a Static Analysis Rule

Implement a tested static rule as a narrow repository guardrail. Treat the
positive example as a required proof of the exact code shape that must emit a
warning.

## Inputs

Require all of the following before changing the harness:

- the intended policy or invariant;
- one **positive example** that must warn, including the expected code shape;
- the expected scope and any valid exception; and
- the requested severity, if one is known.

If the user provides only a vague preference, first identify one narrow,
observable rule candidate and ask for confirmation before adding a detector.
Ground each static check in a demonstrable forbidden shape.

For a false-positive, false-negative, or message-quality investigation, use
`$analyze-static-false-positive` first. Implement its recommendation only after
the user separately invokes this skill.

## Operating boundary

- Modify only the rule implementation, its configuration, fixtures, and the
  minimal harness wiring needed to execute it.
- Preserve application code and unrelated worktree changes.
- Start every new custom rule at warning level. Error promotion requires a
  repository trial, classified findings, stable runtime cost, and a deliberate
  ratchet.
- Keep the rule deterministic and local: no autofix, broad suppression,
  application-specific regex, network access, embeddings, or LLM-dependent
  decision path.
- Make claims about semantic duplication, intent, or equivalence only when the
  selected analysis boundary establishes those facts.

Read [`references/rule-contract.md`](references/rule-contract.md) completely
before selecting the tool or writing the rule.

## Implementation workflow

1. Inspect the current analyzer configuration, the nearest comparable rule,
   its focused tests, and the proposed policy. Confirm the actual rule entry
   points and test command from the current executable configuration.
2. State the proposed identifier and tool before coding, for example
   `local/component-local-helper-ownership` or a Semgrep rule ID. Explain the
   observable condition, supported syntax, configured scope, and explicit
   non-goals.
3. Choose the cheapest reliable analysis boundary. Prefer local AST syntax;
   use typed ESLint only for resolved type facts, dependency-cruiser for module
   relationships, Semgrep for narrow structural patterns, and an advisory
   outcome when the policy is not statically provable.
4. Add the **positive fixture** first. Assert its rule ID, warning severity,
   diagnostic location where stable, and message ID or stable message text.
   The positive fixture must emit exactly the intended warning.
5. Add a direct valid fixture and a close-negative fixture. Add only the alias,
   wrapper, export, or framework-exception variants that the implementation
   claims to support. Keep invalid and valid cases adjacent enough to prove the
   detector boundary.
6. Implement the narrowest detector that accepts the valid fixtures and reports
   the positive fixture. Keep traversal approximately linear in visited AST
   nodes; group candidates instead of comparing every function, component, or module
   against every other one, unless no grouped linear alternative exists.
7. Write the diagnostic as an embedded constrained prompt for the coding agent.
   It must name the detected code shape, explain the readability or
   predictability cost, and give the next bounded action that restores the
   invariant.
8. Wire the rule at warning level in the narrowest relevant scope, keeping
   existing findings visible.
9. Run the focused fixture command, typecheck when the changed code is
   TypeScript, and run a whole-repository no-crash scan when the configured
   command is available. The changed-file hook owns ordinary ESLint enforcement.
   Measure with `TIMING=all` for a new ESLint rule when a full scan is safe.
10. Report the exact rule ID, the positive fixture that emitted, the valid and
    close-negative boundaries, the final console message, severity, and every
    verification result. Separate pre-existing failures from new ones.

## Console diagnostic contract

Write a one- or two-sentence message in this form, using facts the rule can
actually observe:

```text
<Observed code shape> makes <contract, ownership, or behavior> harder to read
or predict. <Bounded next action that can correct the shape.>
```

The second sentence is the injected repair prompt. Prefer directions such as:

```text
Search the current route, then feature-level modules, then app-global helpers;
reuse an existing helper only when its semantics match, otherwise move the
independent responsibility to its nearest owner.
```

Adapt that direction to the proven invariant and verified search scope. Base
reuse on established semantic equivalence and extraction on responsibility
ownership. When there are several valid designs, describe the constraint and
allow equivalent fixes.

## Completion contract

Finish with this concise record:

```markdown
## Rule implemented

- Rule: `<tool>/<rule-id>`
- Severity and scope: `warning`; `<configured scope>`
- Positive fixture: `<path or test name>` — emits `<messageId>`
- Valid fixture: `<path or test name>` — no finding
- Close-negative fixture: `<path or test name>` — no finding
- Console message: `<final actionable message>`
- Verification: `<commands and results>`
- Limits: `<unsupported syntax or intentionally advisory boundary>`
```

If the policy or positive example does not support a reliable rule, stop
implementation, explain the missing evidence, and recommend an advisory or
a narrower candidate.
