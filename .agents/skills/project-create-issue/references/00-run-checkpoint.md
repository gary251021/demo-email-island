# Durable Issue Checkpoint

Before consultation, establish durable temporary storage for this run. Choose
the filenames, format and layout that suit the work.

## Temporary workflow state

The main agent tracks this run with the task-scoped
[state helper](../../../../.codex/hooks/workflow-state.mjs). Run each transition
as its own shell tool call from the repository root:

```bash
node .codex/hooks/workflow-state.mjs set consultation normal
node .codex/hooks/workflow-state.mjs set investigation need_clarification
node .codex/hooks/workflow-state.mjs show
```

Use the current phase as `state`: consultation, investigation, alignment,
code-proof, ui-proof, drafting, preview or publication. Update it on phase changes
and include `{state, substate}` in the progress update. Before asking a human to
resolve a product or contract choice, set `need_clarification` in the current
phase. The `PostToolUse` listener emits the fixed grilling instruction once for
that transition. Read and use `grilling` before asking, keep that substate while
waiting, and return to `normal` after the clarification is settled. Repeating
the same pair stays quiet; entering clarification again emits a new instruction.
Use `awaiting_approval` for the final publication approval.

The main agent writes this state; workers report their findings to it.
State lives in the OS temporary directory, isolated by checkout and
`CODEX_SESSION_ID`. On continuation, inspect it with `show` and reconcile it with
the checkpoint; restore it if temporary storage was cleared. Finish or cancel
the run with `node .codex/hooks/workflow-state.mjs clear`.

The checkpoint owns decisions and evidence; the helper only reports declared
state. Codex must trust the new hook definition before it delivers context.
If the hook is pending trust, follow `grilling` directly and report that automatic
notification is pending activation.

## Retained evidence

Keep current requirements, decisions, evidence, pending work and the evolving
issue draft recoverable throughout the run. Include how to retrieve them in
handoffs and continuation summaries.

Record each phase outcome with the actual outputs, evidence and main-agent review
that establish its completion criteria. Keep the phase pending until that review
accepts the required evidence.

Record the current waiting phase, each actual user answer, the decision it
settles, and the user's shared-understanding confirmation. Keep these decisions
separate: the main agent accepts proof quality, the user's explicit answers settle
product and contract choices, and the user's confirmation establishes shared
understanding for the presented scope. Publication approval authorizes the current
complete preview. Collect each required answer and confirmation at its phase.

After compaction, recover that state and reconcile newer user steering before
continuing. Preserve the full agreed scope and completion requirements.

When a material correction changes a decision or invalidates evidence, mark only
the affected decisions and dependent outputs pending, return to the earliest
affected stage, and preserve still-valid answers and evidence.
