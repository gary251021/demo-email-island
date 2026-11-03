import { afterEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { buildDeliveryArgs, loadProfile, resolveSkills } from "./resources.ts";
import type { DeliveryProfile } from "./types.ts";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(() => ".git\n"),
}));

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function makeProfile(skill: string): DeliveryProfile {
  return {
    version: 1,
    implementer: { model: "test", thinking: "high" },
    concurrency: 1,
    maxReviewRounds: 8,
    skills: {
      coordinator: [skill],
      implementer: [],
      standards: [],
      spec: [],
    },
  };
}

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), "delivery-resources-"));
  temporaryDirectories.push(root);
  const home = join(root, "home");
  const repo = join(root, "repo");
  mkdirSync(home, { recursive: true });
  mkdirSync(repo, { recursive: true });
  return { home, repo };
}

describe("buildDeliveryArgs", () => {
  it("loads the child runtime from the Pi-owned directory", () => {
    const { repo } = makeFixture();
    mkdirSync(join(repo, ".git"));
    const runtimeRoot = join(repo, ".pi", "pi-delivery");
    mkdirSync(runtimeRoot, { recursive: true });
    const profile = makeProfile("unused");
    profile.skills.coordinator = [];
    writeFileSync(join(runtimeRoot, "profile.json"), JSON.stringify(profile));

    const args = buildDeliveryArgs({ repo, runtimeRoot, issue: 31 });
    expect(execFileSync).toHaveBeenCalledWith(
      "git",
      ["rev-parse", "--git-common-dir"],
      { cwd: realpathSync(repo), encoding: "utf8" },
    );
    expect(args[args.indexOf("--extension") + 1]).toBe(
      join(realpathSync(repo), ".pi", "extensions", "deliver.ts"),
    );
    expect(args).toContain(join(realpathSync(repo), ".pi", "extensions", "hooks.ts"));
    expect(args).not.toContain("--no-extensions");
    expect(args[args.indexOf("--session-dir") + 1]).toMatch(
      /\.pi\/delivery\/sessions\/[^/]+\/issue-31$/,
    );
  });
});

describe("loadProfile", () => {
  it("rejects missing or invalid review caps", () => {
    const { repo } = makeFixture();
    const root = join(repo, ".pi", "pi-delivery");
    mkdirSync(root, { recursive: true });
    const profile = makeProfile("unused");
    profile.maxReviewRounds = 0;
    writeFileSync(join(root, "profile.json"), JSON.stringify(profile));
    expect(() => loadProfile(root)).toThrow("Invalid delivery profile");
    profile.maxReviewRounds = 8;
    writeFileSync(join(root, "profile.json"), JSON.stringify(profile));
    expect(loadProfile(root).maxReviewRounds).toBe(8);
  });
});

describe("resolveSkills", () => {
  it("falls back from Pi's skill directory to the matching .agents skill", () => {
    const { home, repo } = makeFixture();
    const fallback = join(
      home,
      ".agents",
      "skills",
      "codebase-design",
      "SKILL.md",
    );
    mkdirSync(dirname(fallback), { recursive: true });
    writeFileSync(fallback, "# Codebase design");

    expect(
      resolveSkills(
        makeProfile("~/.pi/agent/skills/codebase-design/SKILL.md"),
        "coordinator",
        repo,
        home,
      ),
    ).toEqual([realpathSync(fallback)]);
  });

  it("prefers the configured Pi skill when both locations exist", () => {
    const { home, repo } = makeFixture();
    const piSkill = join(
      home,
      ".pi",
      "agent",
      "skills",
      "codebase-design",
      "SKILL.md",
    );
    const agentsSkill = join(
      home,
      ".agents",
      "skills",
      "codebase-design",
      "SKILL.md",
    );
    mkdirSync(dirname(piSkill), { recursive: true });
    mkdirSync(dirname(agentsSkill), { recursive: true });
    writeFileSync(piSkill, "# Pi skill");
    writeFileSync(agentsSkill, "# Agents skill");

    expect(
      resolveSkills(
        makeProfile("~/.pi/agent/skills/codebase-design/SKILL.md"),
        "coordinator",
        repo,
        home,
      ),
    ).toEqual([realpathSync(piSkill)]);
  });

  it("does not search .agents for unrelated configured paths", () => {
    const { home, repo } = makeFixture();
    const unrelatedSkill = join(
      home,
      ".agents",
      "skills",
      "codebase-design",
      "SKILL.md",
    );
    mkdirSync(dirname(unrelatedSkill), { recursive: true });
    writeFileSync(unrelatedSkill, "# Codebase design");

    expect(() =>
      resolveSkills(makeProfile("missing/SKILL.md"), "coordinator", repo, home),
    ).toThrow("Configured coordinator skill is missing");
  });
});
