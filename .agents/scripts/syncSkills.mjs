import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, parse } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

export function skillRoots(
  root,
  home = homedir(),
  codexHome = process.env.CODEX_HOME ?? join(home, ".codex"),
) {
  const global = [
    join(home, ".agents/skills"),
    join(codexHome, "skills"),
    join(codexHome, "skills/.system"),
    "/etc/codex/skills",
  ];
  const parent = [];

  for (let directory = dirname(root); directory !== parse(directory).root; ) {
    const skills = join(directory, ".agents/skills");

    if (!global.includes(skills)) parent.push(skills);

    directory = dirname(directory);
  }

  return {
    global,
    parent,
    local: [join(root, ".agents/skills")],
  };
}

export function disabledSkillPaths(config) {
  return new Set(
    config
      .split("[[skills.config]]")
      .slice(1)
      .flatMap((section) => {
        const block = section.split(/\n(?=\s*\[)/, 1)[0];
        const path = /^\s*path\s*=\s*"([^"\n]+)"\s*$/m.exec(block)?.[1];

        return path && /^\s*enabled\s*=\s*false\s*$/m.test(block)
          ? [path]
          : [];
      }),
  );
}

export async function findSkill(name, roots, disabledGlobals = new Set()) {
  if (!name || name === "." || name === ".." || basename(name) !== name) {
    throw new Error(`Invalid skill name: ${name}`);
  }

  for (const scope of ["global", "parent", "local"]) {
    for (const root of roots[scope]) {
      const skillFile = join(root, name, "SKILL.md");

      try {
        await access(skillFile);

        if (scope === "global" && disabledGlobals.has(skillFile)) {
          continue;
        }

        return { scope, skillFile };
      } catch {}
    }
  }

  return null;
}

export function installArgs(name, entry) {
  const source = entry?.sourceUrl ?? entry?.source;

  if (typeof source !== "string" || source.length === 0) {
    throw new Error(`skills-lock.json has no source for ${name}`);
  }

  return [
    "--yes",
    "skills",
    "add",
    source,
    "--skill",
    name,
    "--agent",
    "codex",
    "--copy",
    "--yes",
  ];
}

async function main() {
  const lock = JSON.parse(
    await readFile(join(repositoryRoot, "skills-lock.json"), "utf8"),
  );

  if (
    !lock.skills ||
    typeof lock.skills !== "object" ||
    Array.isArray(lock.skills)
  ) {
    throw new Error("skills-lock.json has no skills object");
  }

  const roots = skillRoots(repositoryRoot);
  const configPath = join(dirname(roots.global[1]), "config.toml");
  let config = "";

  try {
    config = await readFile(configPath, "utf8");
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }

  const disabledGlobals = disabledSkillPaths(config);
  let installed = 0;
  let skipped = 0;

  for (const [name, entry] of Object.entries(lock.skills)) {
    const found = await findSkill(name, roots, disabledGlobals);

    if (found?.scope === "global") {
      console.log(`skip ${name}: ${found.skillFile}`);
      skipped += 1;
      continue;
    }

    console.log(`sync ${name} -> .agents/skills/${name}`);
    const result = spawnSync("npx", installArgs(name, entry), {
      cwd: repositoryRoot,
      stdio: "inherit",
      shell: false,
    });

    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`Failed to sync ${name} (exit ${result.status})`);
    }

    installed += 1;
  }

  console.log(`skills synced: ${installed}; global skips: ${skipped}`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
