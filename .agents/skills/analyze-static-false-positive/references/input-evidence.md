# Input evidence

Use this reference for every invocation. Establish what the supplied input can
prove before interpreting the user's preliminary verdict.

## Accepted input forms

The user supplies one of:

- an ESLint log or tracing diagnostic; or
- an exact custom rule name or rule ID resolvable in the current repository.

The user may also supply the intended policy or explain why a code shape is
valid or invalid.

## ESLint log

Extract only observable facts:

- tool and rule ID;
- configured scope when available;
- file, line, and column;
- diagnostic message and interpolated values;
- relevant source shape; and
- trace steps that show why the rule matched or failed to match.

Inspect the named rule and minimal referenced source read-only when needed
to reconstruct the decision path. Ground source behavior in the inspected code.

## Rule name

Resolve the exact rule before inspecting related code. Keep the rule
implementation file distinct from source files reported by the rule.

Read only the minimum useful definition evidence:

1. rule implementation and metadata;
2. configured scope and options;
3. message IDs and message templates; and
4. focused rule tests.

Then identify current finding files for the exact rule ID:

1. Prefer a supplied or existing current ESLint result when it establishes the
   exact rule ID.
2. Otherwise, inspect repository lint scripts and run the narrowest read-only
   ESLint command that uses the real configuration. Run it without `--fix`.
3. Match the exact rule ID, including its plugin prefix, and record each source
   file with line and column when available.
4. If the rule is disabled or produces no matches, report `No current
   findings`.
5. If lint cannot be run or the configured scope cannot be established, report
   `Not established` and state the smallest missing command, dependency, or
   evidence.

Provide a human-readable rule description derived from the implementation,
configured policy, and messages:

```text
<Rule> detects <observable code shape> because it makes <contract, ownership,
or behavior> harder to read or predict. Prefer <bounded valid code shape>.
```

This description explains the rule's invariant independently of any one
finding.

A rule name can be enough to assess message quality in `diagnose` mode because
that route accepts rule correctness as an input premise. For `FP`, `FN`, and
`unknown`, support the concrete verdict using the evidence requirements below.
Distinguish:

- behavior established by the implementation;
- behavior established by focused fixtures; and
- behavior that still requires a concrete source example or triggered path.

## Evidence sufficiency

| User verdict | Minimum useful evidence |
| --- | --- |
| `FP` | A valid source shape that triggers, plus the rule path or assumption that reports it |
| `FN` | A forbidden source shape that passes, plus the intended policy and missed rule boundary |
| `unknown` | Enough source, policy, and rule-path evidence to compare validity with the rule model |
| `diagnose` | The current message, rule intent, and enough implementation context to explain the root cause and preferred code shape |

If the available evidence is insufficient, state the smallest missing input
and keep further inspection scoped to that input.
