import { z } from "zod";
import { randomUUID } from "node:crypto";
import { db, transaction } from "../../lib/db.server";
import {
  mailDetailSchema,
  mailSummarySchema,
  mailListSchema,
  domainIdSchema,
  overviewSchema,
} from "../../lib/mailbox";
import type { ListMailInput, MailInput, MailScope } from "../../lib/mailbox";
import {
  matchMailTimeline,
  timelineMailSchema,
  unreadMailCount,
} from "./mailTimeline.server";
import { domains, seedCategories, storySeed } from "./mockSeed.server";

function seedMailbox(ownerKey: string) {
  const insertCategory = db.prepare(
    "INSERT INTO subcategories (id,owner_id,seed_key,domain_id,name,automatic_eligible,origin,layout_slot) VALUES (?,?,?,?,?,1,'seed',?)",
  );
  for (const category of seedCategories) {
    const categoryId = randomUUID();
    insertCategory.run(
      categoryId,
      ownerKey,
      category.key,
      category.domainId,
      category.name,
      seedCategories
        .filter((entry) => entry.domainId === category.domainId)
        .findIndex((entry) => entry.key === category.key),
    );
    if (category.key === storySeed.categoryKey) {
      for (const [index, source] of storySeed.sourceMails.entries()) {
        writeMailboxMail(ownerKey, {
          ...source,
          requiresReply: z.boolean().parse(storySeed.requiresReply[index]),
          domainId: category.domainId,
          subcategoryId: categoryId,
          readAt:
            index < storySeed.sourceMails.length - category.unread
              ? source.receivedAt
              : null,
        });
      }
      continue;
    }
    for (let index = 0; index < Math.max(category.unread, 1); index++) {
      const receivedAt = new Date(
        Date.UTC(2026, 9, 1, 12) - index * 3_600_000,
      ).toISOString();
      writeMailboxMail(ownerKey, {
        seedKey: `${category.key}-${index}`,
        domainId: category.domainId,
        subcategoryId: categoryId,
        sender: category.sender,
        subject:
          index === 0 ? category.subject : `${category.subject} · ${index + 1}`,
        bodyText: category.body,
        receivedAt,
        readAt: category.unread === 0 ? receivedAt : null,
        requiresReply: z.boolean().parse(category.requiresReply[index]),
      });
    }
  }
}

export function initializeMailbox(
  ownerKey: string,
  onImported: () => void = () => {},
) {
  transaction(() => {
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
    onImported();
  });
  return { ownerKey };
}

export function readOverview(ownerKey: string) {
  const categories = db
    .prepare(
      `SELECT s.id,s.domain_id,s.name,s.origin,s.automatic_eligible,s.layout_slot,
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
          origin: category.origin,
          automaticEligible: Boolean(category.automatic_eligible),
          layoutSlot: category.layout_slot,
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
  db.exec("BEGIN");
  try {
    requireCategory(ownerKey, input);
    const mails = db
      .prepare(
        `SELECT ${mailColumns},m.seed_key AS seedKey FROM mails m
       WHERE m.owner_id = ? AND m.subcategory_id = ? AND m.archived_at IS ${input.view === "active" ? "NULL" : "NOT NULL"} ORDER BY m.received_at DESC,m.id`,
      )
      .all(ownerKey, input.subcategoryId);
    const summaries = mailSummarySchema.array().parse(
      mails.map((mail) => ({
        ...mail,
        requiresReply: Boolean(mail.requiresReply),
        hasPendingReply: Boolean(mail.hasPendingReply),
      })),
    );
    const unreadCount = unreadMailCount(summaries);
    const result = mailListSchema.parse({
      mails: summaries,
      unreadCount,
      timeline:
        input.view === "active"
          ? matchMailTimeline(
              timelineMailSchema.array().parse(mails),
              unreadCount,
            )
          : null,
    });
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
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

// These interfaces retain mailbox ownership of content and placement writes.
export function getClassificationInputs(ownerKey: string, ids?: string[]) {
  return mailDetailSchema
    .extend({ placementRevision: z.number().int() })
    .array()
    .parse(
      db
        .prepare(
          `SELECT ${mailColumns},m.placement_revision AS placementRevision
      FROM mails m WHERE m.owner_id = ? ORDER BY m.id`,
        )
        .all(ownerKey)
        .map((mail) => ({
          ...mail,
          requiresReply: Boolean(mail.requiresReply),
          hasPendingReply: Boolean(mail.hasPendingReply),
          replies: db
            .prepare(
              "SELECT id,body_text AS bodyText,created_at AS createdAt FROM mail_replies WHERE owner_id=? AND mail_id=? ORDER BY created_at,id",
            )
            .all(ownerKey, String(mail.id)),
        })),
    )
    .filter((mail) => !ids || ids.includes(mail.id));
}

export function listClassificationCandidates(ownerKey: string) {
  return readOverview(ownerKey).domains.map((domain) => ({
    id: domain.id,
    name: domain.name,
    description: null,
    subcategories: domain.subcategories
      .filter((category) => category.automaticEligible)
      .map((category) => ({
        id: category.id,
        name: category.name,
        description: null,
      })),
  }));
}

export function applyCategory(
  ownerKey: string,
  mailId: string,
  subcategoryId: string,
  expectedRevision: number,
) {
  if (
    !db
      .prepare("SELECT id FROM subcategories WHERE owner_id = ? AND id = ?")
      .get(ownerKey, subcategoryId)
  )
    throw new Error("NOT_FOUND");
  return (
    db
      .prepare(
        `UPDATE mails SET subcategory_id = ?, placement_revision = placement_revision + 1
    WHERE owner_id = ? AND id = ? AND placement_revision = ?`,
      )
      .run(subcategoryId, ownerKey, mailId, expectedRevision).changes === 1
  );
}

export const importedMailSchema = z.strictObject({
  key: z.string().min(1),
  subcategoryId: z.uuid(),
  sender: z.string(),
  subject: z.string(),
  bodyText: z.string(),
  receivedAt: z.iso.datetime(),
  requiresReply: z.boolean(),
});

export function importMail(
  ownerKey: string,
  input: z.infer<typeof importedMailSchema>,
  onChanged: (mailId: string) => void,
) {
  const data = importedMailSchema.parse(input);
  return transaction(() => {
    if (
      !db
        .prepare("SELECT id FROM subcategories WHERE owner_id = ? AND id = ?")
        .get(ownerKey, data.subcategoryId)
    )
      throw new Error("NOT_FOUND");
    const existing = db
      .prepare(
        "SELECT id,sender,subject,body_text,received_at,requires_reply FROM mails WHERE owner_id = ? AND seed_key = ?",
      )
      .get(ownerKey, data.key);
    const id = existing ? String(existing.id) : randomUUID();
    if (
      existing &&
      existing.sender === data.sender &&
      existing.subject === data.subject &&
      existing.body_text === data.bodyText &&
      existing.received_at === data.receivedAt &&
      existing.requires_reply === Number(data.requiresReply)
    )
      return { mailId: id, changed: false };
    if (existing) {
      db.prepare(
        "UPDATE mails SET sender=?,subject=?,body_text=?,received_at=?,requires_reply=? WHERE owner_id=? AND id=?",
      ).run(
        data.sender,
        data.subject,
        data.bodyText,
        data.receivedAt,
        Number(data.requiresReply),
        ownerKey,
        id,
      );
    } else {
      db.prepare(
        "INSERT INTO mails (id,owner_id,seed_key,subcategory_id,sender,subject,body_text,received_at,requires_reply) VALUES (?,?,?,?,?,?,?,?,?)",
      ).run(
        id,
        ownerKey,
        data.key,
        data.subcategoryId,
        data.sender,
        data.subject,
        data.bodyText,
        data.receivedAt,
        Number(data.requiresReply),
      );
    }
    onChanged(id);
    return { mailId: id, changed: true };
  });
}

const mailboxWriteSchema = timelineMailSchema
  .extend({
    id: z.uuid().optional(),
    domainId: domainIdSchema,
    subcategoryId: z.uuid(),
    readAt: z.iso.datetime().nullable(),
    requiresReply: z.boolean(),
  })
  .strict();

// Canonical import/seed write boundary. A replacement keeps its resource identity.
// This server-only service is not a public RPC and never accepts an owner in input.
export function writeMailboxMail(
  ownerKey: string,
  raw: z.infer<typeof mailboxWriteSchema>,
) {
  const input = mailboxWriteSchema.parse(raw);
  requireCategory(ownerKey, input);
  const id = input.id ?? randomUUID();
  if (
    input.id &&
    !db
      .prepare("SELECT id FROM mails WHERE owner_id = ? AND id = ?")
      .get(ownerKey, id)
  )
    throw new Error("NOT_FOUND");
  db.prepare(
    `INSERT INTO mails
    (id,owner_id,seed_key,subcategory_id,sender,subject,body_text,received_at,read_at,requires_reply)
    VALUES (?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET seed_key=excluded.seed_key,
      subcategory_id=excluded.subcategory_id,sender=excluded.sender,subject=excluded.subject,
      body_text=excluded.body_text,received_at=excluded.received_at,read_at=excluded.read_at,
      requires_reply=excluded.requires_reply
    WHERE mails.owner_id=excluded.owner_id`,
  ).run(
    id,
    ownerKey,
    input.seedKey,
    input.subcategoryId,
    input.sender,
    input.subject,
    input.bodyText,
    input.receivedAt,
    input.readAt,
    Number(input.requiresReply),
  );
  return { id };
}

// Does not open a transaction: the snapshot writer owns its atomic read+write scope.
export function readActiveUnreadIds(ownerKey: string, input: MailScope) {
  requireCategory(ownerKey, input);
  return db
    .prepare(
      "SELECT id FROM mails WHERE owner_id=? AND subcategory_id=? AND archived_at IS NULL AND read_at IS NULL ORDER BY id",
    )
    .all(ownerKey, input.subcategoryId)
    .map((mail) => String(mail.id));
}

// The caller owns the encompassing snapshot/confirmation transaction.
export function readBacklogScope(ownerKey: string, subcategoryId: string) {
  const category = db
    .prepare(
      "SELECT id,domain_id AS domainId,name FROM subcategories WHERE owner_id=? AND id=?",
    )
    .get(ownerKey, subcategoryId);
  if (!category) throw new Error("NOT_FOUND");
  return {
    category: {
      id: String(category.id),
      domainId: domainIdSchema.parse(category.domainId),
      name: String(category.name),
    },
    mails: getClassificationInputs(ownerKey).filter(
      (mail) =>
        mail.subcategoryId === subcategoryId && mail.archivedAt === null,
    ),
  };
}
export function createSplitCategory(
  ownerKey: string,
  domainId: z.infer<typeof domainIdSchema>,
  name: string,
) {
  if (
    db
      .prepare(
        "SELECT id FROM subcategories WHERE owner_id=? AND domain_id=? AND name=?",
      )
      .get(ownerKey, domainId, name)
  )
    throw new Error("NAME_CONFLICT");
  const slot = db
    .prepare(
      "SELECT MAX(COALESCE(MAX(layout_slot),1),1)+1 AS slot FROM subcategories WHERE owner_id=? AND domain_id=?",
    )
    .get(ownerKey, domainId);
  const id = randomUUID();
  db.prepare(
    "INSERT INTO subcategories (id,owner_id,seed_key,domain_id,name,automatic_eligible,origin,layout_slot) VALUES (?,?,NULL,?,?,0,'split',?)",
  ).run(id, ownerKey, domainId, name, Number(slot?.slot));
  return id;
}
