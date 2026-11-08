import { createServerFn } from "@tanstack/react-start";
import { prepareInput, commitInput, promptInput } from "../../lib/backlog";
import { requireOwner } from "../session/session.server";
import * as backlog from "./backlog.server";
export const prepareBacklog = createServerFn({ method: "POST" })
  .validator(prepareInput)
  .handler(async ({ data }) =>
    backlog.prepareBacklog(await requireOwner(), data),
  );
export const commitBacklog = createServerFn({ method: "POST" })
  .validator(commitInput)
  .handler(async ({ data }) =>
    backlog.commitBacklog(await requireOwner(), data),
  );
export const getBacklogPrompt = createServerFn({ method: "GET" })
  .validator(promptInput)
  .handler(async ({ data }) =>
    backlog.getBacklogPrompt(await requireOwner(), data),
  );
export const dismissBacklogPrompt = createServerFn({ method: "POST" })
  .validator(promptInput)
  .handler(async ({ data }) =>
    backlog.dismissBacklogPrompt(await requireOwner(), data),
  );
