# GitLab Merge Request Description

Use this template for the business merge-request preview.

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

```markdown
Closes #<delivered issue number>

## Summary

<One or two sentences describing the user- or business-facing result.>

## Modules and features changed

| Module / page | Feature changed | Visible or operational result |
| --- | --- | --- |
| <Recognizable module or page path> | <Feature; issue number when bundled> | <Externally meaningful behavior, data, UI, or operational change> |

## How it changed

- <Implementation approach and owning files or module.>
- Production base: `<vX.Y.Z>` (`<full SHA>`)
- Delivery relationship: `<production root → dependencies → this feature → target>`
- <Compatibility or migration detail when applicable.>

## Human review map

<For code-change MRs, include the filesystem review tree defined above.>

## Verification

- [<x or space>] `<exact command or manual check>` — <result or Not run: reason>
- Review rounds: <reviewed revisions, each mode's status and evidence; explain SKIP separately>
- Correction commits: <ordered SHAs and resolved findings, or None>
- Human decision: <remaining findings or limitations; automated PASS precedes human approval>

<!-- Include Reviewer focus when the business diff exceeds 100 changed lines. -->

## Reviewer focus

Read `<core or highest-risk file>` first: <why this is the review entrypoint.>
```
