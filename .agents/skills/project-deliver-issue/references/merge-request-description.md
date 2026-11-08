# Change-request description

Use this template for a change-request preview when the repository's tracker and provider have been confirmed.

Include a `Modules and features changed` table in every delivery MR. Cover each
changed module or page, the feature changed, and its user-visible or operational
result, including changes supplied by bundled dependencies. Use recognizable
page/module names; identify the owning issue when multiple issues are included.
Refresh the table against the publishable delta before publication approval.

Generate `Human review map` during phase 3 from the reviewed publishable issue
delta and its actual file paths. Include it in the complete MR body before
publication approval; include it only when the delta contains code changes. The map
guides human review of the delivered changes. Refresh it if the patch changes
before publication.

- Use a fenced `text` tree rooted at the repository folder, with exact file or
  folder names and actual filesystem containment. Explain the delivered change
  beside each review target; mark added or deleted paths with `[added]` or
  `[deleted]`, using the base tree for deleted paths.
- Limit the tree to three edges from the root and three children per node.
- Group similar changes under one representative file and explain which other
  files or areas it covers. Keep distinct responsibilities distinguishable.
- When expanding would exceed either limit, collapse to the parent folder;
  summarize its review areas and include one example file in its description.
  Account for all distinct code-change areas through nodes or their descriptions.
- Keep tests and documentation out of this tree; checks and outcomes belong in
  `Verification`.
- Tag each node by the highest review tier inside it: `[must study]` or
  `[check]`; skim-tier nodes stay untagged.

### Review tiers

The tree shows where changes live; the tiers show how deeply a human must read
each one. Assume every changed area contains a flaw that tests and reviewers
missed, then rate each area on two axes. Derive the ratings from the reviewed
delta and the issue contract, and cross-check them against the Standards and
Spec reports.

**Trigger ease** - how readily real use sets off the assumed flaw:

- **High:** every user hits it on the default path (entry, first load, each
  read or save), or any anonymous client can hit it with one crafted request.
- **Medium:** needs a specific but ordinary state: a returning visit, expiry,
  retry after failure, two tabs, a configuration or environment difference.
- **Low:** needs rare timing, operator action, or a path no client can reach.

**Blast radius** - what the assumed flaw breaks once triggered:

- **High:** exposes or changes another owner's data, or destroys persisted data
  with no repair path.
- **Medium:** blocks the main flow, breaks one user's feature, or leaves wrong
  state that a retry, reload, re-seed or redeploy repairs.
- **Low:** cosmetic or confined to one screen, reversible on the next render.

Rate High only when the row names the concrete request or path that triggers
it and the concrete data or users it damages; otherwise rate Medium.

| Trigger \ Blast | High | Medium | Low |
| --------------- | ---- | ------ | --- |
| **High**        | Must study | Check | Skim |
| **Medium**      | Check | Check | Skim |
| **Low**         | Check | Skim | Skim |

The matrix alone decides each tier.

Rate per functionality (one behaviour, such as "owner-scoped mail reads"), which
may span several locations; list its locations in one row. The table holds at
most 10 functionalities: order by tier, then blast radius, then uncovered items
first, and keep the first 10. Lower-ordered Check items and all skim items stay
only as tags in the tree. Passing tests do not lower a tier: the rating assumes
the flaw exists, and the evidence column shows what would catch it.

| # | Tier | Functionality | Locations (`path:line-range`) | Assumed flaw | Trigger | Blast radius | What to verify while reading | Covering evidence |
| - | ---- | ------------- | ----------------------------- | ------------ | ------- | ------------ | ---------------------------- | ----------------- |

`Assumed flaw` names the plausible implementation mistake, such as "a query
filters by an input-supplied owner". `Trigger` and `Blast radius` give the
rating with a short reason. `What to verify` is the concrete question the reader
answers from the code. `Covering evidence` names the test, review finding or
check that would fail on that flaw, or `none`.

```markdown
<Issue reference in the configured provider's syntax>

## Summary

<One or two sentences describing the user- or business-facing result.>

## Modules and features changed

| Module / page | Feature changed | Visible or operational result |
| --- | --- | --- |
| <Recognizable module or page path> | <Feature; issue number when bundled> | <Externally meaningful behavior, data, UI, or operational change> |

## How it changed

- <Implementation approach and owning files or module.>
- Confirmed base: `<ref>` (`<full SHA>`)
- Delivery relationship: `<base → dependencies → this feature → confirmed target>`
- <Compatibility or migration detail when applicable.>

## Human review map

<For code-change MRs, include the filesystem review tree defined above.>

### Review tiers

| # | Tier | Functionality | Locations | Assumed flaw | Trigger | Blast radius | What to verify while reading | Covering evidence |
| - | ---- | ------------- | --------- | ------------ | ------- | ------------ | ---------------------------- | ----------------- |
| 1 | <Must study or Check> | <behaviour name> | `<path:line-range>`, ... | <plausible mistake> | <High/Medium/Low: reason> | <High/Medium/Low: reason> | <question answered from the code> | <test, finding or `none`> |

## Verification

- [<x or space>] `<exact command or manual check>` — <result or Not run: reason>
- Review rounds: <reviewed revisions, each mode's status and evidence; explain SKIP separately>
- Correction commits: <ordered SHAs and resolved findings, or None>
- Human decision: <remaining findings or limitations; automated PASS precedes human approval>
```
