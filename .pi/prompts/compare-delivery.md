---
description: Compare normal issue delivery with direct implementation in isolated Herdr panes
argument-hint: "[issue-number, default: 31]"
---

Run a repeatable comparison for issue ${1:-31} in the Herdr tab named `runner`.

Create a new controller pane. The controller creates two new implementation panes, each with its own Git worktree. Start the controller and both runner sessions with `--model openai/gpt-6.1-sol --thinking medium`. Let the normal workflow choose descendant models. Give the controller the experiment contract below without adding task constraints.

## Experiment contract

### Setup

- Use the Herdr skill for pane operations. Keep existing panes and unrelated work intact.
- Start fresh sessions and isolated worktrees. Record starting commits, application-tree differences, model settings and pane IDs. Use the same starting application code and access to the existing development environment for both arms.
- Select the starting model with the CLI flags above only. Keep normal workflow profiles, descendant model selection, workflow instructions and acceptance rules unchanged, and leave workflow preparation and findings from previous runs to the arm.
- Check launch prerequisites before dispatch. Report any prerequisite that needs the user, and launch an arm only once its prerequisites are resolved.
- Keep the existing permissions and safety rules without experiment-specific restrictions on repairs, tools, dependencies, fixtures, database use, verification or completion. The workflow and the user's existing permissions determine what the delivery arm can do.

### Exact initial inputs

**Delivery arm:** launch the normal delivery workflow. Its only initial input is:

```text
/deliver issue ${1:-31}
```

Send no initial prose prompt, appended system guidance, copied issue body, recovery instructions or controller-written workflow rules. Model selection and worktree setup are configuration, not extra task instructions. Let the installed workflow perform its own preparation, discovery, implementation, repair and verification.

**Direct baseline arm:** its only initial task prompt is:

```text
help me to implement issue ${1:-31}
```

Exclude workflow routing for this arm while retaining ordinary coding standards and tools. Let it work without delivery phases, extra review gates or a controller-designed implementation plan, finding it find the issue and related code itself.

### Observation only after launch

After the initial input to each arm, the controller only observes: it sends no follow-up prompts, reminders, approvals, keys, restarts, reloads, fixes, configuration changes or hints to either arm or its descendants, and leaves their worktrees untouched. This applies when an arm asks a question or stops with a blocker as well as while it is working. Record the outcome and wait for the user instead of intervening.

An idle parent with an active child is not finished. Record each arm's natural completion or stop. Keep any later user-authorized repair or retry separate from the original experiment.

### Final report

Store experiment notes, reports and screen captures outside the project in a run-specific temporary directory.

When both arms finish or stop, capture their final screens if screen capture is available. Preserve existing application screenshots. Label terminal text or ANSI captures as text, not screenshots.

Report a separate evidence-based timeline for each arm: launch, discovery, first application edit, checks, commits, delegated work, verification/review if used, and final stop. Include elapsed time, result, remaining work, model evidence, pane/worktree identifiers and evidence paths. Distinguish coordinator discovery from worker investigation, and waiting from execution.

Compare the actual changes and verification evidence. State any differences in completion requirements or environment, and any user intervention. Preserve the work and reports for inspection; do not automatically clear them.
