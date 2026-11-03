# Unknown route

Use this route when the user supplies `unknown`.

## Objective

The user's `unknown` verdict leaves the classification open. Resolve it using
the evidence ladder below.

## Evidence ladder

Check, in order:

1. the exact reported or detectable source shape;
2. the rule's observable decision path;
3. the stated or configured policy;
4. focused tests that define valid and invalid boundaries; and
5. the cheapest additional evidence needed if ambiguity remains.

Conclude `False positive`, `False negative`, or `Expected finding` when the
evidence supports it. Use `Insufficient evidence` only when the missing policy,
source shape, or semantic fact prevents a reliable conclusion.

## Report behavior

Follow the emission behavior of the evidence-based analysis verdict:

- confirmed false positive: `Do not emit for this case`;
- confirmed false negative or expected finding: `Emit`;
- unresolved ambiguity: `Advisory only` or `Undetermined`.

For unresolved ambiguity, either defer the message until the missing evidence
is available or propose an explicitly advisory uncertainty message.

An AST shape classified as `unknown` means local syntax cannot establish its
shape. Record that evidence limitation separately from the user's verdict.
