---
name: harness-finding-to-gate
description: Condense findings from agent runs (reviewer misses, lint that never fired, duplicated functionality, weak acceptance-test mapping, metric overfitting) into one change at the correct owning layer - type checking, linter, dependency checking, hooks and gates, review checker script, test harness, project document, issue contract, skill workflow or agent routing. Use when the user asks to turn review or session observations into linting, dependency, hook, checker, document or prompt improvements, or invokes $harness-finding-to-gate.
---

# Harness Finding to Gate

Turn what went wrong in an agent run into a mechanism that catches it next time,
placed at the layer that owns the invariant. Prefer machines for detection and
reviewers for judgement: a prompt that asks an agent to *search* for something
a script can compute becomes a checker, and the prompt instead asks the reviewer
to *decide* on the checker's candidates.

Related owners: `project-skill-feedback` edits workflow text driven by user
steering; `implement-static-analysis-rule` writes lint rules. This skill picks
the layer, prepares their inputs, and owns hook, gate and checker changes.

## 1. Collect the findings

Gather observations from the sources in
[finding sources](references/finding-sources.md): review reports, evidence
directories, session transcripts and the user's notes. Record each with its
evidence (`path:line`, transcript timestamp), what should have caught it, and
impact.

Separate product defects from harness defects. A product defect (wrong colour,
missing assertion in this ticket's test) goes back to the delivery workflow as a
correction; this skill handles the harness defect that let it through.

## 2. Condense by mechanism

Merge findings that share one failed mechanism, so six scattered
`"UNAUTHENTICATED"` string checks become one row about an uncaught error-code
protocol. Diagnose each row's failure:

- **Rule absent** - no layer expresses the invariant.
- **Gate unwired** - a rule exists but did not run or did not block.
- **Judgement without candidates** - a reviewer was asked to discover something
  computable, and sampled instead of enumerating.
- **Unreached** - the owning text exists but the agent never read it.
- **Execution miss** - a clear, reachable, wired rule was ignored; cite it and
  stop.

## 3. Name the owning layer

Assign every row exactly one owning layer from
[change layers](references/change-layers.md) (L1 type checking through L10 agent
routing), with the exact file and section. Choose the lowest layer that can
express the invariant deterministically; use its "choosing between neighbouring
layers" table when two fit. Then list the paired references higher layers need,
for example an L5 checker plus the L9 review step that runs it.

When the owning layer already holds the rule (a standard in
`CODING_STANDARDS.md` that reviewers did not apply), the fix belongs to the
layer that failed to enforce or reach it: L4, L5 or L10. Do not restate the
rule elsewhere.

Choose a document or skill layer (L7-L10) for a computable property only after
stating why L1-L6 cannot express it.

Use [mechanism contracts](references/mechanism-contracts.md) for the concrete
shape of each change: gate wiring causes, lint-rule inputs, the checker output
format and reviewer disposition prompt, and document wording.

## 4. Present the plan and wait

Show one table:

| ID | Condensed finding | Diagnosis | Owning layer + file | Paired references | Replay check |
| -- | ----------------- | --------- | ------------------- | ----------------- | ------------ |

Below it, give the proposed diff or checker I/O contract for each row, and list
execution misses and product defects with their disposition. Ask for explicit
approval of the plan or a named subset, end the turn and wait.

## 5. Apply the approved rows

- **L1, L3, L4, L5, L6:** edit the configuration, hook or script and its tests
  directly.
- **L2:** hand policy, positive example, scope and severity to
  `implement-static-analysis-rule`; the user's approval of this plan names that
  skill.
- **L7-L10:** edit the owning section only and link it from dependent text,
  following `project-skill-feedback` conventions.

Follow [AGENTS.md](../../../AGENTS.md): prefer direct, destructive changes over
compatibility shims. Preserve other people's uncommitted edits.

## 6. Verify by replay

Run each row's verification from the layer table against the run where the
finding occurred: the original case must now be caught, and a close negative
from the same run must stay quiet. For L7-L10, walk the phase with the original
evidence and label it a walkthrough.

Run the skill validator on changed skills and the tests of changed scripts.
Report rows applied with their layer and file, replay results, and deferred
rows.
