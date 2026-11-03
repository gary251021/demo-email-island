---
name: garbage-collection-audit
description: Run a repository-specific, read-only code garbage-collection audit that finds and prioritizes entropy in application code and tests. Use only when the user explicitly invokes `$garbage-collection-audit` to inspect the whole codebase or a named path, rule, smell, or Git base. Return evidence, one bounded cleanup recommendation, and harness gaps without modifying files.
---

# Garbage-Collection Audit

Audit code entropy as a repository-quality problem. Produce an evidence-backed
cleanup queue in chat.

## Required guide

Read
[Code Garbage Collection](../../../docs/manual-workflow/code-garbage-collection.md)
completely before running the audit. Apply its scope, smell catalog,
classification, evidence, safety, and output contracts.

Also read the current repository instructions and `docs/code-principle.md`.
Current executable configuration overrides older reports or design documents.

## Inputs

Accept any of these optional selectors:

- a code or test path;
- a lint/static-analysis rule;
- a smell such as duplicate tests or contract drift; or
- a Git base for changed-code prioritization.

Without a selector, audit `src/` and its tests in the current
worktree. Include documentation, tooling cleanup, dependency upgrades, or
generated files only when the user explicitly asks.

## Read-only boundary

- Use read-only inspection and analyzers with autofix and file output disabled.
  Preserve all files, worktree changes, suppressions, baselines, and checks;
  return recommendations and the audit report in chat.
- Establish semantic equivalence from explicit contracts and behavior evidence.
- Keep secrets and private data out of the report.

If the user asks for implementation in the same prompt, complete the audit and
recommend a separately scoped cleanup for a later implementation request.

## Workflow

1. Establish the current repository state with `git status --short`. Record the
   requested selector, current worktree, and Git base when supplied.
2. Inspect `package.json` and the current analyzer configuration. Select only
   commands that exist in this checkout.
3. Run applicable analyzers without autofix or tracked output. Distinguish
   passed checks, findings, failed analyzers, and skipped analyzers.
4. Use `rg`, hashes, direct diffs, consumer searches, source contracts, and
   existing tests to validate the strongest signals.
5. Cluster related evidence by responsibility and owner. Explicitly distinguish
   exact duplication, structural similarity, and unproven semantic similarity.
6. Rank at most 20 candidates using separate confidence, impact, and cleanup
   size classifications. Keep the three classifications separate.
7. Recommend one bounded cleanup with ownership, non-goals, and exact future
   verification.
8. Identify recurring, mechanically observable findings that may deserve
   documentation or a tested advisory rule. Base a rule proposal on the recurring
   pattern.
9. Return the required chat report and finish with `No changes applied.`

## Evidence discipline

- Validate warnings and metrics against the applicable contract before
  classifying a violation.
- Trace defensive code to its model, schema, repository, service, or props
  contract before classifying it as drift.
- Confirm entrypoints, dynamic references, framework conventions, and consumers
  before classifying code as dead.
- Use line count only as support for independently identified responsibilities.
- Record a pass only from a completed successful check; describe skipped or
  broken tools explicitly.
- Separate current checkout evidence from historical reports.

## Output format

Use the exact headings below.

```markdown
# Code garbage-collection audit

## Snapshot and checks

## High-confidence GC candidates

## Candidates needing semantic confirmation

## Harness gaps worth encoding

## Recommended next bounded cleanup

## Status

No changes applied.
```

In `High-confidence GC candidates`, include a table with `Priority`,
`Smell cluster`, `Evidence`, `Confidence`, `Impact`, and `Cleanup size`.
Explain the bounded cleanup direction and current test protection below each
candidate. If no candidate meets the confidence threshold, report that result.
