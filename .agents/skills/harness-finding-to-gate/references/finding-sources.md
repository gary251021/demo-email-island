# Finding sources

Read the sources that exist for the run under review; record unavailable ones.

## Review and delivery evidence

- Review reports and scorecards in the delivery evidence directory named by the
  issue's delivery comment, for example `review/spec-round1.md`,
  `review/standards-round1.md`, `final-verification.md`,
  `test-change-ledger.md`.
- The issue file under `.scratch/<feature>/issues/` for the acceptance contract.
- The delivery checkout at the reviewed SHA for direct verification
  (`git -C <checkout> log`, run linters and checkers there).

## Codex session transcripts

Sessions live in `~/.codex/sessions/<yyyy>/<mm>/<dd>/rollout-*.jsonl`.

- The first line is `session_meta`; `payload.source.subagent.thread_spawn`
  holds `parent_thread_id`, `agent_path` (for example `/root/spec_review`) and
  `agent_nickname`. Build the agent tree from these.
- Agent prose: `response_item` with `payload.type == "message"` and
  `role == "assistant"`. Final answers: `event_msg` with
  `payload.type == "task_complete"` and `last_agent_message`.
- Tool calls: `response_item` with `payload.type` `custom_tool_call` or
  `function_call`; the command is in `input` or `arguments`. Use these to see
  what a reviewer actually ran versus what it cited.
- Inter-agent payloads may be encrypted; rely on the receiver's own messages.

## Terminal panes

When the run is in a herdr pane, `herdr pane list` shows panes with agent and
cwd, and `herdr pane read <pane> --source recent-unwrapped --lines N` returns
recent output. Scrollback is short; use transcripts for history.

## User observations

Quote the user's correction and the agent behaviour it responded to. A user
observation without artifact evidence stays a finding; mark its evidence as the
quoted message.
