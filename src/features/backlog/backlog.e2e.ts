import { promisify } from "node:util";
import { execFile, execFileSync } from "node:child_process";
import { resolve } from "node:path";
import {
  test,
  expect,
  rpc,
  resultData,
  overview,
  call,
  prepare,
  selection,
  commit,
  records,
  service,
  setup,
  card,
} from "./backlog.acceptance";
import { mailListSchema, mailDetailSchema } from "../../lib/mailbox";
import { randomUUID } from "node:crypto";

test("AC1 fortress-prompt-selects-one-source-scope", async ({ page, app }) => {
  const { owner, category } = await setup(page, app);
  await card(page);
  await page.getByRole("button", { name: "批次封存", exact: true }).click();
  await expect(
    page.getByText("共 40 封，未讀 36 封", { exact: true }),
  ).toBeVisible();
  const plan = await prepare(page, category.id);
  expect(plan.totalCount).toBe(40);
  expect(plan.unreadCount).toBe(36);
  expect(
    new Set(plan.mails.map((mail) => mail.subject.split(" ")[0])).size,
  ).toBe(3);
  const other = (await overview(page)).domains.find(
    (entry) => entry.id === "finance-bills",
  )!.subcategories[0]!;
  expect(
    resultData(
      await call(page, "getBacklogPrompt", {
        scope: { subcategoryId: other.id },
      }),
    ),
  ).toMatchObject({ eligible: false });
  const data = await overview(page);
  const a = data.domains.find((entry) => entry.id === "core-projects")!;
  const c = data.domains.find((entry) => entry.id === "finance-bills")!;
  service(
    app,
    owner,
    "write",
    [
      ...a.subcategories.map((entry) => ({ entry, count: 15, domainId: a.id })),
      { entry: c.subcategories[0]!, count: 29, domainId: c.id },
    ].flatMap(({ entry, count, domainId }) =>
      Array.from({ length: count }, (_, index) => ({
        seedKey: `scope-${entry.id}-${index}`,
        domainId,
        subcategoryId: entry.id,
        sender: "範圍寄件者",
        subject: `範圍 ${entry.name} ${index}`,
        bodyText: "範圍內容",
        receivedAt: "2026-11-01T00:00:00.000Z",
        readAt: null,
        requiresReply: false,
      })),
    ),
  );
  expect(
    resultData(
      await call(page, "getBacklogPrompt", { scope: { domainId: a.id } }),
    ),
  ).toMatchObject({ eligible: true });
  expect(
    resultData(
      await call(page, "getBacklogPrompt", { scope: { domainId: c.id } }),
    ),
  ).toMatchObject({ eligible: false });
  await page.goto(app.url + "/island");
  await expect(
    page.getByText("核心專案有積壓郵件", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "處理積壓", exact: true }).click();
  await page.locator(`#subcategory-${a.subcategories[0]!.id}`).click();
  await card(page);
  await page.getByRole("button", { name: "批次封存", exact: true }).click();
  await expect(
    page.getByText("共 15 封，未讀 15 封", { exact: true }),
  ).toBeVisible();
});
test("AC2 prompt-cooldown-persists-and-manual-entry-remains", async ({
  page,
  app,
  browser,
}) => {
  const { owner, category } = await setup(page, app, [
    { sender: "來源", count: 30, read: 0 },
  ]);
  const scope = { scope: { subcategoryId: category.id } };
  app.time(new Date("2026-11-01T00:00:00Z"));
  expect(resultData(await call(page, "getBacklogPrompt", scope))).toMatchObject(
    { eligible: true },
  );
  resultData(await call(page, "dismissBacklogPrompt", scope));
  await page.reload();
  expect(resultData(await call(page, "getBacklogPrompt", scope))).toMatchObject(
    { eligible: false },
  );
  app.sql(
    `UPDATE mails SET read_at='2026-11-01T00:00:00Z' WHERE owner_id='${owner}' AND seed_key='來源-0'`,
  );
  expect(resultData(await call(page, "getBacklogPrompt", scope))).toMatchObject(
    { eligible: false },
  );
  app.sql(`UPDATE mails SET read_at=NULL WHERE owner_id='${owner}'`);
  app.time(new Date("2026-11-01T23:59:59.999Z"));
  expect(resultData(await call(page, "getBacklogPrompt", scope))).toMatchObject(
    { eligible: false },
  );
  await card(page);
  await expect(
    page.getByRole("button", { name: "批次封存", exact: true }),
  ).toBeVisible();
  app.time(new Date("2026-11-02T00:00:00Z"));
  expect(resultData(await call(page, "getBacklogPrompt", scope))).toMatchObject(
    { eligible: true },
  );
  const context = await browser.newContext();
  try {
    const second = await app.withContext(context);
    const other = await setup(second, app, [
      { sender: "來源", count: 30, read: 0 },
    ]);
    expect(other.owner).not.toBe(owner);
    expect(
      resultData(
        await call(second, "getBacklogPrompt", {
          scope: { subcategoryId: other.category.id },
        }),
      ),
    ).toMatchObject({ eligible: true });
  } finally {
    await context.close();
  }
});
test("AC3 sender-candidates-limits-and-name-validation", async ({
  page,
  app,
}) => {
  const { category } = await setup(page, app, [
    ...["F", "E", "D", "C", "B", "A"].map((sender, index) => ({
      sender,
      count: index === 5 ? 5 : 3,
      read: 1,
    })),
    { sender: "tiny", count: 2, read: 0 },
  ]);
  const plan = await prepare(page, category.id);
  expect(plan.groups.map((group) => group.sender)).toEqual([
    "A",
    "B",
    "C",
    "D",
    "E",
  ]);
  expect(plan.mails.some((mail) => mail.readAt !== null)).toBe(true);
  await card(page);
  await page.getByRole("button", { name: "查看分拆建議", exact: true }).click();
  await expect(page.getByLabel("子島名稱 1", { exact: true })).toHaveValue("A");
  await page.getByText(/檢視郵件 5 封/).click();
  await expect(page.getByText("已讀", { exact: true }).first()).toBeVisible();
  for (const name of [" ", "x".repeat(81), category.name, " B "]) {
    await page.getByLabel("子島名稱 1", { exact: true }).fill(name);
    await expect(
      page.getByRole("button", { name: "確認分拆", exact: true }),
    ).toBeDisabled();
  }
  const bad = selection(plan);
  bad.groups[0]!.name = " ";
  expect((await commit(page, plan, bad)).ok).toBe(false);
});
test("AC4 no-split-for-single-source-or-small-groups", async ({
  page,
  app,
}) => {
  const { owner, category } = await setup(page, app, [
    { sender: "單一", count: 30, read: 0 },
  ]);
  expect((await prepare(page, category.id)).groups).toEqual([]);
  await card(page);
  await page.getByRole("button", { name: "查看分拆建議", exact: true }).click();
  await expect(page.getByText("沒有分拆建議", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "批次封存", exact: true }),
  ).toBeEnabled();
  app.sql(`UPDATE mails SET sender=id WHERE owner_id='${owner}'`);
  expect((await prepare(page, category.id)).groups).toEqual([]);
  expect(
    records(app, `SELECT id FROM mails WHERE owner_id='${owner}'`),
  ).toHaveLength(30);
});
test("AC5 confirmed-split-updates-two-layer-counts-and-navigation", async ({
  page,
  app,
}) => {
  const { category } = await setup(page, app);
  await card(page);
  await page.getByRole("button", { name: "查看分拆建議", exact: true }).click();
  await page.getByLabel("子島名稱 1", { exact: true }).fill("設計週報");
  await page.getByLabel("子島名稱 2", { exact: true }).fill("產品筆記");
  await page
    .getByRole("checkbox", { name: "選取整組 其他來源", exact: true })
    .uncheck();
  await page.getByRole("button", { name: "確認分拆", exact: true }).click();
  await expect(
    page.getByText("已保存，群島已更新。", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "關閉積壓處理", exact: true }).click();
  await expect(page.locator(`#subcategory-${category.id}`)).toBeFocused();
  const data = await overview(page);
  expect(data.domains).toHaveLength(8);
  const domain = data.domains.find((entry) => entry.id === "newsletters")!;
  expect(domain.unreadCount).toBe(36);
  expect(
    domain.subcategories.find((entry) => entry.id === category.id)?.unreadCount,
  ).toBe(9);
  for (const [name, count] of [
    ["設計週報", 16],
    ["產品筆記", 11],
  ] as const) {
    await expect(
      page.getByRole("button", {
        name: new RegExp(`${name}，未讀 ${count} 封.*Lv. 3`),
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: new RegExp(`^${name}，`) }).click();
    await expect(
      page.getByRole("dialog", { name: name + "郵件" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "關閉郵件", exact: true }).click();
  }
  await page.getByRole("button", { name: "返回群島", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /電子報，未讀 36 封.*Lv. 4/ }),
  ).toBeVisible();
  await page.reload();
  expect(
    (await overview(page)).domains.find((entry) => entry.id === "newsletters")
      ?.unreadCount,
  ).toBe(36);
});
test("AC6 explicit-selection-preserves-unselected-manual-overrides", async ({
  page,
  app,
}) => {
  const { owner, category } = await setup(page, app, [
    { sender: "A", count: 3, read: 0 },
    { sender: "B", count: 3, read: 0 },
  ]);
  let plan = await prepare(page, category.id);
  const manual = plan.groups[0]!.mailIds[0]!;
  resultData(
    await call(page, "setMailCategory", {
      mailId: manual,
      subcategoryId: category.id,
    }),
  );
  plan = await prepare(page, category.id);
  expect(plan.mails.find((mail) => mail.id === manual)?.manual).toBe(true);
  await card(page);
  await page.getByRole("button", { name: "查看分拆建議", exact: true }).click();
  await page.getByText("檢視郵件 3 封，已選 2 封", { exact: true }).click();
  const manualSubject = plan.mails.find((mail) => mail.id === manual)!.subject;
  await expect(
    page.getByRole("checkbox", { name: new RegExp(`^${manualSubject}`) }),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "關閉積壓處理", exact: true }).click();
  expect(
    records(
      app,
      `SELECT id FROM subcategories WHERE owner_id='${owner}' AND origin='split'`,
    ),
  ).toHaveLength(0);
  await page.locator(`#subcategory-${category.id}`).click();
  await card(page);
  await page.getByRole("button", { name: "取消整組 A", exact: true }).click();
  await page.getByRole("button", { name: "取消整組 B", exact: true }).click();
  await page
    .getByText("檢視郵件 3 封，已選 0 封", { exact: true })
    .first()
    .click();
  await page
    .getByRole("checkbox", { name: new RegExp(`^${manualSubject}`) })
    .check();
  await page.getByRole("button", { name: "確認分拆", exact: true }).click();
  await expect(
    page.getByText("已保存，群島已更新。", { exact: true }),
  ).toBeVisible();
  expect(
    records(
      app,
      `SELECT id FROM subcategories WHERE owner_id='${owner}' AND origin='split'`,
    ),
  ).toHaveLength(1);
  expect(
    records(
      app,
      `SELECT id FROM mails WHERE owner_id='${owner}' AND subcategory_id='${category.id}'`,
    ),
  ).toHaveLength(5);
  expect(
    records(
      app,
      `SELECT subcategory_id FROM classification_overrides WHERE owner_id='${owner}' AND mail_id='${manual}'`,
    )[0]?.subcategory_id,
  ).not.toBe(category.id);
});
test("AC7 batch-archive-matches-confirmed-single-mail-policy", async ({
  page,
  app,
  browser,
}) => {
  const a = await setup(page, app, [
    { sender: "A", count: 4, read: 1 },
    { sender: "B", count: 3, read: 0 },
  ]);
  const context = await browser.newContext();
  try {
    const other = await app.withContext(context);
    const b = await setup(other, app, [
      { sender: "A", count: 4, read: 1 },
      { sender: "B", count: 3, read: 0 },
    ]);
    const pa = await prepare(page, a.category.id, "archive"),
      pb = await prepare(other, b.category.id, "archive");
    const selected = pa.mails.filter((mail) =>
      ["A 0", "A 1", "A 2"].includes(mail.subject),
    );
    const subjects = selected.map((mail) => mail.subject);
    for (const [target, cat, plan] of [
      [page, a.category, pa],
      [other, b.category, pb],
    ] as const) {
      const replied = plan.mails.find((mail) => mail.subject === subjects[0])!;
      resultData(
        await rpc(target, "replyToMail", {
          domainId: "newsletters",
          subcategoryId: cat.id,
          mailId: replied.id,
          replyId: randomUUID(),
          bodyText: "保留回覆",
        }),
      );
    }
    await card(page);
    await page.getByRole("button", { name: "批次封存", exact: true }).click();
    await page
      .getByRole("button", { name: "關閉積壓處理", exact: true })
      .click();
    expect(
      records(
        app,
        `SELECT id FROM mails WHERE owner_id='${a.owner}' AND archived_at IS NOT NULL`,
      ),
    ).toHaveLength(0);
    const latest = await prepare(page, a.category.id, "archive");
    resultData(
      await call(page, "commitBacklog", {
        planId: latest.planId,
        revision: latest.revision,
        selection: {
          action: "archive",
          mailIds: selected.map((mail) => mail.id),
        },
      }),
    );
    for (const mail of pb.mails.filter((mail) =>
      subjects.includes(mail.subject),
    ))
      resultData(
        await rpc(other, "archiveMail", {
          domainId: "newsletters",
          subcategoryId: b.category.id,
          mailId: mail.id,
        }),
      );
    const facts = (owner: string) =>
      records(
        app,
        `SELECT subject,read_at,requires_reply,archived_at IS NOT NULL AS archived,(SELECT COUNT(*) FROM mail_replies r WHERE r.owner_id=m.owner_id AND r.mail_id=m.id) AS replies FROM mails m WHERE owner_id='${owner}' ORDER BY subject`,
      );
    expect(facts(a.owner)).toEqual(facts(b.owner));
    await page.reload();
    const archive = mailListSchema.parse(
      resultData(
        await rpc(page, "listMail", {
          domainId: "newsletters",
          subcategoryId: a.category.id,
          view: "archived",
        }),
      ),
    );
    expect(archive.mails).toHaveLength(3);
    expect(archive.mails.some((mail) => mail.readAt === null)).toBe(true);
    expect(
      (await overview(page)).domains.find((entry) => entry.id === "newsletters")
        ?.unreadCount,
    ).toBe(4);
  } finally {
    await context.close();
  }
});
test("AC8 unchanged-plan-reuse-and-affected-group-update", async ({
  page,
  app,
}) => {
  const { owner, category } = await setup(page, app);
  const provider = process.env.TYPESAFE_BASE_URL!;
  const before = await (await fetch(provider + "/calls")).json();
  const first = await prepare(page, category.id);
  await card(page);
  await page.getByRole("button", { name: "關閉積壓處理", exact: true }).click();
  const second = await prepare(page, category.id);
  expect(second.planId).toBe(first.planId);
  expect(second.diagnostics.reusedItems).toBe(40);
  expect(second.diagnostics.recomputedSenders).toEqual([]);
  const mail = first.mails.find((entry) => entry.readAt === null)!;
  resultData(
    await rpc(page, "markMailRead", {
      domainId: "newsletters",
      subcategoryId: category.id,
      mailId: mail.id,
    }),
  );
  const read = await prepare(page, category.id);
  expect(read.planId).toBe(first.planId);
  expect(read.unreadCount).toBe(35);
  const sender = first.groups[0]!.sender;
  service(app, owner, "import", {
    key: "new",
    subcategoryId: category.id,
    sender,
    subject: "新增",
    bodyText: "新增內容",
    receivedAt: "2026-11-01T00:00:00.000Z",
    requiresReply: false,
  });
  const added = await prepare(page, category.id);
  expect(added.diagnostics).toEqual({
    reusedItems: 40,
    recomputedSenders: [sender],
  });
  expect(added.groups[1]).toEqual(first.groups[1]);
  expect(added.groups[0]!.mailIds).toHaveLength(
    first.groups[0]!.mailIds.length + 1,
  );
  expect(await (await fetch(provider + "/calls")).json()).toEqual(before);
});
for (const variant of ["placement", "content", "override", "archive"] as const)
  test(`AC9 stale-selection-rejected ${variant}`, async ({
    page,
    app,
    context,
  }) => {
    const { owner, category } = await setup(page, app);
    const plan = await prepare(page, category.id);
    const id = plan.groups[0]!.mailIds[0]!;
    const other = await context.newPage();
    await other.goto(app.url);
    if (variant === "override")
      resultData(
        await call(other, "setMailCategory", {
          mailId: id,
          subcategoryId: category.id,
        }),
      );
    else if (variant === "archive")
      resultData(
        await rpc(other, "archiveMail", {
          domainId: "newsletters",
          subcategoryId: category.id,
          mailId: id,
        }),
      );
    else
      app.sql(
        `UPDATE mails SET ${variant === "placement" ? "placement_revision=placement_revision+1" : "body_text='changed'"} WHERE owner_id='${owner}' AND id='${id}'`,
      );
    expect(await commit(page, plan)).toMatchObject({
      ok: false,
      error: "STALE_PLAN",
    });
    expect(
      records(
        app,
        `SELECT id FROM subcategories WHERE owner_id='${owner}' AND origin='split'`,
      ),
    ).toHaveLength(0);
  });
test("AC9 read-state-allowed-and-new-unselected-mail-stays", async ({
  page,
  app,
  context,
}) => {
  const { owner, category } = await setup(page, app);
  const plan = await prepare(page, category.id);
  const id = plan.groups[0]!.mailIds.find(
    (id) => plan.mails.find((mail) => mail.id === id)?.readAt === null,
  )!;
  const other = await context.newPage();
  await other.goto(app.url);
  resultData(
    await rpc(other, "markMailRead", {
      domainId: "newsletters",
      subcategoryId: category.id,
      mailId: id,
    }),
  );
  const added = service(app, owner, "import", {
    key: "unselected",
    subcategoryId: category.id,
    sender: plan.groups[0]!.sender,
    subject: "新未選",
    bodyText: "新",
    receivedAt: "2026-11-01T00:00:00.000Z",
    requiresReply: false,
  });
  resultData(await commit(page, plan));
  expect(
    records(
      app,
      `SELECT subcategory_id FROM mails WHERE owner_id='${owner}' AND id='${added.mailId}'`,
    )[0]?.subcategory_id,
  ).toBe(category.id);
  expect(
    (await overview(page)).domains.find((entry) => entry.id === "newsletters")
      ?.unreadCount,
  ).toBe(36);
});
test("AC10 atomic-commit-replay-rollback-and-name-conflict", async ({
  page,
  app,
  context,
}) => {
  const { owner, category } = await setup(page, app);
  const plan = await prepare(page, category.id);
  const choice = selection(plan);
  const other = await context.newPage();
  await other.goto(app.url);
  const fault = plan.groups[1]!.mailIds[0]!;
  app.sql(
    `CREATE TRIGGER fail_backlog BEFORE UPDATE OF subcategory_id ON mails WHEN OLD.id='${fault}' BEGIN SELECT RAISE(ABORT,'injected-write-failure'); END;`,
  );
  expect((await commit(page, plan, choice)).ok).toBe(false);
  expect(
    records(
      app,
      `SELECT id FROM subcategories WHERE owner_id='${owner}' AND origin='split'`,
    ),
  ).toHaveLength(0);
  expect(
    records(
      app,
      `SELECT id FROM mails WHERE owner_id='${owner}' AND subcategory_id='${category.id}'`,
    ),
  ).toHaveLength(40);
  app.sql("DROP TRIGGER fail_backlog");
  const results = await Promise.all([
    commit(page, plan, choice),
    commit(other, plan, choice),
  ]);
  expect(resultData(results[0]!)).toEqual(resultData(results[1]!));
  expect(resultData(await commit(page, plan, choice))).toEqual(
    resultData(results[0]!),
  );
  const changed = selection(plan);
  changed.groups = changed.groups.slice(0, 1);
  expect(await commit(page, plan, changed)).toMatchObject({
    ok: false,
    error: "PLAN_ALREADY_APPLIED",
  });
  expect(
    records(
      app,
      `SELECT id FROM subcategories WHERE owner_id='${owner}' AND origin='split'`,
    ),
  ).toHaveLength(3);
});
test("AC10 name-race-failure-has-zero-moves", async ({ page, app }) => {
  const { owner, category } = await setup(page, app);
  const plan = await prepare(page, category.id);
  const one = selection(plan);
  one.groups = [{ ...one.groups[0]!, name: "同名" }];
  resultData(await commit(page, plan, one));
  const remaining = await prepare(page, category.id);
  const two = selection(remaining);
  two.groups = [{ ...two.groups[0]!, name: "同名" }];
  expect(await commit(page, remaining, two)).toMatchObject({
    ok: false,
    error: "NAME_CONFLICT",
  });
  expect(
    records(
      app,
      `SELECT id FROM mails WHERE owner_id='${owner}' AND subcategory_id='${category.id}'`,
    ),
  ).toHaveLength(22);
});
test("AC11 committed-result-recovers-after-refresh-failure", async ({
  page,
  app,
}) => {
  const { owner } = await setup(page, app);
  await card(page);
  await page.getByRole("button", { name: "查看分拆建議", exact: true }).click();
  let block = false;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.postData()?.includes("selection")
    )
      block = true;
  });
  await page.route("**/*", (route) => {
    const request = route.request();
    if (
      block &&
      request.method() === "GET" &&
      request.url().includes("_serverFn")
    )
      return route.abort();
    return route.continue();
  });
  await page.getByRole("button", { name: "確認分拆", exact: true }).click();
  await expect(
    page.getByText("已保存，畫面尚未更新", { exact: true }).first(),
  ).toBeVisible();
  const saved = records(
    app,
    `SELECT id FROM subcategories WHERE owner_id='${owner}' AND origin='split'`,
  );
  expect(saved).toHaveLength(3);
  block = false;
  await page.getByRole("button", { name: "更新重試", exact: true }).click();
  await expect(
    page.getByText("已保存，群島已更新。", { exact: true }),
  ).toBeVisible();
  expect(
    records(
      app,
      `SELECT id FROM subcategories WHERE owner_id='${owner}' AND origin='split'`,
    ),
  ).toEqual(saved);
});
test("AC12 owner-scoped-plans-mails-groups-prompt-and-session", async ({
  page,
  app,
  browser,
}) => {
  const a = await setup(page, app);
  const pa = await prepare(page, a.category.id);
  const context = await browser.newContext();
  const anonymous = await browser.newContext();
  try {
    const other = await app.withContext(context);
    const b = await setup(other, app);
    const pb = await prepare(other, b.category.id);
    expect(await commit(page, pb)).toMatchObject({
      ok: false,
      error: "NOT_FOUND",
    });
    expect(
      await call(page, "prepareBacklog", {
        subcategoryId: b.category.id,
        action: "split",
      }),
    ).toMatchObject({ ok: false, error: "NOT_FOUND" });
    expect(
      await call(page, "getBacklogPrompt", {
        scope: { subcategoryId: b.category.id },
      }),
    ).toMatchObject({ ok: false, error: "NOT_FOUND" });
    for (const key of ["group", "mail"]) {
      const forged = selection(pa);
      if (key === "group") forged.groups[0]!.groupId = pb.groups[0]!.groupId;
      else forged.groups[0]!.mailIds = [pb.groups[0]!.mailIds[0]!];
      expect(await commit(page, pa, forged)).toMatchObject({
        ok: false,
        error: "NOT_FOUND",
      });
    }
    expect(
      (
        await call(page, "prepareBacklog", {
          ownerId: b.owner,
          subcategoryId: a.category.id,
          action: "split",
        })
      ).ok,
    ).toBe(false);
    const no = await app.withContext(anonymous);
    expect(
      await call(no, "prepareBacklog", {
        subcategoryId: a.category.id,
        action: "split",
      }),
    ).toMatchObject({ ok: false, error: "UNAUTHENTICATED" });
    expect(
      records(
        app,
        `SELECT id FROM mails WHERE owner_id='${b.owner}' AND subcategory_id='${b.category.id}'`,
      ),
    ).toHaveLength(40);
  } finally {
    await context.close();
    await anonymous.close();
  }
});
test("AC13 confirmed-placement-wins-and-new-mail-candidates-exclude-splits", async ({
  page,
  app,
}) => {
  const { owner, category } = await setup(page, app);
  const before = service(app, owner, "evidence");
  const plan = await prepare(page, category.id);
  resultData(await commit(page, plan));
  const after = service(app, owner, "evidence");
  expect(after.hash).toBe(before.hash);
  expect(after.candidates).toEqual(before.candidates);
  const data = await overview(page);
  const split = data.domains
    .find((entry) => entry.id === "newsletters")!
    .subcategories.find((entry) => entry.origin === "split")!;
  const moved = plan.groups[0]!.mailIds[0]!;
  expect(
    after.classifications.find(
      (entry: { mailId: string }) => entry.mailId === moved,
    ),
  ).toMatchObject({ source: "manual", subcategoryId: split.id });
  const detail = mailDetailSchema.parse(
    resultData(
      await rpc(page, "getMail", {
        domainId: "newsletters",
        subcategoryId: split.id,
        mailId: moved,
      }),
    ),
  );
  expect(detail.sender).toBe(plan.groups[0]!.sender);
  await page.goto(
    app.url +
      `/island?domain=newsletters&subcategory=${split.id}&mail=${moved}`,
  );
  await page.getByRole("button", { name: "修改分類", exact: true }).click();
  await expect(
    page.getByRole("option", { name: split.name, exact: true }),
  ).toBeAttached();
});
test("AC14 stable-anchors-zero-foundation-and-keyboard-return", async ({
  page,
  app,
}) => {
  const { category } = await setup(page, app, [
    { sender: "A", count: 3, read: 0 },
    { sender: "B", count: 3, read: 0 },
  ]);
  const before = (await overview(page)).domains.find(
    (entry) => entry.id === "newsletters",
  )!;
  const plan = await prepare(page, category.id);
  await card(page);
  await page.keyboard.press("Escape");
  await expect(page.locator(`#subcategory-${category.id}`)).toBeFocused();
  resultData(await commit(page, plan));
  await page.reload();
  const after = (await overview(page)).domains.find(
    (entry) => entry.id === "newsletters",
  )!;
  for (const old of before.subcategories)
    expect(
      after.subcategories.find((entry) => entry.id === old.id)?.layoutSlot,
    ).toBe(old.layoutSlot);
  const source = page.getByRole("button", {
    name: new RegExp(`^${category.name}，未讀 0 封.*地基`),
  });
  await expect(source).toBeVisible();
  await source.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("這裡還沒有郵件。", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "關閉郵件", exact: true }).click();
  await expect(source).toBeFocused();
  const child = after.subcategories.find((entry) => entry.origin === "split")!;
  await page.locator(`#subcategory-${child.id}`).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: child.name + "郵件" }),
  ).toBeVisible();
});

test("AC10 concurrent-name-race-and-lost-response-replay", async ({
  page,
  app,
  context,
}) => {
  const { owner, category } = await setup(page, app);
  const first = await prepare(page, category.id);
  service(app, owner, "import", {
    key: "plan-revision",
    subcategoryId: category.id,
    sender: "新來源",
    subject: "新信",
    bodyText: "新",
    receivedAt: "2026-11-01T00:00:00.000Z",
    requiresReply: false,
  });
  const second = await prepare(page, category.id);
  const a = selection(first);
  a.groups = [{ ...a.groups[0]!, name: "同名競爭" }];
  const b = selection(second);
  b.groups = [{ ...b.groups[1]!, name: "同名競爭" }];
  const other = await context.newPage();
  await other.goto(app.url);
  const results = await Promise.all([
    commit(page, first, a),
    commit(other, second, b),
  ]);
  expect(results.filter((result) => result.ok)).toHaveLength(1);
  expect(results.find((result) => !result.ok)).toMatchObject({
    error: "NAME_CONFLICT",
  });
  expect(
    records(
      app,
      `SELECT id FROM subcategories WHERE owner_id='${owner}' AND name='同名競爭'`,
    ),
  ).toHaveLength(1);
  const remaining = await prepare(page, category.id);
  const choice = selection(remaining);
  choice.groups = [{ ...choice.groups[0]!, name: "回應遺失" }];
  let lost = false;
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (
      !lost &&
      request.method() === "POST" &&
      request.postData()?.includes(remaining.planId)
    ) {
      lost = true;
      await route.fetch();
      await route.abort();
      return;
    }
    await route.continue();
  });
  expect((await commit(page, remaining, choice)).ok).toBe(false);
  expect(lost).toBe(true);
  const saved = records(
    app,
    `SELECT id FROM subcategories WHERE owner_id='${owner}' AND name='回應遺失'`,
  );
  expect(saved).toHaveLength(1);
  resultData(await commit(page, remaining, choice));
  expect(
    records(
      app,
      `SELECT id FROM subcategories WHERE owner_id='${owner}' AND name='回應遺失'`,
    ),
  ).toEqual(saved);
});

test("AC13 delayed-real-worker-and-new-classified-import", async ({
  page,
  app,
}) => {
  const { owner, category } = await setup(page, app, [
    { sender: "A", count: 3, read: 0 },
    { sender: "B", count: 3, read: 0 },
  ]);
  const provider = process.env.TYPESAFE_BASE_URL!;
  const heldSubject = "A 0";
  await fetch(provider + "/control", {
    method: "POST",
    body: JSON.stringify([
      {
        subject: heldSubject,
        step: "domain",
        choice: "newsletters",
        hold: true,
      },
      ...["A 1", "A 2", "B 0", "B 1", "B 2"].flatMap((subject) => [
        { subject, step: "domain", choice: "newsletters" },
        { subject, step: "subcategory", choice: category.id },
      ]),
    ]),
  });
  await app.worker(true);
  resultData(await call(page, "startClassifiedDemo"));
  await expect
    .poll(async () => await (await fetch(provider + "/held")).json())
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({ subject: heldSubject }),
      ]),
    );
  const plan = await prepare(page, category.id);
  const moved = plan.mails.find((mail) => mail.subject === heldSubject)!.id;
  const before = service(app, owner, "evidence");
  resultData(await commit(page, plan));
  const after = service(app, owner, "evidence");
  expect(after.hash).toBe(before.hash);
  for (const result of before.classifications) {
    expect(
      after.classifications.find(
        (entry: { mailId: string }) => entry.mailId === result.mailId,
      ).history,
    ).toEqual(
      result.history.map((work: Record<string, unknown>) => ({
        ...work,
        resolved: 1,
        outcome: work.outcome === "pending" ? "superseded" : work.outcome,
      })),
    );
  }
  await fetch(provider + "/release");
  await expect
    .poll(
      () =>
        records(
          app,
          `SELECT outcome FROM classification_work WHERE owner_id='${owner}' AND mail_id='${moved}'`,
        )[0]?.outcome,
    )
    .toBe("superseded");
  const placed = records(
    app,
    `SELECT subcategory_id FROM mails WHERE owner_id='${owner}' AND id='${moved}'`,
  )[0]?.subcategory_id;
  expect(placed).not.toBe(category.id);
  const subject = "新信原候選";
  await fetch(provider + "/control", {
    method: "POST",
    body: JSON.stringify([
      { subject, step: "domain", choice: "newsletters" },
      { subject, step: "subcategory", choice: category.id },
    ]),
  });
  const imported = JSON.parse(
    execFileSync(
      process.execPath,
      [
        resolve("node_modules/tsx/dist/cli.mjs"),
        "src/features/classifier/acceptance-write.server.ts",
        owner,
        JSON.stringify({
          key: "real-import",
          subcategoryId: category.id,
          sender: "A",
          subject,
          bodyText: "新信內容",
          receivedAt: "2026-11-01T00:00:00.000Z",
          requiresReply: false,
        }),
      ],
      {
        env: { ...process.env, EMAIL_ISLAND_DB_PATH: app.dbPath },
        encoding: "utf8",
      },
    ),
  );
  await expect
    .poll(
      () =>
        records(
          app,
          `SELECT outcome FROM classification_work WHERE owner_id='${owner}' AND mail_id='${imported.mailId}'`,
        )[0]?.outcome,
      { timeout: 20000 },
    )
    .toBe("succeeded");
  expect(
    records(
      app,
      `SELECT subcategory_id FROM mails WHERE owner_id='${owner}' AND id='${imported.mailId}'`,
    )[0]?.subcategory_id,
  ).toBe(category.id);
  const calls = await (await fetch(provider + "/calls")).json();
  const subcall = calls.findLast(
    (entry: { subject: string; step: string }) =>
      entry.subject === subject && entry.step === "subcategory",
  );
  expect(Object.keys(subcall.body.questions.category.criteria)).not.toContain(
    placed,
  );
  expect(
    records(
      app,
      `SELECT subcategory_id FROM mails WHERE owner_id='${owner}' AND id='${moved}'`,
    )[0]?.subcategory_id,
  ).toBe(placed);
});

test("AC10 multiprocess-same-plan-commits-once", async ({ page, app }) => {
  const { owner, category } = await setup(page, app);
  const plan = await prepare(page, category.id);
  const input = {
    planId: plan.planId,
    revision: plan.revision,
    selection: selection(plan),
  };
  const execute = promisify(execFile);
  const run = () =>
    execute(
      process.execPath,
      [
        resolve("node_modules/tsx/dist/cli.mjs"),
        "src/features/backlog/backlog-confirm.acceptance.server.ts",
        owner,
        JSON.stringify(input),
      ],
      { env: { ...process.env, EMAIL_ISLAND_DB_PATH: app.dbPath } },
    );
  const results = await Promise.all([run(), run()]);
  expect(JSON.parse(results[0]!.stdout)).toEqual(
    JSON.parse(results[1]!.stdout),
  );
  expect(
    records(
      app,
      `SELECT id FROM subcategories WHERE owner_id='${owner}' AND origin='split'`,
    ),
  ).toHaveLength(3);
  expect(
    records(
      app,
      `SELECT id FROM mails WHERE owner_id='${owner}' AND subcategory_id='${category.id}'`,
    ),
  ).toHaveLength(0);
});
