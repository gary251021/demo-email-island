<!-- documentation-origin: Matt Pocock workflow configuration; project-specific -->

# Triage Labels

GitLab issues use the existing project label vocabulary. Do not create labels
whose names mirror the triage skill's canonical roles.

## Required label dimensions

- **Agent ownership:** Codex-created issues must include `ai-agent`. The local
  issue-creation hook enforces this requirement.
- **Category:** Apply exactly one: `-bug` for a verified defect or `-change`
  for a confirmed change request.
- **Triage state:** Apply the mapped label below when one exists.

## Canonical triage-state mapping

| Canonical triage role | GitLab label  | Use                                                                                                                                  |
| --------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `needs-triage`        | `-feedback`   | A user report or other input that is not yet clarified.                                                                              |
| `needs-info`          | `-discussion` | The issue is waiting for information or a decision.                                                                                  |
| `ready-for-agent`     | None          | `ai-agent` records agent ownership, not readiness. No current label expresses agent readiness; state this in the agent brief.        |
| `ready-for-human`     | None          | No current label expresses human implementation readiness; do not substitute release or QA labels. State this in the triage comment. |
| `wontfix`             | None          | Close the issue with the required triage explanation; `*settled` means it passed internal QA and must not be used.                   |

## Other workflow labels

`*processing`, `*ready`, `*ready for QA`, `*ready in next release`, `*ready to
merge`, and `*settled` describe implementation, review, QA, or release
lifecycle stages. They are not replacements for the triage roles above.
