# Component-module rules

Read this reference only for React, TSX, component-module, component-factory, or
HOC rules.

Classify exports by their observable return shapes:

```text
component
  exported function itself returns JSX, React.createElement, memo, or forwardRef

component factory
  exported function returns a nested function that renders JSX

HOC
  component factory whose returned component renders an outer component parameter

unknown
  local syntax cannot prove a React-related return shape
```

For an unknown AST shape, report the missing classification evidence. Apply
only directly observable invariants, such as a runtime-export count, when they
match the stated policy.

The AST classification `unknown` is separate from the user's `unknown` verdict.

## Example

Input:

```text
src/components/hoc/createTable.tsx:16:1
Runtime export 'createServerQueryTable' does not look like a React component.
```

If `createServerQueryTable` returns a nested function that returns JSX, classify
it as a component factory and report a false positive. The rule incorrectly
assumed every TSX runtime export is a component.

No warning should be emitted for the valid factory. A corrected warning for a
genuinely invalid export should name the unsupported runtime-export shape,
explain why mixing module roles makes ownership harder to read and predict, and
direct the agent to a recognized React export or a separate non-component
module. Base naming guidance on the established export classification.
