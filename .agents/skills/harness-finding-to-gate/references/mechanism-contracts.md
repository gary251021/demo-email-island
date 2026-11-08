# Mechanism contracts

Concrete shapes for changes at each layer of [change layers](change-layers.md).

## L4 Gate wiring

Locate the gate and the exact reason it skipped the event. Typical causes:

- Root resolved from the session cwd while edits happen in a delivery worktree;
  resolve the Git root from each edited file's directory instead.
- Matcher covers `Edit|Write|apply_patch` but files were written by shell; add a
  Stop-time pass over `git status --porcelain` of each touched worktree.
- Gate results only reported, never required; make the phase record the gate's
  command, exit code and output.

Add a test that replays the skipped event shape.

## L2 Lint rule inputs

Prepare for `implement-static-analysis-rule`: policy, one positive example from
the run (copied code shape), scope glob, valid exception, severity `warn`.
New rules start at warning level; the changed-file hook surfaces warnings at
Stop.

## L3 Dependency rule

Add a named `forbidden` rule to `.dependency-cruiser.js` with a `comment` that
tells the agent the allowed direction, or a knip configuration entry. Start at
`warn`; quote the original offending import in the rule's test or replay.

## L5 Checker + L9 reviewer disposition

### Checker contract

- Deterministic and local: no network, embeddings or LLM calls. Same input
  revision, same output.
- Group candidates in roughly linear time: bucket by a normalized signature
  (AST shape hash with identifiers and literals erased, called-API set,
  string-literal protocol value), then compare within buckets.
- Report a group only at its threshold, for example the same behaviour defined
  in three or more places, or a string literal compared in three or more files.
- Emit JSON and a short Markdown table to the review evidence directory:

```json
{
  "checker": "similar-functions",
  "version": 1,
  "revision": "<sha>",
  "candidates": [
    {
      "id": "sf-<hash of sorted member locations>",
      "kind": "similar-behaviour",
      "members": [{ "path": "src/a.tsx", "line": 12, "name": "ReadError" }],
      "signal": "same JSX shape: role=alert + message + retry button",
      "score": 0.86
    }
  ]
}
```

- Exit 0 when it ran; candidates are advisory input. A crash or missing output
  is a gate failure.
- Ship focused tests: one positive group from the originating run and one close
  negative that stays below the threshold.

### Reviewer instruction (L9)

Add to the owning review phase, naming the command and review axis:

```markdown
Run `<checker command> --revision <reviewed-sha>` and attach its report. For each
candidate record one disposition with evidence:

- GROUP - name the owning module and the shared interface to extract.
- KEEP - name the behavioural difference that justifies separate code.
- FALSE_POSITIVE - name the signal the checker misread.

A candidate without a disposition leaves the axis BLOCKED.
```

GROUP dispositions become ordinary findings with severity; KEEP and
FALSE_POSITIVE feed checker tuning in the next run of this skill.

## L7-L10 Text changes

State why L1-L6 cannot express the property. Edit the owning section with the
observable output the reader must produce (screenshot pair, side-by-side
palette, named human check, required report table). Keep wording positive and
specific; the over-defensive document hook flags stacked prohibitions.

## Worked examples (ticket 01 delivery, 2026-11-08)

| Finding | Diagnosis | Owning layer + file | Paired references |
| ------- | --------- | ------------------- | ----------------- |
| ESLint hook never linted implementer edits: worktrees under `/private/tmp` fell outside the session's Git root, and most files were shell-written | Gate unwired | L4 `.codex/hooks/lint-changed-file.mjs` (resolve root per file; Stop-time `git status` per worktree) | `lint-changed-file.test.mjs` replay case |
| `"UNAUTHENTICATED"`/`"NOT_FOUND"` compared as raw strings in 7 places across 5 files | Rule absent | L2 `.eslint/eslint-custom-plugin.mjs`: error-code literal compared outside its owning module | L7 `docs/code-principle.md` names the error-code owner |
| Retry alert UI written 5 ways; clickable-building handlers duplicated; label triples built twice | Judgement without candidates: `CODING_STANDARDS.md` already asks reviewers to search for equivalent helpers, and `sonarjs/no-identical-functions` is same-file only | L5 `similar-functions` checker in `project-deliver-issue/scripts/` | L9 `04_review.md` Standards axis dispositions |
| Spec reviewer matched E2E test names to ACs without checking each Then clause | Judgement without candidates | L5 clause extractor in `04_review.mjs`: Given/When/Then clauses from the issue, test titles and steps | L9 `04_review.md` clause table (text added 2026-11-08) consumes it |
| Spec reviewer reused the implementer's E2E log | Gate unwired | L4 review helper runs the suite on the reviewed SHA and records counts | L9 `04_review.md` independent run step |
| Visual correction set Core terrain to a lime outlier to pass a palette threshold | Partly computable | L5 palette-outlier candidate across domain colours in `visualMetrics.mjs` | L7 `reference/email-island/README.md` palette rule; L9 human visual check |
