import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  test,
  expect,
  rpc,
  resultData,
  identity,
  overview,
  subjectButton,
} from "../mailbox/acceptance-fixtures";
import { mailDetailSchema } from "../../lib/mailbox";
import { queueJobState } from "./classification.acceptance.server";

const provider = process.env.TYPESAFE_BASE_URL ?? "http://127.0.0.1:4305";
test("imported pending reply survives read archive manual classification and a late provider response", async ({
  page,
  app,
}) => {
  await fetch(provider + "/release");
  await fetch(provider + "/reset");
  await page.goto(app.url);
  expect(
    (
      await page.request.post(app.url + "/api/auth/sign-in/anonymous", {
        data: {},
        headers: { origin: app.url },
      })
    ).ok(),
  ).toBe(true);
  resultData(await rpc(page, "startDemo"));
  const owner = (await identity(page)).ownerKey;
  const data = await overview(page);
  const category = data.domains[0]!.subcategories[0]!;
  const team = data.domains.find((domain) => domain.id === "internal-team")!
    .subcategories[0]!;
  app.sql(`DELETE FROM mails WHERE owner_id='${owner}' AND seed_key!='q4-0'`);
  await page.goto(
    `${app.url}/island?domain=core-projects&subcategory=${category.id}`,
  );
  await expect(
    page.getByRole("button", { name: "已封存", exact: true }),
  ).toBeVisible();
  const input = {
    key: "q4-0",
    subcategoryId: category.id,
    sender: "integration@example.com",
    subject: "跨票待回覆信",
    bodyText: "需要確認的原始內容",
    receivedAt: "2026-11-01T00:00:00.000Z",
    requiresReply: true,
  };
  await fetch(provider + "/control", {
    method: "POST",
    body: JSON.stringify([
      {
        subject: input.subject,
        step: "domain",
        hold: true,
        choice: "low-priority",
      },
    ]),
  });
  const imported = JSON.parse(
    execFileSync(
      process.execPath,
      [
        resolve("node_modules/tsx/dist/cli.mjs"),
        "src/features/classifier/acceptance-write.server.ts",
        owner,
        JSON.stringify(input),
      ],
      {
        env: { ...process.env, EMAIL_ISLAND_DB_PATH: app.dbPath },
        encoding: "utf8",
      },
    ),
  ) as { mailId: string };
  const target = {
    domainId: "core-projects",
    subcategoryId: category.id,
    mailId: imported.mailId,
  };
  const db = new DatabaseSync(app.dbPath);
  try {
    await expect
      .poll(async () =>
        (await (await fetch(provider + "/held")).json()).some(
          (request: { subject: string }) => request.subject === input.subject,
        ),
      )
      .toBe(true);
    const originalWork = db
      .prepare(
        "SELECT * FROM classification_work WHERE owner_id=? AND mail_id=?",
      )
      .get(owner, imported.mailId)!;
    await page.goto(
      `${app.url}/island?domain=core-projects&subcategory=${category.id}&mail=${imported.mailId}`,
    );
    await expect(page.getByRole("article")).toContainText(input.bodyText);
    await expect(page.getByText("已讀", { exact: true })).toBeVisible();
    let detail = mailDetailSchema.parse(
      resultData(await rpc(page, "getMail", target)),
    );
    expect(detail.requiresReply).toBe(true);
    expect(detail.hasPendingReply).toBe(true);
    const readAt = detail.readAt;
    await page.getByRole("button", { name: "封存", exact: true }).click();
    await page.getByRole("button", { name: "已封存", exact: true }).click();
    await subjectButton(page, input.subject).click();
    detail = mailDetailSchema.parse(
      resultData(await rpc(page, "getMail", target)),
    );
    expect(detail.hasPendingReply).toBe(true);
    const archivedAt = detail.archivedAt;
    expect(archivedAt).not.toBeNull();
    await page.getByRole("button", { name: "修改分類", exact: true }).click();
    await page.getByLabel("分類", { exact: true }).selectOption(team.id);
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "每週同步郵件" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "已封存", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    const moved = {
      domainId: "internal-team",
      subcategoryId: team.id,
      mailId: imported.mailId,
    };
    await page
      .getByRole("textbox", { name: "回覆內容" })
      .fill("已保存的確認回覆");
    await page.getByRole("button", { name: "回覆", exact: true }).click();
    await expect(page.getByRole("region", { name: "回覆紀錄" })).toContainText(
      "已保存的確認回覆",
    );
    detail = mailDetailSchema.parse(
      resultData(await rpc(page, "getMail", moved)),
    );
    expect(detail).toMatchObject({
      requiresReply: true,
      hasPendingReply: false,
      readAt,
      archivedAt,
    });
    expect(detail.replies).toHaveLength(1);
    const manualWork = db
      .prepare("SELECT * FROM classification_work WHERE work_id=?")
      .get(String(originalWork.work_id))!;
    expect(manualWork).toMatchObject({
      outcome: "superseded",
      resolved: 1,
      dispatch_generation: originalWork.dispatch_generation,
      content_hash: originalWork.content_hash,
    });
    await fetch(provider + "/release");
    await expect
      .poll(() =>
        queueJobState(
          app.dbPath,
          String(originalWork.work_id),
          Number(originalWork.dispatch_generation),
        ),
      )
      .toBe("completed");
    const final = db
      .prepare("SELECT * FROM mails WHERE owner_id=? AND id=?")
      .get(owner, imported.mailId)!;
    expect(final).toMatchObject({
      subcategory_id: team.id,
      placement_revision: 1,
      requires_reply: 1,
      read_at: readAt,
      archived_at: archivedAt,
    });
    expect(
      db
        .prepare("SELECT * FROM classification_work WHERE work_id=?")
        .get(String(originalWork.work_id)),
    ).toEqual(manualWork);
    await page.getByRole("button", { name: "返回列表", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "已封存", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(subjectButton(page, input.subject)).toBeVisible();
    await page.getByRole("button", { name: "郵件", exact: true }).click();
    await expect(subjectButton(page, input.subject)).toHaveCount(0);
    expect(
      (await overview(page)).domains.every(
        (domain) => domain.unreadCount === 0 && domain.pendingReplyCount === 0,
      ),
    ).toBe(true);
  } finally {
    db.close();
    await fetch(provider + "/release");
  }
});
