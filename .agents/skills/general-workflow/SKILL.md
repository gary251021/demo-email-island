---
name: general-workflow
description: Route a request to create or deliver a specific tracked issue through the project's configured workflow. Use whenever the user asks to create, file, open, implement, fix, build, handle, complete, or deliver a tracked issue in a Git-based project. Do not use for read-only issue inspection, diagnosis, planning, issue review, review of an existing change request, or implementation work without a tracked issue.
metadata:
  generated_by_user: Gary
  scope: Global
  matt_pocock_skills: "v1.2.3"
  dependency_check: scripts/checkSkillDependencies.mjs
---

# General Workflow Router

Route a tracked-issue request to the repository's existing issue-creation or
issue-delivery owner. The `general-` prefix marks this project-local first-phase
skill as intended for future global use.

This router owns intent classification and reference selection. Repository
guidance owns tracker, provider, branch, harness, verification, and publication
behavior.

## Check dependencies

Read and run [the Matt Pocock skill dependency check](references/matt-pocock-skills.md).
Stop with its install advice when any required skill is unavailable.

## Route the request

Read the repository `AGENTS.md` before taking a mutating action. Then select
exactly one route:

| User intent                                                            | Read and follow                                                 |
| ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| Create, file, open, publish, or deepen/detail one issue or ticket      | [Create an issue](references/project-create-issue.md)           |
| Implement, fix, build, handle, complete, or deliver one existing issue | [Implement and deliver an issue](references/implement-issue.md) |

Creating an issue ends after its readback. Implementation or delivery requires
a later explicit human request.
