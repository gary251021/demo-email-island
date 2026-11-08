import { randomUUID } from "node:crypto";
import { db } from "../../lib/db.server";
import {
  mailDetailSchema,
  mailSummarySchema,
  overviewSchema,
} from "../../lib/mailbox";
import type { ListMailInput, MailInput, MailScope } from "../../lib/mailbox";
import { domains, seedCategories } from "./mockSeed.server";

function seedMailbox(ownerKey: string) {
  const insertCategory = db.prepare(
    "INSERT INTO subcategories (id,owner_id,seed_key,domain_id,name) VALUES (?,?,?,?,?)",
  );
  const insertMail = db.prepare(`INSERT INTO mails
  (id,owner_id,seed_key,subcategory_id,sender,subject,body_text,received_at,read_at,requires_reply)
  VALUES (?,?,?,?,?,?,?,?,?,?)`);
  for (const category of seedCategories) {
    const categoryId = randomUUID();
    insertCategory.run(
      categoryId,
      ownerKey,
      category.key,
      category.domainId,
      category.name,
    );
    for (let index = 0; index < Math.max(category.unread, 1); index++) {
      const receivedAt = new Date(
        Date.UTC(2026, 9, 1, 12) - index * 3_600_000,
      ).toISOString();
      insertMail.run(
        randomUUID(),
        ownerKey,
        `${category.key}-${index}`,
        categoryId,
        category.sender,
        index === 0 ? category.subject : `${category.subject} · ${index + 1}`,
        category.body,
        receivedAt,
        category.unread === 0 ? receivedAt : null,
        Number(category.requiresReply[index]),
      );
    }
  }
}

export function initializeMailbox(ownerKey: string) {
  db.exec("BEGIN IMMEDIATE");
  try {
    if (
      !db
        .prepare("SELECT owner_id FROM mailboxes WHERE owner_id = ?")
        .get(ownerKey)
    ) {
      seedMailbox(ownerKey);
      db.prepare(
        "INSERT INTO mailboxes (owner_id,seed_version,initialized_at) VALUES (?,1,?)",
      ).run(ownerKey, new Date().toISOString());
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { ownerKey };
}

export function readOverview(ownerKey: string) {
  const categories = db
    .prepare(
      `SELECT s.id,s.domain_id,s.name,
    COUNT(CASE WHEN m.archived_at IS NULL AND m.read_at IS NULL THEN m.id END) AS unread_count,
    COUNT(CASE WHEN m.archived_at IS NULL AND m.requires_reply = 1 AND NOT EXISTS (SELECT 1 FROM mail_replies r WHERE r.owner_id = m.owner_id AND r.mail_id = m.id) THEN m.id END) AS pending_count
    FROM subcategories s LEFT JOIN mails m ON m.owner_id = s.owner_id AND m.subcategory_id = s.id
    WHERE s.owner_id = ? GROUP BY s.id ORDER BY s.rowid`,
    )
    .all(ownerKey);
  if (
    !db
      .prepare("SELECT owner_id FROM mailboxes WHERE owner_id = ?")
      .get(ownerKey)
  ) {
    throw new Error("NOT_FOUND");
  }
  return overviewSchema.parse({
    domains: domains.map((domain) => {
      const subcategories = categories
        .filter((category) => category.domain_id === domain.id)
        .map((category) => ({
          id: category.id,
          name: category.name,
          unreadCount: category.unread_count,
          pendingReplyCount: category.pending_count,
        }));
      return {
        ...domain,
        subcategories,
        pendingReplyCount: subcategories.reduce(
          (sum, category) => sum + Number(category.pendingReplyCount),
          0,
        ),
        unreadCount: subcategories.reduce(
          (sum, category) => sum + Number(category.unreadCount),
          0,
        ),
      };
    }),
  });
}

function requireCategory(ownerKey: string, input: MailScope) {
  const category = db
    .prepare(
      "SELECT id FROM subcategories WHERE owner_id = ? AND domain_id = ? AND id = ?",
    )
    .get(ownerKey, input.domainId, input.subcategoryId);
  if (!category) throw new Error("NOT_FOUND");
}

const mailColumns = `m.id,m.subcategory_id AS subcategoryId,m.sender,m.subject,
  m.body_text AS bodyText,m.received_at AS receivedAt,m.read_at AS readAt,
  m.archived_at AS archivedAt,m.requires_reply AS requiresReply,
  (m.requires_reply = 1 AND NOT EXISTS (SELECT 1 FROM mail_replies r WHERE r.owner_id = m.owner_id AND r.mail_id = m.id)) AS hasPendingReply`;

export function readMailList(ownerKey: string, input: ListMailInput) {
  requireCategory(ownerKey, input);
  return mailSummarySchema.array().parse(
    db
      .prepare(
        `SELECT ${mailColumns} FROM mails m
    WHERE m.owner_id = ? AND m.subcategory_id = ? AND m.archived_at IS ${input.view === "active" ? "NULL" : "NOT NULL"} ORDER BY m.received_at DESC,m.id`,
      )
      .all(ownerKey, input.subcategoryId)
      .map((mail) => ({
        ...mail,
        requiresReply: Boolean(mail.requiresReply),
        hasPendingReply: Boolean(mail.hasPendingReply),
      })),
  );
}

export function readMail(ownerKey: string, input: MailInput) {
  const mail = db
    .prepare(
      `SELECT ${mailColumns} FROM mails m JOIN subcategories s
    ON s.owner_id = m.owner_id AND s.id = m.subcategory_id
    WHERE m.owner_id = ? AND s.domain_id = ? AND m.subcategory_id = ? AND m.id = ?`,
    )
    .get(ownerKey, input.domainId, input.subcategoryId, input.mailId);
  if (!mail) throw new Error("NOT_FOUND");
  const replies = db
    .prepare(
      "SELECT id,body_text AS bodyText,created_at AS createdAt FROM mail_replies WHERE owner_id = ? AND mail_id = ? ORDER BY created_at,id",
    )
    .all(ownerKey, input.mailId);
  return mailDetailSchema.parse({
    ...mail,
    requiresReply: Boolean(mail.requiresReply),
    hasPendingReply: Boolean(mail.hasPendingReply),
    replies,
  });
}

export function saveMailRead(ownerKey: string, input: MailInput) {
  // Read with the complete parent/owner predicate before any mutation.
  readMail(ownerKey, input);
  const readAt = new Date().toISOString();
  db.prepare(
    "UPDATE mails SET read_at = ? WHERE owner_id = ? AND subcategory_id = ? AND id = ? AND read_at IS NULL",
  ).run(readAt, ownerKey, input.subcategoryId, input.mailId);
  return { mailId: input.mailId, readAt: readMail(ownerKey, input).readAt };
}
