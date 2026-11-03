import { accessSync, constants } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

const REQUIRED_SKILLS = [
  "grill-me",
  "grill-with-docs",
  "to-spec",
  "to-tickets",
  "code-review",
  "grilling",
  "domain-modeling",
];

const OPTIONAL_SKILLS = ["implement", "tdd"];
const projectRoot = resolve(process.argv[2] ?? process.cwd());
const userRoot = homedir();
const skillRoots = [
  ["project", resolve(projectRoot, ".agents/skills")],
  ["project", resolve(projectRoot, ".codex/skills")],
  ["project", resolve(projectRoot, ".claude/skills")],
  ["global", resolve(userRoot, ".agents/skills")],
  ["global", resolve(userRoot, ".codex/skills")],
  ["global", resolve(userRoot, ".claude/skills")],
];

function findSkill(name) {
  for (const [scope, root] of skillRoots) {
    const skillFile = resolve(root, name, "SKILL.md");

    try {
      accessSync(skillFile, constants.R_OK);
      return { name, scope, skillFile };
    } catch {
      // Continue to the next supported skill root.
    }
  }

  return { name };
}

function printResults(title, results) {
  console.log(`${title}:`);
  for (const result of results) {
    console.log(
      result.skillFile
        ? `  ready   ${result.name} (${result.scope})`
        : `  missing ${result.name}`,
    );
  }
}

const requiredResults = REQUIRED_SKILLS.map(findSkill);
const optionalResults = OPTIONAL_SKILLS.map(findSkill);
const missingRequired = requiredResults.filter(({ skillFile }) => !skillFile);

printResults("Required", requiredResults);
printResults("Optional", optionalResults);

if (missingRequired.length > 0) {
  console.log("\nInstall missing Matt Pocock skills with:");
  console.log("  npx skills@latest add mattpocock/skills");
  process.exitCode = 1;
} else {
  console.log("\nGeneral workflow skill prerequisites: ready");
}
