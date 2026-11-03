import { defineConfig } from "eslint/config";
import sonarjs from "eslint-plugin-sonarjs";
import localReadabilityPlugin from "./.eslint/eslint-custom-plugin.mjs";
import sharedConfig from "./.eslint/eslint.config.shared.js";

const globalRuleOverrides = {
  "max-params": ["warn", { max: 3 }],
  "max-lines-per-function": [
    "warn",
    { max: 200, skipBlankLines: true, skipComments: true },
  ],
  "@typescript-eslint/no-unnecessary-condition": "warn",
  "sonarjs/no-duplicate-string": ["warn", { threshold: 6 }],
  "sonarjs/no-identical-functions": "warn",
  "sonarjs/cognitive-complexity": ["warn", 12],
  "sonarjs/nested-control-flow": ["warn", { maximumNestingLevel: 3 }],
  // TODO: Refactor BaseRepository to start the DB connection outside the
  // constructor, then restore this rule to error.
  "sonarjs/no-async-constructor": "warn",
  "sonarjs/todo-tag": "warn",
  "sonarjs/prefer-read-only-props": "off",
  complexity: ["warn", { max: 12 }],
  "max-depth": ["warn", { max: 3 }],
  "no-nested-ternary": "error",
  "no-restricted-syntax": [
    "error",
    {
      selector: "ImportExpression",
      message:
        "Dynamic `import()` is not allowed. Use static `import` statements instead.",
    },
  ],
};

// Remove entries from here as their advisory findings become actionable.
const temporarilyDisabledGlobalRules = {
  complexity: "off",
  "max-lines-per-function": "off",
  "max-params": "off",
  "sonarjs/no-unused-vars": "off",
  "sonarjs/todo-tag": "off",
  "sonarjs/cognitive-complexity": "off",
};

const applicationRuleOverrides = {
  "local/max-inline-param-properties": [
    "warn",
    { maxProperties: 3, reactMaxProperties: 5 },
  ],
  "local/react-component-max-params": ["warn", { max: 1 }],
  "local/no-useless-alias-wrapper": ["warn", { allowExported: true }],
};

const reactComponentRuleOverrides = {
  "@typescript-eslint/consistent-type-definitions": ["warn", "type"],
  "@typescript-eslint/consistent-type-exports": [
    "warn",
    { fixMixedExportsWithInlineTypeSpecifier: true },
  ],
  "local/component-responsibility-budget": "warn",
};

const componentModuleRuleOverrides = {
  "local/component-module-contract": "warn",
  "local/component-props-name": "warn",
  "local/component-props-type-exports": "warn",
};

const eslintConfig = defineConfig([
  {
    name: "project/ignores",
    ignores: [".agents/**", ".codex/**", ".pi/**", ".scratch/**", ".storybook-preview/**", "playwright/**"],
  },
  // 1. Extend every shared preset before applying project configuration.
  {
    name: "project/shared-configs",
    extends: [sonarjs.configs.recommended, sharedConfig],
  },

  // 2. Register project plugins and type-aware parser services before using
  // their rules in the override hierarchy below.
  {
    name: "project/plugins-and-language-options",
    plugins: {
      local: localReadabilityPlugin,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },

  // 3. Apply rule overrides from the broadest scope to the narrowest scope.
  {
    name: "project/rules/global",
    rules: {
      ...globalRuleOverrides,
      ...temporarilyDisabledGlobalRules,
    },
  },
  {
    name: "project/rules/typescript-responsibility-budget",
    files: ["**/*.{cts,mts,ts,tsx}"],
    rules: {
      "local/responsibility-budget": "warn",
    },
  },
  {
    name: "project/rules/application",
    files: ["src/**/*.{ts,tsx}"],
    rules: applicationRuleOverrides,
  },
  {
    name: "project/rules/react-components",
    files: ["src/**/*.tsx"],
    rules: reactComponentRuleOverrides,
  },
  {
    name: "project/rules/component-modules",
    files: ["src/**/*.tsx"],
    ignores: ["src/**/context/**/*"],
    rules: componentModuleRuleOverrides,
  },
  {
    name: "project/rules/tanstack-route-framework-contract",
    files: ["src/routes/**/*.tsx"],
    rules: {
      // TanStack file routes export a `Route` object instead of a default component.
      "local/component-module-contract": "off",
    },
  },
]);

export default eslintConfig;
