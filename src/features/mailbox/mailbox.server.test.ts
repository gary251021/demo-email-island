// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rmSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { db, databasePath } from "../../lib/db.server";
import {
  initializeMailbox,
  readOverview,
  readMailList,
  readMail,
  saveMailRead,
} from "./mailbox.server";

const owner = randomUUID();
const secondOwner = randomUUID();

beforeAll(() => {
  for (const id of [owner, secondOwner]) {
    db.prepare(
      "INSERT INTO user (id,name,email,emailVerified,createdAt,updatedAt,isAnonymous) VALUES (?,?,?,0,?,?,1)",
    ).run(id, "Reader", `${id}@example.com`, Date.now(), Date.now());
  }
});
afterAll(() => {
  db.close();
  rmSync(dirname(databasePath), { recursive: true, force: true });
});

describe("owner-scoped mailbox persistence", () => {
  it("initializes once and retains IDs and an idempotent read timestamp", () => {
    initializeMailbox(owner);
    const first = readOverview(owner);
    const category = first.domains[0]?.subcategories[0];
    if (!category) throw new Error("Missing seed");
    const listInput = {
      domainId: "core-projects" as const,
      subcategoryId: category.id,
    };
    const mail = readMailList(owner, { ...listInput, view: "active" })[0];
    if (!mail) throw new Error("Missing mail");
    const input = { ...listInput, mailId: mail.id };
    const saved = saveMailRead(owner, input);
    expect(saveMailRead(owner, input)).toEqual(saved);
    initializeMailbox(owner);
    expect(readMailList(owner, { ...listInput, view: "active" })).toHaveLength(
      3,
    );
    expect(readMail(owner, input).readAt).toBe(saved.readAt);
    expect(readOverview(owner).domains[0]?.unreadCount).toBe(3);
  });

  it("rolls back the entire seed transaction and can retry without duplicates", () => {
    db.exec(
      "CREATE TRIGGER reject_test_seed BEFORE INSERT ON mails BEGIN SELECT RAISE(ABORT, 'test'); END;",
    );
    expect(() => initializeMailbox(secondOwner)).toThrow();
    expect(
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM subcategories WHERE owner_id = ?",
        )
        .get(secondOwner)?.count,
    ).toBe(0);
    expect(
      db
        .prepare("SELECT COUNT(*) AS count FROM mailboxes WHERE owner_id = ?")
        .get(secondOwner)?.count,
    ).toBe(0);
    db.exec("DROP TRIGGER reject_test_seed;");
    initializeMailbox(secondOwner);
    initializeMailbox(secondOwner);
    expect(readOverview(secondOwner).domains).toHaveLength(8);
    expect(
      db
        .prepare("SELECT COUNT(*) AS count FROM mails WHERE owner_id = ?")
        .get(secondOwner)?.count,
    ).toBe(86);
  });

  it("rejects another owner's IDs and inconsistent parent combinations", () => {
    const category = readOverview(secondOwner).domains[0]?.subcategories[0];
    if (!category) throw new Error("Missing seed");
    const input = {
      domainId: "core-projects" as const,
      subcategoryId: category.id,
    };
    const mail = readMailList(secondOwner, { ...input, view: "active" })[0];
    if (!mail) throw new Error("Missing mail");
    expect(() => readMailList(owner, { ...input, view: "active" })).toThrow(
      "NOT_FOUND",
    );
    expect(() => readMail(owner, { ...input, mailId: mail.id })).toThrow(
      "NOT_FOUND",
    );
    expect(() => saveMailRead(owner, { ...input, mailId: mail.id })).toThrow(
      "NOT_FOUND",
    );
    expect(() =>
      readMailList(secondOwner, {
        ...input,
        domainId: "internal-team",
        view: "active",
      }),
    ).toThrow("NOT_FOUND");
    expect(
      readMail(secondOwner, { ...input, mailId: mail.id }).readAt,
    ).toBeNull();
  });

  it("enforces the composite owner/category foreign key", () => {
    const category = readOverview(secondOwner).domains[0]?.subcategories[0];
    if (!category) throw new Error("Missing seed");
    expect(() =>
      db
        .prepare(
          `INSERT INTO mails
      (id,owner_id,seed_key,subcategory_id,sender,subject,body_text,received_at,requires_reply)
      VALUES (?,?,?,?,?,?,?,?,0)`,
        )
        .run(
          randomUUID(),
          owner,
          "invalid-parent",
          category.id,
          "sender",
          "subject",
          "body",
          new Date().toISOString(),
        ),
    ).toThrow(/FOREIGN KEY/);
  });
});

describe("reply persistence constraints", () => {
  it("enforces reply owner/mail keys and orders simultaneous replies by id", () => {
    const category = readOverview(secondOwner).domains[0]!.subcategories[0]!;
    const input = {
      domainId: "core-projects" as const,
      subcategoryId: category.id,
    };
    const mail = readMailList(secondOwner, { ...input, view: "active" })[0]!;
    const insert = db.prepare(
      "INSERT INTO mail_replies (id,owner_id,mail_id,body_text,created_at) VALUES (?,?,?,?,?)",
    );
    expect(() =>
      insert.run(
        randomUUID(),
        owner,
        mail.id,
        "wrong owner",
        "2026-01-01T00:00:00.000Z",
      ),
    ).toThrow(/FOREIGN KEY/);
    const ids = [
      "90000000-0000-4000-8000-000000000002",
      "90000000-0000-4000-8000-000000000001",
    ];
    for (const id of ids)
      insert.run(id, secondOwner, mail.id, id, "2026-01-01T00:00:00.000Z");
    expect(
      readMail(secondOwner, { ...input, mailId: mail.id }).replies.map(
        (reply) => reply.id,
      ),
    ).toEqual([...ids].reverse());
    expect(
      readMail(secondOwner, { ...input, mailId: mail.id }).hasPendingReply,
    ).toBe(false);
  });
});
