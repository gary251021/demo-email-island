import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT_AGENTS_MD_LIMITS = {
  logicalLines: 150,
  unicodeCodePoints: 12_000,
  utf8Bytes: 16_384,
};

const agentsMdPath = fileURLToPath(new URL("../../AGENTS.md", import.meta.url));
const patchPathPattern =
  /^\*\*\* (?:(?:Add|Update|Delete) File|Move to): (.+)$/;

export function changesRootAgentsMd(event) {
  const command = event?.tool_input?.command;
  const cwd = event?.cwd;

  return (
    typeof command === "string" &&
    typeof cwd === "string" &&
    command.split("\n").some((line) => {
      const patchPath = patchPathPattern.exec(line)?.[1];
      return (
        patchPath !== undefined && resolve(cwd, patchPath) === agentsMdPath
      );
    })
  );
}

export function measureAgentsMd(contents) {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(contents);

  if (text.includes("\r")) {
    throw new Error("AGENTS.md must use LF line endings");
  }

  const newlineCount = text.match(/\n/g)?.length ?? 0;
  let logicalLines = newlineCount;

  if (text.length > 0 && !text.endsWith("\n")) {
    logicalLines += 1;
  }

  return {
    logicalLines,
    unicodeCodePoints: Array.from(text).length,
    utf8Bytes: contents.byteLength,
  };
}

export function exceedsAgentsMdBudget(actual, limits = ROOT_AGENTS_MD_LIMITS) {
  return (
    actual.logicalLines > limits.logicalLines ||
    actual.unicodeCodePoints > limits.unicodeCodePoints ||
    actual.utf8Bytes > limits.utf8Bytes
  );
}

export function formatAgentsMdBudgetFailure(
  actual,
  limits = ROOT_AGENTS_MD_LIMITS,
) {
  const metric = (label, value, limit) => {
    const overage = value > limit ? ` (over by ${value - limit})` : "";
    return `  ${label}: ${value} / ${limit}${overage}`;
  };

  return `ERROR: AGENTS.md violates the root instruction budget:
${metric("logical lines", actual.logicalLines, limits.logicalLines)}
${metric("Unicode code points", actual.unicodeCodePoints, limits.unicodeCodePoints)}
${metric("UTF-8 bytes", actual.utf8Bytes, limits.utf8Bytes)}

Keep only repository-wide startup guidance in the root file. Move scope-specific
rules to the nearest owning AGENTS.md when sessions start in that subtree, or move
detailed/task-specific guidance to docs/agents/ and leave a short "read when ..."
pointer in the root AGENTS.md. Do not duplicate the moved content.`;
}

function main() {
  try {
    if (
      process.argv.includes("--hook") &&
      !changesRootAgentsMd(JSON.parse(readFileSync(0, "utf8")))
    ) {
      return;
    }

    const actual = measureAgentsMd(readFileSync(agentsMdPath));

    if (exceedsAgentsMdBudget(actual)) {
      console.error(formatAgentsMdBudgetFailure(actual));
      process.exitCode = 2;
      return;
    }

    console.log(
      `AGENTS.md size is within budget: ${actual.logicalLines} lines, ` +
        `${actual.unicodeCodePoints} code points, ${actual.utf8Bytes} bytes.`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`AGENTS.md size check failed: ${message}`);
    process.exitCode = 2;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
