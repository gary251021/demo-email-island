import { tmpdir } from "node:os";
import { queueJobState } from "./classification.acceptance.server";
/* eslint-disable sonarjs/publicly-writable-directories -- Isolated acceptance artifacts and Redis runtime live in the explicitly assigned temporary evidence directory. */
import {
  test,
  expect,
  rpc,
  resultData,
  identity,
  overview,
  openQ4,
  subjectButton,
} from "../mailbox/acceptance-fixtures";
import type { App } from "../mailbox/acceptance-fixtures";
import type { Page } from "@playwright/test";
import { chromium } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { z } from "zod";

const provider = process.env.TYPESAFE_BASE_URL ?? "http://127.0.0.1:4302";
const redisPort = new URL(
  process.env.EMAIL_ISLAND_REDIS_URL ?? "redis://127.0.0.1:6402",
).port;
const redisData =
  process.env.EMAIL_ISLAND_REDIS_DATA ??
  resolve(tmpdir(), "email-island-test-redis");
const redisBinary = process.env.EMAIL_ISLAND_REDIS_BINARY ?? "redis-server";
function redis(running: boolean) {
  // eslint-disable-next-line sonarjs/no-selector-parameter -- Mirrors the service lifecycle fixture.
  if (running)
    execFileSync(redisBinary, [
      "--port",
      redisPort,
      "--bind",
      "127.0.0.1",
      "--appendonly",
      "yes",
      "--appendfsync",
      "everysec",
      "--maxmemory-policy",
      "noeviction",
      "--dir",
      redisData,
      "--daemonize",
      "yes",
      "--pidfile",
      resolve(redisData, "redis.pid"),
      "--logfile",
      resolve(redisData, "redis.log"),
    ]);
  else
    execFileSync(redisBinary.replace(/redis-server$/, "redis-cli"), [
      "-p",
      redisPort,
      "shutdown",
    ]);
}
const bridge = `import {getClassificationStatus,retryClassification,refreshClassification,setMailCategory,startClassifiedDemo} from '/src/features/classifier/classification.functions.ts';window.classifierRPC={getClassificationStatus,retryClassification,refreshClassification,setMailCategory,startClassifiedDemo};`;
async function classifier(page: Page, method: string, input: unknown = {}) {
  await page.addScriptTag({ type: "module", content: bridge });
  await page.waitForFunction(() =>
    Boolean(Reflect.get(window, "classifierRPC")),
  );
  return page.evaluate(
    async ({ method, input }) => {
      try {
        return {
          ok: true as const,
          data: await Reflect.get(window, "classifierRPC")[method]({
            data: input,
          }),
        };
      } catch (error) {
        return {
          ok: false as const,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
    { method, input },
  );
}
const mailSchema = z.object({
  id: z.string(),
  subject: z.string(),
  subcategory_id: z.string(),
  placement_revision: z.number(),
  read_at: z.string().nullable(),
});
function rows(app: App, owner: string) {
  const db = new DatabaseSync(app.dbPath);
  try {
    return mailSchema
      .array()
      .parse(
        db
          .prepare("SELECT * FROM mails WHERE owner_id=? ORDER BY rowid")
          .all(owner),
      );
  } finally {
    db.close();
  }
}
function records(app: App, sql: string) {
  const db = new DatabaseSync(app.dbPath);
  try {
    return db.prepare(sql).all();
  } finally {
    db.close();
  }
}
async function plans(value: unknown[]) {
  await fetch(provider + "/control", {
    method: "POST",
    body: JSON.stringify(value),
  });
}
async function release() {
  await fetch(provider + "/release");
}
const callsSchema = z.array(
  z.object({
    subject: z.string(),
    step: z.string(),
    requestId: z.number(),
    body: z.unknown(),
  }),
);
async function calls() {
  return callsSchema.parse(await (await fetch(provider + "/calls")).json());
}
async function prepare(page: Page, app: App, count = 10) {
  await page.goto(app.url);
  const auth = await page.request.post(
    app.url + "/api/auth/sign-in/anonymous",
    { data: {}, headers: { origin: app.url } },
  );
  expect(auth.ok()).toBe(true);
  resultData(await rpc(page, "startDemo"));
  const owner = (await identity(page)).ownerKey;
  app.sql(
    `DELETE FROM mails WHERE owner_id='${owner}' AND id NOT IN (SELECT id FROM mails WHERE owner_id='${owner}' ORDER BY rowid LIMIT ${count});`,
  );
  if (count >= 7)
    app.sql(
      `UPDATE mails SET subject='十一月訂閱精選' WHERE owner_id='${owner}' AND seed_key='letters-0';`,
    );
  return owner;
}
async function status(page: Page, value: string) {
  await expect(
    page.getByRole("status", { name: "郵件分類", exact: true }),
  ).toHaveText(value, { timeout: 20000 });
}
async function start(page: Page, _app: App) {
  await page.getByRole("button", { name: "進入群島", exact: true }).click();
  await expect(
    page.getByRole("main", { name: "郵件群島", exact: true }),
  ).toBeVisible();
}
async function correction(page: Page, categoryName = "每週同步") {
  await page.getByRole("button", { name: "修改分類", exact: true }).click();
  await page
    .getByLabel("分類", { exact: true })
    .selectOption({ label: categoryName });
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: categoryName + "郵件" }),
  ).toBeVisible();
}
function write(app: App, owner: string, input: unknown) {
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        resolve("node_modules/tsx/dist/cli.mjs"),
        "src/features/classifier/acceptance-write.server.ts",
        owner,
        JSON.stringify(input),
      ],
      {
        env: {
          ...process.env,
          EMAIL_ISLAND_DB_PATH: app.dbPath,
          EMAIL_ISLAND_REDIS_URL:
            process.env.EMAIL_ISLAND_REDIS_URL ?? "redis://127.0.0.1:6402",
        },
        encoding: "utf8",
        timeout: 15000,
      },
    ),
  );
}

async function openCategory(page: Page, domain: string, category: string) {
  const close = page.getByRole("button", { name: "關閉郵件", exact: true });
  if (await close.isVisible()) await close.click();
  const back = page.getByRole("button", { name: "返回群島", exact: true });
  if (await back.isVisible()) await back.click();
  await page
    .getByRole("button")
    .and(page.getByText(domain, { exact: true }))
    .click();
  await page
    .getByRole("button")
    .and(page.getByText(category, { exact: true }))
    .click();
  await expect(
    page.getByRole("dialog", { name: category + "郵件" }),
  ).toBeVisible();
}
async function releaseOne(
  subject: string,
  step = "domain",
  requestId?: number,
) {
  const response = await fetch(provider + "/release-one", {
    method: "POST",
    body: JSON.stringify({ subject, step, requestId }),
  });
  expect(response.ok).toBe(true);
}
async function waitHeld(subject: string, step = "domain") {
  await expect
    .poll(async () => {
      const held = await (await fetch(provider + "/held")).json();
      return held.some(
        (request: { subject: string; step: string }) =>
          request.subject === subject && request.step === step,
      );
    })
    .toBe(true);
}

test.beforeEach(async () => {
  await release();
  await fetch(provider + "/reset");
});

test("incoming-mail-global-status-and-placement", async ({ page, app }) => {
  const owner = await prepare(page, app);
  await plans([
    { subject: "請確認報價項目", step: "domain", hold: true },
    { subject: "十一月訂閱精選", step: "domain", hold: true },
  ]);
  await start(page, app);
  await status(page, "pending");
  await expect(page.locator(".building-anchor")).toHaveCount(8);
  await expect(
    page.locator(".scene-label-layer button.island-label"),
  ).toHaveCount(8);
  await openQ4(page);
  await subjectButton(page, "請確認報價項目").click();
  await expect(
    page.getByRole("article", { name: "請確認報價項目" }),
  ).toBeVisible();
  await expect(page.getByRole("status", { name: "郵件分類" })).toHaveCount(1);
  await expect(page.getByText("待確認", { exact: false })).toHaveCount(0);
  await expect(
    page.locator('.mail-reader [aria-label="郵件分類"]'),
  ).toHaveCount(0);
  await release();
  await status(page, "completed");
  await page.getByRole("button", { name: "關閉郵件", exact: true }).click();
  await page.getByRole("button", { name: "返回群島", exact: true }).click();
  await expect(page.locator(".building-anchor")).toHaveCount(8);
  await expect(
    page.locator(".scene-label-layer button.island-label"),
  ).toHaveCount(8);
  const data = await overview(page);
  expect(data.domains).toHaveLength(8);
  const mails = rows(app, owner);
  expect(
    mails.find((mail) => mail.subject === "請確認報價項目")?.subcategory_id,
  ).toBe(
    data.domains[0]!.subcategories.find(
      (category) => category.name === "Q4 報價",
    )!.id,
  );
  expect(
    mails.find((mail) => mail.subject === "十一月訂閱精選")?.subcategory_id,
  ).toBe(
    data.domains.find((domain) => domain.id === "newsletters")!
      .subcategories[0]!.id,
  );
});

test("low-confidence-valid-choice-completes", async ({ page, app }) => {
  const owner = await prepare(page, app, 2);
  await plans([
    { subject: "請確認報價項目", step: "subcategory", confidence: 0.2 },
  ]);
  await start(page, app);
  await status(page, "completed");
  await openQ4(page);
  await expect(subjectButton(page, "請確認報價項目")).toBeVisible();
  expect(
    records(
      app,
      `SELECT subcategory_answer FROM classification_results WHERE owner_id='${owner}' AND mail_id='${rows(app, owner)[0]!.id}'`,
    )[0]?.subcategory_answer,
  ).toContain('"confidence":0.2');
  await expect(subjectButton(page, "請確認報價項目 · 2")).toBeVisible();
  expect(
    records(
      app,
      `SELECT outcome FROM classification_work WHERE owner_id='${owner}' AND outcome='succeeded'`,
    ),
  ).toHaveLength(2);
  expect(rows(app, owner).map((mail) => mail.subcategory_id)).toEqual([
    rows(app, owner)[0]!.subcategory_id,
    rows(app, owner)[0]!.subcategory_id,
  ]);
  await expect(page.getByText("待確認")).toHaveCount(0);
  await expect(page.getByRole("status", { name: "郵件分類" })).toHaveText(
    "completed",
  );
  await expect(
    page.getByRole("button", { name: "重試", exact: true }),
  ).toHaveCount(0);
});

test("partial-failure-retry-failed-only", async ({ page, app }) => {
  const owner = await prepare(page, app);
  const before = rows(app, owner);
  await plans([
    { subject: before[0]!.subject, step: "domain", fail: true },
    { subject: before[1]!.subject, step: "subcategory", fail: true },
  ]);
  await start(page, app);
  await status(page, "complete with error");
  expect(
    records(
      app,
      `SELECT outcome FROM classification_work WHERE owner_id='${owner}' AND outcome='succeeded'`,
    ),
  ).toHaveLength(8);
  await openQ4(page);
  await subjectButton(page, "請確認報價項目").click();
  await expect(page.getByRole("article")).toBeVisible();
  expect(
    rows(app, owner)
      .slice(0, 2)
      .map((mail) => mail.subcategory_id),
  ).toEqual(before.slice(0, 2).map((mail) => mail.subcategory_id));
  await page.getByRole("button", { name: "返回列表", exact: false }).click();
  await subjectButton(page, before[1]!.subject).click();
  await expect(
    page.getByRole("article", { name: before[1]!.subject, exact: true }),
  ).toBeVisible();
  const firstCalls = await calls();
  const locations = rows(app, owner).slice(2);
  await plans([{ subject: before[0]!.subject, step: "domain", hold: true }]);
  await page.getByRole("button", { name: "重試", exact: true }).click();
  await status(page, "pending");
  await release();
  await status(page, "completed");
  expect(
    rows(app, owner)
      .slice(2)
      .map((mail) => [mail.id, mail.subcategory_id]),
  ).toEqual(locations.map((mail) => [mail.id, mail.subcategory_id]));
  const retryCalls = (await calls()).slice(firstCalls.length);
  const q4Category = (await overview(page)).domains
    .find((domain) => domain.id === "core-projects")!
    .subcategories.find((category) => category.name === "Q4 報價")!;
  expect(
    rows(app, owner)
      .slice(0, 2)
      .map((mail) => mail.subcategory_id),
  ).toEqual([q4Category.id, q4Category.id]);
  await openCategory(page, "核心專案", "Q4 報價");
  for (const mail of before.slice(0, 2))
    await expect(subjectButton(page, mail.subject)).toBeVisible();
  expect(retryCalls).toHaveLength(3);
  expect(
    retryCalls
      .filter((call) => call.subject === before[1]!.subject)
      .map((call) => call.step),
  ).toEqual(["subcategory"]);
});

test("persisted-results-no-rerun-on-read-or-reopen", async ({
  page,
  app,
  browser,
}) => {
  const owner = await prepare(page, app, 2);
  await start(page, app);
  await status(page, "completed");
  const before = rows(app, owner);
  const count = (await calls()).length;
  await openQ4(page);
  await subjectButton(page, "請確認報價項目").click();
  await expect(page.getByText("已讀", { exact: true })).toBeVisible();
  await page.reload();
  await status(page, "completed");
  const state = await page.context().storageState();
  const fresh = await chromium.launch({
    args: ["--enable-unsafe-swiftshader"],
  });
  const ctx = await fresh.newContext({ storageState: state });
  const reopened = await ctx.newPage();
  await reopened.goto(app.url + "/island");
  await status(reopened, "completed");
  await fresh.close();
  await page.goto("about:blank");
  await app.worker(false);
  redis(false);
  redis(true);
  await app.restart();
  await page.goto(app.url + "/island");
  await status(page, "completed");
  expect(
    rows(app, owner).map((mail) => [mail.id, mail.subcategory_id]),
  ).toEqual(before.map((mail) => [mail.id, mail.subcategory_id]));
  expect(rows(app, owner)[0]?.read_at).not.toBeNull();
  expect(await calls()).toHaveLength(count);
  expect(browser.isConnected()).toBe(true);
});

test("manual-correction-wins-inflight-result", async ({ page, app }) => {
  const owner = await prepare(page, app, 6);
  await start(page, app);
  await status(page, "completed");
  const beforeRead = await overview(page);
  expect(beforeRead.domains[0]!.unreadCount).toBe(4);
  expect(
    beforeRead.domains.find((domain) => domain.id === "internal-team")!
      .unreadCount,
  ).toBe(2);
  app.sql(
    `UPDATE classification_work SET rule_version='old' WHERE owner_id='${owner}';`,
  );
  await plans([{ subject: "請確認報價項目", step: "domain", hold: true }]);
  await page.getByRole("button", { name: "更新分類" }).click();
  await status(page, "pending");
  await openQ4(page);
  await subjectButton(page, "請確認報價項目").click();
  await expect(page.getByText("已讀", { exact: true })).toBeVisible();
  await expect
    .poll(async () => (await overview(page)).domains[0]!.unreadCount)
    .toBe(3);
  await correction(page);
  await release();
  await page.reload();
  await status(page, "completed");
  const data = await overview(page);
  const team = data.domains.find((domain) => domain.id === "internal-team")!;
  expect(rows(app, owner)[0]?.subcategory_id).toBe(team.subcategories[0]!.id);
  expect(team.unreadCount).toBe(2);
  expect(data.domains[0]!.unreadCount).toBe(3);
  expect(
    data.domains[0]!.subcategories.find(
      (category) => category.name === "Q4 報價",
    )!.unreadCount,
  ).toBe(2);
  await openCategory(page, "核心專案", "Q4 報價");
  await expect(subjectButton(page, "請確認報價項目")).toHaveCount(0);
  await expect(subjectButton(page, "請確認報價項目 · 2")).toBeVisible();
  await expect(page.getByLabel("Q4 報價未讀 2", { exact: true })).toHaveText(
    "未讀 2",
  );
  await openCategory(page, "團隊溝通", "每週同步");
  await expect(subjectButton(page, "請確認報價項目")).toBeVisible();
  await expect(subjectButton(page, "本週團隊工作摘要")).toBeVisible();
  await expect(page.getByLabel("每週同步未讀 2", { exact: true })).toHaveText(
    "未讀 2",
  );
  await expect(page.getByText("待確認")).toHaveCount(0);
});

test("refresh-only-stale-automatic-results", async ({ page, app }) => {
  const owner = await prepare(page, app, 3);
  await start(page, app);
  await status(page, "completed");
  const mails = rows(app, owner);
  const team = (await overview(page)).domains.find(
    (domain) => domain.id === "internal-team",
  )!.subcategories[0]!.id;
  resultData(
    await classifier(page, "setMailCategory", {
      mailId: mails[0]!.id,
      subcategoryId: team,
    }),
  );
  app.sql(
    `UPDATE classification_work SET rule_version='2' WHERE mail_id='${mails[2]!.id}';`,
  );
  const beforeRestart = rows(app, owner).map((mail) => [
    mail.id,
    mail.subcategory_id,
  ]);
  const beforeRestartCalls = (await calls()).length;
  app.ruleVersion("2");
  await page.goto("about:blank");
  await app.restart();
  await page.goto(app.url + "/island");
  await status(page, "completed");
  const count = (await calls()).length;
  expect(
    rows(app, owner).map((mail) => [mail.id, mail.subcategory_id]),
  ).toEqual(beforeRestart);
  expect(count).toBe(beforeRestartCalls);
  expect(rows(app, owner)[1]?.subcategory_id).toBe(mails[1]!.subcategory_id);
  await plans([
    {
      subject: mails[1]!.subject,
      step: "domain",
      hold: true,
      choice: "internal-team",
    },
  ]);
  await page.getByRole("button", { name: "更新分類" }).click();
  await status(page, "pending");
  await release();
  await status(page, "completed");
  expect(rows(app, owner).map((mail) => mail.subcategory_id)).toEqual([
    team,
    team,
    mails[2]!.subcategory_id,
  ]);
  expect((await calls()).slice(count).map((call) => call.subject)).toEqual([
    mails[1]!.subject,
    mails[1]!.subject,
  ]);
});

test("incoming-and-changed-content-invalidation", async ({ page, app }) => {
  const owner = await prepare(page, app, 2);
  await start(page, app);
  await status(page, "completed");
  const original = rows(app, owner);
  const category = original[0]!.subcategory_id;
  await plans([
    { subject: "新團隊郵件", step: "domain", hold: true },
    { subject: "修改團隊內容", step: "domain", hold: true },
  ]);
  const input = {
    key: "imported",
    subcategoryId: category,
    sender: "test@example.com",
    subject: "新團隊郵件",
    bodyText: "團隊同步",
    receivedAt: "2026-11-01T00:00:00.000Z",
  };
  const added = write(app, owner, input);
  write(app, owner, { ...input, key: "q4-0", subject: "修改團隊內容" });
  await status(page, "pending");
  await release();
  await status(page, "completed");
  const team = (await overview(page)).domains.find(
    (domain) => domain.id === "internal-team",
  )!.subcategories[0]!.id;
  expect(
    rows(app, owner).find((mail) => mail.id === added.mailId)?.subcategory_id,
  ).toBe(team);
  expect(rows(app, owner)[0]?.subcategory_id).toBe(team);
  expect(rows(app, owner)[1]?.subcategory_id).toBe(original[1]!.subcategory_id);
  await openCategory(page, "團隊溝通", "每週同步");
  await expect(subjectButton(page, "新團隊郵件")).toBeVisible();
  await expect(subjectButton(page, "修改團隊內容")).toBeVisible();
  await openCategory(page, "核心專案", "Q4 報價");
  await expect(subjectButton(page, original[1]!.subject)).toBeVisible();
  await expect(subjectButton(page, "修改團隊內容")).toHaveCount(0);
  await expect(subjectButton(page, "新團隊郵件")).toHaveCount(0);
  const count = (await calls()).length;
  expect(write(app, owner, input).changed).toBe(false);
  await expect.poll(async () => (await calls()).length).toBe(count);
  expect(rows(app, owner)).toHaveLength(3);
  await status(page, "completed");
});

test("owner-scoped-status-and-correction-requests", async ({
  page,
  app,
  browser,
}) => {
  const a = await prepare(page, app, 1);
  await start(page, app);
  await status(page, "completed");
  const ctx = await browser.newContext();
  const bPage = await ctx.newPage();
  const b = await prepare(bPage, app, 1);
  await plans([{ subject: "請確認報價項目", step: "domain", fail: true }]);
  await start(bPage, app);
  await status(bPage, "complete with error");
  const am = rows(app, a)[0]!;
  const bm = rows(app, b)[0]!;
  const bc = (await overview(bPage)).domains.find(
    (domain) => domain.id === "internal-team",
  )!.subcategories[0]!.id;
  resultData(await classifier(page, "retryClassification"));
  await status(page, "completed");
  await status(bPage, "complete with error");
  for (const input of [
    { mailId: bm.id, subcategoryId: am.subcategory_id },
    { mailId: am.id, subcategoryId: bc },
    { mailId: bm.id, subcategoryId: bc },
  ]) {
    const response = await classifier(page, "setMailCategory", input);
    expect(response).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(JSON.stringify(response)).not.toContain(bm.subject);
  }
  expect(
    (
      await classifier(page, "setMailCategory", {
        mailId: am.id,
        subcategoryId: am.subcategory_id,
        ownerId: b,
      })
    ).ok,
  ).toBe(false);
  expect(
    (await classifier(page, "getClassificationStatus", { ownerId: b })).ok,
  ).toBe(false);
  const anon = await browser.newContext();
  const anonymous = await anon.newPage();
  await anonymous.goto(app.url);
  expect(await classifier(anonymous, "getClassificationStatus")).toEqual({
    ok: false,
    error: "UNAUTHENTICATED",
  });
  expect(
    await classifier(anonymous, "setMailCategory", {
      mailId: bm.id,
      subcategoryId: bc,
    }),
  ).toEqual({ ok: false, error: "UNAUTHENTICATED" });
  expect(rows(app, b)[0]?.subcategory_id).toBe(bm.subcategory_id);
  await ctx.close();
  await anon.close();
});

test("concurrent-retry-and-worker-recovery", async ({ page, app }) => {
  const owner = await prepare(page, app, 2);
  await plans([{ subject: "請確認報價項目", step: "domain", fail: true }]);
  await start(page, app);
  await status(page, "complete with error");
  const successful = rows(app, owner)[1]!;
  const other = await page.context().newPage();
  await other.goto(app.url + "/island");
  await plans([{ subject: "請確認報價項目", step: "domain", hold: true }]);
  await Promise.all([
    classifier(page, "retryClassification"),
    classifier(other, "retryClassification"),
  ]);
  await status(page, "pending");
  await status(other, "pending");
  await expect
    .poll(
      async () =>
        (await calls()).filter((call) => call.subject === "請確認報價項目")
          .length,
    )
    .toBe(2);
  await app.worker(false);
  await release();
  await app.worker(true);
  await status(page, "completed");
  await status(other, "completed");
  expect(rows(app, owner)).toHaveLength(2);
  expect(rows(app, owner)[1]?.subcategory_id).toBe(successful.subcategory_id);
  expect(rows(app, owner)[0]?.subcategory_id).toBe(successful.subcategory_id);
  for (const currentPage of [page, other]) {
    await openCategory(currentPage, "核心專案", "Q4 報價");
    await expect(subjectButton(currentPage, "請確認報價項目")).toHaveCount(1);
    await expect(
      subjectButton(currentPage, "請確認報價項目 · 2"),
    ).toBeVisible();
    await status(currentPage, "completed");
  }
  expect(
    records(
      app,
      `SELECT dispatch_generation FROM classification_work WHERE owner_id='${owner}' AND mail_id='${rows(app, owner)[0]!.id}'`,
    )[0]?.dispatch_generation,
  ).toBe(1);
});

test("dispatch-failure-remains-visible-and-retries", async ({ page, app }) => {
  const owner = await prepare(page, app, 1);
  await start(page, app);
  await status(page, "completed");
  await app.worker(false);
  redis(false);
  try {
    write(app, owner, {
      key: "offline",
      subcategoryId: rows(app, owner)[0]!.subcategory_id,
      sender: "test@example.com",
      subject: "離線團隊信",
      bodyText: "團隊",
      receivedAt: "2026-11-01T00:00:00.000Z",
    });
    await status(page, "complete with error");
    await openQ4(page);
    await subjectButton(page, "請確認報價項目").click();
    await expect(page.getByRole("article")).toBeVisible();
    expect(
      records(
        app,
        `SELECT outcome FROM classification_work WHERE owner_id='${owner}' AND error_code='QUEUE_DISPATCH_FAILED'`,
      ),
    ).toHaveLength(1);
  } finally {
    redis(true);
    await app.worker(true);
  }
  await plans([{ subject: "離線團隊信", step: "domain", hold: true }]);
  await page.getByRole("button", { name: "重試", exact: true }).click();
  await status(page, "pending");
  await release();
  await status(page, "completed");
  expect(
    rows(app, owner).find((mail) => mail.subject === "離線團隊信")
      ?.subcategory_id,
  ).toBe(
    (await overview(page)).domains.find(
      (domain) => domain.id === "internal-team",
    )!.subcategories[0]!.id,
  );
});

test("manual-correction-resolves-failed-work", async ({ page, app }) => {
  const owner = await prepare(page, app, 1);
  await plans([{ subject: "請確認報價項目", step: "domain", fail: true }]);
  await start(page, app);
  await status(page, "complete with error");
  await openQ4(page);
  await subjectButton(page, "請確認報價項目").click();
  await correction(page);
  await status(page, "completed");
  const count = (await calls()).length;
  const location = rows(app, owner)[0]?.subcategory_id;
  resultData(await classifier(page, "retryClassification"));
  await status(page, "completed");
  expect(rows(app, owner)[0]?.subcategory_id).toBe(location);
  expect(await calls()).toHaveLength(count);
  expect(
    records(
      app,
      `SELECT outcome,resolved FROM classification_work WHERE owner_id='${owner}'`,
    ),
  ).toEqual([{ outcome: "failed", resolved: 1 }]);
  expect(
    records(
      app,
      `SELECT * FROM classification_results WHERE owner_id='${owner}'`,
    ),
  ).toHaveLength(0);
});

test("stale-result-rejected-and-empty-mailbox-completed", async ({
  page,
  app,
  browser,
}) => {
  const owner = await prepare(page, app, 1);
  await plans([
    {
      subject: "請確認報價項目",
      step: "domain",
      hold: true,
      choice: "low-priority",
    },
  ]);
  await start(page, app);
  await status(page, "pending");
  await expect.poll(async () => (await calls()).length).toBe(1);
  await plans([{ subject: "新內容團隊", step: "domain", hold: true }]);
  write(app, owner, {
    key: "q4-0",
    subcategoryId: rows(app, owner)[0]!.subcategory_id,
    sender: "test@example.com",
    subject: "新內容團隊",
    bodyText: "團隊內容",
    receivedAt: "2026-11-01T00:00:00.000Z",
  });
  await waitHeld("新內容團隊");
  const initialPlacement = rows(app, owner)[0]!.subcategory_id;
  const initialRevision = rows(app, owner)[0]!.placement_revision;
  const oldWorkId = String(
    records(
      app,
      `SELECT work_id FROM classification_work WHERE owner_id='${owner}' ORDER BY rowid`,
    )[0]!.work_id,
  );
  await releaseOne("請確認報價項目");
  await expect
    .poll(() => queueJobState(app.dbPath, oldWorkId, 0))
    .toBe("completed");
  await expect
    .poll(
      () =>
        records(
          app,
          `SELECT outcome FROM classification_work WHERE owner_id='${owner}' ORDER BY rowid`,
        )[0]?.outcome,
    )
    .toBe("superseded");
  await waitHeld("新內容團隊");
  await status(page, "pending");
  expect(rows(app, owner)[0]!.subcategory_id).toBe(initialPlacement);
  expect(rows(app, owner)[0]!.placement_revision).toBe(initialRevision);
  expect(
    (await calls()).filter((call) => call.subject === "請確認報價項目"),
  ).toHaveLength(1);
  await releaseOne("新內容團隊");
  await status(page, "completed");
  const team = (await overview(page)).domains.find(
    (domain) => domain.id === "internal-team",
  )!.subcategories[0]!.id;
  expect(rows(app, owner)[0]?.subcategory_id).toBe(team);
  expect(
    (await calls()).filter((call) => call.subject === "請確認報價項目"),
  ).toHaveLength(1);
  const ctx = await browser.newContext();
  const empty = await ctx.newPage();
  await prepare(empty, app, 0);
  await start(empty, app);
  await status(empty, "completed");
  await expect(
    empty.getByRole("button", { name: "重試", exact: true }),
  ).toHaveCount(0);
  expect((await overview(empty)).domains).toHaveLength(8);
  await expect(empty.getByText("待確認", { exact: false })).toHaveCount(0);
  await expect(empty.locator(".building-anchor")).toHaveCount(8);
  await expect(
    empty.locator(".scene-label-layer button.island-label"),
  ).toHaveCount(8);
  await expect(empty.getByRole("status", { name: "郵件分類" })).toHaveCount(1);
  await ctx.close();
});

for (const successfulA of [false, true]) {
  test(`content-return-restores-${successfulA ? "successful-cache" : "superseded-inflight"}`, async ({
    page,
    app,
  }) => {
    const owner = await prepare(page, app, 1);
    const first = rows(app, owner)[0]!;
    const content = records(
      app,
      `SELECT sender,body_text,received_at FROM mails WHERE id='${first.id}'`,
    )[0]!;
    const original = {
      key: "q4-0",
      subcategoryId: first.subcategory_id,
      sender: String(content.sender),
      subject: first.subject,
      bodyText: String(content.body_text),
      receivedAt: String(content.received_at),
    };
    if (!successfulA)
      await plans([
        {
          subject: first.subject,
          step: "domain",
          hold: true,
          choice: "low-priority",
        },
      ]);
    await start(page, app);
    if (successfulA) await status(page, "completed");
    else {
      await status(page, "pending");
      await waitHeld(first.subject);
    }
    const oldRequest = successfulA ? undefined : (await calls())[0]!.requestId;
    write(app, owner, {
      ...original,
      subject: "團隊內容 B",
      bodyText: "團隊同步 B",
    });
    await status(page, "completed");
    const team = (await overview(page)).domains.find(
      (domain) => domain.id === "internal-team",
    )!.subcategories[0]!.id;
    expect(rows(app, owner)[0]!.subcategory_id).toBe(team);
    await openCategory(page, "團隊溝通", "每週同步");
    await expect(subjectButton(page, "團隊內容 B")).toBeVisible();
    const beforeReturn = (await calls()).length;
    if (!successfulA)
      await plans([{ subject: first.subject, step: "domain", hold: true }]);
    write(app, owner, original);
    if (!successfulA) {
      await waitHeld(first.subject);
      await expect
        .poll(
          async () =>
            (await calls()).filter((call) => call.subject === first.subject)
              .length,
        )
        .toBe(2);
      const oldWorkId = String(
        records(
          app,
          `SELECT work_id FROM classification_work WHERE owner_id='${owner}' ORDER BY rowid`,
        )[0]!.work_id,
      );
      await releaseOne(first.subject, "domain", oldRequest);
      await expect
        .poll(() => queueJobState(app.dbPath, oldWorkId, 0))
        .toBe("completed");
      await status(page, "pending");
      expect(rows(app, owner)[0]!.subcategory_id).toBe(team);
      await releaseOne(first.subject);
    }
    await status(page, "completed");
    expect(rows(app, owner)[0]!.subcategory_id).toBe(first.subcategory_id);
    await openCategory(page, "核心專案", "Q4 報價");
    await expect(subjectButton(page, first.subject)).toHaveCount(1);
    await openCategory(page, "團隊溝通", "每週同步");
    await expect(subjectButton(page, first.subject)).toHaveCount(0);
    expect(rows(app, owner)).toHaveLength(1);
    expect((await calls()).length - beforeReturn).toBe(successfulA ? 0 : 2);
    const generation = records(
      app,
      `SELECT dispatch_generation FROM classification_work WHERE owner_id='${owner}' ORDER BY rowid`,
    )[0]!.dispatch_generation;
    expect(generation).toBe(1);
    const count = (await calls()).length;
    expect(write(app, owner, original).changed).toBe(false);
    resultData(await classifier(page, "startClassifiedDemo"));
    await status(page, "completed");
    expect(await calls()).toHaveLength(count);
    expect(
      records(
        app,
        `SELECT dispatch_generation FROM classification_work WHERE owner_id='${owner}' ORDER BY rowid`,
      )[0]!.dispatch_generation,
    ).toBe(generation);
  });
}
