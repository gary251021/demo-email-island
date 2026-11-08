import { z } from "zod";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { spawn } from "node:child_process";
import type { Page } from "@playwright/test";
import { mailListSchema, mailDetailSchema } from "../../lib/mailbox";
import { websiteTimeline } from "./timelineTemplates.server";
import {
  identity,
  overview,
  rpc,
  resultData,
  expect,
} from "./acceptance-fixtures";

const mailWriteResultSchema = mailDetailSchema.pick({ id: true });
type MailWriteResult = z.infer<typeof mailWriteResultSchema>;

export async function story(page: Page) {
  const owner = await identity(page);
  const domain = (await overview(page)).domains.find(
    (d) => d.id === "finance-bills",
  );
  const category = domain?.subcategories.find((c) => c.name === "待處理帳單");
  if (!category) throw new Error("Missing story category");
  return {
    ownerKey: owner.ownerKey,
    domainId: "finance-bills" as const,
    subcategoryId: category.id,
  };
}
export type Story = Awaited<ReturnType<typeof story>>;
export async function list(page: Page, input: Story) {
  return mailListSchema.parse(
    resultData(
      await rpc(page, "listMail", {
        domainId: input.domainId,
        subcategoryId: input.subcategoryId,
      }),
    ),
  );
}
export async function openStory(page: Page) {
  await page.getByRole("button", { name: /^財務帳單，/ }).click();
  await page.getByRole("button", { name: /^待處理帳單，/ }).click();
  await expect(
    page.getByRole("dialog", { name: "待處理帳單郵件" }),
  ).toBeVisible();
}
export function configureStory(dbPath: string, input: Story, unread: number) {
  const db = new DatabaseSync(dbPath);
  try {
    db.prepare("DELETE FROM mails WHERE owner_id=? AND subcategory_id=?").run(
      input.ownerKey,
      input.subcategoryId,
    );
    for (const [index, mail] of websiteTimeline.sourceMails.entries()) {
      db.prepare(
        `INSERT INTO mails (id,owner_id,seed_key,subcategory_id,sender,subject,body_text,received_at,read_at)
        VALUES (?,?,?,?,?,?,?,?,?)`,
      ).run(
        randomUUID(),
        input.ownerKey,
        mail.seedKey,
        input.subcategoryId,
        mail.sender,
        mail.subject,
        mail.bodyText,
        mail.receivedAt,
        index < 30 - unread ? mail.receivedAt : null,
      );
    }
  } finally {
    db.close();
  }
}
export function sourceMail(dbPath: string, input: Story, id?: string) {
  const db = new DatabaseSync(dbPath);
  try {
    const row = db
      .prepare(
        `SELECT id,seed_key AS seedKey,sender,subject,body_text AS bodyText,
      received_at AS receivedAt,read_at AS readAt FROM mails WHERE owner_id=? AND subcategory_id=?
      ${id ? "AND id=?" : ""} ORDER BY received_at DESC LIMIT 1`,
      )
      .get(
        ...(id
          ? [input.ownerKey, input.subcategoryId, id]
          : [input.ownerKey, input.subcategoryId]),
      );
    if (!row) throw new Error("Missing source");
    return mailDetailSchema
      .pick({
        id: true,
        sender: true,
        subject: true,
        bodyText: true,
        receivedAt: true,
        readAt: true,
      })
      .extend({ seedKey: z.string() })
      .parse(row);
  } finally {
    db.close();
  }
}

// Invoke the real server-only persistence service, also used by product seeding.
// This process uses Vite's normal TS/raw-SQL loading, without a product test route.
export async function writeMail(
  dbPath: string,
  ownerKey: string,
  input: Record<string, unknown>,
) {
  const script = `import {createServer} from 'vite';
    const server=await createServer({configFile:false,logLevel:'error',cacheDir:${JSON.stringify(dbPath + "-write-cache")},server:{middlewareMode:true},appType:'custom'});
    try {const mod=await server.ssrLoadModule('/src/features/mailbox/mailbox.server.ts');
      const result=mod.writeMailboxMail(${JSON.stringify(ownerKey)},${JSON.stringify(input)});
      process.stdout.write(JSON.stringify(result));
    } finally {await server.close();}`;
  return new Promise<MailWriteResult>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--input-type=module", "-e", script],
      {
        cwd: process.cwd(),
        env: { ...process.env, EMAIL_ISLAND_DB_PATH: dbPath },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "";
    let errors = "";
    child.stdout.on("data", (data: Buffer) => {
      output += data.toString();
    });
    child.stderr.on("data", (data: Buffer) => {
      errors += data.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(errors));
        return;
      }
      try {
        const decoded: unknown = JSON.parse(output);
        resolve(mailWriteResultSchema.parse(decoded));
      } catch {
        reject(new Error(output + errors));
      }
    });
  });
}

export function configureLegacyMailbox(dbPath: string, input: Story) {
  const db = new DatabaseSync(dbPath);
  try {
    db.prepare("DELETE FROM mails WHERE owner_id=? AND subcategory_id=?").run(
      input.ownerKey,
      input.subcategoryId,
    );
    for (let index = 0; index < 11; index++) {
      db.prepare(
        `INSERT INTO mails (id,owner_id,seed_key,subcategory_id,sender,subject,body_text,received_at,read_at)
        VALUES (?,?,?,?,?,?,?,?,?)`,
      ).run(
        randomUUID(),
        input.ownerKey,
        `legacy-bills-${index}`,
        input.subcategoryId,
        "帳務團隊 <billing@example.com>",
        index === 0 ? "上月服務費帳單" : `本月服務費帳單 · ${index}`,
        "舊版本正文：請核對帳單金額與付款日期。",
        "2026-10-01T12:00:00.000Z",
        index === 0 ? "2026-10-02T12:00:00.000Z" : null,
      );
    }
    db.prepare("UPDATE mailboxes SET seed_version=0 WHERE owner_id=?").run(
      input.ownerKey,
    );
  } finally {
    db.close();
  }
}
