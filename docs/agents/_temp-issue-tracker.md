<!-- documentation-origin: Matt Pocock workflow configuration; project-specific -->

# Issue Trackers

Temporary reference only. This fixed GitLab configuration is pending the workflow reconciliation TODO in `project.md`; use [the active tracker guidance](issue-tracker.md) meanwhile.

GitLab is the default issue tracker. Local Markdown is a secondary tracker used
only when the user explicitly requests it for the current work.

## GitLab: Default

Issues and PRDs live as GitLab issues. Use the
[`glab`](https://gitlab.com/gitlab-org/cli) CLI for all operations.

### Conventions

- **Create an issue**: `glab issue create --title "..." --description "..."`.
- **Read an issue**: `glab issue view <number> --comments`.
- **List issues**: `glab issue list -F json`.
- **Comment**: `glab issue note <number> --message "..."`.
- **Apply / remove labels**: `glab issue update <number> --label "..."` / `--unlabel "..."`.
- **Close**: `glab issue close <number>`.
- **Merge requests**: Use `glab mr create`, `glab mr view`, `glab mr note`, etc.

Infer the repo from `git remote -v`; `glab` does this automatically inside the clone.

### Merge requests as a triage surface

Record requests in issues. Use merge requests to review their implementation.

## Local Markdown: Explicit Opt-in

When the user explicitly requests the local tracker:

- One feature uses one `.scratch/<feature-slug>/` directory.
- The spec is `.scratch/<feature-slug>/spec.md`.
- Implementation issues are separate files under
  `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`.
- Record triage state with a `Status:` line near the top.
- Append conversation history under a `## Comments` heading.

For local wayfinding:

- The map is `.scratch/<effort>/map.md`.
- Child tickets are `.scratch/<effort>/issues/<NN>-<slug>.md`.
- Record dependencies with `Blocked by: NN, NN`.
- Claim work by setting `Status: claimed`.
- Resolve work by adding an `## Answer`, setting `Status: resolved`, and
  updating the map's Decisions-so-far.

## Skill Routing

When a skill says "publish to the issue tracker":

- Use GitLab unless the user explicitly selected local Markdown.
- When local Markdown is selected, create the appropriate file under
  `.scratch/<feature-slug>/`.

When a skill says "fetch the relevant ticket":

- Use `glab issue view <number> --comments` by default.
- Read the referenced `.scratch/` file when local Markdown was explicitly
  selected.
