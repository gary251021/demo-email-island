# 01 Prepare the issue branch

Read the issue and accepted comments, then apply the repository's [delivery policy](../../../../docs/agents/issue-delivery-policy.md) defaults and [branching strategy](branching-strategy.md). Record the chosen base and target refs, their full SHAs, dependency revisions, source checkout and required checks. Preserve an existing branch for continued work. When the workspace has existing changes, prepare a separate clean checkout for delivery and leave those changes intact.

## Executable operation

Run `node references/01_prepare.mjs prepare '{"issue":"<NN>","type":"<type>","slug":"<slug>","dependencies":[{"branch":"<branch>","sha":"<full-sha>"}]}'` from a clean checkout. It always branches from the latest local `demo` tip, or from the last ordered dependency revision descending from it, and creates `<type>/<NN>-<slug>`. Continue an existing issue on its existing branch. Confirm actual repository state after any failed operation before retrying.

Use the issue's accepted implementation contract, independently of its human-facing summary. Inspect current project guidance and source ownership before decomposing work. An infrastructure or release target needs its own explicit project policy and approval.
