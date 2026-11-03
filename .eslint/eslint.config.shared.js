const { defineConfig, globalIgnores } = require("eslint/config");
const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const globals = require("globals");
const reactHooksPlugin = require("eslint-plugin-react-hooks");
const tanstackRouter = require("@tanstack/eslint-plugin-router");
const tanstackQuery = require("@tanstack/eslint-plugin-query");

const sharedRuleOverrides = {
  "@typescript-eslint/no-explicit-any": "warn",
  "@typescript-eslint/no-unused-vars": [
    "warn",
    {
      varsIgnorePattern: "^_",
      argsIgnorePattern: "^_",
    },
  ],
};

const sharedConfig = defineConfig([
  globalIgnores([
    // Build output and generated files:
    ".output/**",
    "dist/**",
    ".tanstack/**",
    ".nitro/**",
    "coverage",
    "src/routeTree.gen.ts",
    "**/*/**.test.ts",
    "**/*/**.test.tsx",
    // shadcn default, should not alter
    "src/components/ui/**",
    // Project tooling:
    ".agents/**",
    ".codex/**",
    ".pi/**",
    ".dependency-cruiser.js",
    ".eslint/**",
    "eslint.human.js",
    "eslint.config.mjs",
    "vite.config.mts",
  ]),

  // 1. Extend shared presets first. Each preset registers its own plugins.
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooksPlugin.configs.flat.recommended,
  ...tanstackRouter.configs["flat/recommended"],
  ...tanstackQuery.configs["flat/recommended"],

  // 2. Add shared settings after every preset has loaded.
  {
    name: "shared/settings",
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },

  // 3. Override shared rules last.
  {
    name: "shared/rule-overrides",
    rules: sharedRuleOverrides,
  },
]);

module.exports = sharedConfig;
