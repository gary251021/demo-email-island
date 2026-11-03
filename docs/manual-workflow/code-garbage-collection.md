# Code Garbage Collection

## Purpose

Code garbage collection is a manually initiated, evidence-backed process
for finding entropy in application code and tests before weak patterns become
the examples that future contributors and coding agents copy.

This practice adapts the scan → review → encode loop from
[Entropy & Garbage Collection](https://github.com/deusyu/harness-engineering/blob/main/concepts/03-entropy-and-garbage-collection.md)
to this application. It turns repeated review judgment into durable guidance and,
when a pattern is mechanically detectable, a tested advisory rule.

Garbage collection identifies and prioritizes bounded cleanup work for human
review. It is read-only and is not a routine delivery gate.

## Foundation

Use [code principles](../code-principle.md) and the
[architecture router](../agents/project-architecture.md) to select the frontend
and/or backend contract for the audited responsibility, and
[test principles](../agents/architecture/test-principles.md) for test findings.
Cite the owning contract and its applicability rather than restating its rules
or treating every legacy difference as a required migration.

## Scope

The default audit covers:

- production code under `src/`;
- colocated unit, component, integration, and regression tests; and
- an explicitly named code or test path supplied by the user.

An audit may inspect repository configuration only to understand how an
existing analyzer is wired or why it failed. Documentation, build tooling,
generated output, vendored code, lockfiles, and dependency upgrades are not GC
targets unless the user explicitly expands the scope.

## Audit boundary

A GC audit is read-only.

- Leave code unchanged: no refactoring, deleting, moving, renaming, or generating.
- Run formatters and autofix only in check mode.
- Keep checks as they are: no suppressions, accepted baselines, or weakened rules.
- Return the report in chat rather than a file.
- Keep warnings from becoming behavior changes.
- Establish field meaning and semantic equivalence through the owning sources
  under [external context](../agents/external-context.md).

If an analyzer writes only ignored caches as part of ordinary execution, record
that fact. Compare the final worktree with the starting snapshot and preserve
all pre-existing changes.

## Principles

### Prefer continuous, bounded cleanup

Treat entropy like accumulating interest. Recommend one small, reviewable
cleanup cluster at a time instead of a repository-wide rewrite.

### Gather evidence before recommending structure

Warnings, file size, complexity, and repetition are review signals. Confirm the
source contract, ownership boundary, consumers, and existing tests before
calling a pattern garbage.

### Review smell clusters, not isolated lines

Several warnings in one responsibility often describe one cleanup. Conversely,
the same rule in unrelated domains may require different decisions. Group
evidence by behavior and owner before ranking it.

### Do not synthesize a quality score

Rank candidates by confidence, impact, and cleanup size. Keep these dimensions
separate so a large but uncertain finding cannot outrank a small, proven one
through arbitrary arithmetic.

## Smell catalog

Use this catalog to broaden an audit beyond literal duplication. A catalog
entry is a search route, not an automatic finding.

| Smell cluster | Evidence to seek | Boundary to preserve |
| --- | --- | --- |
| Exact duplication | Matching file or function hashes, identical-function diagnostics, direct diff | Confirm both copies own the same semantics before recommending one implementation |
| Near-duplicate code or tests | Repeated control flow, setup/action/assertion shape, mappings, helper bodies with side-by-side diff | Similar syntax may support different policies; describe as structural similarity until meaning is proven |
| Dead or obsolete code | Knip findings, zero consumers, unreachable branches, superseded compatibility paths, tests for removed behavior | Validate entrypoints, framework conventions, dynamic references, and configuration before recommending deletion |
| Contract drift | `any`, broad records, repeated assertions, unchecked property probing, redundant guards, semantic fallbacks | Apply [source-backed types](../code-principle.md#source-backed-types) and trace the owning source through [external context](../agents/external-context.md) |
| Responsibility overload | Several independent workflows, Effects, state machines, transformations, or test responsibilities in one owner, supported by readability warnings | Size alone is not a smell; identify the cohesive responsibilities and their lifecycles |
| Ownership drift | Cross-route imports, unrelated component exports, feature-local modules with external consumers, duplicate helpers in different scopes | Use the applicable contract from the [architecture router](../agents/project-architecture.md) to establish the correct owner |
| Error and workflow divergence | Similar operations using incompatible error propagation, recovery, retry, or async orchestration | Differences may be intentional at distinct boundaries; compare contracts and user-visible behavior |
| Workarounds and weakened checks | New diagnostic suppressions, empty catches, unconditional success, skipped or focused tests, removed validation, increased retry/timeout limits | Treat as root-cause review prompts, not proof that the workaround is wrong |
| Test entropy | Tautological assertions, pass-through field checks, oversized fixtures, missing behavior coverage | Evaluate usefulness and grouping under [test principles](../agents/architecture/test-principles.md) |
| Stale code residue | Old TODOs, commented-out code, compatibility shims, misleading inline comments, helpers or absence assertions left after a removal | Establish whether the obligation is still active under [retire removed surfaces](../code-principle.md#retire-removed-surfaces) |

## Evidence sources

### Preflight

Start from the current checkout rather than an older report.

1. Read the current repository instructions,
   [code-change principles](../code-principle.md), and
   [architecture contracts](../agents/project-architecture.md).
2. Record `git status --short` so user-owned work is visible and preserved.
3. Resolve the requested path, rule, or Git base. Without one, audit `src/`
   and its tests in the current worktree.
4. Check the current `package.json` and analyzer configuration before selecting
   commands.

### Existing analyzers

Select applicable read-only checks from [package.json](../../package.json).
Inspect [ESLint configuration](../../eslint.config.mjs),
[dependency rules](../../.dependency-cruiser.js), and the selected analyzer's
configuration to establish actual coverage. The
[harness signal](../../scripts/harnessSignal.sh) defines its own check set;
other available analyzers are not automatically delivery gates.

Static checks provide evidence. Passing them does not establish architectural
compliance or prove the meaning of persisted data.

Report a failed, missing, misconfigured, or out-of-scope analyzer as `failed` or
`skipped` with the reason, not as a clean result.
A full test run is not required for a read-only inventory. Instead, inspect the
tests protecting a candidate and prescribe focused verification for the future
cleanup.

### Targeted inspection

Use narrow searches to validate or expand analyzer findings:

- `rg` for call sites, exports, suppressions, TODOs, focused/skipped tests,
  fallbacks, assertions, catches, retries, and repeated helpers;
- `shasum` for byte-identical files;
- `diff -u` for a suspected pair;
- `wc -l` only as supporting context; and
- source types, schemas, and tests to establish semantics and compatibility.

Do not paste secrets, credentials, private response data, or application
payloads into the audit report.

## Classification and ranking

Classify confidence independently from impact and cleanup size.

### Confidence

- **Confirmed:** reproducible evidence establishes the smell and its semantic
  boundary.
- **Supported:** multiple signals indicate a likely smell, but one ownership or
  behavior decision still needs confirmation.
- **Investigate:** a heuristic or isolated pattern identifies a useful review
  point without proving a cleanup.

### Impact

- **High:** the pattern can spread incorrect contracts, inconsistent behavior,
  or cross-feature ownership.
- **Medium:** the pattern materially increases change cost or review burden.
- **Low:** the pattern is local clutter with limited propagation risk.

### Cleanup size

- **Small:** one bounded owner and focused verification.
- **Medium:** several consumers or tests within one feature.
- **Large:** multiple ownership scopes, persisted behavior, or migration work.

Prefer confirmed, high- or medium-impact, small cleanups. Do not combine the
dimensions into a numerical score.

## Garbage-collection cycle

1. **Inventory:** run the applicable analyzers and targeted searches against
   the current checkout.
2. **Cluster:** group related diagnostics, duplicated shapes, and weak contracts
   by responsibility and owner.
3. **Validate:** inspect source contracts, consumers, and tests against the
   [architecture contracts](../agents/project-architecture.md); distinguish exact
   duplication, structural similarity, and unproven semantic similarity.
4. **Rank:** assign confidence, impact, and cleanup size without collapsing them
   into one score.
5. **Recommend one cleanup:** identify the highest-confidence bounded cluster,
   the intended ownership, and explicit non-goals.
6. **Define verification:** apply the existing
   [verification contract](../../AGENTS.md#verification) and name the specific
   behavior evidence needed for the proposed cleanup.
7. **Encode repeated judgment:** identify whether recurring feedback belongs in
   this guide, an [architecture contract](../agents/project-architecture.md), an existing
   analyzer configuration, or a new tested advisory rule.
8. **Stop without changes:** report the remaining candidates and finish with
   `No changes applied.`

## Encoding repeated judgment

First identify why the existing guidance or checks missed the problem:

- Existing contract was not loaded: recommend repairing its routing or handoff.
- Contract is unclear: clarify the owning document linked in Foundation.
- Implementation diverged from a clear contract: improve the applicable review
  or verification step.
- Isolated legacy finding: recommend bounded cleanup without adding a rule.

For repeated mechanically observable gaps, use the least powerful durable
mechanism that reliably captures the lesson:

```text
repeated mechanically observable pattern
  -> propose a warning-level rule with valid, invalid, and close-negative fixtures
stable high-confidence rule
  -> separately trial and classify repository findings
validated zero-debt invariant
  -> consider ratcheting only through an explicitly authorized change
```

Do not add a rule merely because a smell appears once. Prefer an established
community analyzer when it expresses the contract accurately and fits the
repository. Static rules must describe observable code shapes and must not
claim business meaning they cannot prove.

## Audit output

Return this structure in chat:

```markdown
# Code garbage-collection audit

## Snapshot and checks

- Scope: ...
- Git base/current worktree: ...
- Checks: `<command>` — passed | findings | failed | skipped: `<reason>`

## High-confidence GC candidates

| Priority | Smell cluster | Evidence | Confidence | Impact | Cleanup size |
| -------- | ------------- | -------- | ---------- | ------ | ------------ |

For each candidate, explain the shared responsibility, bounded cleanup
direction, important non-goals, and current test protection.

## Candidates needing semantic confirmation

List supported or investigate-level candidates and the exact missing evidence.

## Harness gaps worth encoding

List recurring observable patterns that may justify documentation, an
architecture contract update, or a tested advisory rule. Say `None established`
when no repeated pattern was proven.

## Recommended next bounded cleanup

State one cleanup objective, affected owner, constraints, and verification.

## Status

No changes applied.
```

Limit the detailed queue to at most 20 candidates. If the user requests a
broader inventory, summarize the remaining clusters without adding more
detailed candidate records. Use repository-relative paths and line numbers,
and separate current evidence from historical context.
