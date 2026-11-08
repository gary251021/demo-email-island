# Response language

Reply in Traditional Chinese (繁體中文) by default, unless the user requests another language.

# Code changes

This is a personal demo project, not a long-lived production system. By default, do not preserve backward compatibility: prefer destructive changes — rename, remove, or restructure code, data, APIs, and config directly, without shims, deprecation paths, migrations, or fallback branches. Only handle backward compatibility when a human explicitly asks for it in the task.

# Tracked issues

Before using issue or release skills, read `docs/agents/issue-tracker.md` and `docs/agents/issue-delivery-policy.md`. Resolve tracker and Git targets from this project; if they are not configured, ask before starting the workflow. Files prefixed `_temp-` are reference material pending the reconciliation TODO in `project.md`.

# Prototype visuals

Before creating or revising Email Island prototype images, UI visuals, or building props, read [the visual style guide](reference/email-island/README.md) and inspect the relevant linked images. Apply its recorded user corrections and distinguish researched inspiration from generated concepts. Use `project.md` for functional behavior and building tier thresholds; the generated images are visual references.

## Agent skills

### Issue tracker

Track issues as local Markdown files under `.scratch/<feature>/`.
Before issue work, read `docs/agents/issue-tracker.md`.

### Triage labels

Use the five default triage roles.
Before triaging issues, read `docs/agents/triage-labels.md`.

### Domain docs

Use a single-context layout with root `CONTEXT.md` and `docs/adr/`.
Before exploring domain concepts or decisions, read `docs/agents/domain.md`.
