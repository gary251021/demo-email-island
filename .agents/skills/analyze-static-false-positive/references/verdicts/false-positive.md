# False-positive route

Use this route when the user supplies `FP`.

## Objective

Determine whether valid code was reported because the rule's model is
incomplete, over-broad, or applied outside its intended scope.

Treat `FP` as a hypothesis. Confirm:

1. the source shape is valid under the supplied or repository policy;
2. the rule actually reports that shape;
3. the condition or assumption that causes the match; and
4. the cheapest boundary that can distinguish the valid shape from the
   genuinely invalid one.

If the evidence does not establish validity or the triggered path, return
`Insufficient evidence` and name the minimum missing example or trace.

## Report behavior

- Analysis verdict: `False positive` when confirmed.
- Emission: `Do not emit for this case`.
- Emission reason: name the valid code shape, the faulty assumption, and the
  valid behavior continued emission would reject.
- Original message gap: explain how the message describes the rule's mistaken
  model as though it were a real violation.
- Proposed message: write the warning the corrected rule should emit for the
  genuinely invalid shape.

`Do not emit` applies to the lint diagnostic on the reported valid source.
Explain the FP root cause in the analysis report.

## Correction and fixtures

Prefer refining the rule at the first reliable boundary. Add:

- a valid fixture that must produce no warning;
- an invalid fixture that must still warn with the corrected message; and
- a close boundary fixture that prevents the distinction from becoming
  over-broad.
