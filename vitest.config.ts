import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { setupFiles: ["./src/features/mailbox/test-database-setup.ts"] },
});
