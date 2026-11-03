# Preview, Confirm and Publish

## Render the complete issue-document preview

This previews the issue text and attachments. Validate interactive UI changes
through the [Storybook workflow](04-ui-design-validation.md) during alignment.

Keep issue-document preview files outside the repository and render the complete
current issue draft. Markdown remains the tracker source of truth. Use the bundled renderer:

```bash
node .agents/skills/project-create-issue/scripts/renderIssuePreview.mjs \
  --input <issue.json> \
  --output <issue.html>
```

Open the returned HTML in Codex's right-side panel, or provide its absolute path
if the panel is unavailable. The main agent inspects the actual rendered body,
images and Mermaid output and retains its association with the current draft.

## Request confirmation

Explain in the user's conversation language what the preview will create and
the practical effects of decision-relevant tradeoffs or prerequisites. Keep the
explanation consistent with `For Human` and ask for explicit confirmation.

Publication requires approval of the current complete preview. Material changes
require an updated preview, explanation and confirmation; preserve settled
answers and valid evidence when revising.

## Visual attachments

Include selected screenshots in the preview before confirmation. After approval,
upload the same files and replace local references with tracker references.
Mermaid stays as confirmed source. Include downloadable artifacts only when
requested and included in the confirmed preview; retain other working artifacts internally.

Create the issue through the configured tracker, then read it back and verify its
title, metadata, body and attachments match the confirmed preview. Resolve
publication failures before reporting completion. Report the verified issue
identifier and link, then stop.
