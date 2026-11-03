# False-negative route

Use this route when the user supplies `FN`.

## Objective

Determine whether invalid code passes because the rule misses a forbidden
source shape, execution path, configured scope, or required analysis boundary.

Treat `FN` as a hypothesis. Confirm:

1. the supplied policy forbids the source shape;
2. the current rule does not report it;
3. the exact condition, traversal path, or boundary the rule misses; and
4. the narrowest detection change that catches it without rejecting nearby
   valid code.

If the forbidden shape or intended policy is not established, return
`Insufficient evidence` and state what is missing.

## Report behavior

- Analysis verdict: `False negative` when confirmed.
- Emission: `Emit`.
- Emission reason: explain the violated invariant and why the current rule
  fails to recognize it.
- Original message gap: state whether an existing message can describe the
  newly detected shape accurately.
- Proposed message: name the missed observable shape, its readability or
  predictability cost, and the preferred code shape.

## Correction and fixtures

Add:

- a valid fixture that remains accepted;
- the missed invalid fixture with the expected warning; and
- a close boundary fixture that protects against expanding the rule too far.
