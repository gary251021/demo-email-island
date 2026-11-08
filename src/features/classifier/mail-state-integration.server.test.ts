// @vitest-environment node
import { afterAll, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { dirname } from "node:path";
import { db, databasePath } from "../../lib/db.server";
import {
  initializeMailbox,
  getClassificationInputs,
  importedMailSchema,
  readOverview,
  readMail,
  saveMailRead,
} from "../mailbox/mailbox.server";
import { saveArchive, saveReply } from "../mailbox/mail-actions.server";
import {
  importClassifiedMail,
  classificationStatus,
} from "./classification.server";
import { contentHash } from "./classification-policy.server";
import { ownerWorks } from "./classification.repository.server";

function fixture() {
  const owner = randomUUID();
  db.prepare(
    "INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt,isAnonymous) VALUES(?,?,?,0,?,?,1)",
  ).run(owner, "Integration", `${owner}@example.com`, Date.now(), Date.now());
  initializeMailbox(owner);
  const category = readOverview(owner).domains[0]!.subcategories[0]!;
  const mail = getClassificationInputs(owner).find(
    (item) => item.subcategoryId === category.id,
  )!;
  return {
    owner,
    scope: { domainId: "core-projects" as const, subcategoryId: category.id },
    mail,
    input: {
      key: `import-${randomUUID()}`,
      subcategoryId: category.id,
      sender: "import@example.com",
      subject: "Explicit pending",
      bodyText: "Original imported body",
      receivedAt: "2026-11-01T00:00:00.000Z",
      requiresReply: true,
    },
  };
}
afterAll(() => {
  db.close();
  rmSync(dirname(databasePath), { recursive: true, force: true });
});

it("requires explicit imported reply metadata and rolls back content plus classification intent together", () => {
  const { owner, input } = fixture();
  const { requiresReply: omitted, ...missing } = input;
  expect(omitted).toBe(true);
  expect(importedMailSchema.safeParse(missing).success).toBe(false);
  db.exec(
    "CREATE TRIGGER reject_import_intent BEFORE INSERT ON classification_work BEGIN SELECT RAISE(ABORT,'intent rejected'); END;",
  );
  try {
    expect(() => importClassifiedMail(owner, input)).toThrow("intent rejected");
    expect(
      db
        .prepare("SELECT id FROM mails WHERE owner_id=? AND seed_key=?")
        .get(owner, input.key),
    ).toBeUndefined();
    expect(ownerWorks(owner)).toEqual([]);
  } finally {
    db.exec("DROP TRIGGER reject_import_intent;");
  }
  const added = importClassifiedMail(owner, input);
  expect(added.changed).toBe(true);
  expect(getClassificationInputs(owner, [added.mailId])[0]).toMatchObject({
    requiresReply: true,
    hasPendingReply: true,
    replies: [],
  });
  expect(ownerWorks(owner)).toHaveLength(1);
  const before = readMail(owner, {
    domainId: "core-projects",
    subcategoryId: input.subcategoryId,
    mailId: added.mailId,
  });
  const work = ownerWorks(owner)[0]!;
  db.exec(
    "CREATE TRIGGER reject_import_update BEFORE UPDATE ON classification_work BEGIN SELECT RAISE(ABORT,'update intent rejected'); END; CREATE TRIGGER reject_new_intent BEFORE INSERT ON classification_work BEGIN SELECT RAISE(ABORT,'new intent rejected'); END;",
  );
  try {
    expect(() =>
      importClassifiedMail(owner, {
        ...input,
        bodyText: "Changed body",
        requiresReply: false,
      }),
    ).toThrow();
    expect(
      readMail(owner, {
        domainId: "core-projects",
        subcategoryId: input.subcategoryId,
        mailId: added.mailId,
      }),
    ).toEqual(before);
    expect(ownerWorks(owner)).toEqual([work]);
  } finally {
    db.exec(
      "DROP TRIGGER reject_import_update; DROP TRIGGER reject_new_intent;",
    );
  }
});

it("read reply archive and metadata-only imports retain classifier content identity and per-mail placement", () => {
  const { owner, input, scope } = fixture();
  const added = importClassifiedMail(owner, input);
  const target = { ...scope, mailId: added.mailId };
  const initial = getClassificationInputs(owner, [added.mailId])[0]!;
  const hash = contentHash(initial),
    work = ownerWorks(owner)[0]!,
    status = classificationStatus(owner);
  saveMailRead(owner, target);
  expect(readMail(owner, target).hasPendingReply).toBe(true);
  const archived = saveArchive(owner, target);
  const readAt = readMail(owner, target).readAt;
  const reply = saveReply(owner, {
    ...target,
    replyId: randomUUID(),
    bodyText: "Saved reply",
  });
  expect(
    saveReply(owner, { ...target, replyId: reply.id, bodyText: "Saved reply" }),
  ).toEqual(reply);
  const saved = getClassificationInputs(owner, [added.mailId])[0]!;
  expect(saved).toMatchObject({
    requiresReply: true,
    hasPendingReply: false,
    archivedAt: archived.archivedAt,
    readAt,
    replies: [reply],
    placementRevision: initial.placementRevision,
  });
  expect(contentHash(saved)).toBe(hash);
  expect(ownerWorks(owner)).toEqual([work]);
  expect(classificationStatus(owner)).toEqual(status);
  expect(
    importClassifiedMail(owner, { ...input, requiresReply: false }).changed,
  ).toBe(true);
  const metadata = getClassificationInputs(owner, [added.mailId])[0]!;
  expect(metadata).toMatchObject({
    requiresReply: false,
    archivedAt: archived.archivedAt,
    readAt,
    replies: [reply],
    placementRevision: initial.placementRevision,
  });
  expect(contentHash(metadata)).toBe(hash);
  expect(ownerWorks(owner)).toEqual([work]);
  expect(
    importClassifiedMail(owner, { ...input, requiresReply: false }).changed,
  ).toBe(false);
});
