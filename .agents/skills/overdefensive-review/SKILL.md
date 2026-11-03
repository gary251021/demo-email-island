---
name: overdefensive-review
description: Review new or changed work for over-defensive content and fix it. Routes to a code variant (guards, fallbacks, swallowed errors, casts, unneeded tooling tests) or a document variant (agent prompts and docs written as stacked prohibitions, shouting or repeated caveats). Use when a hook reports over-defensive candidates, or when the user asks to check code or prompts for over-defensiveness.
metadata:
  triggered_by: .codex/hooks/check-overdefensive.mjs
---

# Over-defensive review

Over-defensive work protects against states the contract already rules out.
In code it hides real failures and blurs the contract; in prompts it buries the
intended behavior under warnings. Review the reported locations, decide each one
against its owning contract, and fix what does not earn its place.

## Route the review

| Input | Variant |
| --- | --- |
| Source files under `src/`, or test files added outside `src/` | [Code](references/code.md) |
| Markdown that instructs or informs agents or people: skills, prompts, `docs/`, `AGENTS.md`, `CODING_STANDARDS.md` | [Document](references/document.md) |

Read only the variant that matches the input; read both when the input mixes
code and documents. A hook message names its variant and lists the candidates.

## Scope

- Review the reported candidates first, then the rest of the same change for the
  same patterns. Leave unrelated existing code and text alone.
- Hook candidates come from pattern matching. Treat each as a question to
  answer, not as a verdict.
- Third-party skills listed in `skills-lock.json`, `impeccable`, and the import
  record under `docs/harness/` are outside scope.

## Report

End the final reply with one line per variant you applied:

`Over-defensive review (<variant>): removed <n>, kept <m> — <one reason per kept item>`
