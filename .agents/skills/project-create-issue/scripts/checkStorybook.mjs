#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

const MAIN_FILE = /^main\.(?:cjs|cts|js|jsx|mjs|mts|ts|tsx)$/;
const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];

const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};

function declaredPackages(packageJson) {
  return DEPENDENCY_FIELDS.flatMap((field) => {
    const dependencies = packageJson[field];
    if (!dependencies || typeof dependencies !== "object") return [];
    return Object.entries(dependencies)
      .filter(([name]) => name === "storybook" || name.startsWith("@storybook/"))
      .map(([name, range]) => ({ field, name, range }));
  }).sort((left, right) => {
    const leftKey = `${left.name}:${left.field}`;
    const rightKey = `${right.name}:${right.field}`;
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
}

function resolvePackage(projectDir, name) {
  const requireFromProject = createRequire(join(projectDir, "package.json"));
  let lastError;
  for (const specifier of [`${name}/package.json`, name]) {
    try {
      return { name, path: requireFromProject.resolve(specifier) };
    } catch (error) {
      lastError = error;
    }
  }
  return { name, error: lastError instanceof Error ? lastError.message : String(lastError) };
}

function inspect(projectArg, configDirArg) {
  const projectDir = resolve(projectArg);
  if (!existsSync(projectDir) || !statSync(projectDir).isDirectory()) {
    throw new Error(`Project directory is not a directory: ${projectDir}`);
  }

  const packagePath = join(projectDir, "package.json");
  let packageJson;
  let packageError = null;
  if (existsSync(packagePath)) {
    try {
      packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
      if (!packageJson || typeof packageJson !== "object" || Array.isArray(packageJson)) {
        throw new Error("package.json must contain a JSON object");
      }
    } catch (error) {
      packageError = error instanceof Error ? error.message : String(error);
    }
  }

  const configDirectory = resolve(projectDir, configDirArg ?? ".storybook");
  const configDirectoryExists = existsSync(configDirectory);
  const configFiles =
    configDirectoryExists && statSync(configDirectory).isDirectory()
      ? readdirSync(configDirectory).filter((name) => MAIN_FILE.test(name)).sort()
      : [];
  const declared = packageJson ? declaredPackages(packageJson) : [];
  const declaredNames = [...new Set(declared.map(({ name }) => name))];
  const packageNames = [...new Set([...declaredNames, "storybook"])] ;
  const resolutions = packageError
    ? []
    : packageNames.map((name) => resolvePackage(projectDir, name));
  const resolved = resolutions.filter((entry) => entry.path);
  const unresolved = resolutions.filter((entry) => entry.error);
  const storybookDeclared = declaredNames.includes("storybook");
  const storybookResolved = resolved.some(({ name }) => name === "storybook");
  const declaredPackagesResolved = declaredNames.every((name) =>
    resolved.some((entry) => entry.name === name),
  );
  const hasEvidence = Boolean(
    packageError || declared.length || configFiles.length || configDirectoryExists || storybookResolved,
  );
  const ready = Boolean(
    !packageError && storybookDeclared && configFiles.length === 1 &&
    storybookResolved && declaredPackagesResolved,
  );
  const status = !hasEvidence ? "absent" : ready ? "ready" : "incomplete";
  const relevantUnresolved = hasEvidence ? unresolved : [];
  const evidence = [
    `project directory: ${projectDir}`,
    `package.json: ${packageError ? `error (${packageError})` : packageJson ? `present (${packagePath})` : "absent"}`,
    `declared Storybook packages: ${declared.length ? declared.map(({ name, range, field }) => `${name}@${range} (${field})`).join(", ") : "none"}`,
    `Storybook config main: ${configFiles.length ? configFiles.map((name) => join(configDirectory, name)).join(", ") : "none"}`,
    `installed package resolution: ${resolved.length ? resolved.map(({ name, path }) => `${name} -> ${path}`).join(", ") : "none"}`,
  ];
  if (relevantUnresolved.length) {
    evidence.push(`unresolved packages: ${relevantUnresolved.map(({ name, error }) => `${name}: ${error}`).join(" | ")}`);
  }
  if (status === "incomplete") {
    const missing = [
      packageError || !packageJson ? "valid package.json" : null,
      !storybookDeclared ? "declared storybook package" : null,
      configFiles.length !== 1 ? "exactly one main.* in the Storybook config directory" : null,
      !storybookResolved ? "resolvable storybook package" : null,
      !declaredPackagesResolved ? "resolution for every declared Storybook package" : null,
    ].filter(Boolean);
    evidence.push(`incomplete because: ${missing.join(", ")}`);
  }

  return {
    status,
    projectDir,
    configDirectory,
    packageJson: { path: packagePath, present: Boolean(packageJson), error: packageError },
    declared,
    resolved,
    unresolved: relevantUnresolved,
    evidence,
  };
}

const projectDir = argument("--project-dir");
if (!projectDir || process.argv.includes("--help")) {
  console.error("Usage: checkStorybook.mjs --project-dir <project-directory> [--config-dir <directory>]");
  process.exitCode = process.argv.includes("--help") ? 0 : 2;
} else {
  try {
    const result = inspect(projectDir, argument("--config-dir"));
    console.log(JSON.stringify(result, null, 2));
    if (result.status === "incomplete") process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
