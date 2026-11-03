---
name: project-deliver-issue
description: Deliver a tracked issue with a coordinator, implementation workers owning code and tests, independent Standards/Spec reviewers, and a verified local merge-request preview.
metadata:
  routed_by: general-workflow
  configured_by: general-setup-workflow
  optional_skill: implement
---

# Project Deliver Issue

Read [delivery policy](../../../docs/agents/issue-delivery-policy.md). The coordinator owns preparation, shared discovery, bounded assignments, integration, acceptance, independent review and the local MR preview. This workflow authorizes delegated implementation and review. Implementers write application code and its tests against coordinator-defined scenarios under [acceptance testing](../../../docs/agents/acceptance-testing.md); reviewers inspect both. An independent verifier may execute and assess evidence; implementers write their own tests. Dispatch ready work while preparing independent contracts.

## Model selection and context

In Pi, read the installed `pi-subagents` skill and use its native runtime. Keep the coordinator on the user's active model. Consult [.pi/pi-delivery/profile.json](../../../.pi/pi-delivery/profile.json) for optional implementer model/thinking preferences; resolve exact models using native `subagent({action:"models"})`. The current profile selects `openai/gpt-6-luna`. Pass configured thinking through documented model suffix syntax; omitted fields use normal active defaults and native Pi authentication. When the configured selection is unavailable, ask for help.

Implementers use explicit `context: "fork"` from the **delivery coordinator**. Verifiers and both initial Standards/Spec reviewers use explicit `context: "fresh"` with their own contract, checkout, revisions, diff and evidence. For mixed workflows set context per child and omit an outer override. Reuse native run IDs/continuation for same-role corrections and subsequent reviews; legacy custom SDK session files are evidence, not native retained runs. [Phase 02](references/02_handoff.md#native-pi-dispatch) owns native dispatch and [phase 04](references/04_review.md#cumulative-correction-review) owns retained review.

Graph reporters describe domain progress and evidence. Git, implementation, commands, reviews and draft preparation use ordinary tools, native delegation and phase scripts. Publication authority comes from the user, and the coordinator certifies reports.

In Codex, use native collaboration subagents for implementation and independent
review. A user-selected model overrides the default implementer preference.
Fork implementation context when the runtime supports it; when a model override
requires fresh context, provide the complete bounded assignment instead. Use
fresh reviewer context and retain subagent IDs for corrections. The legacy
`buildDispatch` chat payload serves only to resume existing marked chat deliveries.

## Select the role

Use the explicit assignment's responsibility and authority boundary. Implementation assignments own bounded code/test paths and acceptance scenarios; correction assignments retain findings and revision evidence. Review assignments own one independent axis and are read-only. Without an assignment, act as the coordinator. Context choice is a native runtime option, not a role prompt. Other supported harnesses use their available transport while preserving these role, context and authority boundaries; report unavailable capabilities.

## Phase index

Read the phase when entering it. Scripts and instructions are siblings.

| Phase                   | Owner                        | Instructions                            | Script                                          |
| ----------------------- | ---------------------------- | --------------------------------------- | ----------------------------------------------- |
| 01 Prepare              | Coordinator                  | [Prepare](references/01_prepare.md)     | [01_prepare.mjs](references/01_prepare.mjs)     |
| 02 Context and dispatch | Coordinator                  | [Handoff](references/02_handoff.md)     | [02_handoff.mjs](references/02_handoff.mjs)     |
| 03 Implement            | Coordinator and implementers | [Implement](references/03_implement.md) | [03_implement.mjs](references/03_implement.mjs) |
| 04 Review               | Coordinator and reviewers    | [Review](references/04_review.md)       | [04_review.mjs](references/04_review.mjs)       |
| 05 Preview              | Coordinator                  | [Preview](references/05_preview.md)     | [05_preview.mjs](references/05_preview.mjs)     |

For an existing MR merge conflict use [target-side conflict integration](references/target-side-conflict-integration.md), which owns its publication exception.

## Script interface

Run `node <phase-script> <operation> '<JSON input>'`; `--help` lists operations. Each operation is exported. Success returns `{ "ok": true, "data": ... }` and exit 0; failure returns `{ "ok": false, "error": { "code": "...", "message": "..." } }` and exit 1. Shared checks live in [scripts/shared.mjs](scripts/shared.mjs). Phase 01 mutates Git; other operations validate state or build legacy transport payloads. Pi uses native delegation rather than the legacy chat-payload builder. The coordinator verifies semantic context completeness and actual acceptance; phase 04's script prepares revision/diff evidence.
