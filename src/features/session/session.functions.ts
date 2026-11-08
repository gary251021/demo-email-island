import { createServerFn } from "@tanstack/react-start";
import { emptyInput } from "../../lib/session";
import { readIdentity } from "./session.server";

export const getIdentity = createServerFn({ method: "GET" })
  .validator(emptyInput)
  .handler(() => readIdentity());
