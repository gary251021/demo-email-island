# Durable Issue Checkpoint

Before scoping, establish durable temporary storage for this run. Choose
the filenames, format and layout that suit the work.

## Temporary workflow state

The main agent tracks this run with the task-scoped
[state helper](../../../../.codex/hooks/workflow-state.mjs). Run each transition
as its own shell tool call from the repository root:

```bash
node .codex/hooks/workflow-state.mjs set scoping normal
node .codex/hooks/workflow-state.mjs set design awaiting_feedback
node .codex/hooks/workflow-state.mjs show
```

Use the current phase as `state`: scoping, investigation, design,
drafting, preview or publication. Design validation stays read-only within design.
Update it on phase changes
and include `{state, substate}` in the progress update. Before presenting a
proposal for the user to accept or correct, set `awaiting_feedback` in the current
phase. The `PostToolUse` listener emits the fixed propose-and-react reminder once
for that transition. Keep that substate while waiting and return to `normal`
after the user accepts the revision. Repeating the same pair stays quiet;
entering feedback again emits a new reminder. Use `awaiting_approval` for the
final publication approval.

The main agent writes this state; workers report their findings to it.
State lives in the OS temporary directory, isolated by checkout and
`CODEX_SESSION_ID`. On continuation, inspect it with `show` and reconcile it with
the checkpoint; restore it if temporary storage was cleared. Finish or cancel
the run with `node .codex/hooks/workflow-state.mjs clear`.

The checkpoint owns decisions and evidence; the helper only reports declared
state. Codex must trust the new hook definition before it delivers context.
If the hook is pending trust, follow the propose-and-react loop directly and
report that automatic notification is pending activation.

## Retained evidence

Keep current requirements, decisions, evidence, pending work, the evolving
issue draft and the review-layer illustrations (with the revision each belongs
to) recoverable throughout the run. Include how to retrieve them in
handoffs and continuation summaries.

Record each phase outcome with the actual outputs, evidence and main-agent review
that establish its completion criteria. Keep the phase pending until that review
accepts the required evidence.

Record the current waiting phase, each proposal revision with its `(proposed)`
defaults, each user correction and the point it settles, and the user's
acceptance of a revision. Keep these decisions separate: the main agent accepts
source evidence, the user's corrections and acceptance settle product and contract
choices, and acceptance of a revision covers its unchallenged defaults. Publication approval authorizes the current
complete preview. Collect each required acceptance at its phase.

After compaction, recover that state and reconcile newer user steering before
continuing. Preserve the full agreed scope and completion requirements.

When a material correction changes a decision or invalidates evidence, mark only
the affected decisions and dependent outputs pending, return to the earliest
affected stage, and preserve still-valid answers and evidence.
