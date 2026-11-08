---
name: project-create-issue
description: Create, deepen or publish one issue with product scope, acceptance criteria and implementation design. Documentation only; never implement application code, tests, prototypes or code-proof experiments, including in temporary workspaces.
metadata:
  routed_by: general-workflow
  configured_by: general-setup-workflow
---

# Project Create Issue

Turn one ticket into an issue an implementer can execute without inventing
architecture. Product scope comes from the ticket and spec; this skill's job is
the **implementation design**: how the slice is built, with what, and where the
code goes. Read [tracker guidance](../../../docs/agents/issue-tracker.md) and
[delivery policy](../../../docs/agents/issue-delivery-policy.md) first. If
tracker or delivery inputs needed for publication are not configured, keep the
work as a local draft and ask for the missing project decision.
Read each stage only when entering it.

## Documentation-only boundary

Inspect existing code and authoritative documentation; produce issue text,
design contracts, checkpoints and static review illustrations. Code snippets in
documents describe proposed interfaces or cite existing source; they are not
executable validation.

Do not write or modify application code, tests, runnable prototypes or code-proof
experiments. This applies equally to temporary directories, isolated worktrees
and delegated work. Do not install dependencies or prepare implementation
workspaces for issue creation. Approval of a design or issue authorizes only
the corresponding documentation or publication step.

Record runtime questions that source inspection cannot settle as unverified,
with a validation plan for delivery. Implementation and executable experiments
require a separate task outside this skill.

## Workflow

Create the [durable issue checkpoint](references/00-run-checkpoint.md) before
scoping and keep the same run through every phase. The main agent inspects the
checkpoint evidence and actual phase outputs against the completion criteria
below before accepting each transition.

1. [Load the ticket scope](#load-the-ticket-scope). Enter investigation when the
   scope baseline is recorded and any architecture-blocking product gap has an
   accepted default.
2. Read [investigate and design](references/01-investigate-design.md) and
   investigate. Enter design when the source baseline, architecture contracts,
   affected owners, sibling-ticket contracts and candidate libraries are recorded.
3. [Propose the implementation design](references/01-investigate-design.md#propose-the-implementation-design),
   using [code-design validation](references/03-code-design-validation.md) or
   [UI-design validation](references/04-ui-design-validation.md) when applicable.
   Enter drafting when the user accepts the current design revision, its
   source-backed evidence and remaining validation needs are recorded, and no
   library, placement, ownership or contract point is left without either a
   user correction or an accepted default.
4. [Draft the issue contract](references/02-issue-contract.md): a `For Human`
   summary of at most 200 words, `Verification (E2E)` criteria, and the
   `For Agent` code architecture. Enter preview when the draft carries the full
   accepted design and passes the checks in that reference.
5. Read [preview, confirm and publish](references/05-preview-publish.md). Publish
   only after the user explicitly approved the exact previewed revision. Finish
   only after tracker readback verifies the published issue.

Keep the ticket's product scope, verified current code, inference, and human
decisions distinct. Preserve exact identifiers and domain meaning; apply the
repository's [semantic fallback requirements](../../../docs/agents/external-context.md)
when considering another field.

If a correction invalidates a decision or output, return to the earliest
affected stage and regenerate its dependents while preserving settled answers
and evidence that remain valid.

After producing the complete issue draft and after verified publication, use
[project-skill-feedback](../project-skill-feedback/SKILL.md) to classify new user
steering and propose an update plan; apply it only after the user approves that
plan. Finish with the issue's path or identifier and link, then stop.

## Working style: propose, don't interview

This is a prototype; most details are discovered by reacting to something
concrete. In every phase, lead with a concrete proposal and let the user correct
it. Where the ticket, spec or code is silent, choose a reasonable default and mark
it inline as `(proposed)` so invented points are visible. Ask a direct question
only when no reasonable default exists or the candidates diverge so far that
proposing one would waste the review; then offer 2–3 candidates with a
recommendation. Show only what changed in each revision. Silence on a
`(proposed)` point in an accepted revision accepts it. Establish source facts by
inspection, never by asking.

## Two output layers

The agent produces two kinds of output; keep them apart.

- **Issue layer — written to the issue.** Everything defined by the
  [issue contract](references/02-issue-contract.md): `For Human`,
  `Verification (E2E)` and the `For Agent` code architecture.
- **Review layer — shown to the user, never written to the issue.** Pictures
  that let the user see the deliverable and judge the design quickly. Pick what
  fits the slice:
  - the deliverable itself: a UI mockup, annotated screenshot or generated
    image of the end state (follow the visual style guide routed by `AGENTS.md`);
  - the architecture: the module × layer matrix as a graph, with new and changed
    modules highlighted and module dependencies drawn;
  - the flow: a sequence or data-flow diagram of the primary path;
  - the comparison: a chart or table image when choosing between libraries or
    approaches (cost, bundle size, capability coverage);
  - the plan: a graph of this ticket and its blocking/blocked tickets.

  Render each illustration to an image or HTML file in the checkpoint directory
  and open it with available local tooling, or give its absolute path; use a
  terminal ASCII sketch only when nothing can be rendered. Label what is verified
  and what is `(proposed)`. Keep these files out of the repository and out of the
  issue; when one encodes a decision, write that decision into the issue as text.

## Codex delegation

The main agent owns scoping, design, synthesis, artifact acceptance and
publication. When delegation is authorized, give each worker a bounded question
(for example, evaluating one library against the stack), the evidence baseline,
current requirements and access to the checkpoint. Inspect returned evidence
before accepting it. If a required capability is unavailable, report the blocker.

## Load the ticket scope

The usual input is a ticket from `to-tickets` at
`.scratch/<feature>/issues/<NN>-<slug>.md`, plus the feature's `spec.md`. Read
the ticket (including comments), its spec, its blocking tickets, and the tickets
it blocks. Its "What to build", acceptance criteria and blocking edges are the
**settled product scope** — do not re-propose visible behavior, flows or UX
defaults the ticket already states or leaves to UI detail.

Record in the checkpoint:

- the scope baseline (ticket path, what it delivers, its acceptance criteria);
- what blocking tickets will already provide, and what later tickets will build
  on top of this one, since this slice's design becomes their foundation;
- product gaps that would change the architecture (for example, whether data
  survives a browser restart, whether two browsers see the same data). Fill each
  with a `(proposed)` default and present them together in one short message.
  Leave gaps that do not affect architecture to implementation.

Scoping `(proposed)` items are **functional only**: the user should be able to
object to each one purely as a user of the product. Write them as what the user
can do and observe, and strip every implementation detail — who creates what,
credentials, storage, seeding mechanics, libraries, or "to be evaluated in
design" notes. Implementation is the agent's call in the design phase and is not
presented for objection here.

- ✅ `(proposed)` Refreshing or reopening the same browser keeps the user's data;
  another browser or a private window starts with separate data.
- ✅ `(proposed)` Clicking "Enter the island" again keeps the existing data and
  read state instead of resetting it.
- ✅ `(proposed)` No reset, account recovery or cross-device sign-in in this
  ticket.
- ❌ `(proposed)` The server creates the anonymous identity and the browser keeps
  an unguessable session credential. — mechanism; decide in design.
- ❌ `(proposed)` A fixed seed is copied into the user's storage on first click.
  — mechanism; state only the observable result.
- ❌ SQLite is still to be evaluated in design. — implementation; omit.

Any on-screen text the scope names — button labels, titles, empty states —
follows [Interface text](../../../reference/email-island/README.md#interface-text):
it names the thing or action only. Never put build or meta wording such as
`示範`, `demo`, `mock`, `測試` or `placeholder`, or a state the control's
appearance already shows such as `尚未開放`, into a label, even when the source
ticket uses it; propose a player-facing name instead and flag the change.

- ✅ Entry button `進入群島`; greyed sign-in button `Google 登入`.
- ❌ `體驗示範`, `打開你的示範群島` — build wording shown to the player.
- ❌ `Google 登入・尚未開放` — the greyed style already shows the state.

When there is no ticket, write a one-paragraph scope from the user's request in
the same shape and get it accepted before investigating.
