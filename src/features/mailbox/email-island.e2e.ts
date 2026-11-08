import { z } from "zod";
import {
  test,
  expect,
  enter,
  identity,
  overview,
  q4,
  openQ4,
  readQ4,
  rpc,
  resultData,
  subjectButton,
} from "./acceptance-fixtures";
import { chromium } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";

const domainNames = [
  "核心專案",
  "團隊溝通",
  "電子報",
  "財務帳單",
  "系統通知",
  "社交活動",
  "網購物流",
  "低優先郵件",
];

test("AC-1 entry-disabled-google-and-initialize", async ({ page, app }) => {
  const outbound: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith(app.url)) outbound.push(request.url());
  });
  await enter(page, app.url);
  const data = await overview(page);
  expect(data.domains.map((domain) => domain.name)).toEqual(domainNames);
  for (const domain of data.domains) {
    await expect(
      page.getByRole("button", { name: new RegExp(domain.name) }),
    ).toBeVisible();
    expect(domain.subcategories.length).toBeGreaterThan(0);
    for (const subcategory of domain.subcategories) {
      const result = resultData(
        await rpc(page, "listMail", {
          domainId: domain.id,
          subcategoryId: subcategory.id,
        }),
      );
      expect(Array.isArray(result) && result.length > 0).toBe(true);
    }
  }
  expect(outbound).toEqual([]);
});

test("AC-2 repeat-entry-preserves-mailbox", async ({ page, app }) => {
  await enter(page, app.url);
  await readQ4(page);
  const before = await q4(page);
  const owner = await identity(page);
  await page.reload();
  await page.goto(app.url);
  await expect(page.getByRole("button", { name: /核心專案/ })).toBeVisible();
  expect(resultData(await rpc(page, "startDemo"))).toEqual(owner);
  expect(resultData(await rpc(page, "startDemo"))).toEqual(owner);
  const after = await q4(page);
  expect(after.mails).toEqual(before.mails);
  expect(after.mail.readAt).not.toBeNull();
});

test("AC-3 domain-subcategory-mail-navigation", async ({ page, app }) => {
  await enter(page, app.url);
  await openQ4(page);
  await subjectButton(page, "請確認報價項目").click();
  await expect(
    page
      .getByRole("article", { name: "請確認報價項目", exact: true })
      .getByText("林曉晴 <clare@example.com>", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("第四季的報價已整理完成", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "返回列表", exact: true }).click();
  await expect(subjectButton(page, "請確認報價項目")).toBeVisible();
  await page.getByRole("button", { name: "關閉郵件", exact: true }).click();
  await expect(page.getByRole("button", { name: /設計審批/ })).toBeVisible();
  await page.getByRole("button", { name: "返回群島", exact: true }).click();
  for (const name of domainNames.slice(1)) {
    await page.getByRole("button", { name: new RegExp(name) }).click();
    const selected = new URL(page.url()).searchParams.get("domain");
    const domain = (await overview(page)).domains.find(
      (entry) => entry.id === selected,
    );
    if (!domain) throw new Error("Domain missing from navigation");
    const category = domain.subcategories[0];
    if (!category) throw new Error("Category missing from seed");
    await page.getByRole("button", { name: new RegExp(category.name) }).click();
    await expect(
      page.getByRole("dialog", { name: `${category.name}郵件` }),
    ).toBeVisible();
    await page.getByRole("button", { name: "關閉郵件", exact: true }).click();
    await page.getByRole("button", { name: "返回群島", exact: true }).click();
  }
});

test("AC-4 read-updates-all-unread-counts-once", async ({ page, app }) => {
  await enter(page, app.url);
  const before = await q4(page);
  expect(before.subcategory.unreadCount).toBe(3);
  expect(before.domain?.unreadCount).toBe(4);
  await openQ4(page);
  await subjectButton(page, "請確認報價項目").hover();
  expect((await q4(page)).subcategory.unreadCount).toBe(3);
  await subjectButton(page, "請確認報價項目").click();
  await expect(
    page.getByText("第四季的報價已整理完成", { exact: false }),
  ).toBeVisible();
  await expect
    .poll(async () => (await q4(page)).subcategory.unreadCount)
    .toBe(2);
  const after = await q4(page);
  expect(after.domain?.unreadCount).toBe(3);
  expect(
    after.domain?.subcategories.find((entry) => entry.name === "設計審批")
      ?.unreadCount,
  ).toBe(1);
  await page.getByRole("button", { name: "返回列表", exact: true }).click();
  const readRow = subjectButton(page, "請確認報價項目");
  await expect(readRow).not.toContainText("未讀");
  await page.getByRole("button", { name: "關閉郵件", exact: true }).click();
  await expect(page.getByLabel("Q4 報價未讀 2", { exact: true })).toHaveText(
    "未讀 2",
  );
  await expect(page.getByLabel("設計審批未讀 1", { exact: true })).toHaveText(
    "未讀 1",
  );
  await page.getByRole("button", { name: "返回群島", exact: true }).click();
  await expect(page.getByLabel("核心專案未讀 3", { exact: true })).toHaveText(
    "未讀 3",
  );
  await openQ4(page);
  await readRow.click();
  await expect(
    page.getByText("第四季的報價已整理完成", { exact: false }),
  ).toBeVisible();
  expect((await q4(page)).mail.readAt).toBe(after.mail.readAt);
  expect((await q4(page)).subcategory.unreadCount).toBe(2);
});

test("AC-5 zero-unread-keeps-navigation", async ({ page, app }) => {
  await enter(page, app.url);
  await page.getByRole("button", { name: /核心專案/ }).click();
  await page.getByRole("button", { name: /設計審批/ }).click();
  await page.getByRole("button", { name: /首頁設計等待確認/ }).click();
  await expect(
    page.getByText("最新的首頁設計已完成", { exact: false }),
  ).toBeVisible();
  await expect
    .poll(
      async () =>
        (await overview(page)).domains[0]?.subcategories.find(
          (entry) => entry.name === "設計審批",
        )?.unreadCount,
    )
    .toBe(0);
  await page.getByRole("button", { name: "關閉郵件", exact: true }).click();
  await expect(page.getByLabel("設計審批未讀 0", { exact: true })).toHaveText(
    "未讀 0",
  );
  await page.getByRole("button", { name: /設計審批/ }).click();
  await page.getByRole("button", { name: /首頁設計等待確認/ }).click();
  await expect(
    page.getByText("最新的首頁設計已完成", { exact: false }),
  ).toBeVisible();
});

test("AC-6 persistence-browser-and-server-restart", async ({ page, app }) => {
  await enter(page, app.url);
  await readQ4(page);
  const saved = await q4(page);
  const owner = await identity(page);
  const storageState = await page.context().storageState();
  await page.reload();
  expect((await q4(page)).mails).toEqual(saved.mails);
  await page.close();
  await app.restart();
  const reopenedBrowser = await chromium.launch({
    args: ["--enable-unsafe-swiftshader"],
  });
  try {
    const context = await reopenedBrowser.newContext({ storageState });
    const reopened = await app.withContext(context);
    await expect(
      reopened.getByRole("button", { name: /核心專案/ }),
    ).toBeVisible();
    expect(await identity(reopened)).toEqual(owner);
    expect((await q4(reopened)).mails).toEqual(saved.mails);
  } finally {
    await reopenedBrowser.close();
  }
});

test("AC-7 cross-owner-read-write-isolation", async ({
  page,
  browser,
  app,
}) => {
  await enter(page, app.url);
  const contextB = await browser.newContext();
  try {
    const b = await contextB.newPage();
    await enter(b, app.url);
    const dataA = await q4(page);
    const dataB = await q4(b);
    expect(dataA.input.mailId).not.toBe(dataB.input.mailId);
    await readQ4(page);
    for (const method of ["listMail", "getMail", "markMailRead"] as const) {
      const input =
        method === "listMail"
          ? {
              domainId: dataB.input.domainId,
              subcategoryId: dataB.input.subcategoryId,
            }
          : dataB.input;
      const response = await rpc(page, method, input);
      expect(response).toEqual({ ok: false, error: "NOT_FOUND" });
      expect(JSON.stringify(response)).not.toContain(dataB.mail.sender);
    }
    expect((await q4(b)).subcategory.unreadCount).toBe(3);
    expect((await q4(b)).mail.readAt).toBeNull();
    await readQ4(b);
    expect((await q4(b)).subcategory.unreadCount).toBe(2);
  } finally {
    await contextB.close();
  }
});

test("AC-8 resource-auth-and-parent-validation", async ({
  page,
  browser,
  app,
}) => {
  await enter(page, app.url);
  const data = await q4(page);
  const anonymous = await browser.newContext();
  try {
    const unauthenticated = await app.withContext(anonymous);
    for (const method of [
      "getOverview",
      "listMail",
      "getMail",
      "markMailRead",
    ] as const) {
      let input: unknown = data.input;
      if (method === "getOverview") input = {};
      if (method === "listMail")
        input = {
          domainId: data.input.domainId,
          subcategoryId: data.input.subcategoryId,
        };
      expect(await rpc(unauthenticated, method, input)).toEqual({
        ok: false,
        error: "UNAUTHENTICATED",
      });
    }
    await unauthenticated.goto(`${app.url}/island`);
    await expect(
      unauthenticated.getByRole("button", { name: "進入群島", exact: true }),
    ).toBeVisible();
  } finally {
    await anonymous.close();
  }
  for (const method of ["listMail", "getMail", "markMailRead"] as const) {
    const input =
      method === "listMail"
        ? { domainId: "internal-team", subcategoryId: data.input.subcategoryId }
        : { ...data.input, domainId: "internal-team" };
    expect(await rpc(page, method, input)).toEqual({
      ok: false,
      error: "NOT_FOUND",
    });
  }
  const invalid = await rpc(page, "markMailRead", {
    ...data.input,
    owner_id: (await identity(page)).ownerKey,
  });
  expect(invalid.ok).toBe(false);
  expect(invalid.ok ? "" : invalid.error).toContain("owner_id");
  await page.goto(
    `${app.url}/island?domain=internal-team&subcategory=${data.input.subcategoryId}&mail=${data.input.mailId}`,
  );
  await expect(page.getByText("找不到", { exact: false })).toBeVisible();
  await expect(page.getByText(data.mail.subject, { exact: true })).toHaveCount(
    0,
  );
});

test("AC-9 session-daily-renewal", async ({ page, app }) => {
  await enter(page, app.url);
  await readQ4(page);
  const owner = await identity(page);
  const mail = await q4(page);
  const database = new DatabaseSync(app.dbPath);
  const old = database
    .prepare('SELECT "expiresAt" FROM session WHERE "userId" = ?')
    .get(owner.ownerKey);
  database.close();
  const originalExpiry = Date.parse(z.iso.datetime().parse(old?.expiresAt));
  expect(originalExpiry).toBeGreaterThan(Date.now());
  app.time(new Date(Date.now() + 2 * 86_400_000));
  const refresh = page.waitForResponse(
    (response) =>
      response.url().includes("/api/auth/get-session") &&
      response.request().method() === "POST",
  );
  await page.goto(app.url);
  expect((await refresh).ok()).toBe(true);
  const check = new DatabaseSync(app.dbPath);
  const renewed = check
    .prepare('SELECT "expiresAt" FROM session WHERE "userId" = ?')
    .get(owner.ownerKey);
  check.close();
  expect(
    Date.parse(z.iso.datetime().parse(renewed?.expiresAt)),
  ).toBeGreaterThan(originalExpiry);
  app.time(new Date(originalExpiry + 86_400_000));
  await page.reload();
  expect(await identity(page)).toEqual(owner);
  expect((await q4(page)).mail.readAt).toBe(mail.mail.readAt);
});

test("AC-10 expiry-or-cookie-loss-starts-new-owner", async ({
  page,
  browser,
  app,
}) => {
  await enter(page, app.url);
  const expiredOwner = await identity(page);
  const expiredMail = await q4(page);
  app.time(new Date(Date.now() + 366 * 86_400_000));
  await page.goto(app.url);
  await expect(
    page.getByRole("button", { name: "進入群島", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "進入群島", exact: true }).click();
  await expect(page.getByRole("button", { name: /核心專案/ })).toBeVisible();
  expect((await identity(page)).ownerKey).not.toBe(expiredOwner.ownerKey);
  expect(await rpc(page, "getMail", expiredMail.input)).toEqual({
    ok: false,
    error: "NOT_FOUND",
  });
  const secondContext = await browser.newContext();
  try {
    const second = await secondContext.newPage();
    await enter(second, app.url);
    const secondOwner = await identity(second);
    const secondMail = await q4(second);
    await secondContext.clearCookies();
    await second.goto(app.url);
    await second.getByRole("button", { name: "進入群島", exact: true }).click();
    await expect(
      second.getByRole("button", { name: /核心專案/ }),
    ).toBeVisible();
    expect((await identity(second)).ownerKey).not.toBe(secondOwner.ownerKey);
    expect(await rpc(second, "getMail", secondMail.input)).toEqual({
      ok: false,
      error: "NOT_FOUND",
    });
    await expect(second.getByText(/找回帳號|重設|跨裝置登入/)).toHaveCount(0);
  } finally {
    await secondContext.close();
  }
  const database = new DatabaseSync(app.dbPath);
  expect(
    database
      .prepare("SELECT COUNT(*) AS count FROM mails WHERE owner_id = ?")
      .get(expiredOwner.ownerKey)?.count,
  ).toBeGreaterThan(0);
  database.close();
});

test("AC-11 seed-and-read-persistence-failure", async ({ page, app }) => {
  await page.goto(app.url);
  await expect(
    page.getByRole("button", { name: "進入群島", exact: true }),
  ).toBeVisible();
  app.sql(
    "CREATE TRIGGER reject_seed BEFORE INSERT ON mails BEGIN SELECT RAISE(ABORT, 'isolated seed failure'); END;",
  );
  await page.getByRole("button", { name: "進入群島", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("未能準備郵件");
  const owner = await identity(page);
  const database = new DatabaseSync(app.dbPath);
  expect(
    database
      .prepare("SELECT COUNT(*) AS count FROM subcategories WHERE owner_id = ?")
      .get(owner.ownerKey)?.count,
  ).toBe(0);
  expect(
    database
      .prepare("SELECT COUNT(*) AS count FROM mailboxes WHERE owner_id = ?")
      .get(owner.ownerKey)?.count,
  ).toBe(0);
  database.close();
  app.sql("DROP TRIGGER reject_seed;");
  await page.getByRole("button", { name: "重試", exact: true }).click();
  await expect(page.getByRole("button", { name: /核心專案/ })).toBeVisible();
  expect((await q4(page)).mails).toHaveLength(3);
  app.sql(
    "CREATE TRIGGER reject_read BEFORE UPDATE OF read_at ON mails BEGIN SELECT RAISE(ABORT, 'isolated read failure'); END;",
  );
  await openQ4(page);
  await subjectButton(page, "請確認報價項目").click();
  await expect(
    page.getByText("第四季的報價已整理完成", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("保存失敗");
  expect((await q4(page)).subcategory.unreadCount).toBe(3);
  app.sql("DROP TRIGGER reject_read;");
  await page.getByRole("button", { name: "重試", exact: true }).click();
  await expect
    .poll(async () => (await q4(page)).subcategory.unreadCount)
    .toBe(2);
  const saved = await q4(page);
  resultData(await rpc(page, "markMailRead", saved.input));
  expect((await q4(page)).mail.readAt).toBe(saved.mail.readAt);
});

test("AC-12 keyboard-and-scene-navigation", async ({
  page,
  app,
  browserErrors,
}) => {
  await enter(page, app.url);
  const core = page.getByRole("button", { name: /核心專案/ });
  await core.focus();
  await page.keyboard.press("Enter");
  const category = page.getByRole("button", { name: /Q4 報價/ });
  await category.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Q4 報價郵件" })).toBeVisible();
  await page.getByRole("button", { name: "關閉郵件", exact: true }).click();
  await expect(category).toBeFocused();
  await page.getByRole("button", { name: "返回群島", exact: true }).click();
  // Click the projected building, not its HTML label, using scene's public screen anchor.
  const building = page.locator('[data-building="core-projects"]');
  const box = await building.boundingBox();
  if (!box) throw new Error("Missing projected building anchor");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByRole("button", { name: /Q4 報價/ })).toBeVisible();
  await expect(page.locator("nav, aside, footer")).toHaveCount(0);
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.getByRole("button", { name: /Q4 報價/ })).toBeVisible();
  await page.screenshot();
  expect(browserErrors).toEqual([]);
});
