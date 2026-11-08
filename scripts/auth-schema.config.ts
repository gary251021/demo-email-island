import { betterAuth } from "better-auth";
import { DatabaseSync } from "node:sqlite";
import { authOptions } from "../src/features/session/auth-options.server";

export const auth = betterAuth({
  ...authOptions,
  database: new DatabaseSync(":memory:"),
});
