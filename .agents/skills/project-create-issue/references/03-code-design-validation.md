# Code design validation

Validate design claims through read-only source inspection and authoritative
documentation under the skill's [documentation-only boundary](../SKILL.md#documentation-only-boundary).

## Establish evidence

- Record the source ref and SHA, responsible modules, existing callers and
  contracts relevant to the choice.
- Check installed dependency versions and official documentation or source for
  the required capabilities, supported configuration and compatibility.
- Distinguish verified existing behavior, documented library support, engineering
  inference and runtime behavior that has not been tested in this project.

When evidence cannot settle an integration question, record the uncertainty and
the smallest delivery-time check with its expected observable result. Missing
runtime proof does not authorize an experiment during issue creation. If the
uncertainty prevents choosing an architecture, keep that decision open and
present the concrete alternatives to the user.

## Retain the design evidence

Keep source references and unresolved questions in the checkpoint. In the issue,
include only excerpts that explain interfaces, ownership and dependency
direction. Identify existing excerpts by path and symbol; mark proposed snippets
as design rather than executed code.

Return to design when inspected evidence changes an accepted library, ownership
or contract choice. Record implementation and runtime checks as future delivery
work, and require revalidation when a relevant source baseline changes.
