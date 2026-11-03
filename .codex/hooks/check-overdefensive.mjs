// Deterministic triggers for the overdefensive-review skill
// (.agents/skills/overdefensive-review/SKILL.md).
//
//   PostToolUse (edits): --mark      records edited paths for the Stop check
//   PostToolUse (edits): --document  markdown just written -> document variant
//   Stop:                (no flag)   this turn's code changes -> code variant
//
// Every mode reads the hook event JSON (session_id, turn_id, tool_input,
// stop_hook_active) on stdin and stays silent when it finds nothing, so Codex
// and the Pi adapter share it. --document returns additionalContext once per
// file per turn; Stop returns {decision:"block"} once per turn.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { extractEditedFilePaths } from "./lint-changed-file.mjs";

const APPLICATION_PATH = /^src\//;
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?)$/;
const TEST_FILE =
  /(?:\.(?:test|spec)\.[^/]+$|\.bats$|(?:^|\/)test_[^/]+\.py$|_test\.(?:py|go)$)/;
const MAX_FINDINGS = 20;
const SKILL = ".agents/skills/overdefensive-review/SKILL.md";
const MARKDOWN_FILE = /\.mdx?$/i;
// Third-party skills and the harness import record are outside review scope.
const OUT_OF_SCOPE = /^(?:node_modules|docs\/harness)\/|^HARNESS-IMPORT\.md$/;
const SHOUTING = /\b(?:IMPORTANT|CRITICAL|WARNING|NEVER|ALWAYS|MUST(?: NOT)?|DO NOT|DON'T)\b|\*\*(?:never|always|do not|don't|must not|important)\b/;
const NEGATIVE =
  /\b(?:never|do not|don't|must not|should not|shouldn't|cannot|avoid|under no circumstances|not allowed|forbidden|prohibited)\b/i;
const NEGATIVE_LINE_THRESHOLD = 3;

// Each pattern matches added application source text. They are candidates for
// review, not verdicts: the agent keeps a guard the owning contract requires.
const PATTERNS = [
  {
    label: "empty catch swallows the error",
    regex: /catch\s*(?:\([^)]*\))?\s*\{\s*(?:\/\/[^\n]*\s*|\/\*[\s\S]*?\*\/\s*)*\}/g,
  },
  {
    label: "catch only logs, so the failure is swallowed",
    regex: /catch\s*\([^)]*\)\s*\{\s*console\.\w+\([^;{}]*\);?\s*\}/g,
  },
  {
    label: "catch returns a silent fallback",
    regex:
      /catch\s*(?:\([^)]*\))?\s*\{\s*return\s+(?:null|undefined|false|\[\]|\{\}|""|'')?\s*;?\s*\}/g,
  },
  {
    label: "fallback literal for a possibly required value",
    regex: /(?:\?\?|\|\|)\s*(?:\[\]|\{\}|""|''|0\b|false\b)/g,
  },
  {
    label: "type escape hides the contract",
    regex: /\bas\s+(?:any\b|unknown\s+as\b)/g,
  },
  {
    label: "redundant null and undefined double check",
    regex: /!==?\s*null\s*&&\s*\S+\s*!==?\s*undefined|!==?\s*undefined\s*&&\s*\S+\s*!==?\s*null/g,
  },
];

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

function turnFilesPath(event, root) {
  const key = createHash("sha256")
    .update(JSON.stringify([root, event.session_id, event.turn_id]))
    .digest("hex");
  return resolve(tmpdir(), `codex-overdefensive-files-${key}`);
}

function markEditedFiles(event, root) {
  const paths = extractEditedFilePaths(event.tool_input)
    .map((filePath) => relative(root, resolve(root, filePath)))
    .filter((filePath) => !filePath.startsWith(".."));
  if (paths.length > 0) appendFileSync(turnFilesPath(event, root), `${paths.join("\n")}\n`);
}

function consumeEditedFiles(event, root) {
  const path = turnFilesPath(event, root);
  if (!existsSync(path)) return [];
  const files = [...new Set(readFileSync(path, "utf8").split("\n").filter(Boolean))];
  rmSync(path, { force: true });
  return files.filter((file) => existsSync(resolve(root, file)));
}

function isTracked(file, root) {
  try {
    git(["ls-files", "--error-unmatch", "--", file], root);
    return true;
  } catch {
    return false;
  }
}

function hasHead(root) {
  try {
    git(["rev-parse", "--verify", "HEAD"], root);
    return true;
  } catch {
    return false;
  }
}

// Returns added text with its starting line numbers: [{ line, text }].
function addedHunks(file, root, headExists) {
  if (!isTracked(file, root)) {
    return [{ line: 1, text: readFileSync(resolve(root, file), "utf8") }];
  }
  const diff = git(["diff", "-U0", ...(headExists ? ["HEAD"] : []), "--", file], root);
  const hunks = [];
  let current;
  for (const row of diff.split("\n")) {
    const header = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(row);
    if (header) {
      current = { line: Number(header[1]), text: "" };
      hunks.push(current);
    } else if (current && row.startsWith("+") && !row.startsWith("+++")) {
      current.text += `${row.slice(1)}\n`;
    }
  }
  return hunks;
}

function scanApplicationFile(file, root, headExists) {
  const findings = [];
  for (const hunk of addedHunks(file, root, headExists)) {
    for (const { label, regex } of PATTERNS) {
      for (const match of hunk.text.matchAll(regex)) {
        const line = hunk.line + hunk.text.slice(0, match.index).split("\n").length - 1;
        const snippet = match[0].replaceAll(/\s+/g, " ").slice(0, 80);
        findings.push({ line, text: `- ${file}:${line} ${label}: \`${snippet}\`` });
      }
    }
  }
  return findings.sort((a, b) => a.line - b.line).map(({ text }) => text);
}

function thirdPartySkills(root) {
  try {
    const lock = JSON.parse(readFileSync(resolve(root, "skills-lock.json"), "utf8"));
    return new Set([...Object.keys(lock.skills ?? {}), "impeccable"]);
  } catch {
    return new Set(["impeccable"]);
  }
}

function isReviewableDocument(file, root) {
  if (!MARKDOWN_FILE.test(file) || OUT_OF_SCOPE.test(file)) return false;
  const skill = /^\.(?:agents|pi|codex|claude)\/skills\/([^/]+)\//.exec(file)?.[1];
  return !skill || !thirdPartySkills(root).has(skill);
}

export function scanDocument(file, root) {
  const shouting = [];
  const negative = [];
  for (const hunk of addedHunks(file, root, hasHead(root))) {
    let inCode = false;
    hunk.text.split("\n").forEach((text, index) => {
      if (/^\s*(?:```|~~~)/.test(text)) inCode = !inCode;
      if (inCode || !text.trim()) return;
      const entry = `- ${file}:${hunk.line + index} \`${text.trim().slice(0, 100)}\``;
      // Inline code quotes commands and examples; only prose is wording.
      const prose = text.replaceAll(/`[^`]*`/g, "");
      if (SHOUTING.test(prose)) shouting.push(entry);
      else if (NEGATIVE.test(prose)) negative.push(entry);
    });
  }
  const flagged = negative.length >= NEGATIVE_LINE_THRESHOLD ? [...shouting, ...negative] : shouting;
  return flagged.slice(0, MAX_FINDINGS);
}

export function buildDocumentResponse(findings) {
  if (findings.length === 0) return null;
  return {
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: `Possible over-defensive wording in the markdown just written:\n${findings.join("\n")}\nRead ${SKILL} and apply its document variant to these lines before continuing.`,
    },
  };
}

function documentMarkerPath(event, root, file) {
  const key = createHash("sha256")
    .update(JSON.stringify([root, event.session_id, event.turn_id, file]))
    .digest("hex");
  return resolve(tmpdir(), `codex-overdefensive-doc-${key}`);
}

function reviewWrittenDocuments(event, root) {
  const files = [...new Set(extractEditedFilePaths(event.tool_input)
    .map((filePath) => relative(root, resolve(root, filePath))))]
    .filter((file) => !file.startsWith("..") && existsSync(resolve(root, file)) && isReviewableDocument(file, root))
    // Once per file per turn, so a revision that keeps a justified boundary does not loop.
    .filter((file) => !existsSync(documentMarkerPath(event, root, file)));
  const findings = files.flatMap((file) => {
    const fileFindings = scanDocument(file, root);
    if (fileFindings.length > 0) writeFileSync(documentMarkerPath(event, root, file), "");
    return fileFindings;
  });
  return buildDocumentResponse(findings.slice(0, MAX_FINDINGS));
}

export function collectFindings(files, root) {
  const headExists = hasHead(root);
  const defensive = files
    .filter((file) => APPLICATION_PATH.test(file) && SOURCE_FILE.test(file) && !TEST_FILE.test(file))
    .flatMap((file) => scanApplicationFile(file, root, headExists));
  const toolingTests = files
    .filter((file) => TEST_FILE.test(file) && !APPLICATION_PATH.test(file))
    .map((file) => `- ${file}`);
  return { defensive: defensive.slice(0, MAX_FINDINGS), toolingTests };
}

export function buildStopResponse({ defensive, toolingTests }) {
  if (defensive.length === 0 && toolingTests.length === 0) return null;
  const sections = [`Before finishing, read ${SKILL} and apply its code variant to this turn's changes.`];
  if (defensive.length > 0) {
    sections.push(`Possible over-defensive application code:\n${defensive.join("\n")}`);
  }
  if (toolingTests.length > 0) {
    sections.push(`Tests added or edited for tooling outside src/:\n${toolingTests.join("\n")}`);
  }
  sections.push("Then return your complete final answer, ending with the skill's report line.");
  return { decision: "block", reason: sections.join("\n\n") };
}

function run() {
  const event = JSON.parse(readFileSync(0, "utf8"));
  const root = git(["rev-parse", "--show-toplevel"], process.cwd()).trim();

  if (process.argv[2] === "--mark") {
    markEditedFiles(event, root);
    return;
  }
  if (process.argv[2] === "--document") {
    const response = reviewWrittenDocuments(event, root);
    if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
    return;
  }

  const files = consumeEditedFiles(event, root);
  if (event.stop_hook_active === true) return;
  const response = buildStopResponse(collectFindings(files, root));
  if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
