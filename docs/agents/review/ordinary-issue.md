# Ordinary issue contract review

For a feature, bug fix or mixed-purpose issue, require refactoring only when
the selected change directly violates an applicable documented contract.
Read [code principles](../../code-principle.md) and use the
[architecture router](../project-architecture.md) for the affected ownership.
Apply each contract within its stated scope and use its documented exceptions.

Trace the affected flow and callers. Each blocking finding must cite the exact
contract, offending code and smallest correction. Check responsibility and
dependency boundaries, source-backed types and the meaning of fallback fields.
For removed surfaces, ensure remaining names, comments and tests describe the
live contract; retain absence checks when absence is itself a requirement.

Use existing lint/type/harness results for rules they enforce. Report missing
required verification as BLOCKED. Keep required corrections within the selected
change and the cited contract.

Return FAIL for a direct contract violation, BLOCKED when the applicable
contract cannot be established, otherwise PASS.
