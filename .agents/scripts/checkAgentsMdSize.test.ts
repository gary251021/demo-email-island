import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  changesRootAgentsMd,
  exceedsAgentsMdBudget,
  formatAgentsMdBudgetFailure,
  measureAgentsMd,
} from "./checkAgentsMdSize.mjs";

const checkAgentsMdSizePath = fileURLToPath(
  new URL("./checkAgentsMdSize.mjs", import.meta.url),
);

describe("checkAgentsMdSize", () => {
  it("reads hook events from stdin", () => {
    expect(
      execFileSync(process.execPath, [checkAgentsMdSizePath, "--hook"], {
        encoding: "utf8",
        input: JSON.stringify({
          cwd: process.cwd(),
          tool_input: {
            command: "*** Add File: docs/agents/one-off/.gitkeep",
          },
        }),
      }),
    ).toBe("");
  });

  it("checks hooks only when the root AGENTS.md changes", () => {
    const event = (path: string) => ({
      cwd: process.cwd(),
      tool_input: { command: `*** Update File: ${path}` },
    });

    expect(changesRootAgentsMd(event("AGENTS.md"))).toBe(true);
    expect(changesRootAgentsMd(event(`${process.cwd()}/AGENTS.md`))).toBe(true);
    expect(changesRootAgentsMd(event("docs/AGENTS.md"))).toBe(false);
    expect(changesRootAgentsMd(event("README.md"))).toBe(false);
  });

  it("counts logical lines, Unicode code points, and UTF-8 bytes", () => {
    expect(measureAgentsMd(Buffer.from("a\n💡\n"))).toEqual({
      logicalLines: 2,
      unicodeCodePoints: 4,
      utf8Bytes: 7,
    });
  });

  it("counts a non-empty final line without a trailing newline", () => {
    expect(measureAgentsMd(Buffer.from("first\nsecond"))).toEqual({
      logicalLines: 2,
      unicodeCodePoints: 12,
      utf8Bytes: 12,
    });
  });

  it("rejects CRLF input so the count is platform-independent", () => {
    expect(() => measureAgentsMd(Buffer.from("first\r\nsecond\r\n"))).toThrow(
      "AGENTS.md must use LF line endings",
    );
  });

  it("fails when any configured limit is exceeded", () => {
    const limits = {
      logicalLines: 2,
      unicodeCodePoints: 10,
      utf8Bytes: 20,
    };

    expect(
      exceedsAgentsMdBudget(
        { logicalLines: 3, unicodeCodePoints: 10, utf8Bytes: 20 },
        limits,
      ),
    ).toBe(true);
    expect(
      exceedsAgentsMdBudget(
        { logicalLines: 2, unicodeCodePoints: 11, utf8Bytes: 20 },
        limits,
      ),
    ).toBe(true);
    expect(
      exceedsAgentsMdBudget(
        { logicalLines: 2, unicodeCodePoints: 10, utf8Bytes: 21 },
        limits,
      ),
    ).toBe(true);
    expect(
      exceedsAgentsMdBudget(
        { logicalLines: 2, unicodeCodePoints: 10, utf8Bytes: 20 },
        limits,
      ),
    ).toBe(false);
  });

  it("explains how to distribute instructions when the budget is exceeded", () => {
    const message = formatAgentsMdBudgetFailure(
      { logicalLines: 3, unicodeCodePoints: 11, utf8Bytes: 21 },
      { logicalLines: 2, unicodeCodePoints: 10, utf8Bytes: 20 },
    );

    expect(message).toContain("logical lines: 3 / 2");
    expect(message).toContain("logical lines: 3 / 2 (over by 1)");
    expect(message).toContain("Unicode code points: 11 / 10");
    expect(message).toContain("UTF-8 bytes: 21 / 20");
    expect(message).toContain(
      "detailed/task-specific guidance to docs/agents/",
    );
    expect(message).toContain('leave a short "read when ..."');
  });
});
