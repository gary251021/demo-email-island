# Triage labels

Record the canonical role in each local issue's `Status:` line.

| Canonical role | Local value | Meaning |
| --- | --- | --- |
| needs-triage | needs-triage | Maintainer evaluation needed |
| needs-info | needs-info | Waiting for more information |
| ready-for-agent | ready-for-agent | Fully specified for agent implementation |
| ready-for-human | ready-for-human | Requires human implementation |
| wontfix | wontfix | Will not be actioned |

Use these values when a skill asks to apply a triage label.
New issues start with `Status: needs-triage`.

Execution progress is recorded separately as defined in
`docs/agents/issue-tracker.md`.

`_temp-triage-labels.md` remains reference material and does not define
the active vocabulary.
