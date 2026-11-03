const { defineConfig } = require("eslint/config");
const sonarjs = require("eslint-plugin-sonarjs");
const sharedConfig = require("./.eslint/eslint.config.shared.js");

// Human lint is intentionally limited to the shared TypeScript, React and TanStack rules.
module.exports = defineConfig([
  {
    plugins: { sonarjs },
    rules: { "sonarjs/deprecation": "off" },
  },
  { extends: [sharedConfig] },
]);
