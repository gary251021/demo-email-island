import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/features/mailbox/test-database-setup.ts"],
  },
});
