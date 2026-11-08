# Change layers

Every condensed finding names exactly one **owning layer**: the place where the
invariant lives. Other layers may reference it (a review phase runs a checker,
a skill links a standard) but never restate it. Choose the lowest layer that
can express the invariant deterministically, then add only the references the
higher layers need to run or read it.

| # | Layer | Owns | Files in this repository | Choose when | Verify |
| - | ----- | ---- | ------------------------ | ----------- | ------ |
| L1 | Type checking | Facts the compiler can prove | `tsconfig.json` | A stricter compiler flag rejects the shape | `npm run typecheck` fails on the original code |
| L2 | Linter | A forbidden shape inside one file (AST or type facts) | `eslint.config.mjs` (severity, scope), `.eslint/eslint-custom-plugin.mjs` + its test (custom rules), `eslint.human.js` | Decidable per file; route new rules through `implement-static-analysis-rule` | Positive fixture from the run warns; close negative stays quiet |
| L3 | Dependency checking | Relationships between modules and packages: import direction, layering, cycles, orphans, unused exports and dependencies | `.dependency-cruiser.js` (`npm run lint:deps`), knip (`npm run knip`) | The finding is about who imports whom, or code/exports nobody uses | Rule reports the original import or orphan |
| L4 | Hooks and gates | When and where checks run, and whether a failure blocks | `.codex/hooks.json` + `.codex/hooks/*.mjs` (Codex), `.pi/pi-delivery/hooks.ts` + `gates` (Pi), `package.json` scripts | A rule exists in L1-L3/L5 but did not run or did not block | Replay the original event; hook now runs and reports |
| L5 | Review checker scripts | Deterministic candidate lists that a reviewer must disposition | `.agents/skills/project-deliver-issue/references/04_review.mjs`, `scripts/` of the owning skill (e.g. `visualMetrics.mjs`) | Candidates are computable across files, acceptance needs judgement | Checker reports the original group on the run's SHA |
| L6 | Test harness | How tests are collected, isolated and run | `playwright.config.ts`, `vitest.config.ts`, shared fixtures | Tests ran in the wrong scope, collected the wrong files, or could not express the scenario | Harness run shows the corrected collection/behaviour |
| L7 | Project documents | What counts as correct code, tests and visuals; shared by every skill | `CODING_STANDARDS.md`, `docs/code-principle.md`, `docs/agents/project-architecture.md`, `docs/agents/architecture/test-principles.md`, `docs/agents/acceptance-testing.md`, `reference/email-island/README.md`, `docs/adr/` | The rule is a standard any agent or human should follow, independent of workflow | A reviewer citing the section can decide the original case |
| L8 | Issue contract | What a ticket must specify | `.agents/skills/project-create-issue/references/02-issue-contract.md` | The gap is in the ticket itself (missing clause granularity, untestable criterion) | The original ticket, redrafted, exposes the gap |
| L9 | Skill workflow | Who does what in which phase, what each handoff/report must contain, which checkers a reviewer runs | `.agents/skills/<skill>/SKILL.md` and its `references/` | Ownership, ordering, packet contents or required report outputs were wrong | Walkthrough of the phase with the original evidence |
| L10 | Agent routing | Which documents and skills an agent reads first | `AGENTS.md` (size checked by `.agents/scripts/checkAgentsMdSize.mjs`), `docs/agents/*.md` routing docs | The right document existed but was never reached | Walkthrough from session start reaches the owning document |

## Pairing rules

- **L5 always pairs with L9.** The checker computes candidates; the owning
  review phase (L9) names the command, attaches the report and requires a
  disposition per candidate.
- **L2/L3 pair with L4 only when the gate is missing.** A new lint or
  dependency rule normally rides on existing hooks and scripts.
- **L7 is the owner of a standard; L9 links it.** When a standard already exists
  in L7 but was not applied, the finding is not "add the standard again"; it is
  a missing L5 checker, an L4 gate or an L10 routing gap.
- **L8 changes future tickets only.** Repair the current ticket through the
  delivery workflow as a product correction.

## Choosing between neighbouring layers

| Confusion | Decide by |
| --------- | --------- |
| L2 vs L3 | One file's syntax → L2. Edges between files or packages → L3. |
| L2 vs L5 | Detectable without comparing files → L2. Needs grouping across files → L5. |
| L3 vs L5 | Import graph or unused symbol → L3. Behavioural similarity → L5. |
| L4 vs L9 | Must run automatically on every edit or stop → L4. Runs once per review round → L9 (with L5). |
| L7 vs L9 | True for all work in the repository → L7. True only inside one workflow → L9. |
| L7 vs L10 | Text is missing → L7. Text exists but is not read → L10. |
