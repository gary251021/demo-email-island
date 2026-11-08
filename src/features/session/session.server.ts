import {
  getRequestHeaders,
  setResponseHeader,
} from "@tanstack/react-start/server";
import { auth } from "./auth.server";
import { identitySchema } from "../../lib/session";

export async function readIdentity() {
  setResponseHeader("Cache-Control", "private, no-store");
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  return session ? identitySchema.parse({ ownerKey: session.user.id }) : null;
}

export async function requireOwner() {
  const identity = await readIdentity();
  if (!identity) throw new Error("UNAUTHENTICATED");
  return identity.ownerKey;
}
