# Implement and deliver an issue

Use this route only when the user requests implementation or delivery of a
specific tracked issue.

## Read the project contract

Before editing:

1. Read the repository `AGENTS.md`.
2. Read the generated issue-tracker artifact named by the repository, normally
   `docs/agents/issue-tracker.md`.
3. Read the issue and every issue comment through the configured tracker.
4. Identify any project-specific delivery skill named by `AGENTS.md`.

The generated tracker artifact supplies the project's runtime configuration.
If it is required but missing, stop and instruct the user to run the project's
tracker setup.

## Apply the project delivery extension

When `AGENTS.md` names a project-specific delivery skill, read that skill
completely and follow it as the delivery workflow for this repository.

The project extension owns:

- tracker-provider commands;
- branch names and base-selection policy;
- project-specific harness preparation;
- fresh-task or workspace mechanics;
- required project signals; and
- pull-request or merge-request publication details.

Use the extension's mechanics for the current repository, with this route as
the entrypoint.

Use this precedence when instructions differ:

1. explicit user instruction;
2. repository `AGENTS.md` and its project delivery extension;
3. generated tracker configuration; and
4. the generic lifecycle below.

## Generic lifecycle

Use this prompt-controlled lifecycle only when the repository does not declare
a project-specific delivery extension:

1. Establish the issue scope and acceptance criteria from the issue and its
   comments.
2. Resolve the tracker provider, Git base, publication target, and required
   signals from repository guidance. Stop for a decision when a material value
   is missing.
3. Preserve existing work and require a clean checkout before changing branch
   state.
4. Prepare a business branch according to the repository's Git conventions.
5. Implement only the issue scope and keep the history reviewable.
6. Run focused tests and every repository-required signal.
7. Review the complete business delta against the issue and repository
   standards.
8. Publish through the configured provider only when publication is part of
   the requested workflow.
9. Report the issue, branch, target, commits, verification, and change-request
   URL or explicit local stopping point.

Keep decisions in prompting during this first phase, with no YAML binding,
generated workflow file, or new deterministic delivery script.
