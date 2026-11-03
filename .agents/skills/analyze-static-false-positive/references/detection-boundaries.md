# Detection boundaries

Use the cheapest reliable boundary that can express the intended invariant.

In `diagnose` mode, use this reference only to explain what evidence the correct
rule observes and why the warning may safely claim the violation. Keep the
boundary, detection logic, configured scope, and severity fixed.

| Boundary | Use when | Do not use when |
| --- | --- | --- |
| Local syntax or AST | The distinction is visible in one parsed file | Correctness depends on resolved types or other modules |
| TypeScript type information | The invariant depends on resolved signatures, return types, symbols, or aliases | Syntax already proves the distinction |
| Module or import graph | Ownership, dependency direction, or cross-file exports define validity | A local node is sufficient |
| Repository convention or configured scope | The invariant is path-, package-, or configuration-specific | The rule claims a universal language invariant |
| Non-static or advisory | Semantic intent cannot be proven reliably | A stable static signal exists |

## Selection method

1. State what the current rule can observe.
2. State what fact is required to separate valid and invalid code.
3. Select the first boundary that supplies that fact reliably.
4. Explain the false-positive and false-negative cost of choosing a cheaper or
   broader boundary.

## Correction priority

Prefer, in order:

1. refine the rule using evidence at the correct boundary;
2. add a narrow, stable rule option or configured exception;
3. narrow the rule's path scope;
4. downgrade an inherently ambiguous check to an advisory warning; or
5. remove the check when no useful invariant remains.

For regression coverage, include one valid case, one invalid case with the
expected message or stable semantic fragments, and one close boundary case.
