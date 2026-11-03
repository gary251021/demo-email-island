# Configure the current project

This phase is prompt-led. Use the bundled skill dependency checker and ordinary
read-only inspection commands.

## Determine applicability

The full issue-delivery workflow applies when:

- Git is the project's source-control mechanism;
- work is represented by tracked issues; and
- completion is represented by a pull request, merge request, or merge.

Application code, documentation, configuration, infrastructure, research, and
other artifacts can use this workflow when Git and merge-based delivery are
their actual lifecycle.

When the workspace is not intended for version control or merge-based
delivery, report that the workflow is not applicable and make no changes.

## Check prerequisites

Run and apply [the Matt Pocock skill dependency check](../../general-workflow/references/matt-pocock-skills.md).

Inspect and report:

1. whether the current directory is inside a Git repository;
2. whether the repository has a usable remote and default delivery branch;
3. whether the generated issue-tracker artifact exists;
4. which tracker and hosting provider the artifact configures;
5. whether the required provider CLI is installed and authenticated;
6. whether `AGENTS.md` routes issue work to `general-workflow`;
7. whether `AGENTS.md` names a project-specific delivery extension when the
   project requires one;
8. whether the project extension and its prompt references exist; and
9. whether the repository's required verification or signal commands are
   documented and available; and
10. whether every required Matt Pocock skill is available locally or globally.

If the generated tracker artifact is missing, stop and instruct the user to run
the project's tracker setup, which owns generation of Matt Pocock setup artifacts.

## Report structure

Return a concise readiness report:

```text
Applicability: applicable | not applicable | blocked

Source control:
  Git repository: ready | missing
  Remote and delivery branch: ready | missing | unclear

Issue tracking:
  Generated tracker artifact: ready | missing
  Provider CLI: ready | missing
  Authentication: ready | blocked

Prompt routing:
  general-workflow: ready | missing
  Project delivery extension: ready | not required | missing

Agent skills:
  Matt Pocock skills v1.2.3: ready | missing | outdated | unclear

Signals:
  Required commands: ready | missing | unclear

Next action:
  <one concrete action or "ready">
```

## Configure only prompt surfaces

When the user explicitly asks to configure an applicable project, limit this
first phase to:

- adding project-local `general-*` skills;
- adding or updating a compact project `AGENTS.md` routing instruction; and
- preserving an existing project-specific delivery skill as the owner of its
  provider and branch workflow.

Leave `issue-delivery.yaml`, new workflow scripts, and provider adapters out of
scope. Global routing is a separate user-level decision, so project onboarding
leaves global instructions unchanged.
