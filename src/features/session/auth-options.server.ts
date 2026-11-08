import { anonymous } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";

const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const secret = process.env.BETTER_AUTH_SECRET;
if (!secret)
  throw new Error(
    "BETTER_AUTH_SECRET is required. Set a random secret of at least 32 characters.",
  );

export const authOptions = {
  baseURL,
  secret,
  trustedOrigins: [new URL(baseURL).origin],
  advanced: { database: { generateId: "uuid" as const } },
  session: {
    expiresIn: 60 * 60 * 24 * 365,
    updateAge: 60 * 60 * 24,
    deferSessionRefresh: true,
  },
  plugins: [
    anonymous({ disableDeleteAnonymousUser: true }),
    tanstackStartCookies(),
  ],
};
