import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  test,
  expect,
  enter,
  rpc,
  resultData,
  subjectButton,
  overview,
} from "./acceptance-fixtures";
import {
  story,
  list,
  openStory,
  configureStory,
  configureLegacyMailbox,
  sourceMail,
  writeMail,
} from "./timeline-fixtures";
import { mailDetailSchema } from "../../lib/mailbox";

const expectedStages = [
  {
    title: "需求確認",
    summary:
      "確認首頁、常見問題及聯絡頁，支援手機閱讀與鍵盤操作。本次不包含付款或會員帳戶。",
    from: "2026-10-01T04:00:00.000Z",
    to: "2026-10-10T04:00:00.000Z",
  },
  {
    title: "方案修訂",
    summary:
      "首頁改用產品照片，聯絡頁電話欄位改為選填。修訂版已批准，其餘需求不變。",
    from: "2026-10-11T04:00:00.000Z",
    to: "2026-10-20T04:00:00.000Z",
  },
  {
    title: "交付確認",
    summary:
      "三頁網站通過手機與鍵盤檢查，交付檔案及操作說明已收到。網站已驗收，沒有待修項目。",
    from: "2026-10-21T04:00:00.000Z",
    to: "2026-10-30T04:00:00.000Z",
  },
];
const timeline = (page: import("@playwright/test").Page) =>
  page.getByRole("region", { name: "郵件時間軸" });
async function assertTimeline(page: import("@playwright/test").Page) {
  await expect(timeline(page)).toBeVisible();
  const stages = page
    .getByRole("list", { name: "三階段時間軸" })
    .getByRole("listitem");
  await expect(stages).toHaveCount(3);
  for (const [i, stage] of expectedStages.entries()) {
    await expect(stages.nth(i)).toContainText(stage.title);
    await expect(stages.nth(i)).toContainText(stage.summary);
    await expect(stages.nth(i).locator("time").first()).toHaveAttribute(
      "datetime",
      stage.from,
    );
    await expect(stages.nth(i).locator("time").last()).toHaveAttribute(
      "datetime",
      stage.to,
    );
  }
}

test("city-three-stages-full-scope", async ({ page, app }) => {
  await enter(page, app.url);
  const input = await story(page);
  const seeded = await list(page, input);
  expect(seeded.mails).toHaveLength(30);
  expect(seeded.unreadCount).toBe(10);
  // Configure only readAt for the AC-1 twelve-unread case, preserving seed content.
  app.sql(
    `UPDATE mails SET read_at=NULL WHERE owner_id='${input.ownerKey}' AND seed_key IN ('website-story-19','website-story-20')`,
  );
  await page.reload();
  await openStory(page);
  await assertTimeline(page);
  const data = await list(page, input);
  expect(data.unreadCount).toBe(12);
  expect(data.timeline?.stages).toEqual(expectedStages);
  expect(data.mails.filter((m) => m.readAt !== null)).toHaveLength(18);
  await subjectButton(page, "需求確認 · 10").click();
  await expect(page.getByRole("article")).toContainText(
    "需求正式確認：三頁網站",
  );
  await expect(timeline(page)).toHaveCount(0);
});

test("timeline-tier-boundaries", async ({ page, app }) => {
  await enter(page, app.url);
  const input = await story(page);
  for (const count of [0, 1, 2, 3, 9, 10, 29, 30]) {
    configureStory(app.dbPath, input, count);
    await page.goto(`${app.url}/island`);
    await expect(timeline(page)).toHaveCount(0);
    if (count === 10 || count === 29)
      await expect(
        page.getByRole("button", {
          name: `財務帳單，未讀 ${count} 封，待回覆 0 封，Lv. 3`,
          exact: true,
        }),
      ).toBeVisible();
    await openStory(page);
    await expect(
      page.getByRole("list", { name: "郵件列表" }).getByRole("listitem"),
    ).toHaveCount(30);
    if (count === 10 || count === 29) await assertTimeline(page);
    else await expect(timeline(page)).toHaveCount(0);
    expect((await list(page, input)).unreadCount).toBe(count);
  }
});

test("read-crosses-city-boundaries", async ({ page, app }) => {
  await enter(page, app.url);
  const input = await story(page);
  for (const count of [10, 11, 30]) {
    configureStory(app.dbPath, input, count);
    await page.goto(`${app.url}/island`);
    await openStory(page);
    if (count !== 30) await assertTimeline(page);
    await subjectButton(page, "交付確認 · 10").click();
    await expect(page.getByRole("article")).toContainText("沒有待修項目");
    await expect(timeline(page)).toHaveCount(0);
    await expect
      .poll(async () => (await list(page, input)).unreadCount)
      .toBe(count - 1);
    await page.getByRole("button", { name: "返回列表", exact: true }).click();
    if (count === 10) await expect(timeline(page)).toHaveCount(0);
    else await assertTimeline(page);
    await expect(subjectButton(page, "交付確認 · 10")).not.toContainText(
      "未讀",
    );
    await page.getByRole("button", { name: "關閉郵件", exact: true }).click();
    await expect(
      page.getByRole("button", {
        name: `待處理帳單，未讀 ${count - 1} 封，待回覆 0 封，Lv. ${count === 10 ? 2 : 3}`,
        exact: true,
      }),
    ).toBeFocused();
  }
});

test("navigation-and-reopen", async ({ page, app }) => {
  await enter(page, app.url);
  const input = await story(page);
  configureStory(app.dbPath, input, 12);
  await page.reload();
  await openStory(page);
  await assertTimeline(page);
  await subjectButton(page, "交付確認 · 10").click();
  await expect.poll(async () => (await list(page, input)).unreadCount).toBe(11);
  await page.getByRole("button", { name: "返回列表", exact: true }).click();
  await assertTimeline(page);
  await page.getByRole("button", { name: "關閉郵件", exact: true }).click();
  await page.getByRole("button", { name: "返回群島", exact: true }).click();
  await page.getByRole("button", { name: /^核心專案，/ }).click();
  await page.getByRole("button", { name: /^Q4 報價，/ }).click();
  await expect(timeline(page)).toHaveCount(0);
  await expect(page.getByRole("list", { name: "郵件列表" })).toBeVisible();
  await page.getByRole("button", { name: "關閉郵件", exact: true }).click();
  await page.getByRole("button", { name: "返回群島", exact: true }).click();
  await openStory(page);
  await assertTimeline(page);
  const saved = await list(page, input);
  await page.reload();
  await assertTimeline(page);
  const url = page.url();
  const storageState = await page.context().storageState();
  await page.close();
  await app.restart();
  const browser = await chromium.launch({
    args: ["--enable-unsafe-swiftshader"],
  });
  try {
    const context = await browser.newContext({ storageState });
    const fresh = await context.newPage();
    await fresh.goto(url);
    await assertTimeline(fresh);
    expect(await list(fresh, input)).toEqual(saved);
    await subjectButton(fresh, "交付確認 · 10").click();
    await expect(fresh.getByRole("article")).toContainText("沒有待修項目");
  } finally {
    await browser.close();
  }
});

for (const change of [
  "add",
  "move-out",
  "move-in",
  "bodyText",
  "sender",
  "subject",
  "receivedAt",
] as const) {
  test(`changed-content-or-membership-hides-summary ${change}`, async ({
    page,
    app,
  }) => {
    await enter(page, app.url);
    const input = await story(page);
    configureStory(app.dbPath, input, 12);
    await page.reload();
    await openStory(page);
    await assertTimeline(page);
    const other = (await overview(page)).domains[0]?.subcategories[0];
    if (!other) throw new Error("Missing other category");
    const original = sourceMail(app.dbPath, input);
    expect(original.subject).toBe("交付確認 · 10");
    const write: Record<string, unknown> = {
      ...original,
      domainId: input.domainId,
      subcategoryId: input.subcategoryId,
    };
    if (change === "add" || change === "move-in") {
      delete write.id;
      write.seedKey = `new-${change}`;
      write.subject = `新增的${change}`;
      write.bodyText = "真實寫入的新正文";
      write.readAt = null;
      if (change === "move-in") {
        const inserted = await writeMail(app.dbPath, input.ownerKey, {
          ...write,
          domainId: "core-projects",
          subcategoryId: other.id,
        });
        write.id = inserted.id;
      }
    } else if (change === "move-out") {
      write.domainId = "core-projects";
      write.subcategoryId = other.id;
    } else
      write[change] =
        change === "receivedAt"
          ? "2026-11-01T04:00:00.000Z"
          : `已修訂${change}`;
    const changed = await writeMail(app.dbPath, input.ownerKey, write);
    await page.reload();
    await expect(timeline(page)).toHaveCount(0);
    const current = await list(page, input);
    expect(current.timeline).toBeNull();
    expect(current.unreadCount).toBeGreaterThanOrEqual(10);
    expect(current.unreadCount).toBeLessThan(30);
    let expectedCount = 30;
    if (change === "move-out") expectedCount = 29;
    if (change === "add" || change === "move-in") expectedCount = 31;
    expect(current.mails).toHaveLength(expectedCount);
    let expectedSubjects = expectedStages.flatMap((stage) =>
      Array.from({ length: 10 }, (_, index) => `${stage.title} · ${index + 1}`),
    );
    if (change === "add" || change === "move-in")
      expectedSubjects.push(String(write.subject));
    if (change === "move-out")
      expectedSubjects = expectedSubjects.filter(
        (subject) => subject !== original.subject,
      );
    if (change === "subject")
      expectedSubjects = expectedSubjects.map((subject) =>
        subject === original.subject ? String(write.subject) : subject,
      );
    const renderedList = page.getByRole("list", {
      name: "郵件列表",
      exact: true,
    });
    await expect(renderedList.getByRole("listitem")).toHaveCount(expectedCount);
    for (const subject of expectedSubjects)
      await expect(
        renderedList.getByText(subject, { exact: true }),
      ).toHaveCount(1);
    if (change === "move-out") {
      await expect(
        renderedList.getByText(original.subject, { exact: true }),
      ).toHaveCount(0);
    } else {
      const affectedRow = subjectButton(page, String(write.subject));
      await expect(
        affectedRow.getByText(String(write.sender), { exact: true }),
      ).toBeVisible();
      await expect(affectedRow.locator("time")).toHaveAttribute(
        "datetime",
        String(write.receivedAt),
      );
      await expect(affectedRow.locator("time")).toHaveText(
        change === "receivedAt" ? "11月1日" : "10月30日",
      );
    }
    const target = {
      domainId: write.domainId,
      subcategoryId: write.subcategoryId,
      mailId: changed.id,
    };
    // Read through normal UI even for a moved-out message in its new category.
    if (change === "move-out") {
      await page.getByRole("button", { name: "關閉郵件", exact: true }).click();
      await page.getByRole("button", { name: "返回群島", exact: true }).click();
      await page.getByRole("button", { name: /^核心專案，/ }).click();
      await page.getByRole("button", { name: /^Q4 報價，/ }).click();
    }
    await subjectButton(page, String(write.subject)).click();
    const detail = mailDetailSchema.parse(
      resultData(await rpc(page, "getMail", target)),
    );
    expect(detail.bodyText).toBe(write.bodyText);
    expect(detail.sender).toBe(write.sender);
    expect(detail.subject).toBe(write.subject);
    expect(detail.receivedAt).toBe(write.receivedAt);
    await expect(page.getByRole("article")).toContainText(
      String(write.bodyText),
    );
  });
}

test("missing-template-and-existing-owner", async ({ page, browser, app }) => {
  await enter(page, app.url);
  const input = await story(page);
  configureLegacyMailbox(app.dbPath, input);
  const before = await list(page, input);
  expect(before.timeline).toBeNull();
  app.sql(
    `INSERT INTO subcategories(id,owner_id,seed_key,domain_id,name) VALUES('11111111-1111-4111-8111-111111111111','${input.ownerKey}','empty','finance-bills','空分類')`,
  );
  await page.goto("about:blank");
  await app.restart();
  await page.goto(`${app.url}/island`);
  resultData(await rpc(page, "startDemo"));
  await openStory(page);
  expect(await list(page, input)).toEqual(before);
  await expect(timeline(page)).toHaveCount(0);
  await subjectButton(page, "上月服務費帳單").click();
  await expect(page.getByRole("article")).toContainText("舊版本正文");
  await page.getByRole("button", { name: "關閉郵件", exact: true }).click();
  await page.getByRole("button", { name: /^空分類，/ }).click();
  await expect(
    page.getByText("這裡還沒有郵件。", { exact: true }),
  ).toBeVisible();
  const context = await browser.newContext();
  try {
    const fresh = await context.newPage();
    await enter(fresh, app.url);
    await openStory(fresh);
    await assertTimeline(fresh);
  } finally {
    await context.close();
  }
});

test("owner-isolation-and-direct-requests", async ({ page, browser, app }) => {
  await enter(page, app.url);
  const a = await story(page);
  const context = await browser.newContext();
  const anonymous = await browser.newContext();
  try {
    const b = await context.newPage();
    await enter(b, app.url);
    const bi = await story(b);
    const mail = sourceMail(app.dbPath, bi);
    await writeMail(app.dbPath, bi.ownerKey, {
      ...mail,
      domainId: bi.domainId,
      subcategoryId: bi.subcategoryId,
      bodyText: "B 的私有修訂正文",
    });
    await openStory(page);
    await assertTimeline(page);
    await openStory(b);
    await expect(timeline(b)).toHaveCount(0);
    for (const input of [
      {
        domainId: bi.domainId,
        subcategoryId: bi.subcategoryId,
        view: "active",
      },
      {
        domainId: "core-projects",
        subcategoryId: a.subcategoryId,
        view: "active",
      },
    ]) {
      const response = await rpc(page, "listMail", input);
      expect(response).toEqual({ ok: false, error: "NOT_FOUND" });
      expect(JSON.stringify(response)).not.toContain("B 的私有修訂正文");
    }
    expect(
      (
        await rpc(page, "listMail", {
          domainId: a.domainId,
          subcategoryId: a.subcategoryId,
          view: "active",
          ownerKey: bi.ownerKey,
        })
      ).ok,
    ).toBe(false);
    const noIdentity = await app.withContext(anonymous);
    expect(
      await rpc(noIdentity, "listMail", {
        domainId: a.domainId,
        subcategoryId: a.subcategoryId,
        view: "active",
      }),
    ).toEqual({ ok: false, error: "UNAUTHENTICATED" });
    expect((await list(page, a)).timeline?.stages).toEqual(expectedStages);
    expect((await list(b, bi)).timeline).toBeNull();
  } finally {
    await context.close();
    await anonymous.close();
  }
});

test("list-error-and-retry", async ({ page, app }) => {
  await enter(page, app.url);
  const input = await story(page);
  await openStory(page);
  await assertTimeline(page);
  const source = await (
    await page.request.get(
      `${app.url}/src/features/mailbox/mailbox.functions.ts`,
    )
  ).text();
  const id = source
    .split("\n")
    .find((line) => line.startsWith("export const listMail ="))
    ?.match(/createClientRpc\("([^"]+)"/)?.[1];
  if (!id) throw new Error("Missing list RPC");
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started = false;
  await page.route(
    `**/_serverFn/${id}**`,
    async (route) => {
      started = true;
      await held;
      await route.abort();
    },
    { times: 1 },
  );
  // Closing/reopening retains the successful query cache and starts a real background refetch.
  await page.getByRole("button", { name: "關閉郵件", exact: true }).click();
  await page.getByRole("button", { name: /^待處理帳單，/ }).click();
  await expect.poll(() => started).toBe(true);
  await expect(page.getByRole("status")).toContainText("正在載入郵件");
  await expect(timeline(page)).toHaveCount(0);
  release();
  await expect(page.getByRole("alert")).toContainText("郵件載入失敗");
  await expect(timeline(page)).toHaveCount(0);
  await expect(page.getByText("這裡還沒有郵件。", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "重試", exact: true }).click();
  await assertTimeline(page);
  expect((await list(page, input)).unreadCount).toBe(10);
  await expect(
    page.getByRole("list", { name: "郵件列表" }).getByRole("listitem"),
  ).toHaveCount(30);
});

for (const width of [1600, 390]) {
  test(`keyboard-and-responsive-card ${width}`, async ({ page, app }) => {
    await page.setViewportSize({ width, height: 900 });
    await enter(page, app.url);
    const input = await story(page);
    configureStory(app.dbPath, input, 12);
    await page.reload();
    await page.getByRole("button", { name: /^財務帳單，/ }).focus();
    await page.keyboard.press("Enter");
    const category = page.getByRole("button", { name: /^待處理帳單，/ });
    await category.focus();
    await page.keyboard.press("Enter");
    await assertTimeline(page);
    const card = page.getByRole("dialog");
    await expect(card).toBeVisible();
    await expect(timeline(page).getByRole("button")).toHaveCount(0);
    const boxes = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: innerWidth,
      card: document
        .querySelector('[role="dialog"]')
        ?.getBoundingClientRect()
        .toJSON(),
    }));
    expect(boxes.document).toBeLessThanOrEqual(width);
    expect(boxes.card?.x).toBeGreaterThanOrEqual(0);
    expect(boxes.card?.right).toBeLessThanOrEqual(width);
    const evidence = process.env.EMAIL_ISLAND_TIMELINE_EVIDENCE;
    if (evidence) {
      mkdirSync(evidence, { recursive: true });
      await page.screenshot({ path: join(evidence, `timeline-${width}.png`) });
      writeFileSync(
        join(evidence, `boxes-${width}.json`),
        JSON.stringify(boxes, null, 2),
      );
    }
    const content = page.getByRole("region", { name: "郵件內容", exact: true });
    await content.focus();
    await page.keyboard.press("End");
    const last = subjectButton(page, "需求確認 · 1");
    await expect(last).toBeInViewport();
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    await last.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("article")).toContainText("網站只包含首頁");
    await page.getByRole("button", { name: "返回列表", exact: true }).focus();
    await page.keyboard.press("Enter");
    await assertTimeline(page);
    await page.getByRole("button", { name: "關閉郵件", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(category).toBeFocused();
    expect((await list(page, input)).unreadCount).toBe(12);
  });
}

test("keyboard-close-preserves-newer-focus-during-navigation", async ({
  page,
  app,
}) => {
  await enter(page, app.url);
  const input = await story(page);
  configureStory(app.dbPath, input, 12);
  app.sql(
    `INSERT INTO subcategories(id,owner_id,seed_key,domain_id,name) VALUES('22222222-2222-4222-8222-222222222222','${input.ownerKey}','focus-empty','finance-bills','鍵盤空分類')`,
  );
  await page.reload();
  await openStory(page);
  await expect(page.getByRole("list", { name: "郵件列表" })).toBeVisible();
  const source = await (
    await page.request.get(
      `${app.url}/src/features/mailbox/mailbox.functions.ts`,
    )
  ).text();
  const id = source
    .split("\n")
    .find((line) => line.startsWith("export const getOverview ="))
    ?.match(/createClientRpc\("([^"]+)"/)?.[1];
  if (!id) throw new Error("Missing overview RPC");
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started = false;
  await page.route(
    `**/_serverFn/${id}**`,
    async (route) => {
      started = true;
      await held;
      await route.continue();
    },
    { times: 1 },
  );
  // Keep the explicit newer focus in the same browser turn as closing.
  // Awaiting locator.click first lets the old close effect finish before the test can act.
  const focused = await page
    .getByRole("button", { name: "關閉郵件", exact: true })
    .evaluate((button) => {
      if (!(button instanceof HTMLButtonElement))
        throw new Error("Expected close button");
      button.click();
      const next = document.getElementById(
        "subcategory-22222222-2222-4222-8222-222222222222",
      );
      if (!next) throw new Error("Missing next category entry");
      next.focus();
      return document.activeElement?.id;
    });
  expect(focused).toBe("subcategory-22222222-2222-4222-8222-222222222222");
  await expect.poll(() => started).toBe(true);
  const next = page.getByRole("button", { name: /^鍵盤空分類，/ });
  release();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(next).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "鍵盤空分類郵件" }),
  ).toBeVisible();
  await expect(
    page.getByText("這裡還沒有郵件。", { exact: true }),
  ).toBeVisible();
  // With no newer focus choice, Escape restores the original entry.
  await page.keyboard.press("Escape");
  await expect(next).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "關閉郵件", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(next).toBeFocused();
});
