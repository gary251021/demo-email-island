# Warning-message guidance

Read this reference before writing the `Proposed warning message` section.

Treat a custom lint diagnostic as code-writing guidance for human developers and
coding agents. The message should make the preferred code shape understandable
without requiring the reader to inspect the rule implementation.

Keep two outputs distinct:

- the **human-readable rule description** summarizes the invariant across all
  findings; and
- the **proposed warning message** explains one reportable source occurrence
  and its corrective direction.

## Message structure

Write one or two concise sentences that answer:

1. **What was detected?** Name the observable code shape in terms the reader
   can use to change the code.
2. **Why does it matter?** Explain which contract, ownership boundary, or flow
   becomes harder to read, or which behavior becomes harder to predict.
3. **What should change?** Give the narrowest concrete direction that restores
   readability or predictability while permitting equivalent valid designs.

Use this default shape:

```text
<Observed code shape> makes <contract, ownership, or behavior> difficult to
read or predict. <Preferred code shape or bounded next action>.
```

Predictability means contracts, ownership, control flow, and runtime behavior
can be inferred from the code. Ground semantic claims in evidence available
to the selected analysis boundary.

## Required report fields

- **Emission**: whether the lint rule should report the source case.
- **Emission reason**: why the case should or should not produce a diagnostic.
- **Original message gap**: what is absent, vague, or misleading.
- **Message**: the proposed diagnostic text.
- **Guidance**: detected shape, readability or predictability impact, and
  preferred code shape.
- **Rationale**: how the message follows from the verdict and root cause without
  exceeding the detection boundary.

Always include the verdict and root cause in the analysis report, for every
`Emission` value.

## Avoid

- vague messages such as `Refactor this code`;
- metric-only messages that do not explain the consequence;
- rule-internal terminology that does not help the reader change code;
- renames or rewrites that merely silence the rule;
- one-size-fits-all fixes not required by the invariant; and
- definitive wording when the rule cannot prove the violation.
