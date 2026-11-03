import {
  appendFileSync,
  existsSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { relative, resolve } from "node:path";

const PATCH_PATH_PATTERN =
  /^\*\*\* (?:(?:Add|Update|Delete) File|Move to): (.+)$/;
const LINTABLE_FILE_PATTERN = /\.(?:[cm]?ts|tsx)$/;

export function extractEditedFilePaths(toolInput) {
  const inputs =
    typeof toolInput === "string"
      ? [toolInput]
      : [toolInput?.command, toolInput?.input, toolInput?.patch];
  const directPaths = [
    toolInput?.file_path,
    toolInput?.filePath,
    toolInput?.path,
  ];

  return [
    ...directPaths.filter((filePath) => typeof filePath === "string"),
    ...inputs
      .filter((input) => typeof input === "string")
      .flatMap((input) =>
        input
          .split("\n")
          .map((line) => PATCH_PATH_PATTERN.exec(line)?.[1]?.trim())
          .filter(Boolean),
      ),
  ];
}

function getTurnFilesPath(event, repositoryRoot) {
  if (!event.session_id || !event.turn_id) {
    return undefined;
  }

  const key = createHash("sha256")
    .update(JSON.stringify([repositoryRoot, event.session_id, event.turn_id]))
    .digest("hex");
  return resolve(tmpdir(), `codex-lint-files-${key}`);
}

export function getLintHookResponse({
  errorMessage,
  isStopHook,
  status,
  stderr = "",
  stdout = "",
  stopHookActive = false,
}) {
  const lintOutput =
    errorMessage || stdout || stderr || "ESLint failed without output.";

  if (errorMessage || status !== 0) {
    return {
      decision: "block",
      reason:
        "Fix every reported ESLint error in the changed file(s), rerun ESLint on those files, and continue only after it passes.",
      hookSpecificOutput: {
        hookEventName: isStopHook ? "Stop" : "PostToolUse",
        additionalContext: `ESLint failed for the changed file(s):\n\n${lintOutput}`,
      },
    };
  }

  if (!isStopHook || stopHookActive || !stdout.trim()) {
    return undefined;
  }

  return {
    decision: "block",
    reason:
      "Review the reported ESLint warnings before finishing. Follow each rule's guidance.",
    hookSpecificOutput: {
      hookEventName: "Stop",
      additionalContext: `ESLint warnings for the changed file(s):\n\n${stdout}`,
    },
  };
}

function run() {
  const event = JSON.parse(readFileSync(0, "utf8"));
  const cwd = typeof event?.cwd === "string" ? event.cwd : process.cwd();
  const repositoryRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd,
    encoding: "utf8",
  }).trim();
  const isStopHook = process.argv.includes("--stop");
  const turnFilesPath = getTurnFilesPath(event, repositoryRoot);
  const filePaths = isStopHook
    ? turnFilesPath && existsSync(turnFilesPath)
      ? readFileSync(turnFilesPath, "utf8").trim().split("\n").map(JSON.parse)
      : []
    : extractEditedFilePaths(event?.tool_input);
  const changedFiles = [
    ...new Set(
      filePaths
        .filter((filePath) => LINTABLE_FILE_PATTERN.test(filePath))
        .map((filePath) => resolve(cwd, filePath))
        .filter((filePath) => {
          const relativePath = relative(repositoryRoot, filePath);
          return (
            relativePath &&
            !relativePath.startsWith("..") &&
            existsSync(filePath) &&
            statSync(filePath).isFile()
          );
        }),
    ),
  ];

  if (!isStopHook && turnFilesPath && changedFiles.length > 0) {
    appendFileSync(
      turnFilesPath,
      changedFiles.map((filePath) => JSON.stringify(filePath)).join("\n") +
        "\n",
      { mode: 0o600 },
    );
  }

  if (changedFiles.length === 0) {
    if (isStopHook && turnFilesPath) rmSync(turnFilesPath, { force: true });
    return;
  }

  const eslintCommand = resolve(
    repositoryRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "eslint.cmd" : "eslint",
  );
  const result = spawnSync(
    eslintCommand,
    ["--no-warn-ignored", ...changedFiles],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
    },
  );

  const response = getLintHookResponse({
    errorMessage: result.error?.message,
    isStopHook,
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
    stopHookActive: event?.stop_hook_active === true,
  });

  if (isStopHook && !response && turnFilesPath) {
    rmSync(turnFilesPath, { force: true });
  }

  if (response) {
    process.stdout.write(`${JSON.stringify(response)}\n`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
