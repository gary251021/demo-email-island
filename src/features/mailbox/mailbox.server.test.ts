// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { rmSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { db, databasePath } from "../../lib/db.server";
import {
  initializeMailbox,
  readOverview,
  readMailList,
  readMail,
  saveMailRead,
  writeMailboxMail,
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
    const mail = readMailList(owner, listInput).mails[0];
    if (!mail) throw new Error("Missing mail");
    const input = { ...listInput, mailId: mail.id };
    const saved = saveMailRead(owner, input);
    expect(saveMailRead(owner, input)).toEqual(saved);
    initializeMailbox(owner);
    expect(readMailList(owner, listInput).mails).toHaveLength(3);
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
    ).toBe(106);
  });

  it("rejects another owner's IDs and inconsistent parent combinations", () => {
    const category = readOverview(secondOwner).domains[0]?.subcategories[0];
    if (!category) throw new Error("Missing seed");
    const input = {
      domainId: "core-projects" as const,
      subcategoryId: category.id,
    };
    const mail = readMailList(secondOwner, input).mails[0];
    if (!mail) throw new Error("Missing mail");
    expect(() => readMailList(owner, input)).toThrow("NOT_FOUND");
    expect(() => readMail(owner, { ...input, mailId: mail.id })).toThrow(
      "NOT_FOUND",
    );
    expect(() => saveMailRead(owner, { ...input, mailId: mail.id })).toThrow(
      "NOT_FOUND",
    );
    expect(() =>
      readMailList(secondOwner, { ...input, domainId: "internal-team" }),
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
      (id,owner_id,seed_key,subcategory_id,sender,subject,body_text,received_at)
      VALUES (?,?,?,?,?,?,?,?)`,
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

describe("timeline list snapshot and canonical writes", () => {
  it("keeps category, list, count and summary in one snapshot across a concurrent writer", () => {
    const category = readOverview(owner).domains.find(
      (domain) => domain.id === "finance-bills",
    )?.subcategories[0];
    if (!category) throw new Error("Missing story");
    const input = {
      domainId: "finance-bills" as const,
      subcategoryId: category.id,
    };
    const before = readMailList(owner, input);
    expect(before.timeline).not.toBeNull();
    const writer = new DatabaseSync(databasePath);
    const prepare = db.prepare.bind(db);
    const spy = vi.spyOn(db, "prepare").mockImplementation((sql) => {
      const statement = prepare(sql);
      if (sql.startsWith("SELECT id FROM subcategories")) {
        const get = statement.get.bind(statement);
        vi.spyOn(statement, "get").mockImplementation((...params) => {
          const row = get(...params);
          writer
            .prepare(
              "UPDATE mails SET sender='Concurrent writer',read_at=NULL WHERE owner_id=? AND seed_key='website-story-1'",
            )
            .run(owner);
          return row;
        });
      }
      return statement;
    });
    try {
      expect(readMailList(owner, input)).toEqual(before);
    } finally {
      spy.mockRestore();
      writer.close();
    }
    const after = readMailList(owner, input);
    expect(after.unreadCount).toBe(11);
    expect(after.timeline).toBeNull();
    expect(
      after.mails.find((mail) => mail.subject === "需求確認 · 1")?.sender,
    ).toBe("Concurrent writer");
  });

  it("authorizes both current identity and destination at the real write boundary", () => {
    const category = readOverview(secondOwner).domains[0]?.subcategories[0];
    const destination = readOverview(owner).domains[0]?.subcategories[0];
    if (!category || !destination) throw new Error("Missing categories");
    const mail = readMailList(secondOwner, {
      domainId: "core-projects",
      subcategoryId: category.id,
    }).mails[0];
    if (!mail) throw new Error("Missing source");
    const input = {
      ...readMail(secondOwner, {
        domainId: "core-projects",
        subcategoryId: category.id,
        mailId: mail.id,
      }),
      domainId: "core-projects" as const,
      subcategoryId: destination.id,
      seedKey: "write-test",
    };
    expect(() => writeMailboxMail(owner, input)).toThrow("NOT_FOUND");
    expect(() => writeMailboxMail(secondOwner, input)).toThrow("NOT_FOUND");
    expect(() =>
      writeMailboxMail(owner, {
        ...input,
        id: undefined,
        domainId: "internal-team",
      }),
    ).toThrow("NOT_FOUND");
  });
});
