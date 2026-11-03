import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { extractEditedFilePaths } from "./lint-changed-file.mjs";

const REVIEW_REQUEST =
  'For project-deliver-issue work (coordinator, ticket or correction), leave reviewer dispatch to the main coordinator\'s full-issue review phase and finish the current handoff without extra review or fixes. A reviewer or isolated verification run likewise finishes only its assigned responsibility. Otherwise, before stopping, spawn exactly one isolated project custom agent using `spawn_agent` with `agent_type: "reviewer"` and `fork_turns: "none"`; do not merely give a default agent that task label. Supply the absolute checkout, the selected working-tree change scope including staged/unstaged/untracked files, accepted requirements, applicable contracts and verification evidence. Ask it to read docs/agents/review/ordinary-issue.md, or docs/agents/review/pure-refactor.md only for an explicitly accepted pure-refactor task. Wait for its result; it edits nothing itself. Treat each blocking finding under the selected policy as a high-priority recommendation and follow valid findings by default. Decline one only when a specific instruction or functional requirement explicitly conflicts, or evidence shows it is invalid or out of scope. Apply accepted fixes within the authorized task and run relevant verification; report BLOCKED evidence to the human. Return the complete original or updated user-facing result first, then end with exactly `Review: changed — <short reason>` when review caused a production-code edit, or `Review: unchanged — <short reason>` otherwise, including when review belongs to the issue coordinator or caller.';
const CODE_FILE_PATTERN =
  /\.(?:[cm]?[jt]sx?|py|go|rs|java|kt|kts|rb|php|cs|swift|sh|bash|zsh|sql)$/;
const TEST_FILE_PATTERN = /\.(?:test|spec)(?:\.[^/]+)?$/;
const DOCUMENTATION_PATH_PATTERN =
  /(?:^|\/)(?:docs?|documentation)(?:\/|$)|\.(?:md|mdx|rst|txt)$/i;

function getMarkerPath(event) {
  const markerId = `${event.session_id}-${event.turn_id}`.replaceAll(
    /[^a-zA-Z0-9_-]/g,
    "_",
  );

  return join(tmpdir(), `codex-ponytail-review-${markerId}`);
}

export function getReviewRequest(event, fileChangeCount) {
  if (event?.stop_hook_active === true || fileChangeCount === 0) {
    return null;
  }

  return {
    decision: "block",
    reason: REVIEW_REQUEST,
  };
}

export function hasReviewableCodeFileChange(toolInput) {
  const repositoryRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  }).trim();

  return extractEditedFilePaths(toolInput).some((filePath) => {
    if (
      !CODE_FILE_PATTERN.test(filePath) ||
      TEST_FILE_PATTERN.test(filePath) ||
      DOCUMENTATION_PATH_PATTERN.test(filePath)
    ) {
      return false;
    }

    try {
      execFileSync("git", ["ls-files", "--error-unmatch", "--", filePath], {
        cwd: repositoryRoot,
        stdio: "ignore",
      });
      return true;
    } catch {
      return false;
    }
  });
}

function markFileChange(event) {
  if (!hasReviewableCodeFileChange(event?.tool_input)) {
    return;
  }

  writeFileSync(getMarkerPath(event), "");
}

function consumeFileChangeCount(event) {
  const markerPath = getMarkerPath(event);
  const fileChangeCount = existsSync(markerPath) ? 1 : 0;

  rmSync(markerPath, { force: true });
  return fileChangeCount;
}

function run() {
  const event = JSON.parse(readFileSync(0, "utf8"));

  if (process.argv[2] === "--mark") {
    markFileChange(event);
    return;
  }

  const fileChangeCount = consumeFileChangeCount(event);
  const originalResponsePath = `${getMarkerPath(event)}-original-response`;
  const reviewChangedPath = `${getMarkerPath(event)}-review-changed`;
  const correctionRequestedPath = `${getMarkerPath(event)}-correction-requested`;

  if (
    event.stop_hook_active !== true &&
    fileChangeCount > 0 &&
    typeof event.last_assistant_message === "string"
  ) {
    writeFileSync(originalResponsePath, event.last_assistant_message, {
      mode: 0o600,
    });
  }

  if (event.stop_hook_active === true && fileChangeCount > 0) {
    writeFileSync(reviewChangedPath, "");
  }

  const originalResponse = existsSync(originalResponsePath)
    ? readFileSync(originalResponsePath, "utf8")
    : undefined;
  const reviewChanged = existsSync(reviewChangedPath);
  const correctionRequested = existsSync(correctionRequestedPath);
  const outcomePrefix = `\n\nReview: ${reviewChanged ? "changed" : "unchanged"} — `;
  const outcomeIndex =
    event.last_assistant_message?.lastIndexOf(outcomePrefix) ?? -1;
  const mustReportOutcome =
    event.stop_hook_active === true &&
    originalResponse !== undefined &&
    (outcomeIndex < 0 ||
      !event.last_assistant_message
        .slice(outcomeIndex + outcomePrefix.length)
        .trim() ||
      (!reviewChanged &&
        !event.last_assistant_message.startsWith(originalResponse)));
  const result =
    mustReportOutcome && !correctionRequested
      ? {
          decision: "block",
          reason: reviewChanged
            ? "Return the complete updated user-facing result, then append `Review: changed — <short reason>`. Do not return only the review status."
            : `Read ${JSON.stringify(originalResponsePath)}, return its exact contents first, then append \`Review: unchanged — <short reason>\`. Do not return only the review status.`,
        }
      : getReviewRequest(event, fileChangeCount);

  if (mustReportOutcome && !correctionRequested) {
    writeFileSync(correctionRequestedPath, "");
  }

  if (!result) {
    rmSync(originalResponsePath, { force: true });
    rmSync(reviewChangedPath, { force: true });
    rmSync(correctionRequestedPath, { force: true });
  }

  if (result) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
