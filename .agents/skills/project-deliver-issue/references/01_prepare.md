# 01 Prepare the issue branch

Read the issue and accepted comments, then confirm the repository's [delivery policy](../../../../docs/agents/issue-delivery-policy.md) and [branching strategy](branching-strategy.md). Record the chosen base and target refs, their full SHAs, dependency revisions, source checkout and required checks. Preserve an existing branch for continued work.

## Executable operation

The existing [preparation script](01_prepare.mjs) expects a production tag and fixed branch conventions from the parked workflow. Use it only after those inputs and its implementation have been reconciled with this project. When a required value is unconfigured, report the missing decision before changing Git state. Confirm actual repository state after any failed operation before retrying.

Use the issue's accepted implementation contract, independently of its human-facing summary. Inspect current project guidance and source ownership before decomposing work. An infrastructure or release target needs its own explicit project policy and approval.
