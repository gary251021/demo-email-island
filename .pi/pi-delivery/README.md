# Pi delivery reporting

Run `/deliver issue N` from an idle interactive Pi session. A dedicated delivery conversation opens in the same terminal with normal Pi tools, extensions, skills and native pi-subagents available. The agent chooses how to deliver the issue under [coordinator guidance](instructions.md), [project delivery](../../.agents/skills/project-deliver-issue/SKILL.md), [delivery policy](../../docs/agents/issue-delivery-policy.md) and [acceptance testing](../../docs/agents/acceptance-testing.md).

## Hooks

The project extension `.pi/extensions/hooks.ts` loads in ordinary Pi sessions. The `/deliver` launcher also loads it explicitly; Pi deduplicates the same path when project discovery is on. The adapter executes the existing Codex scripts with Codex-shaped stdin, including session and turn IDs, without changing their Codex configuration.

| Pi event | Existing script | Effect |
| --- | --- | --- |
| `input` / `before_agent_start` (user prompts) | `require-harness-managed-edit-approval.py --capture-approval` | Record exact protected-edit approval. |
| `tool_call` (`edit`, `write`, `apply_patch`) | `require-harness-managed-edit-approval.py` | Deny unapproved protected tooling edits. |
| `tool_call` (`bash`) | `enforce-gitlab-guardrails.py`, `enforce-issue-integration.py` | Deny invalid GitLab requests and integration-branch pushes. |
| `tool_call` (`subagent`) | `enforce-issue-integration.py` | Check native task launch and reviewer isolation. Dynamic scripted workflows cannot be inspected in advance and are refused; use direct/parallel task payloads. |
| `tool_result` (`bash`) | `workflow-state.mjs --hook` | Add clarification context to the tool result. |
| `tool_result` (edits) | `request-ponytail-review.mjs --mark`, `check-overdefensive.mjs --mark` and `--document` (markdown → overdefensive-review document variant), `checkAgentsMdSize.mjs --hook`, `lint-changed-file.mjs`, impeccable `hook.mjs` | Mark edited paths and show budget/lint/UI feedback. |
| `agent_before_settle` | `lint-changed-file.mjs --stop`, `check-overdefensive.mjs`, impeccable `hook.mjs`, `request-ponytail-review.mjs`; delivery graph | Inject one more turn for lint/review feedback or an unfinished delivery's next step. A graph revision is reminded once to prevent an idle loop. |

Every script decision is appended to `hook-events.jsonl` beside the issue's `graph.json`; outside delivery, a session-ID-hashed `pi-hooks-*.jsonl` lives in the OS temp directory. `/delivery graph` shows the last decision. Script errors deny operations rather than bypassing checks. The Codex reviewer request still names its Codex-specific `spawn_agent` API; Pi surfaces that text unchanged instead of rewriting the source script. The coordinator must use Pi's native reviewer mechanism where applicable.

## Domain API

| Tool                      | Reported facts                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| `delivery_status`         | Workflow reports, history and evidence references.                                       |
| `delivery_preparation`    | Baseline/dependency pins and branch preparation status/evidence.                         |
| `delivery_plan`           | Tasks, acceptance expectations, ownership contracts and dependencies.                    |
| `delivery_implementation` | Per-task status, native run ID, full revision, summary and tests/evidence.               |
| `delivery_verification`   | Revision-scoped automated/live/visual check outcomes and artifacts.                      |
| `delivery_review`         | Standards or Spec axis, revision, native run ID, verdict, round and structured findings. |
| `delivery_preview`        | Local artifact, source/target, reviewed revision, equality/compatibility and evidence.   |

The tools validate report shape and contradictions, then save domain facts. A completed preview also requires no open T1/T2 findings, passing verification and completed Standards and Spec reviews on the current reviewed revision in the same round. T3-only preview follows the five-round stopping rule. Once the configured hard cap of completed review rounds is reached, correction reports stop and the coordinator must report the delivery `blocked` with evidence for a human decision. They never dispatch workers, run Git/tests/browser commands, generate a preview or publish. Completed reports need the corresponding revision/evidence; check completion requires reported passing outcomes. This validates a **claim**, not the underlying execution. The coordinator remains responsible for scope, actual acceptance, current-revision evidence and publication authority. Blockers belong to the relevant report; corrections append implementation/check/review history. Review finding IDs retain their history and explicit dispositions. Omitted review rounds group the next pair of independent axes; explicit rounds support retained review updates.

## Native work and configuration

[profile.json](profile.json) retains role skills, a concurrency preference, the hard `maxReviewRounds` limit, and optional implementer model/thinking preferences. Its current model preference is `openai/gpt-6-luna`. The coordinator passes configured preferences through documented native pi-subagents options, with normal active defaults when omitted and existing Pi authentication. Reporters do not select models or credentials. Implementers fork the **delivery coordinator** context; verifiers and each reviewer start fresh with explicit target/contract/diff/evidence. Native run IDs and resume own continuation; see [instructions](instructions.md#native-delegation).

The launch inherits the current Pi model/thinking and normal discovery rather than replacing ordinary tools with an execution allowlist. Additional configured extensions and coordinator skills resolve from the repository or `~/`. Pi skill paths may resolve to their matching `~/.agents/skills` installation; missing configured skills fail visibly. The reusable [phase scripts](../../.agents/skills/project-deliver-issue/SKILL.md#script-interface) remain available for preparation, checkout/commit validation, review preparation and preview/patch proofs. There is no custom SDK worker layer or reporting sandbox.

## Graph and persistence

`/delivery graph` opens the top-center popup with horizontal centering, 95% width and one-cell margin. Arrow/Page Up/Down/Home/End scroll; Escape/Ctrl+C closes it without stopping work. `/delivery hide|show` changes the one-line widget; `/delivery exit` returns to the original terminal session.

### Pi Web

Start [@agegr/pi-web](https://github.com/agegr/pi-web) through its standalone npm CLI, choose this repository, and run `/deliver issue N` in an idle chat:

```sh
npx @agegr/pi-web@latest
```

The command activates delivery in that browser session and starts the coordinator turn; merely opening an unrelated saved session does not create a delivery run. Activation is recorded in the delivery session so Pi Web can restore its reporting tools, status and widget after its session wrapper is recreated. The **Delivery graph** status button sends `/delivery toggle` and opens the same read-only graph as `/delivery graph`; Pi Web disables the button while the session is busy. Close the graph to return to chat. The one-line graph widget and its updates use Pi's standard `setWidget` API, while the terminal keeps its plain status text, widget and popup behavior. No separate browser plugin or host fork is required.

The renderer independently projects preparation → planning → implementation → verification → two-axis review, corrections/reverification and local preview. Tasks/dependencies, check outcomes, review rounds/findings and stale revision evidence remain visible. Marks mean **reported** progress. The status HEAD is the last reported implementation/verification checkout revision, not an implicit Git inspection. Verification/review staleness compares exact revisions; preview staleness uses its explicit reviewed revision rather than treating source and integration revisions as interchangeable.

Reports persist atomically in `~/.pi/delivery/<git-common-directory-hash>/issue-N/graph.json`, protected by one session lease. A read-only Git-common-directory lookup identifies the repository at startup. Reporting updates themselves perform only snapshot persistence. Legacy `state.json`, `events.jsonl`, sessions, checkouts, commits and evidence are preserved unchanged and referenced for inspection; no compatibility executor or automatic migration runs. Coordinator sessions remain under `~/.pi/delivery/sessions/`.

## Test-only local cleanup

After an experiment stops, stop its workers and dev servers, then run **`/delivery clear` inside the workflow**. It needs no issue number or confirmation flag: this explicit command authorizes permanent local deletion. The launcher waits for the delivery process to exit and release its lease before running cleanup, so it cannot recreate the removed session files.

Alternatively, from the parent session:

- `/deliver clear N` previews the exact local deletion list.
- `/deliver clear N --apply` permanently deletes it, including uncommitted experiment work.

Cleanup removes this repository's issue runtime directory, dedicated delivery sessions and archives, registered worktrees inside those directories, terminal native run artifacts identified by issue session/cwd, and conventional `type/N-slug` and `local/int/N-slug` local branches. It refuses a live session lease, nonterminal native runs, unrelated branches inside managed worktrees, and issue branches checked out outside managed storage. Exit the experiment rather than forcing a live reset.

Keep delivery-created scratch files, baseline/mutation checkouts, screenshots and logs under the issue runtime directory so cleanup owns them deterministically. Existing external scratch paths require explicit manual cleanup; it never guesses ownership from evidence strings or searches arbitrary directories for an issue number. Harness code, general conversation history, shared runtime probes, unrelated worktrees, databases and remote state are preserved. Git objects expire through normal garbage collection; this command does not erase shared Git history. The seven reporters remain record-only, and cleanup never runs automatically.

## Verification boundary

Existing UI/resource checks still cover display, scrolling, close controls and resource resolution. The removed SDK dispatch/sandbox/controller simulations no longer establish anything about this design. Native launch context/authentication and actual application acceptance require their own recorded execution evidence. The terminal outcome remains a verified local MR draft, with publication separately authorized.
