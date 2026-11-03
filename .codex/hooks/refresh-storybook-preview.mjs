import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const preview = resolve(root, ".storybook-preview");
const stamp = resolve(preview, "storybook-static/.codex-preview-build-stamp");

function snapshot(path) {
  if (!existsSync(path)) return [path, "missing"];
  const entry = statSync(path);
  if (entry.isFile()) return [path, entry.mtimeMs, entry.size];
  return [path, readdirSync(path).sort().map((name) => snapshot(resolve(path, name)))];
}

function hasStory(path) {
  if (!existsSync(path)) return false;
  return readdirSync(path, { withFileTypes: true }).some((entry) =>
    entry.isDirectory()
      ? hasStory(resolve(path, entry.name))
      : /\.stories\.tsx?$/.test(entry.name),
  );
}

function block(reason) {
  process.stdout.write(`${JSON.stringify({ decision: "block", reason })}\n`);
}

const variants = resolve(preview, "variants");
if (existsSync(preview) && (existsSync(stamp) || hasStory(variants))) {
  const sources = JSON.stringify([snapshot(variants), snapshot(resolve(preview, ".storybook"))]);
  const builtSources = existsSync(stamp) ? readFileSync(stamp, "utf8") : "";
  if (sources !== builtSources) {
    const result = spawnSync("npm", ["run", "build"], {
      cwd: preview,
      encoding: "utf8",
      timeout: 100_000,
    });
    if (result.status !== 0) {
      block(`Storybook preview build failed. Fix the build and retry.\n${(result.stderr || result.stdout || result.error?.message || "Unknown error").slice(-3000)}`);
    } else {
      writeFileSync(stamp, sources);
      block("The Storybook preview was rebuilt. Reload the open story and inspect the rendered result before finishing.");
    }
  }
}
