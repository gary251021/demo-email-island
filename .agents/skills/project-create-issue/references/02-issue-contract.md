# Issue Contract

Apply the user-facing generation rule in `AGENTS.md` and draft one issue in the
user's requested language. Every issue has exactly three required sections, in
this order:

1. **For Human** — a plain-language summary of at most 200 words.
2. **Verification (E2E)** — end-to-end acceptance criteria with stable IDs,
   each implemented as an automated test.
3. **For Agent** — the expected code architecture, collapsed.

When deepening a ticket, the issue replaces that ticket file in place: keep its
`Status:`, `Progress:` and `Blocked by:` lines and `## Comments`. The ticket's
"What to build" becomes the source for `For Human`, and its acceptance criteria
become `Verification (E2E)` items, unchanged in meaning unless the user corrected
them.

Include only reachable edge cases that change business meaning, integrity,
compatibility or acceptance. Repository guidance supplies routine engineering
rules; include only issue-specific exceptions. Classify the issue by its primary
responsibility. Use a branch type only when the repository's
[branching policy](../../project-deliver-issue/references/branching-strategy.md#feature-branch)
is configured.

## Template

```markdown
# <Scope>: <Title>

Status: <triage value>
Progress: open
Blocked by: <NN, NN or "None">

## For Human

<≤200 words. What the user can do after this issue and what they will see,
with one representative example. One or two sentences on how it is built, in
plain words (for example, "Mail is stored per demo user in a local SQLite
database"). What is deliberately left to later tickets.>

## Verification (E2E)

- **AC-1 <short name>**
  - **Given:** <Starting state and representative data.>
  - **When:** <User actions in the browser.>
  - **Then:** <What the user observes.>
- **AC-2 …**

<details>
<summary>For Agent</summary>

### Objective

<One sentence.>

### Code architecture

Source ref/SHA: `<ref>` `<full SHA>`

#### Approach

<How the slice is built end to end and why.>

#### Libraries

| Package | Version | Owns | Rejected alternative |
| ------- | ------- | ---- | -------------------- |

#### Modules and layers

| Module | Routing | UI view | UI model | Service | Data access | Integration |
| ------ | ------- | ------- | -------- | ------- | ----------- | ----------- |

<Per module: one-line capability and public interface. Then the dependency
direction between modules. Shared contracts used across modules. Follow
[architecture axes](architecture-layers.md).>

#### Data and contracts

<Persisted entities, shared schemas, server function/API signatures and key
types as short snippets.>

#### Data flow

<Primary path from user action to persistence and back; where validation,
authorization and caching happen.>

#### Prefactoring

<Changes that land first.>

#### Foundations for later tickets

<Seams later tickets extend; what this slice leaves out for them.>

#### Testing seams

<Each AC → its automated E2E test name and file; seed data and which external
boundaries are faked; any focused unit or integration checks.>

### Constraints and exceptions

<Verified domain facts, assumptions, accepted exceptions and revalidation
conditions not covered above.>

### Dependencies and delivery

<Blocking issues with branch/SHA when available; delivery fields from the
delivery policy, only when confirmed.>

</details>

## Comments
```

Omit `Code architecture` subsections the slice does not touch, and `Constraints
and exceptions` or `Dependencies and delivery` when empty. Never omit the three
required sections.

## For Human

Write for a domain-familiar reader who does not inspect code. Count the words
(for CJK text, count characters ÷ 2) and keep it at or under 200. No file paths,
package names, type names or API shapes; describe engineering only through its
practical effect. No headings or tables inside the section; a short list is fine.
Before preview, reread it alone: if a reader could not predict the result of the
main flow from it, it is missing something; if a sentence does not help the
reader judge or act, cut it.

## Verification (E2E)

Each criterion specifies one user journey for an automated end-to-end test
(Playwright against the running application) during delivery. Issue creation
writes the criteria and test plan only. A human can still follow them by hand,
but automation is the default delivery proof:

- stable IDs `AC-1`, `AC-2`, … referenced by
  [acceptance testing](../../../../docs/agents/acceptance-testing.md);
- `Given` names concrete seed data or state; `When` uses visible labels, roles
  and actions; `Then` states what is observable on screen, never internal state;
- cover the main flow, each acceptance criterion from the ticket, and
  consequential exceptions (for example, a second user cannot see the first
  user's data);
- when a guarantee is not observable in a browser (direct resource requests,
  persistence after restart), keep it as an automated AC that states the request
  or restart and the observable response;
- write `Then` so a test can assert it: accessible roles, names and text, counts,
  URLs or response codes — not "looks right";
- mark a criterion `(manual)` with a one-line reason only when it cannot be
  automated, such as judging visual quality against the style guide. Keep manual
  criteria rare; split the automatable part into its own AC.

Payload, database and unit-level checks belong in `Testing seams`.

## For Agent

Make this section sufficient for implementation without the conversation or
`For Human`. `Code architecture` carries the accepted design from
[investigate and design](01-investigate-design.md#propose-the-implementation-design).
Paths and snippets are binding where the user accepted them (library choice,
module ownership, contracts) and illustrative otherwise (private helper names,
exact file splits inside one module); say which. Changing an agreed boundary
returns to design.

Label excerpts from inspected existing source by path and symbol. Label proposed
interface snippets as design, without claiming they were executed. Record
unverified integration claims and their delivery validation plan. For UI changes,
describe the selected appearance and interaction contract in text; static
illustrations supplement it.

## Title

Prefix the title with the most specific owning scope, or two when genuinely
cross-cutting: General, UI, UX, Accessibility, Localization, Performance,
Security, Privacy, Data, API, Documentation, Testing, Developer Experience,
Dependency, Infrastructure.

## Diagrams

This covers diagrams written into the issue. Illustrations made for the user's
review stay in the [review layer](../SKILL.md#two-output-layers) and are not
written here.

Use a diagram only when it clarifies interactions, sequence or responsibilities
better than text. Put it in `Data flow`; `For Human` stays text-only. Write
Mermaid 11 source with `accTitle` and `accDescr`, and inspect its rendered
preview before requesting confirmation.
