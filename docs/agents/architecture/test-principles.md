# Test Principles

Read when adding or restructuring tests. Use existing repository tooling and
choose checks that can detect plausible regressions in the affected behavior.

- Assert behavior or decisions made by the code under test. A check that merely
  repeats configured mock output provides little evidence of correctness.
  For example, verify that a caller's status filter changes the query sent to
  the dependency, rather than only asserting the mocked record's name.
- Use behavior-changing mutations as a reasoning aid for finding coverage gaps.
  Ordinary test authoring does not require a mutation run or separate proof for
  every assertion. Full-issue delivery review and explicitly invoked mutation
  review use [targeted mutation execution](../review/mutation.md) in an isolated
  snapshot, reporting actual baseline and mutant results.
- Keep mocks consistent with dependency contracts and include the data needed
  to make the scenario understandable. Avoid unrelated fixture detail.
- Organize tests around understandable behavior. Group related decisions when
  that makes the scenario clearer.
- Preserve coverage of meaningful behaviors and regression risks when simplifying
  tests.
- Write tests for application code under `src/`. Tooling outside it (shell
  scripts, hooks, harness extensions, lint rules) needs no test cases; verify
  it by running it, and add tests only when the user asks.
