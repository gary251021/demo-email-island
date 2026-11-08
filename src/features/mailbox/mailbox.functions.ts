import { createServerFn } from "@tanstack/react-start";
import { emptyInput } from "../../lib/session";
import {
  listMailInput,
  mailInput,
  mailScopeInput,
  replyInput,
  snapshotInput,
} from "../../lib/mailbox";
import { requireOwner } from "../session/session.server";
import {
  initializeMailbox,
  readOverview,
  readMailList,
  readMail,
  saveMailRead,
} from "./mailbox.server";
import {
  saveReply,
  saveArchive,
  readQuickArchivePreview,
  saveUnreadSnapshot,
} from "./mail-actions.server";

export const startDemo = createServerFn({ method: "POST" })
  .validator(emptyInput)
  .handler(async () => initializeMailbox(await requireOwner()));
export const getOverview = createServerFn({ method: "GET" })
  .validator(emptyInput)
  .handler(async () => readOverview(await requireOwner()));
export const listMail = createServerFn({ method: "GET" })
  .validator(listMailInput)
  .handler(async ({ data }) => readMailList(await requireOwner(), data));
export const getMail = createServerFn({ method: "GET" })
  .validator(mailInput)
  .handler(async ({ data }) => readMail(await requireOwner(), data));
export const markMailRead = createServerFn({ method: "POST" })
  .validator(mailInput)
  .handler(async ({ data }) => saveMailRead(await requireOwner(), data));

export const replyToMail = createServerFn({ method: "POST" })
  .validator(replyInput)
  .handler(async ({ data }) => saveReply(await requireOwner(), data));
export const archiveMail = createServerFn({ method: "POST" })
  .validator(mailInput)
  .handler(async ({ data }) => saveArchive(await requireOwner(), data));
export const getQuickArchivePreview = createServerFn({ method: "GET" })
  .validator(mailScopeInput)
  .handler(async ({ data }) =>
    readQuickArchivePreview(await requireOwner(), data),
  );
export const archiveUnreadSnapshot = createServerFn({ method: "POST" })
  .validator(snapshotInput)
  .handler(async ({ data }) => saveUnreadSnapshot(await requireOwner(), data));
