# Targeted mutation review

Run real, behavior-changing mutations against the supplied full issue change
and its relevant tests, following [test principles](../architecture/test-principles.md).
Limit this delivery check to selected faults runnable with existing tooling.

## Isolate and establish a baseline

For a pinned commit, create a separate temporary snapshot with `git archive`
and extract it outside the delivery checkout. For an explicitly selected
working-tree review, include staged, unstaged and untracked files in that
snapshot and record its identity. Check that the original version stays
unchanged. Copy any required ignored runtime configuration privately; keep it
out of reports and tracked files. Use the existing managed dependencies, with
test caches and outputs confined to the snapshot; never alter shared modules.

Run the relevant unchanged tests in the snapshot before mutating. If the
baseline or environment cannot run, return BLOCKED with the actual command and
failure. Attribute kills only to changes from a passing baseline.

## Select and execute

Choose a small set of plausible faults in meaningful changed decisions, such
as an inverted condition, wrong boundary, omitted required side effect or wrong
domain-field selection. Explain the behavior each mutation changes and the
test expected to detect it. Keep the tests fixed while executing each mutant.

Apply one mutation at a time, run the relevant tests, capture their outcome,
and restore the snapshot before the next mutation. Finish by rerunning the
baseline. Leave all intentional faults out of the delivery tree.

- **Killed:** a previously passing test fails because of the changed behavior.
- **Survived:** tests pass despite a demonstrated behavior error; return FAIL
  with the concrete missing assertion or scenario for the implementer.
- **Invalid/equivalent:** syntax or compilation failure, or no observable
  behavior difference. Exclude it from detection evidence and select another
  meaningful mutation.
- **Blocked:** timeout or environment failure prevents attribution. Report it
  separately.

If behavior with meaningful regression risk has no relevant tests, return FAIL
and identify the smallest needed coverage. For documentation/configuration-only
changes or no applicable behavior mutation, return SKIP with the scope and
reason.

Return the baseline command/result, each mutation and observed test result,
restoration evidence, and any unexamined scope. PASS requires meaningful valid
mutations to be detected and the restored baseline to pass. Scope PASS evidence
to the selected faults.
