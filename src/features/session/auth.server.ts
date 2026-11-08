import { betterAuth } from "better-auth";
import { db } from "../../lib/db.server";
import { authOptions } from "./auth-options.server";

export const auth = betterAuth({ ...authOptions, database: db });
