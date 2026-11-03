# Code variant

Guard where the contract allows the state; trust it everywhere else. The rule
and its scope are owned by
[defensive code](../../../../docs/code-principle.md#defensive-code) and
[source-backed types](../../../../docs/code-principle.md#source-backed-types).

## Decide each candidate

1. Find the owning contract for the value or call: its Zod schema, server
   function validator, component props, provider SDK type, or documented API.
2. Keep the guard when that contract allows the state: unvalidated input,
   external I/O (network, storage, provider APIs), or a documented optional
   field. Keep it at that boundary, once.
3. Otherwise remove it and use the value directly:

| Pattern | Replace with |
| --- | --- |
| `?? []`, `\|\| {}`, `?? ""` on a required field | the field itself; fix the type at its source if it is wrong |
| empty `catch`, or `catch` that only logs or returns a default | let the error propagate to the boundary that reports it |
| `try` around code that cannot throw | the code without `try` |
| `as any`, `as unknown as T` | the contract's real type, or validation at the boundary |
| `!== null && !== undefined`, repeated checks of a validated value | one check at the boundary, or none |
| re-validating input a validator already parsed | the parsed value |
| unreachable `default` or `else` branches for closed unions | an exhaustive check, or no branch |
| optional parameters every caller supplies | a required parameter |

## Tests for tooling

Tooling outside `src/` (shell scripts, hooks, harness extensions, lint rules)
needs no test cases; verify it by running it with realistic input. Remove test
files you added there unless the user asked for them, and report the command you
ran instead. Application code under `src/` follows
[test principles](../../../../docs/agents/architecture/test-principles.md).

## Verify

Rerun the type check and the tests that cover the edited code. A removed guard
that a test still depends on means the test encoded the over-defensive behavior;
update the test to assert the contract.
