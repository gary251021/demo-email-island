# Matt Pocock skill dependencies

This workflow targets `mattpocock/skills` release `v1.2.3`.

From the project root, run the bundled checker:

```bash
node .agents/skills/general-workflow/scripts/checkSkillDependencies.mjs
```

When the skill is loaded from another root, use its reported base directory in
place of `.agents/skills/general-workflow`. The script is the source of truth for
the required names and checks readable `SKILL.md` files in supported
project-local and user-global roots. Exit code `0` means ready; exit code `1`
means one or more required skills are missing.

The canonical upstream name is `grill-with-docs`.

`implement` and `tdd` remain optional capabilities. Project adapters decide
whether and how to use optional skills.

When any are missing, relay the script's install command.

When the installed package is older than `v1.2.3`, advise:

```bash
npx skills update
```

When the installed source version is not recorded, report it as unclear.

Install or update skills only with explicit user approval.
