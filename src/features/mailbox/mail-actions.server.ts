import { db } from "../../lib/db.server";
import { replySchema } from "../../lib/mailbox";
import type {
  MailInput,
  MailScope,
  ReplyInput,
  SnapshotInput,
} from "../../lib/mailbox";
import { readMail, readMailList } from "./mailbox.server";

function transaction<T>(action: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = action();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function saveReply(ownerKey: string, input: ReplyInput) {
  return transaction(() => {
    readMail(ownerKey, input);
    const previous = db
      .prepare(
        "SELECT mail_id,body_text AS bodyText,id,created_at AS createdAt FROM mail_replies WHERE owner_id = ? AND id = ?",
      )
      .get(ownerKey, input.replyId);
    if (previous) {
      if (
        previous.mail_id !== input.mailId ||
        previous.bodyText !== input.bodyText
      )
        throw new Error("REPLY_CONFLICT");
      return replySchema.parse(previous);
    }
    const createdAt = new Date().toISOString();
    db.prepare(
      "INSERT INTO mail_replies (id,owner_id,mail_id,body_text,created_at) VALUES (?,?,?,?,?)",
    ).run(input.replyId, ownerKey, input.mailId, input.bodyText, createdAt);
    db.prepare(
      "UPDATE mails SET read_at = ? WHERE owner_id = ? AND id = ? AND read_at IS NULL",
    ).run(createdAt, ownerKey, input.mailId);
    return { id: input.replyId, bodyText: input.bodyText, createdAt };
  });
}
export function saveArchive(ownerKey: string, input: MailInput) {
  return transaction(() => {
    const mail = readMail(ownerKey, input);
    const archivedAt = mail.archivedAt ?? new Date().toISOString();
    db.prepare(
      "UPDATE mails SET archived_at = ? WHERE owner_id = ? AND id = ? AND archived_at IS NULL",
    ).run(archivedAt, ownerKey, input.mailId);
    return { archivedAt };
  });
}
export function readQuickArchivePreview(ownerKey: string, input: MailScope) {
  const mails = readMailList(ownerKey, { ...input, view: "active" });
  return {
    mailIds: mails
      .filter((mail) => mail.readAt === null)
      .map((mail) => mail.id)
      .sort((left, right) => left.localeCompare(right)),
  };
}
export function saveUnreadSnapshot(ownerKey: string, input: SnapshotInput) {
  return transaction(() => {
    const mails = input.mailIds.map((mailId) =>
      readMail(ownerKey, { ...input, mailId }),
    );
    if (mails.every((mail) => mail.archivedAt !== null))
      return { archivedIds: input.mailIds };
    const current = readQuickArchivePreview(ownerKey, input).mailIds;
    if (
      current.length !== input.mailIds.length ||
      !current.every((id) => input.mailIds.includes(id))
    )
      throw new Error("SNAPSHOT_CHANGED");
    const archivedAt = new Date().toISOString();
    const update = db.prepare(
      "UPDATE mails SET archived_at = ? WHERE owner_id = ? AND id = ?",
    );
    for (const mailId of input.mailIds)
      update.run(archivedAt, ownerKey, mailId);
    return { archivedIds: input.mailIds };
  });
}
