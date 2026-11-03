# Static rule contract

Read this reference before implementing a new rule. It condenses the repository
static-analysis harness specification into the implementation decisions that
protect rule quality.

## Select the analyzer boundary

| Boundary | Choose it when | Avoid it when |
| --- | --- | --- |
| Local AST or ESLint | One parsed file proves the condition | Types, imports, or configuration decide validity |
| Typed ESLint | Resolved signatures, symbols, or types decide validity | Syntax already proves the condition |
| dependency-cruiser | Module ownership, import direction, cycles, or fan-in decide validity | A file-local node is enough |
| Semgrep | A narrow cross-cutting structural pattern is clearer than ESLint | The rule needs type or graph resolution |
| Configured scope | A stable path, framework, or package convention defines the rule | The policy is really a universal code invariant |
| Advisory or no rule | Intent, semantics, or equivalence cannot be proved reliably | A stable static signal exists |

Choose the first boundary that supplies the needed fact. State what a cheaper
boundary can observe and why it would make a false-positive or false-negative
mistake.

## Required fixtures

Every custom rule needs:

1. a **positive** fixture that must warn;
2. a direct valid fixture that must not warn;
3. a close-negative fixture that must not warn;
4. every syntax, wrapper, alias, or export variant the rule claims to support;
5. a configured framework exception fixture, when applicable;
6. an assertion for the diagnostic location and message or stable semantic
   fragments; and
7. a whole-repository no-crash scan.

Use `positive` only for a forbidden source shape that emits a finding. Call
accepted code `valid` or `close-negative`.

## Diagnostic requirements

Treat a console diagnostic as a short repair prompt. Include only facts the
detector proves:

1. Name the observed source shape.
2. Name the contract, ownership, control flow, or runtime behavior that becomes
   harder to read or predict.
3. Give the smallest concrete next action that restores the invariant.

Use code-meaning language, specific directions, and consequence-based
wording; allow equivalent designs instead of mandating one rewrite or rename. When a rule detects a helper large enough to
warrant a reuse search, describe that search opportunity; a duplication claim
requires evidence of equivalent behavior.

## Rollout and verification

- Start all new custom rules as warnings.
- Keep rules advisory: no automatic behavior changes or autofixes.
- Keep per-file rules approximately linear in AST nodes and graph checks
  approximately linear in modules and edges.
- Run focused rule fixtures whenever `.eslint/**`, `eslint.config.*`,
  `.dependency-cruiser.*`, `semgrep-rules/**`, or `scripts/*static*` changes.
- Run lint on changed files, typecheck TypeScript rule code, and use the
  repository's full no-crash static scan when available.
- Measure a new ESLint rule with `TIMING=all`; a single rule should add no more
  than 10% to full ESLint runtime.
- Before error promotion, perform a whole-repository trial, classify initial
  findings, verify runtime stability, and create a deliberate zero-debt or
  ratchet policy.
