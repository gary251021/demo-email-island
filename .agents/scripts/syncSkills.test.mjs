import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  disabledSkillPaths,
  findSkill,
  installArgs,
  skillRoots,
} from "./syncSkills.mjs";

test("resolves global, parent, then local skills", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "sync-skills-"));
  const home = join(temporaryRoot, "home");
  const repository = join(home, "work/repository");
  const roots = skillRoots(repository, home, join(home, ".codex"));

  try {
    await Promise.all([
      mkdir(join(home, ".agents/skills/global-skill"), { recursive: true }),
      mkdir(join(home, "work/.agents/skills/parent-skill"), {
        recursive: true,
      }),
      mkdir(join(repository, ".agents/skills/local-skill"), {
        recursive: true,
      }),
      mkdir(join(home, "work/.agents/skills/shared-skill"), {
        recursive: true,
      }),
      mkdir(join(repository, ".agents/skills/shared-skill"), {
        recursive: true,
      }),
      mkdir(join(repository, ".agents/skills/global-skill"), {
        recursive: true,
      }),
    ]);
    await Promise.all(
      [
        join(home, ".agents/skills/global-skill/SKILL.md"),
        join(home, "work/.agents/skills/parent-skill/SKILL.md"),
        join(repository, ".agents/skills/local-skill/SKILL.md"),
        join(home, "work/.agents/skills/shared-skill/SKILL.md"),
        join(repository, ".agents/skills/shared-skill/SKILL.md"),
        join(repository, ".agents/skills/global-skill/SKILL.md"),
      ].map((path) => writeFile(path, "---\nname: test\n---\n")),
    );

    assert.equal((await findSkill("global-skill", roots))?.scope, "global");
    assert.equal(
      (
        await findSkill(
          "global-skill",
          roots,
          new Set([join(home, ".agents/skills/global-skill/SKILL.md")]),
        )
      )?.scope,
      "local",
    );
    assert.equal((await findSkill("parent-skill", roots))?.scope, "parent");
    assert.equal((await findSkill("local-skill", roots))?.scope, "local");
    assert.equal((await findSkill("shared-skill", roots))?.scope, "parent");
    assert.equal(await findSkill("missing-skill", roots), null);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("reads disabled global skill paths", () => {
  assert.deepEqual(
    disabledSkillPaths(`
[[skills.config]]
path = "/global/enabled/SKILL.md"
enabled = true

[[skills.config]]
path = "/global/disabled/SKILL.md"
enabled = false
`),
    new Set(["/global/disabled/SKILL.md"]),
  );
});

test("builds a non-shell local Codex install command", () => {
  assert.deepEqual(installArgs("my-skill", { source: "owner/repository" }), [
    "--yes",
    "skills",
    "add",
    "owner/repository",
    "--skill",
    "my-skill",
    "--agent",
    "codex",
    "--copy",
    "--yes",
  ]);
});
