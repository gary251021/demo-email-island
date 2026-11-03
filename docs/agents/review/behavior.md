# Behavior conformance review

Review the full issue change against its existing behavior descriptions in
`For Agent` and accepted comments, or the explicit specification supplied for
standalone review. Natural-language requirements are sufficient; Gherkin syntax
is optional. If no behavior description exists, return `SKIP: no behavior
description` without inventing acceptance criteria.

For each described behavior, identify its precondition, action and observable
outcome, then trace the implementation and relevant tests through the affected
callers. Report missing, partial, contradictory or unrequested behavior with
the exact requirement and code location. Include boundary cases, errors and
side effects when they follow from that description.

Return FAIL for a demonstrated mismatch, BLOCKED for inaccessible or ambiguous
requirements needed to judge the change, otherwise PASS with the requirement
coverage and evidence. Establish implementation mismatches by tracing the
required behavior. Mutation mode evaluates test sensitivity; the selected
refactor mode evaluates structural quality.
