# Document variant

Agent prompts and docs work best as direct statements of the intended behavior.
Stacked prohibitions, shouting and repeated caveats make the reader search for
what to do and dilute the boundaries that matter.

## Decide each candidate

1. State the desired behavior. Turn "don't do X" into "do Y" whenever a positive
   form exists: "Never use `--fix`" becomes "Run it without `--fix`".
2. Keep a prohibition only for a genuine hard boundary with no clean positive
   form: destructive or irreversible actions, secrets, publishing externally,
   approval gates. State it once, plainly, with its reason when the reason is
   short.
3. Remove shouting: ALL-CAPS words, `IMPORTANT:`/`CRITICAL:` prefixes, and bold
   used for alarm. Emphasis belongs to the one boundary that needs it, if any.
4. Merge repeated warnings about the same thing into one statement in the
   section that owns it; link to it from elsewhere.
5. Drop hedges and caveats that restate a rule or guard against a case the
   surrounding text already excludes.

## Preserve

- Meaning and every real requirement and workflow gate.
- Headings (other files link to their anchors), links, code blocks, commands,
  file paths, and frontmatter. A skill `description` controls triggering, so
  change its wording only when the meaning stays the same.
- Length: the result is the same length or shorter. Add no new rules.

## Verify

Reread each edited passage as its intended reader: the agent or person can tell
what to do without inferring it from what not to do.
