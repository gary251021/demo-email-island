import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import type { DeliveryProfile } from "./types.ts";

const roles = ["coordinator", "implementer", "standards", "spec"] as const;

export function loadProfile(runtimeRoot: string): DeliveryProfile {
  const profilePath = join(runtimeRoot, "profile.json");
  const profile = JSON.parse(
    readFileSync(profilePath, "utf8"),
  ) as DeliveryProfile;
  if (
    profile.version !== 1 ||
    !Number.isSafeInteger(profile.concurrency) ||
    profile.concurrency < 1 ||
    !Number.isSafeInteger(profile.maxReviewRounds) ||
    profile.maxReviewRounds < 1
  ) {
    throw new Error(`Invalid delivery profile: ${profilePath}`);
  }
  if (
    profile.extensions !== undefined &&
    (!Array.isArray(profile.extensions) ||
      profile.extensions.some(
        (entry) => typeof entry !== "string" || !entry.trim(),
      ))
  ) {
    throw new Error(`Invalid extensions in delivery profile: ${profilePath}`);
  }
  for (const role of roles) {
    if (
      !Array.isArray(profile.skills[role]) ||
      profile.skills[role].some((skill) => typeof skill !== "string")
    ) {
      throw new Error(
        `Invalid ${role} skills in delivery profile: ${profilePath}`,
      );
    }
  }
  return profile;
}

export function resolveSkills(
  profile: DeliveryProfile,
  role: "coordinator" | "implementer" | "standards" | "spec",
  repo: string,
  homeDirectory = homedir(),
): string[] {
  return profile.skills[role].map((entry) => {
    const expanded = entry.startsWith("~/")
      ? join(homeDirectory, entry.slice(2))
      : entry;
    const path = isAbsolute(expanded) ? expanded : resolve(repo, expanded);
    const skillFile = path.endsWith("SKILL.md") ? path : join(path, "SKILL.md");
    const piSkillsRoot = resolve(homeDirectory, ".pi", "agent", "skills");
    const relativeToPiSkills = relative(piSkillsRoot, path);
    const isPiSkill =
      !isAbsolute(relativeToPiSkills) &&
      relativeToPiSkills !== ".." &&
      !relativeToPiSkills.startsWith(`..${sep}`);
    const fallbackPath = isPiSkill
      ? resolve(homeDirectory, ".agents", "skills", relativeToPiSkills)
      : undefined;
    const fallbackFile = fallbackPath
      ? fallbackPath.endsWith("SKILL.md")
        ? fallbackPath
        : join(fallbackPath, "SKILL.md")
      : undefined;
    const resolvedSkillFile = [skillFile, fallbackFile].find(
      (candidate) => candidate && existsSync(candidate),
    );
    if (!resolvedSkillFile) {
      const fallbackNote = fallbackFile
        ? ` (fallback also missing: ${fallbackFile})`
        : "";
      throw new Error(
        `Configured ${role} skill is missing: ${skillFile}${fallbackNote}`,
      );
    }
    return realpathSync(resolvedSkillFile);
  });
}

export function deliveryPrompt(issue: number): string {
  return `Deliver issue ${issue} to a verified local MR preview using ordinary Pi tools, applicable skills and available delegation. Read delivery_status and any preserved evidence first. Use the domain-specific delivery reporting tools only to describe progress and evidence; choose and execute actions yourself. Preserve existing work and pins. No publication.`;
}

export function buildDeliveryArgs(options: {
  repo: string;
  runtimeRoot: string;
  issue: number;
  model?: string;
  thinking?: string;
}): string[] {
  const repo = realpathSync(options.repo);
  const runtimeRoot = realpathSync(options.runtimeRoot);
  if (!Number.isSafeInteger(options.issue) || options.issue < 1)
    throw new Error("Issue must be a positive integer");
  const gitCommonDir = execFileSync("git", ["rev-parse", "--git-common-dir"], {
    cwd: repo,
    encoding: "utf8",
  }).trim();
  const canonicalGitCommonDir = realpathSync(resolve(repo, gitCommonDir));
  const repoHash = createHash("sha256")
    .update(canonicalGitCommonDir)
    .digest("hex");
  const sessionDir = join(
    homedir(),
    ".pi",
    "delivery",
    "sessions",
    repoHash,
    `issue-${options.issue}`,
  );
  const profile = loadProfile(runtimeRoot);
  const explicitSkills = resolveSkills(profile, "coordinator", repo);
  // Keep normal Pi tools, extensions and skill discovery available.
  const args = [
    "--extension",
    resolve(runtimeRoot, "../extensions/deliver.ts"),
    "--extension",
    resolve(runtimeRoot, "../extensions/hooks.ts"),
    "--extension",
    "builtin:mcp",
    "--session-dir",
    sessionDir,
    "--session-id",
    `issue-${options.issue}-${randomUUID()}`,
  ];
  for (const entry of profile.extensions ?? []) {
    const expanded = entry.startsWith("~/")
      ? join(homedir(), entry.slice(2))
      : entry;
    const path = isAbsolute(expanded) ? expanded : resolve(repo, expanded);
    if (!existsSync(path)) {
      throw new Error(`Configured delivery extension is missing: ${path}`);
    }
    args.push("--extension", realpathSync(path));
  }
  for (const skill of explicitSkills) args.push("--skill", skill);
  if (options.model) args.push("--model", options.model);
  if (options.thinking) args.push("--thinking", options.thinking);
  args.push("--", deliveryPrompt(options.issue));
  return args;
}
