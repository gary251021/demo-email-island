# Issue tracker: Local Markdown

Issues and specs live as Markdown files under `.scratch/`.

## Conventions

- Use one directory per feature: `.scratch/<feature-slug>/`.
- Store the specification in `spec.md`.
- Store each issue in `issues/<NN>-<slug>.md`, numbered from `01`
  within its feature directory.
- Identify issues by their repository-relative file paths. Resolve a
  bare number within the selected feature; ask if it is ambiguous.
- Record triage in a `Status:` line near the top, using the values in
  `docs/agents/triage-labels.md`.
- Track execution separately with `Progress: open`, `claimed`, or
  `resolved`. New issues start with `Progress: open`.
- Append comments and conversation history under `## Comments`.

## Skill operations

When a skill says "publish to the issue tracker", create the spec or
individual issue file at the corresponding path above.

When a skill says "fetch the relevant ticket", read its file, including
comments.

When closing an issue, record its outcome and set `Progress: resolved`.
Preserve the file as history.

## Wayfinding operations

- Store the effort map in `.scratch/<feature-slug>/map.md`, with
  Notes, Decisions-so-far, and Fog sections.
- Store each child ticket in the feature's `issues/` directory.
- Record its type with `Type: research`, `prototype`, `grilling`,
  or `task`.
- Record dependencies with `Blocked by: NN, NN`, referencing issues
  in the same feature. A ticket is unblocked when all listed issues
  have `Progress: resolved`.
- Select the lowest-numbered open, unblocked ticket.
- Claim a ticket by saving `Progress: claimed` before starting work.
- Resolve it by appending `## Answer`, setting `Progress: resolved`,
  and adding a summary and relative link to the map's Decisions-so-far.

## Delivery configuration

For implementation and release work, also read
`docs/agents/issue-delivery-policy.md`. This tracker choice does not
configure Git remotes, branches, or publication authority.

`_temp-issue-tracker.md` remains reference material for the reconciliation
TODO in `project.md`.
