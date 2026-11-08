import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { mailDetailSchema, mailListSchema } from "../../lib/mailbox";
import {
  test,
  expect,
  enter,
  q4,
  rpc,
  resultData,
  overview,
  identity,
  openQ4,
  subjectButton,
} from "./acceptance-fixtures";

const categoryButton = (page: Page, name = "Q4 報價") =>
  page.getByRole("button", { name: new RegExp(`^${name}，`) });
const scopeOf = (input: { domainId: string; subcategoryId: string }) => ({
  domainId: input.domainId,
  subcategoryId: input.subcategoryId,
});
async function detail(page: Page, input: unknown) {
  return mailDetailSchema.parse(resultData(await rpc(page, "getMail", input)));
}
async function list(
  page: Page,
  input: ReturnType<typeof scopeOf>,
  view = "active",
) {
  return mailListSchema.parse(
    resultData(await rpc(page, "listMail", { ...input, view })),
  ).mails;
}
async function readFirst(page: Page) {
  await openQ4(page);
  await subjectButton(page, "請確認報價項目").click();
  await expect(page.getByRole("article")).toContainText(
    "第四季的報價已整理完成",
  );
  await expect(page.getByText("已讀", { exact: true })).toBeVisible();
}
async function reply(page: Page, text: string) {
  await expect(page.getByRole("textbox", { name: "回覆內容" })).toBeVisible();
  await page.getByRole("textbox", { name: "回覆內容" }).fill(text);
  await page.getByRole("button", { name: "回覆", exact: true }).click();
  await expect(page.getByRole("region", { name: "回覆紀錄" })).toContainText(
    text,
  );
}
async function rpcIds(page: Page, url: string) {
  const source = await (
    await page.request.get(`${url}/src/features/mailbox/mailbox.functions.ts`)
  ).text();
  return (name: string) => {
    const line = source
      .split("\n")
      .find((line) => line.startsWith(`export const ${name} =`));
    const id = line?.match(/createClientRpc\("([^"]+)"/)?.[1];
    if (!id) throw new Error(`Missing RPC ${name}`);
    return id;
  };
}
async function assertBoth(
  page: Page,
  categoryCount: number,
  categoryPending: number,
  domainCount = categoryCount + 1,
  domainPending = categoryPending + 1,
) {
  await expect(categoryButton(page)).toHaveAccessibleName(
    new RegExp(`未讀 ${categoryCount} 封，待回覆 ${categoryPending} 封`),
  );
  await page.getByRole("button", { name: "返回群島", exact: true }).click();
  await expect(categoryButton(page, "核心專案")).toHaveAccessibleName(
    new RegExp(`未讀 ${domainCount} 封，待回覆 ${domainPending} 封`),
  );
}

test("AC-1 reply and read remain independent", async ({ page, app }) => {
  await enter(page, app.url);
  const original = await q4(page);
  await expect(categoryButton(page, "核心專案")).toHaveAccessibleName(
    /待回覆 3 封/,
  );
  await readFirst(page);
  expect((await q4(page)).subcategory.pendingReplyCount).toBe(2);
  await reply(page, "報價已確認\n請安排交付。");
  const saved = await detail(page, original.input);
  expect(saved.replies).toHaveLength(1);
  expect(saved.replies[0]?.createdAt).toMatch(/^\d{4}-/);
  expect(saved.hasPendingReply).toBe(false);
  expect(saved.readAt).not.toBeNull();
  expect([saved.sender, saved.subject, saved.receivedAt]).toEqual([
    original.mail.sender,
    original.mail.subject,
    original.mail.receivedAt,
  ]);
  expect(await list(page, scopeOf(original.input))).toHaveLength(3);
  await page.getByRole("button", { name: "返回列表", exact: true }).click();
  await subjectButton(page, "請確認報價項目 · 2").click();
  await expect(page.getByText("待回覆", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "關閉郵件", exact: true }).click();
  await assertBoth(page, 1, 1);
});

test("AC-2 reply completion and zero foundations", async ({ page, app }) => {
  await enter(page, app.url);
  const state = await q4(page);
  await expect(categoryButton(page, "核心專案")).toHaveAccessibleName(
    /待回覆 3 封/,
  );
  app.sql(
    `UPDATE mails SET requires_reply=0; UPDATE mails SET requires_reply=1,read_at='2026-01-01T00:00:00.000Z' WHERE id='${state.mail.id}'; UPDATE mails SET read_at='2026-01-01T00:00:00.000Z' WHERE id!='${state.mails[2]?.id}';`,
  );
  await page.reload();
  await expect(categoryButton(page, "核心專案")).toHaveAccessibleName(
    /未讀 1 封，待回覆 1 封/,
  );
  await readFirst(page);
  await reply(page, "完成確認");
  await page.getByRole("button", { name: "返回列表", exact: true }).click();
  await subjectButton(page, "請確認報價項目 · 3").click();
  await expect(page.getByText("已讀", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "關閉郵件", exact: true }).click();
  await assertBoth(page, 0, 0, 0, 0);
  await categoryButton(page, "核心專案").click();
  await categoryButton(page).click();
  await expect(subjectButton(page, "請確認報價項目")).toBeVisible();
  await page.getByRole("button", { name: "關閉郵件", exact: true }).click();
  await page.getByRole("button", { name: "返回群島", exact: true }).click();
  app.sql(
    `UPDATE mails SET requires_reply=1 WHERE id='${state.mails[1]?.id}';`,
  );
  await page.reload();
  await expect(categoryButton(page, "核心專案")).toHaveAccessibleName(
    /未讀 0 封，待回覆 1 封，地基/,
  );
  await expect(categoryButton(page, "核心專案")).toContainText("待回覆");
  await categoryButton(page, "核心專案").click();
  await expect(categoryButton(page)).toHaveAccessibleName(
    /未讀 0 封，待回覆 1 封，地基/,
  );
  await expect(categoryButton(page).locator("..")).toContainText("待回覆");
});

test("AC-3 archive preserves mail history", async ({ page, app }) => {
  await enter(page, app.url);
  const state = await q4(page);
  await readFirst(page);
  await reply(page, "保存的回覆");
  const before = await detail(page, state.input);
  await page.getByRole("button", { name: "封存", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "郵件列表", exact: true }),
  ).toBeFocused();
  await expect(subjectButton(page, state.mail.subject)).toHaveCount(0);
  await page.getByRole("button", { name: "已封存", exact: true }).click();
  await subjectButton(page, state.mail.subject).click();
  await expect(page.getByRole("article")).toContainText(before.bodyText);
  await expect(page.getByRole("region", { name: "回覆紀錄" })).toContainText(
    "保存的回覆",
  );
  await expect(
    page.getByRole("button", { name: "封存", exact: true }),
  ).toHaveCount(0);
  const after = await detail(page, state.input);
  expect(after.readAt).toBe(before.readAt);
  expect(after.replies).toEqual(before.replies);
  expect(after.archivedAt).not.toBeNull();
  await page.getByRole("button", { name: "返回列表", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "已封存", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "關閉郵件", exact: true }).click();
  await expect(categoryButton(page)).toBeFocused();
  const pending = state.mails[1]!;
  const target = { ...scopeOf(state.input), mailId: pending.id };
  const archived = resultData(await rpc(page, "archiveMail", target));
  expect(resultData(await rpc(page, "archiveMail", target))).toEqual(archived);
  expect((await detail(page, target)).hasPendingReply).toBe(true);
  expect((await detail(page, target)).readAt).toBeNull();
  await categoryButton(page).click();
  await page.getByRole("button", { name: "已封存", exact: true }).click();
  await expect(subjectButton(page, pending.subject)).toContainText("未讀");
  await subjectButton(page, pending.subject).click();
  await expect(page.getByText("已讀", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "關閉郵件", exact: true }).click();
  await assertBoth(page, 1, 0);
});

test("AC-4 level one explicit quick archive", async ({ page, app }) => {
  await enter(page, app.url);
  const state = await q4(page);
  await categoryButton(page, "核心專案").hover();
  await expect(
    page.getByRole("button", { name: /封存 \d+ 封未讀/ }),
  ).toHaveCount(0);
  await categoryButton(page, "核心專案").click();
  await categoryButton(page).hover();
  await expect(
    page.getByRole("button", { name: /封存 \d+ 封未讀/ }),
  ).toHaveCount(0);
  const design = categoryButton(page, "設計審批");
  await design.hover();
  const quick = page.getByRole("button", {
    name: "設計審批：封存 1 封未讀",
    exact: true,
  });
  await expect(quick).toBeVisible();
  await page.mouse.move(20, 20);
  expect((await overview(page)).domains[0]?.unreadCount).toBe(4);
  await design.focus();
  await expect(quick).toBeVisible();
  await page.keyboard.press("Tab");
  expect((await overview(page)).domains[0]?.unreadCount).toBe(4);
  await expect(quick).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(design).toHaveAccessibleName(/未讀 0 封，待回覆 0 封，地基/);
  await design.click();
  await page.getByRole("button", { name: "已封存", exact: true }).click();
  await expect(subjectButton(page, "首頁設計等待確認")).toContainText("未讀");
  await page.getByRole("button", { name: "關閉郵件", exact: true }).click();
  resultData(await rpc(page, "markMailRead", state.input));
  await page.reload();
  await categoryButton(page).focus();
  const two = page.getByRole("button", {
    name: "Q4 報價：封存 2 封未讀",
    exact: true,
  });
  await expect(two).toBeVisible();
  await two.click();
  await expect(categoryButton(page)).toHaveAccessibleName(
    /未讀 0 封，待回覆 1 封，地基/,
  );
  expect(await list(page, scopeOf(state.input))).toHaveLength(1);
  expect(await list(page, scopeOf(state.input), "archived")).toHaveLength(2);
});

test("AC-5 snapshot changes and repeat request", async ({
  page,
  app,
  browser,
}) => {
  await enter(page, app.url);
  const state = await q4(page);
  resultData(await rpc(page, "markMailRead", state.input));
  await page.reload();
  await categoryButton(page, "核心專案").click();
  await categoryButton(page).focus();
  const quick = page.getByRole("button", {
    name: "Q4 報價：封存 2 封未讀",
    exact: true,
  });
  await expect(quick).toBeVisible();
  const other = await browser.newContext({
    storageState: await page.context().storageState(),
  });
  try {
    const b = await app.withContext(other);
    resultData(
      await rpc(b, "markMailRead", {
        ...scopeOf(state.input),
        mailId: state.mails[1]!.id,
      }),
    );
    await quick.click();
    await expect(page.getByRole("alert")).toContainText("郵件已變動");
    await expect(categoryButton(page)).toBeFocused();
    expect(await list(page, scopeOf(state.input), "archived")).toHaveLength(0);
    const one = page.getByRole("button", {
      name: "Q4 報價：封存 1 封未讀",
      exact: true,
    });
    await expect(one).toBeVisible();
    const snapshot = resultData(
      await rpc(page, "getQuickArchivePreview", scopeOf(state.input)),
    ) as { mailIds: string[] };
    await one.click();
    await expect(categoryButton(page)).toHaveAccessibleName(/未讀 0 封/);
    expect(
      resultData(
        await rpc(page, "archiveUnreadSnapshot", {
          ...scopeOf(state.input),
          ...snapshot,
        }),
      ),
    ).toEqual({ archivedIds: snapshot.mailIds });
  } finally {
    await other.close();
  }
  // New arrivals invalidate an exact snapshot and require a second explicit click.
  const design = (await overview(page)).domains[0]!.subcategories[1]!;
  const input = { domainId: "core-projects", subcategoryId: design.id };
  await categoryButton(page, "設計審批").focus();
  const oldQuick = page.getByRole("button", {
    name: "設計審批：封存 1 封未讀",
    exact: true,
  });
  await expect(oldQuick).toBeVisible();
  const old = resultData(await rpc(page, "getQuickArchivePreview", input)) as {
    mailIds: string[];
  };
  app.sql(
    `INSERT INTO mails (id,owner_id,seed_key,subcategory_id,sender,subject,body_text,received_at,requires_reply) SELECT '${randomUUID()}',owner_id,'new-arrival',subcategory_id,'new','new','new',received_at,0 FROM mails WHERE id='${old.mailIds[0]}';`,
  );
  await oldQuick.click();
  await expect(page.getByRole("alert")).toContainText("郵件已變動");
  await expect(categoryButton(page, "設計審批")).toBeFocused();
  expect(await list(page, input, "archived")).toHaveLength(0);
  const freshQuick = page.getByRole("button", {
    name: "設計審批：封存 2 封未讀",
    exact: true,
  });
  await expect(freshQuick).toBeVisible();
  const fresh = resultData(
    await rpc(page, "getQuickArchivePreview", input),
  ) as { mailIds: string[] };
  await freshQuick.click();
  await expect(categoryButton(page, "設計審批")).toHaveAccessibleName(
    /未讀 0 封/,
  );
  expect(await list(page, input, "archived")).toHaveLength(2);
  resultData(
    await rpc(page, "archiveUnreadSnapshot", {
      ...input,
      mailIds: [...fresh.mailIds].reverse(),
    }),
  );
});

test("AC-6 reply failure and lost response", async ({ page, app }) => {
  await enter(page, app.url);
  await readFirst(page);
  const state = await q4(page);
  await expect(page.getByRole("textbox", { name: "回覆內容" })).toBeVisible();
  for (const text of ["  \n ", "x".repeat(10001)]) {
    await page.getByRole("textbox", { name: "回覆內容" }).fill(text);
    await page.getByRole("button", { name: "回覆", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("1 至 10,000");
  }
  expect((await detail(page, state.input)).replies).toHaveLength(0);
  const ids = await rpcIds(page, app.url);
  let mode = "reject";
  await page.route("**/_serverFn/**", async (route) => {
    if (
      route.request().url().includes(ids("replyToMail")) &&
      mode !== "normal"
    ) {
      if (mode === "lost") await route.fetch();
      await route.abort();
    } else await route.continue();
  });
  await page.getByRole("textbox", { name: "回覆內容" }).fill("重試只保存一次");
  await page.getByRole("button", { name: "回覆", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("回覆保存失敗");
  await expect(page.getByRole("textbox", { name: "回覆內容" })).toHaveValue(
    "重試只保存一次",
  );
  expect((await detail(page, state.input)).replies).toHaveLength(0);
  mode = "lost";
  await page.getByRole("button", { name: "回覆", exact: true }).click();
  await expect
    .poll(async () => (await detail(page, state.input)).replies.length)
    .toBe(1);
  await expect(page.getByRole("alert")).toContainText("回覆保存失敗");
  mode = "normal";
  await page.getByRole("button", { name: "回覆", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "回覆紀錄" }).locator("li"),
  ).toHaveCount(1);
  expect((await detail(page, state.input)).replies).toHaveLength(1);
  await reply(page, "第二筆主動回覆");
  expect((await detail(page, state.input)).replies).toHaveLength(2);
});

test("AC-6 saved reply survives overview failure", async ({ page, app }) => {
  await enter(page, app.url);
  await readFirst(page);
  const state = await q4(page);
  const ids = await rpcIds(page, app.url);
  let fail = false;
  await page.route("**/_serverFn/**", async (route) => {
    if (route.request().url().includes(ids("replyToMail"))) {
      const response = await route.fetch();
      fail = true;
      await route.fulfill({ response });
    } else if (fail && route.request().url().includes(ids("getOverview")))
      await route.abort();
    else await route.continue();
  });
  await reply(page, "總覽故障仍保存");
  await expect(page.getByRole("alert")).toContainText("未能更新群島");
  await expect(categoryButton(page)).toHaveAccessibleName(
    /未讀 2 封，待回覆 2 封/,
  );
  await page.getByRole("button", { name: "關閉郵件", exact: true }).click();
  await assertBoth(page, 2, 2);
  fail = false;
  await page
    .getByRole("alert")
    .getByRole("button", { name: "重試", exact: true })
    .click();
  await expect(categoryButton(page, "核心專案")).toHaveAccessibleName(
    /未讀 3 封，待回覆 2 封/,
  );
  await categoryButton(page, "核心專案").click();
  await expect(categoryButton(page)).toHaveAccessibleName(
    /未讀 2 封，待回覆 1 封/,
  );
  expect((await detail(page, state.input)).replies).toHaveLength(1);
});

test("AC-7 archive failure and shared overview", async ({ page, app }) => {
  await enter(page, app.url);
  const state = await q4(page);
  await expect(categoryButton(page, "核心專案")).toHaveAccessibleName(
    /待回覆 3 封/,
  );
  const ids = await rpcIds(page, app.url);
  let failOverview = false;
  let arm = false;
  app.sql(
    "CREATE TRIGGER reject_archive BEFORE UPDATE OF archived_at ON mails BEGIN SELECT RAISE(ABORT,'write rejected'); END;",
  );
  await page.route("**/_serverFn/**", async (route) => {
    const url = route.request().url();
    if (url.includes(ids("markMailRead"))) await route.abort();
    else if (url.includes(ids("archiveMail")) && arm) {
      const response = await route.fetch();
      failOverview = true;
      await route.fulfill({ response });
    } else if (url.includes(ids("getOverview")) && failOverview)
      await route.abort();
    else await route.continue();
  });
  await openQ4(page);
  await subjectButton(page, state.mail.subject).click();
  await expect(page.getByRole("alert")).toContainText("已讀狀態保存失敗");
  await page.getByRole("button", { name: "封存", exact: true }).click();
  await expect(
    page.getByText("封存失敗，請再次按封存重試。", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toContainText(state.mail.subject);
  expect(await list(page, scopeOf(state.input))).toHaveLength(3);
  expect((await q4(page)).subcategory.unreadCount).toBe(3);
  app.sql("DROP TRIGGER reject_archive;");
  arm = true;
  await page.getByRole("button", { name: "封存", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "郵件列表", exact: true }),
  ).toBeVisible();
  await expect(categoryButton(page)).toHaveAccessibleName(
    /未讀 3 封，待回覆 2 封，Lv. 2/,
  );
  await page.getByRole("button", { name: "關閉郵件", exact: true }).click();
  await assertBoth(page, 3, 2);
  failOverview = false;
  await page
    .getByRole("alert")
    .getByRole("button", { name: "重試", exact: true })
    .click();
  await expect(categoryButton(page, "核心專案")).toHaveAccessibleName(
    /未讀 3 封，待回覆 2 封/,
  );
  await categoryButton(page, "核心專案").click();
  await expect(categoryButton(page)).toHaveAccessibleName(
    /未讀 2 封，待回覆 1 封，Lv. 1/,
  );
  expect((await detail(page, state.input)).readAt).toBeNull();
  const saved = resultData(await rpc(page, "archiveMail", state.input));
  expect(resultData(await rpc(page, "archiveMail", state.input))).toEqual(
    saved,
  );
});

test("AC-8 persistence and owner isolation", async ({ page, app, browser }) => {
  await enter(page, app.url);
  const state = await q4(page);
  await expect(categoryButton(page, "核心專案")).toHaveAccessibleName(
    /待回覆 3 封/,
  );
  await readFirst(page);
  await reply(page, "只屬於 A 的回覆");
  await page.getByRole("button", { name: "封存", exact: true }).click();
  const saved = await detail(page, state.input);
  const storageState = await page.context().storageState();
  await page.reload();
  const reopened = await browser.newContext({ storageState });
  const other = await browser.newContext();
  try {
    const a = await app.withContext(reopened);
    expect(await detail(a, state.input)).toEqual(saved);
    await a.goto(`${app.url}/island`);
    await expect(categoryButton(a, "核心專案")).toHaveAccessibleName(
      /未讀 3 封，待回覆 2 封/,
    );
    await categoryButton(a, "核心專案").click();
    await expect(categoryButton(a)).toHaveAccessibleName(
      /未讀 2 封，待回覆 1 封/,
    );
    await a.goto(
      `${app.url}/island?domain=core-projects&subcategory=${state.input.subcategoryId}&view=archived`,
    );
    await expect(subjectButton(a, state.mail.subject)).toBeVisible();
    const b = await other.newPage();
    await enter(b, app.url);
    expect((await q4(b)).subcategory.unreadCount).toBe(3);
    expect((await q4(b)).subcategory.pendingReplyCount).toBe(2);
    for (const [method, input] of [
      [
        "replyToMail",
        { ...state.input, replyId: randomUUID(), bodyText: "intrusion" },
      ],
      ["archiveMail", state.input],
      [
        "archiveUnreadSnapshot",
        { ...scopeOf(state.input), mailIds: [state.mail.id] },
      ],
      ["getQuickArchivePreview", scopeOf(state.input)],
    ] as const) {
      expect(await rpc(b, method, input)).toEqual({
        ok: false,
        error: "NOT_FOUND",
      });
    }
    expect(await detail(a, state.input)).toEqual(saved);
  } finally {
    await reopened.close();
    await other.close();
  }
});

test("AC-9 archived reply and navigation", async ({ page, app }) => {
  await enter(page, app.url);
  const state = await q4(page);
  await expect(categoryButton(page, "核心專案")).toHaveAccessibleName(
    /待回覆 3 封/,
  );
  resultData(await rpc(page, "archiveMail", state.input));
  await page.reload();
  await openQ4(page);
  await page.getByRole("button", { name: "已封存", exact: true }).click();
  await subjectButton(page, state.mail.subject).click();
  await reply(page, "封存後仍能回覆");
  expect((await detail(page, state.input)).hasPendingReply).toBe(false);
  expect((await detail(page, state.input)).archivedAt).not.toBeNull();
  await expect(
    page.getByRole("button", { name: "封存", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "返回列表", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "已封存", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await subjectButton(page, state.mail.subject).click();
  await page.getByRole("button", { name: "郵件", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(subjectButton(page, state.mail.subject)).toHaveCount(0);
  await page.getByRole("button", { name: "關閉郵件", exact: true }).click();
  await assertBoth(page, 2, 1);
});

test("AC-5 AC-6 AC-8 strict mutations and atomic rollback", async ({
  page,
  app,
  browser,
}) => {
  await enter(page, app.url);
  const state = await q4(page);
  await expect(categoryButton(page, "核心專案")).toHaveAccessibleName(
    /待回覆 3 封/,
  );
  const input = { ...state.input, replyId: randomUUID(), bodyText: "原始文字" };
  app.sql(
    "CREATE TRIGGER reject_reply_read BEFORE UPDATE OF read_at ON mails BEGIN SELECT RAISE(ABORT,'read rejected'); END;",
  );
  expect((await rpc(page, "replyToMail", input)).ok).toBe(false);
  expect((await detail(page, state.input)).replies).toHaveLength(0);
  expect((await detail(page, state.input)).readAt).toBeNull();
  app.sql("DROP TRIGGER reject_reply_read;");
  const saved = resultData(await rpc(page, "replyToMail", input));
  expect(resultData(await rpc(page, "replyToMail", input))).toEqual(saved);
  expect(
    await rpc(page, "replyToMail", { ...input, bodyText: "changed" }),
  ).toEqual({ ok: false, error: "REPLY_CONFLICT" });
  expect(
    await rpc(page, "replyToMail", { ...input, mailId: state.mails[1]!.id }),
  ).toEqual({ ok: false, error: "REPLY_CONFLICT" });
  for (const extra of [
    { view: "active" },
    { owner_id: (await identity(page)).ownerKey },
  ])
    expect(
      (await rpc(page, "archiveMail", { ...state.input, ...extra })).ok,
    ).toBe(false);
  for (const bodyText of [" ", "x".repeat(10001)])
    expect(
      (
        await rpc(page, "replyToMail", {
          ...input,
          replyId: randomUUID(),
          bodyText,
        })
      ).ok,
    ).toBe(false);
  for (const [method, data] of [
    ["replyToMail", { ...input, domainId: "internal-team" }],
    ["archiveMail", { ...state.input, domainId: "internal-team" }],
    [
      "archiveUnreadSnapshot",
      {
        ...scopeOf(state.input),
        domainId: "internal-team",
        mailIds: [state.mail.id],
      },
    ],
  ] as const)
    expect(await rpc(page, method, data)).toEqual({
      ok: false,
      error: "NOT_FOUND",
    });
  resultData(
    await rpc(page, "replyToMail", {
      ...input,
      replyId: randomUUID(),
      bodyText: "x".repeat(10000),
    }),
  );
  expect((await detail(page, state.input)).replies).toHaveLength(2);
  const scope = scopeOf(state.input);
  const remaining = state.mails.slice(1).map((mail) => mail.id);
  for (const mailIds of [
    [],
    [remaining[0], remaining[0]],
    state.mails.map((mail) => mail.id),
    ["bad-id"],
  ])
    expect(
      (await rpc(page, "archiveUnreadSnapshot", { ...scope, mailIds })).ok,
    ).toBe(false);
  resultData(
    await rpc(page, "archiveMail", { ...scope, mailId: remaining[0] }),
  );
  expect(
    await rpc(page, "archiveUnreadSnapshot", { ...scope, mailIds: remaining }),
  ).toEqual({ ok: false, error: "SNAPSHOT_CHANGED" });
  expect(
    (await detail(page, { ...scope, mailId: remaining[1] })).archivedAt,
  ).toBeNull();
  const anon = await browser.newContext();
  try {
    const b = await app.withContext(anon);
    for (const [method, data] of [
      ["replyToMail", input],
      ["archiveMail", state.input],
      ["archiveUnreadSnapshot", { ...scope, mailIds: [remaining[0]] }],
    ] as const)
      expect(await rpc(b, method, data)).toEqual({
        ok: false,
        error: "UNAUTHENTICATED",
      });
  } finally {
    await anon.close();
  }
});
