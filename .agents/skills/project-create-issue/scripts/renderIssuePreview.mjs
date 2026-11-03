#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { BRANCH_TYPES } from "../../project-deliver-issue/scripts/prepareIssueBranches.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const templatePath = resolve(scriptDir, "../assets/issue-preview.html");
const placeholder = "__ISSUE_PREVIEW_DATA_PLACEHOLDER__";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function validate(data) {
  const strings = ["project", "title", "classification", "bodyMarkdown"];
  for (const key of strings) {
    if (typeof data[key] !== "string" || data[key].trim() === "") {
      throw new Error(`${key} must be a non-empty string`);
    }
  }
  if (!BRANCH_TYPES.has(data.classification)) {
    throw new Error(`classification must be one of: ${[...BRANCH_TYPES].join(", ")}`);
  }
  if (
    !Array.isArray(data.labels) ||
    data.labels.some((label) => typeof label !== "string")
  ) {
    throw new Error("labels must be an array of strings");
  }
  for (const key of [
    "productionBase",
    "developmentTarget",
    "productionPath",
  ]) {
    if (
      typeof data.delivery?.[key] !== "string" ||
      data.delivery[key].trim() === ""
    ) {
      throw new Error(`delivery.${key} must be a non-empty string`);
    }
  }
}

function safeJson(data) {
  return JSON.stringify(data, null, 2)
    .replaceAll("&", "\\u0026")
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function checkWrappedListRendering(template) {
  const renderer = template.slice(
    template.indexOf("const escapeHtml"),
    template.indexOf("document.title"),
  );
  const context = {
    markdown: "- First line\n  continuation line\n- Second item",
  };
  runInNewContext(
    `${renderer}\nthis.output = renderMarkdown(markdown);`,
    context,
  );
  const expected =
    "<ul><li>First line continuation line</li><li>Second item</li></ul>";
  if (context.output !== expected)
    throw new Error("wrapped list lines must remain in their list item");

  const diagram = {
    markdown: "```mermaid\ngraph TD\n  A --> B\n```",
  };
  runInNewContext(
    `${renderer}\nthis.output = renderMarkdown(markdown);`,
    diagram,
  );
  if (diagram.output !== '<div class="mermaid">graph TD\n  A --&gt; B</div>')
    throw new Error("Mermaid fences must render as diagram containers");

  const collapsible = {
    markdown:
      "<details>\n<summary>For Agent</summary>\n\n### Objective\n\n- Implement\n\n</details>",
  };
  runInNewContext(
    `${renderer}\nthis.output = renderMarkdown(markdown);`,
    collapsible,
  );
  if (
    collapsible.output !==
    "<details>\n<summary>For Agent</summary>\n<h3>Objective</h3>\n<ul><li>Implement</li></ul>\n</details>"
  )
    throw new Error(
      "agent section must render as collapsed details with Markdown content",
    );
}

async function render(data, outputPath) {
  validate(data);
  const template = await readFile(templatePath, "utf8");
  if (template.split(placeholder).length !== 2)
    throw new Error("preview template placeholder must occur exactly once");
  await writeFile(outputPath, template.replace(placeholder, safeJson(data)));
}

if (process.argv.includes("--check")) {
  const template = await readFile(templatePath, "utf8");
  if (template.split(placeholder).length !== 2)
    throw new Error("preview template placeholder must occur exactly once");
  checkWrappedListRendering(template);
  validate({
    project: "group/project",
    title: "[Scope] Preview check",
    classification: "fix",
    labels: ["ai-agent"],
    delivery: {
      productionBase: "v0.0.0",
      developmentTarget: "configured-development-target",
      productionPath: "human-controlled",
    },
    bodyMarkdown: "## Check\n\n- Rendered",
  });
  console.log("Issue preview template check passed.");
  process.exit(0);
}

const inputPath = argument("--input");
const outputPath = argument("--output");
if (!inputPath || !outputPath) {
  throw new Error(
    "Usage: renderIssuePreview.mjs --input <issue.json> --output <preview.html>",
  );
}

const data = JSON.parse(await readFile(inputPath, "utf8"));
await render(data, outputPath);
console.log(resolve(outputPath));
