import { randomUUID } from "node:crypto";
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
  identity,
} from "./backlog.acceptance";
import { facts, source, suggestions, list, counts } from "./backlog.assertions";
import { mailDetailSchema, mailListSchema } from "../../lib/mailbox";

const savedMessage = "已保存，群島已更新。";
const nameError = "名稱須為 1 至 80 字元，且同領域不可重名。";

test("AC1 clauses exact30 fortress and both scoped UI actions", async ({
  page,
  app,
}) => {
  const { owner, category } = await setup(page, app, [
    { sender: "B甲", count: 15, read: 0 },
    { sender: "B乙", count: 15, read: 0 },
  ]);
  const data = await overview(page);
  const a = data.domains.find((domain) => domain.id === "core-projects")!;
  const c = data.domains.find((domain) => domain.id === "finance-bills")!;
  service(
    app,
    owner,
    "write",
    [
      ...a.subcategories.map((entry) => ({ entry, count: 15, domainId: a.id })),
      { entry: c.subcategories[0]!, count: 29, domainId: c.id },
    ].flatMap(({ entry, count, domainId }) =>
      Array.from({ length: count }, (_, i) => ({
        seedKey: `exact-${entry.id}-${i}`,
        domainId,
        subcategoryId: entry.id,
        sender: `來源 ${entry.name}`,
        subject: `${entry.name} ${i}`,
        bodyText: "所選分類內容",
        receivedAt: "2026-11-01T00:00:00.000Z",
        readAt: null,
        requiresReply: false,
      })),
    ),
  );
  const factsSchema = mailDetailSchema
    .pick({ id: true, sender: true, subject: true })
    .array();
  const ordered = (value: unknown) =>
    factsSchema.parse(value).toSorted((x, y) => x.id.localeCompare(y.id));
  const expectedA = ordered(
    records(
      app,
      `SELECT id,sender,subject FROM mails WHERE owner_id='${owner}' AND subcategory_id='${a.subcategories[0]!.id}'`,
    ),
  );
  const expectedB = ordered(
    records(
      app,
      `SELECT id,sender,subject FROM mails WHERE owner_id='${owner}' AND subcategory_id='${category.id}'`,
    ),
  );
  expect(
    expectedA
      .map((mail) => mail.subject)
      .toSorted((x, y) => x.localeCompare(y)),
  ).toEqual(
    Array.from(
      { length: 15 },
      (_, index) => `${a.subcategories[0]!.name} ${index}`,
    ).toSorted((x, y) => x.localeCompare(y)),
  );
  expect(new Set(expectedA.map((mail) => mail.sender))).toEqual(
    new Set([`來源 ${a.subcategories[0]!.name}`]),
  );
  expect(
    expectedB
      .map((mail) => mail.subject)
      .toSorted((x, y) => x.localeCompare(y)),
  ).toEqual(
    ["B甲", "B乙"]
      .flatMap((sender) =>
        Array.from({ length: 15 }, (_, index) => `${sender} ${index}`),
      )
      .toSorted((x, y) => x.localeCompare(y)),
  );
  expect(new Set(expectedB.map((mail) => mail.sender))).toEqual(
    new Set(["B甲", "B乙"]),
  );
  const all = ordered(
    records(
      app,
      `SELECT id,sender,subject FROM mails WHERE owner_id='${owner}'`,
    ),
  );
  await page.goto(app.url + "/island");
  await expect(
    page.getByText("核心專案有積壓郵件", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "處理積壓", exact: true }).click();
  await page.locator(`#subcategory-${a.subcategories[0]!.id}`).click();
  await card(page);
  for (const name of ["批次封存", "查看分拆建議"])
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  await expect(
    page.getByText("共 15 封，未讀 15 封", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "批次封存", exact: true }).click();
  const planA = await prepare(page, a.subcategories[0]!.id, "archive");
  expect(ordered(planA.mails)).toEqual(expectedA);
  await expect(
    page.getByRole("dialog", { name: /積壓處理/ }).getByRole("checkbox"),
  ).toHaveCount(15);
  for (const mail of expectedA)
    await expect(
      page.getByRole("checkbox", { name: `${mail.subject} 未讀`, exact: true }),
    ).toBeAttached();
  const foreignA = new Set(
    all
      .filter((mail) => !expectedA.some((expected) => expected.id === mail.id))
      .map((mail) => mail.id),
  );
  expect(planA.mails.filter((mail) => foreignA.has(mail.id))).toEqual([]);
  await page.goto(app.url + "/island");
  await page.getByRole("button", { name: /電子報，未讀 30 封.*Lv. 4/ }).click();
  await page.locator(`#subcategory-${category.id}`).click();
  await card(page);
  for (const name of ["批次封存", "查看分拆建議"])
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  await expect(
    page.getByText("共 30 封，未讀 30 封", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "批次封存", exact: true }).click();
  const planB = await prepare(page, category.id, "archive");
  expect(ordered(planB.mails)).toEqual(expectedB);
  await expect(
    page.getByRole("dialog", { name: /積壓處理/ }).getByRole("checkbox"),
  ).toHaveCount(30);
  for (const mail of expectedB)
    await expect(
      page.getByRole("checkbox", { name: `${mail.subject} 未讀`, exact: true }),
    ).toBeAttached();
  const foreignB = new Set(
    all
      .filter((mail) => !expectedB.some((expected) => expected.id === mail.id))
      .map((mail) => mail.id),
  );
  expect(planB.mails.filter((mail) => foreignB.has(mail.id))).toEqual([]);
  await page.goto(app.url + "/island?domain=finance-bills");
  await expect(
    page.getByRole("main", { name: "財務帳單板塊", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("財務帳單有積壓郵件", { exact: true }),
  ).toHaveCount(0);
});
test("AC2 clauses actual dismissal cooldown and exact-day reentry prompt", async ({
  page,
  app,
}) => {
  const { owner, category } = await setup(page, app, [
    { sender: "來源", count: 30, read: 0 },
  ]);
  app.time(new Date("2026-11-01T00:00:00Z"));
  await source(page, app, category.id);
  await page.getByRole("button", { name: "關閉積壓提示", exact: true }).click();
  await expect(
    page.getByText(`${category.name}有積壓郵件`, { exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "關閉積壓提示", exact: true }),
  ).toHaveCount(0);
  app.sql(
    `UPDATE mails SET read_at='2026-11-01T00:00:00Z' WHERE owner_id='${owner}' AND seed_key='來源-0'`,
  );
  await source(page, app, category.id);
  await expect(
    page.getByRole("button", { name: "關閉積壓提示", exact: true }),
  ).toHaveCount(0);
  app.sql(`UPDATE mails SET read_at=NULL WHERE owner_id='${owner}'`);
  app.time(new Date("2026-11-01T23:59:59.999Z"));
  await source(page, app, category.id);
  await expect(
    page.getByRole("button", { name: "關閉積壓提示", exact: true }),
  ).toHaveCount(0);
  await card(page);
  await expect(
    page.getByRole("button", { name: "批次封存", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "關閉積壓處理", exact: true }).click();
  app.time(new Date("2026-11-02T00:00:00Z"));
  await page.goto(app.url + "/island");
  await source(page, app, category.id);
  await expect(
    page.getByText(`${category.name}有積壓郵件`, { exact: true }),
  ).toBeVisible();
});
test("AC3 clauses full names read selection and visible normalized-name errors", async ({
  page,
  app,
}) => {
  const { owner, category } = await setup(page, app, [
    { sender: "Full sender A <a@example.com>", count: 4, read: 1 },
    { sender: "Full sender B <b@example.com>", count: 3, read: 0 },
  ]);
  const plan = await prepare(page, category.id);
  const before = facts(app, owner);
  await suggestions(page);
  for (const [i, group] of plan.groups.entries())
    await expect(
      page.getByLabel(`子島名稱 ${i + 1}`, { exact: true }),
    ).toHaveValue(group.sender);
  await page.getByText("檢視郵件 4 封，已選 4 封", { exact: true }).click();
  const read = plan.mails.find((mail) => mail.readAt !== null)!;
  const checkbox = page.getByRole("checkbox", {
    name: new RegExp(`^${read.subject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
  });
  await expect(checkbox).toBeEnabled();
  await checkbox.uncheck();
  await expect(checkbox).not.toBeChecked();
  await checkbox.check();
  await expect(checkbox).toBeChecked();
  for (const invalid of [
    " ",
    "x".repeat(81),
    category.name,
    ` ${plan.groups[1]!.sender} `,
  ]) {
    await page.getByLabel("子島名稱 1", { exact: true }).fill(invalid);
    await expect(
      page.getByText(nameError, {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "確認分拆", exact: true }),
    ).toBeDisabled();
    expect(facts(app, owner)).toEqual(before);
  }
  await page.getByLabel("子島名稱 1", { exact: true }).fill(" Café ");
  await page.getByLabel("子島名稱 2", { exact: true }).fill("Cafe\u0301");
  await expect(
    page.getByRole("button", { name: "確認分拆", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("alert")).toHaveText(nameError);
  const duplicate = selection(plan, [" Café ", "Cafe\u0301"]);
  expect((await commit(page, plan, duplicate)).ok).toBe(false);
  expect(facts(app, owner)).toEqual(before);
});
for (const mode of ["single", "small"] as const)
  test(`AC4 clauses ${mode} empty UI preview changes no facts`, async ({
    page,
    app,
  }) => {
    const { owner, category } = await setup(
      page,
      app,
      mode === "single"
        ? [{ sender: "單一來源", count: 30, read: 0 }]
        : [
            { sender: "A", count: 2, read: 0 },
            { sender: "B", count: 2, read: 0 },
          ],
    );
    const before = facts(app, owner);
    await card(page);
    await page
      .getByRole("button", { name: "查看分拆建議", exact: true })
      .click();
    await expect(page.getByText("沒有分拆建議", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "批次封存", exact: true }),
    ).toBeEnabled();
    expect(facts(app, owner)).toEqual(before);
    expect((await list(page, category.id)).mails).toHaveLength(
      mode === "single" ? 30 : 4,
    );
  });
test("AC5 clauses exact child lists bodies tiers and persisted two-layer identities", async ({
  page,
  app,
}) => {
  const { category } = await setup(page, app);
  const plan = await prepare(page, category.id);
  await suggestions(page);
  await page.getByLabel("子島名稱 1", { exact: true }).fill("設計週報");
  await page.getByLabel("子島名稱 2", { exact: true }).fill("產品筆記");
  await page
    .getByRole("button", { name: "取消整組 其他來源", exact: true })
    .click();
  await page.getByRole("button", { name: "確認分拆", exact: true }).click();
  await expect(page.getByText(savedMessage, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "關閉積壓處理", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: new RegExp(`^${category.name}，未讀 9 封.*Lv. 2`),
    }),
  ).toBeVisible();
  const saved = await overview(page);
  const domain = saved.domains.find((d) => d.id === "newsletters")!;
  const children = domain.subcategories.filter((c) => c.origin === "split");
  expect(children).toHaveLength(2);
  for (const [i, name] of ["設計週報", "產品筆記"].entries()) {
    const child = children.find((c) => c.name === name)!;
    const expected = plan.groups[i]!.mailIds.toSorted((a, b) =>
      a.localeCompare(b),
    );
    expect(
      (await list(page, child.id)).mails
        .map((m) => m.id)
        .toSorted((a, b) => a.localeCompare(b)),
    ).toEqual(expected);
    await page.locator(`#subcategory-${child.id}`).click();
    const mail = (await list(page, child.id)).mails.find(
      (mail) => mail.readAt !== null,
    )!;
    await page
      .getByRole("button")
      .filter({ has: page.getByText(mail.subject, { exact: true }) })
      .click();
    await expect(
      page.getByRole("article", { name: mail.subject }),
    ).toContainText(mail.sender);
    await expect(
      page.getByRole("article", { name: mail.subject }),
    ).toContainText(`內容 ${mail.subject}`);
    const detail = mailDetailSchema.parse(
      resultData(
        await rpc(page, "getMail", {
          domainId: "newsletters",
          subcategoryId: child.id,
          mailId: mail.id,
        }),
      ),
    );
    expect(detail.subcategoryId).toBe(child.id);
    await page.getByRole("button", { name: "關閉郵件", exact: true }).click();
    await expect(page.locator(`#subcategory-${child.id}`)).toBeFocused();
  }
  expect(
    (await list(page, category.id)).mails
      .map((m) => m.id)
      .toSorted((a, b) => a.localeCompare(b)),
  ).toEqual(plan.groups[2]!.mailIds.toSorted((a, b) => a.localeCompare(b)));
  await page.getByRole("button", { name: "返回群島", exact: true }).click();
  await expect(
    page.getByRole("main", { name: "郵件群島", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /電子報，未讀 36 封.*Lv. 4/ }),
  ).toBeVisible();
  await page.reload();
  expect(await overview(page)).toEqual(saved);
  await page.getByRole("button", { name: /電子報，未讀 36 封/ }).click();
  for (const child of children)
    await expect(page.locator(`#subcategory-${child.id}`)).toBeVisible();
  expect((await overview(page)).domains).toHaveLength(8);
});
test("AC6 clauses cancel and unselected placements and overrides stay exact", async ({
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
  const before = facts(app, owner);
  await suggestions(page);
  await page.getByRole("button", { name: "關閉積壓處理", exact: true }).click();
  expect(facts(app, owner)).toEqual(before);
  const choice = selection(plan);
  choice.groups = [{ ...choice.groups[0]!, mailIds: [manual] }];
  resultData(await commit(page, plan, choice));
  const after = facts(app, owner);
  const child = after.categories.find((row) => row.origin === "split")!;
  expect(after.mails.find((row) => row.id === manual)?.subcategory_id).toBe(
    child.id,
  );
  expect(
    after.overrides.find((row) => row.mail_id === manual)?.subcategory_id,
  ).toBe(child.id);
  expect(after.mails.filter((row) => row.id !== manual)).toEqual(
    before.mails.filter((row) => row.id !== manual),
  );
  expect(after.overrides.filter((row) => row.mail_id !== manual)).toEqual(
    before.overrides.filter((row) => row.mail_id !== manual),
  );
});
test("AC7 clauses UI selected archive preserves every unselected fact and both layer aggregates", async ({
  page,
  app,
}) => {
  const { owner, category } = await setup(page, app, [
    { sender: "A", count: 4, read: 1 },
    { sender: "B", count: 3, read: 0 },
  ]);
  const initial = await prepare(page, category.id, "archive");
  const replied = initial.mails.find((m) => m.subject === "A 0")!;
  resultData(
    await rpc(page, "replyToMail", {
      domainId: "newsletters",
      subcategoryId: category.id,
      mailId: replied.id,
      replyId: randomUUID(),
      bodyText: "保留歷史",
    }),
  );
  const before = facts(app, owner);
  await card(page);
  await page.getByRole("button", { name: "批次封存", exact: true }).click();
  await page.getByRole("button", { name: "關閉積壓處理", exact: true }).click();
  expect(facts(app, owner)).toEqual(before);
  await source(page, app, category.id);
  await card(page);
  await page.getByRole("button", { name: "批次封存", exact: true }).click();
  const selected = new Set(
    initial.mails
      .filter((m) => ["A 0", "A 1", "A 2"].includes(m.subject))
      .map((m) => m.id),
  );
  for (const mail of initial.mails.filter((m) => !selected.has(m.id)))
    await page
      .getByRole("checkbox", { name: new RegExp(`^${mail.subject}`) })
      .uncheck();
  await page
    .getByRole("button", { name: "確認封存 3 封", exact: true })
    .click();
  await expect(page.getByText(savedMessage, { exact: true })).toBeVisible();
  const after = facts(app, owner);
  expect(after.mails.filter((m) => !selected.has(String(m.id)))).toEqual(
    before.mails.filter((m) => !selected.has(String(m.id))),
  );
  expect(after.replies).toEqual(before.replies);
  expect(after.overrides).toEqual(before.overrides);
  for (const old of before.mails.filter((m) => selected.has(String(m.id)))) {
    const now = after.mails.find((m) => m.id === old.id)!;
    expect(now).toEqual({ ...old, archived_at: expect.any(String) });
  }
  const archived = await list(page, category.id, "archived");
  expect(
    archived.mails.map((m) => m.id).toSorted((a, b) => a.localeCompare(b)),
  ).toEqual([...selected].toSorted((a, b) => a.localeCompare(b)));
  const pending = archived.mails.find((m) => m.subject === "A 2")!;
  expect(pending).toMatchObject({
    readAt: null,
    requiresReply: true,
    hasPendingReply: true,
  });
  const detail = mailDetailSchema.parse(
    resultData(
      await rpc(page, "getMail", {
        domainId: "newsletters",
        subcategoryId: category.id,
        mailId: replied.id,
      }),
    ),
  );
  expect(detail.replies.map((r) => r.bodyText)).toEqual(["保留歷史"]);
  await page.getByRole("button", { name: "關閉積壓處理", exact: true }).click();
  await counts(page, category.id, 4, 2, "Lv. 2");
  await page.getByRole("button", { name: "返回群島", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "電子報，未讀 4 封，待回覆 2 封，Lv. 2",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "電子報，未讀 4 封，待回覆 2 封，Lv. 2",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^電子報，未讀 4 封/ }).click();
  await counts(page, category.id, 4, 2, "Lv. 2");
  expect(facts(app, owner)).toEqual(after);
});
test("AC8 clauses edited draft survives close read and incremental new membership", async ({
  page,
  app,
  context,
}) => {
  const { owner, category } = await setup(page, app, [
    { sender: "A", count: 3, read: 0 },
    { sender: "B", count: 3, read: 0 },
  ]);
  const provider = process.env.TYPESAFE_BASE_URL!;
  const callsBefore = await (await fetch(provider + "/calls")).json();
  const plan = await prepare(page, category.id);
  await suggestions(page);
  await page.getByLabel("子島名稱 1", { exact: true }).fill("閱讀甲");
  await page
    .getByText("檢視郵件 3 封，已選 3 封", { exact: true })
    .first()
    .click();
  await page.getByRole("checkbox", { name: /^A 1/ }).uncheck();
  await page.getByRole("button", { name: "取消整組 B", exact: true }).click();
  await page.getByRole("button", { name: "關閉積壓處理", exact: true }).click();
  await page.locator(`#subcategory-${category.id}`).click();
  await card(page);
  await expect(page.getByLabel("子島名稱 1", { exact: true })).toHaveValue(
    "閱讀甲",
  );
  await page.getByText("檢視郵件 3 封，已選 2 封", { exact: true }).click();
  await expect(page.getByRole("checkbox", { name: /^A 1/ })).not.toBeChecked();
  await expect(
    page.getByText("檢視郵件 3 封，已選 0 封", { exact: true }),
  ).toBeVisible();
  const other = await context.newPage();
  await other.goto(app.url);
  const read = plan.mails.find((m) => m.subject === "A 0")!;
  resultData(
    await rpc(other, "markMailRead", {
      domainId: "newsletters",
      subcategoryId: category.id,
      mailId: read.id,
    }),
  );
  await page.getByRole("button", { name: "查看分拆建議", exact: true }).click();
  await expect(
    page.getByText("共 6 封，未讀 5 封", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("子島名稱 1", { exact: true })).toHaveValue(
    "閱讀甲",
  );
  await expect(page.getByRole("checkbox", { name: /^A 1/ })).not.toBeChecked();
  const readPlan = await prepare(page, category.id);
  expect(readPlan.planId).toBe(plan.planId);
  expect(readPlan.groups).toEqual(plan.groups);
  service(app, owner, "import", {
    key: "draft-new",
    subcategoryId: category.id,
    sender: "A",
    subject: "新增 A",
    bodyText: "新增內容",
    receivedAt: "2026-11-01T00:00:00.000Z",
    requiresReply: false,
  });
  await page.getByRole("button", { name: "查看分拆建議", exact: true }).click();
  await expect(
    page.getByText("共 7 封，未讀 6 封", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("子島名稱 1", { exact: true })).toHaveValue(
    "閱讀甲",
  );
  await expect(page.getByRole("checkbox", { name: /^A 1/ })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: /^新增 A/ })).toBeChecked();
  await expect(
    page.getByText("檢視郵件 3 封，已選 0 封", { exact: true }),
  ).toBeVisible();
  const added = await prepare(page, category.id);
  expect(added.groups[1]).toEqual(plan.groups[1]);
  expect(added.diagnostics).toEqual({ reusedItems: 7, recomputedSenders: [] });
  expect(await (await fetch(provider + "/calls")).json()).toEqual(callsBefore);
});
for (const variant of [
  "placement",
  "content",
  "manual",
  "manual-repeat",
  "archive",
] as const)
  test(`AC9 clauses ${variant} UI stale is atomic and can re-preview`, async ({
    page,
    app,
    context,
  }) => {
    const { owner, category } = await setup(page, app);
    let plan = await prepare(page, category.id);
    const id = plan.groups[0]!.mailIds[0]!;
    if (variant === "manual-repeat") {
      resultData(
        await call(page, "setMailCategory", {
          mailId: id,
          subcategoryId: category.id,
        }),
      );
      plan = await prepare(page, category.id);
    }
    const mail = plan.mails.find((m) => m.id === id)!;
    await suggestions(page);
    if (variant === "manual-repeat") {
      await page.getByText(/檢視郵件 18 封/).click();
      await page
        .getByRole("checkbox", { name: new RegExp(`^${mail.subject}`) })
        .check();
      await page
        .getByRole("button", { name: "關閉積壓處理", exact: true })
        .click();
      await page.locator(`#subcategory-${category.id}`).click();
      await card(page);
      await page
        .getByRole("button", { name: "查看分拆建議", exact: true })
        .click();
      await page.getByText(/檢視郵件 18 封/).click();
      await expect(
        page.getByRole("checkbox", { name: new RegExp(`^${mail.subject}`) }),
      ).toBeChecked();
    }
    const other = await context.newPage();
    await other.goto(app.url);
    if (variant === "manual" || variant === "manual-repeat")
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
    else if (variant === "content") {
      const old = records(
        app,
        `SELECT * FROM mails WHERE owner_id='${owner}' AND id='${id}'`,
      )[0]!;
      service(app, owner, "import", {
        key: old.seed_key,
        subcategoryId: category.id,
        sender: old.sender,
        subject: old.subject,
        bodyText: "另一頁修改內容",
        receivedAt: old.received_at,
        requiresReply: Boolean(old.requires_reply),
      });
    } else {
      const otherCategory = (await overview(other)).domains.find(
        (d) => d.id === "core-projects",
      )!.subcategories[0]!;
      app.sql(
        `UPDATE mails SET subcategory_id='${otherCategory.id}',placement_revision=placement_revision+1 WHERE owner_id='${owner}' AND id='${id}'`,
      );
    }
    const before = facts(app, owner);
    await page.getByRole("button", { name: "確認分拆", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText(
      "預覽已過時，請重新查看建議再確認。",
    );
    expect(facts(app, owner)).toEqual(before);
    await page
      .getByRole("button", { name: "查看分拆建議", exact: true })
      .click();
    await expect(
      page.getByText("預覽已過時，請重新查看建議再確認。", { exact: true }),
    ).toHaveCount(0);
    const fresh = await prepare(page, category.id);
    expect(fresh.revision).not.toBe(plan.revision);
    if (variant === "manual" || variant === "manual-repeat") {
      const details = page
        .getByRole("group", { name: "設計來源", exact: true })
        .locator("details");
      if ((await details.getAttribute("open")) === null) {
        await details.locator("summary").click();
      }
      await expect(
        page.getByRole("checkbox", { name: new RegExp(`^${mail.subject}`) }),
      ).not.toBeChecked();
    }
    await page.getByRole("button", { name: "確認分拆", exact: true }).click();
    await expect(page.getByText(savedMessage, { exact: true })).toBeVisible();
    expect(
      records(
        app,
        `SELECT id FROM subcategories WHERE owner_id='${owner}' AND origin='split'`,
      ),
    ).toHaveLength(3);
  });
test("AC10 clauses same-name loser displays conflict and all losing IDs stay", async ({
  page,
  app,
  context,
}, testInfo) => {
  const { owner, category } = await setup(page, app);
  const planA = await prepare(page, category.id);
  await suggestions(page);
  await page.getByLabel("子島名稱 1", { exact: true }).fill("名稱競爭");
  await page
    .getByRole("button", { name: "取消整組 產品來源", exact: true })
    .click();
  await page
    .getByRole("button", { name: "取消整組 其他來源", exact: true })
    .click();
  service(app, owner, "import", {
    key: "name-race-snapshot",
    subcategoryId: category.id,
    sender: "新來源",
    subject: "未選新信",
    bodyText: "不擴大任何確認範圍",
    receivedAt: "2026-11-01T00:00:00.000Z",
    requiresReply: false,
  });
  const other = await context.newPage();
  await source(other, app, category.id);
  const planB = await prepare(other, category.id);
  expect(planB.planId).not.toBe(planA.planId);
  expect(planB.revision).not.toBe(planA.revision);
  await suggestions(other);
  await other.getByLabel("子島名稱 2", { exact: true }).fill("名稱競爭");
  await other
    .getByRole("button", { name: "取消整組 設計來源", exact: true })
    .click();
  await other
    .getByRole("button", { name: "取消整組 其他來源", exact: true })
    .click();
  const losing = planA.groups[0]!.mailIds;
  const winning = planB.groups[1]!.mailIds;
  expect(losing.filter((id) => winning.includes(id))).toEqual([]);
  const before = facts(app, owner);
  const held = new Map<string, () => void>();
  const order: string[] = [];
  for (const [target, id] of [
    [page, planA.planId],
    [other, planB.planId],
  ] as const) {
    await target.route("**/_serverFn/**", async (route) => {
      const request = route.request();
      if (
        request.method() === "POST" &&
        request.postData()?.includes(id) &&
        request.postData()?.includes("selection")
      ) {
        order.push(`held:${id}`);
        await new Promise<void>((resolve) => held.set(id, () => resolve()));
        order.push(`continued:${id}`);
      }
      await route.continue();
    });
  }
  await Promise.all([
    page.getByRole("button", { name: "確認分拆", exact: true }).click(),
    other.getByRole("button", { name: "確認分拆", exact: true }).click(),
  ]);
  await expect.poll(() => held.size).toBe(2);
  held.get(planB.planId)!();
  await expect(other.getByText(savedMessage, { exact: true })).toBeVisible();
  held.get(planA.planId)!();
  await expect(
    page.getByText("名稱已存在，請修改名稱。", { exact: true }),
  ).toBeVisible();
  await testInfo.attach("same-name-real-rpc-order.json", {
    body: JSON.stringify(
      { planA: planA.planId, planB: planB.planId, order },
      null,
      2,
    ),
    contentType: "application/json",
  });
  const after = facts(app, owner);
  expect(
    after.mails.filter((mail) => losing.includes(String(mail.id))),
  ).toEqual(before.mails.filter((mail) => losing.includes(String(mail.id))));
  expect(
    after.overrides.filter((row) => losing.includes(String(row.mail_id))),
  ).toEqual(
    before.overrides.filter((row) => losing.includes(String(row.mail_id))),
  );
  const targets = records(
    app,
    `SELECT id FROM subcategories WHERE owner_id='${owner}' AND name='名稱競爭'`,
  );
  expect(targets).toHaveLength(1);
  for (const id of losing)
    expect(after.mails.find((mail) => mail.id === id)?.subcategory_id).toBe(
      category.id,
    );
  for (const id of winning)
    expect(after.mails.find((mail) => mail.id === id)?.subcategory_id).toBe(
      targets[0]!.id,
    );
  expect(after.categories).toHaveLength(before.categories.length + 1);
});
test("AC11 clauses refresh failure keeps old board and retry sends no mutation", async ({
  page,
  app,
}) => {
  const { owner, category } = await setup(page, app);
  await suggestions(page);
  let failedReads = false;
  let writes = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.postData()?.includes('"selection"')
    ) {
      writes++;
      failedReads = true;
    }
  });
  await page.route("**/*", (route) => {
    if (
      failedReads &&
      route.request().method() === "GET" &&
      route.request().url().includes("_serverFn")
    )
      return route.abort();
    return route.continue();
  });
  await page.getByRole("button", { name: "確認分拆", exact: true }).click();
  await expect(
    page.getByText("已保存，畫面尚未更新", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.locator(`#subcategory-${category.id}`)).toHaveAttribute(
    "aria-label",
    /未讀 36 封.*Lv. 4/,
  );
  await expect(
    page.getByRole("button", { name: /^設計來源，未讀/ }),
  ).toHaveCount(0);
  const persisted = facts(app, owner);
  expect(persisted.categories.filter((c) => c.origin === "split")).toHaveLength(
    3,
  );
  expect(writes).toBe(1);
  failedReads = false;
  await page.getByRole("button", { name: "更新重試", exact: true }).click();
  await expect(page.getByText(savedMessage, { exact: true })).toBeVisible();
  const actual = await overview(page);
  const domain = actual.domains.find((d) => d.id === "newsletters")!;
  expect(domain.unreadCount).toBe(36);
  expect(
    domain.subcategories.find((c) => c.id === category.id)?.unreadCount,
  ).toBe(0);
  for (const [name, count] of [
    ["設計來源", 16],
    ["產品來源", 11],
    ["其他來源", 9],
  ] as const)
    await expect(
      page.getByRole("button", {
        name: new RegExp(`^${name}，未讀 ${count} 封`),
      }),
    ).toBeVisible();
  expect(facts(app, owner)).toEqual(persisted);
  expect(writes).toBe(1);
});
test("AC12 clauses forged writes cannot affect B data or prompt and reload stays exact", async ({
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
    const before = facts(app, b.owner);
    const boardBefore = await overview(other);
    const listBefore = await list(other, b.category.id);
    const scope = { scope: { subcategoryId: b.category.id } };
    const promptBefore = resultData(
      await call(other, "getBacklogPrompt", scope),
    );
    const promptRowsBefore = records(
      app,
      `SELECT * FROM backlog_prompts WHERE owner_id='${b.owner}' ORDER BY scope`,
    );
    for (const method of ["getBacklogPrompt", "dismissBacklogPrompt"])
      expect(await call(page, method, scope)).toEqual({
        ok: false,
        error: "NOT_FOUND",
      });
    expect(
      await call(page, "prepareBacklog", {
        subcategoryId: b.category.id,
        action: "archive",
      }),
    ).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(await commit(page, pb)).toEqual({ ok: false, error: "NOT_FOUND" });
    const forged = selection(pa);
    forged.groups[0]!.groupId = pb.groups[0]!.groupId;
    expect(await commit(page, pa, forged)).toEqual({
      ok: false,
      error: "NOT_FOUND",
    });
    const ownArchive = await prepare(page, a.category.id, "archive");
    expect(
      await call(page, "commitBacklog", {
        planId: ownArchive.planId,
        revision: ownArchive.revision,
        selection: { action: "archive", mailIds: [pb.mails[0]!.id] },
      }),
    ).toEqual({ ok: false, error: "NOT_FOUND" });
    for (const method of ["prepareBacklog", "dismissBacklogPrompt"]) {
      const input =
        method === "prepareBacklog"
          ? { subcategoryId: a.category.id, action: "split", ownerId: b.owner }
          : { scope: { subcategoryId: a.category.id }, ownerId: b.owner };
      const response = await call(page, method, input);
      expect(response.ok).toBe(false);
      expect(JSON.stringify(response)).not.toContain(pb.mails[0]!.subject);
    }
    resultData(
      await call(page, "dismissBacklogPrompt", {
        scope: { subcategoryId: a.category.id },
      }),
    );
    expect(resultData(await call(other, "getBacklogPrompt", scope))).toEqual(
      promptBefore,
    );
    expect(
      records(
        app,
        `SELECT * FROM backlog_prompts WHERE owner_id='${b.owner}' ORDER BY scope`,
      ),
    ).toEqual(promptRowsBefore);
    const no = await app.withContext(anonymous);
    for (const method of ["prepareBacklog", "dismissBacklogPrompt"]) {
      const input =
        method === "prepareBacklog"
          ? { subcategoryId: b.category.id, action: "split" }
          : scope;
      expect(await call(no, method, input)).toEqual({
        ok: false,
        error: "UNAUTHENTICATED",
      });
    }
    await other.reload();
    await expect(other.locator(`#subcategory-${b.category.id}`)).toBeVisible();
    expect(await overview(other)).toEqual(boardBefore);
    expect(await list(other, b.category.id)).toEqual(listBefore);
    expect(facts(app, b.owner)).toEqual(before);
    expect(resultData(await call(other, "getBacklogPrompt", scope))).toEqual(
      promptBefore,
    );
  } finally {
    await context.close();
    await anonymous.close();
  }
});
test("AC14 clauses keyboard confirmation foundations and model-label destinations", async ({
  page,
  app,
}) => {
  const { owner, category } = await setup(page, app, [
    { sender: "A", count: 3, read: 0 },
    { sender: "B", count: 3, read: 0 },
  ]);
  const priorId = randomUUID();
  app.sql(
    `INSERT INTO subcategories(id,owner_id,seed_key,domain_id,name,automatic_eligible,origin,layout_slot) VALUES('${priorId}','${owner}','prior-newsletter','newsletters','既有電子報',1,'seed',1)`,
  );
  await source(page, app, category.id);
  await expect(
    page.locator(".scene-label-position[data-world-anchor]"),
  ).toHaveCount(2);
  const beforeAnchors = await page
    .locator(".scene-label-position[data-world-anchor]")
    .evaluateAll((elements) =>
      elements.map((element) => ({
        id: element
          .querySelector("[data-building]")!
          .getAttribute("data-building"),
        position: JSON.parse(element.getAttribute("data-world-anchor")!),
      })),
    );
  expect(beforeAnchors).toHaveLength(2);
  const original = (await overview(page)).domains.find(
    (d) => d.id === "newsletters",
  )!.subcategories;
  const otherOld = original.filter((entry) => entry.id !== category.id);
  expect(otherOld.map((entry) => entry.id)).toEqual([priorId]);
  expect(
    beforeAnchors
      .map((anchor) => anchor.id)
      .toSorted((x, y) => String(x).localeCompare(String(y))),
  ).toEqual(
    original.map((entry) => entry.id).toSorted((x, y) => x.localeCompare(y)),
  );
  await page
    .getByRole("button", { name: "處理積壓", exact: true })
    .last()
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: /積壓處理/ })).toBeVisible();
  await page.getByRole("button", { name: "查看分拆建議", exact: true }).click();
  await page.getByRole("button", { name: "確認分拆", exact: true }).click();
  await expect(page.getByText(savedMessage, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "關閉積壓處理", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(`#subcategory-${category.id}`)).toBeFocused();
  const afterAnchors = await page
    .locator(".scene-label-position[data-world-anchor]")
    .evaluateAll((elements) =>
      elements.map((element) => ({
        id: element
          .querySelector("[data-building]")!
          .getAttribute("data-building"),
        position: JSON.parse(element.getAttribute("data-world-anchor")!),
      })),
    );
  expect(
    afterAnchors.filter((anchor) =>
      original.some((entry) => entry.id === anchor.id),
    ),
  ).toEqual(beforeAnchors);
  expect(afterAnchors.find((anchor) => anchor.id === priorId)).toEqual(
    beforeAnchors.find((anchor) => anchor.id === priorId),
  );
  const domain = (await overview(page)).domains.find(
    (d) => d.id === "newsletters",
  )!;
  for (const old of original)
    expect(domain.subcategories.find((c) => c.id === old.id)?.layoutSlot).toBe(
      old.layoutSlot,
    );
  await expect(page.locator(`#subcategory-${category.id}`)).toHaveAttribute(
    "aria-label",
    /未讀 0 封.*地基/,
  );
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("這裡還沒有郵件。", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "關閉郵件", exact: true }).click();
  await expect(page.locator(`#subcategory-${category.id}`)).toBeFocused();
  for (const child of domain.subcategories.filter(
    (c) => c.origin === "split",
  )) {
    const label = page.locator(`#subcategory-${child.id}`);
    await label.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("dialog", { name: child.name + "郵件", exact: true }),
    ).toBeVisible();
    expect((await list(page, child.id)).mails).toHaveLength(3);
    await page.getByRole("button", { name: "關閉郵件", exact: true }).click();
    await expect(label).toBeFocused();
    const anchor = await page
      .locator(`[data-building="${child.id}"]`)
      .boundingBox();
    expect(anchor).not.toBeNull();
    if (!anchor) throw new Error("Missing actual model anchor");
    await page.mouse.click(
      anchor.x + anchor.width / 2,
      anchor.y + anchor.height / 2,
    );
    await expect(
      page.getByRole("dialog", { name: child.name + "郵件", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "關閉郵件", exact: true }).click();
    await expect(label).toBeFocused();
  }
  await page.getByRole("button", { name: "返回群島", exact: true }).click();
  await expect(
    page.getByRole("main", { name: "郵件群島", exact: true }),
  ).toBeVisible();
  expect((await overview(page)).domains).toHaveLength(8);
});
test("AC5 integration split invalidates real story exact match while read-only retains it", async ({
  page,
  app,
}) => {
  await app.worker(false);
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
  const category = (await overview(page)).domains
    .find((d) => d.id === "finance-bills")!
    .subcategories.find((c) => c.name === "待處理帳單")!;
  const scope = { domainId: "finance-bills", subcategoryId: category.id };
  await page.goto(
    app.url + `/island?domain=finance-bills&subcategory=${category.id}`,
  );
  await expect(page.locator(`#subcategory-${category.id}`)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "處理積壓", exact: true }).last(),
  ).toBeVisible();
  const readList = async (view: "active" | "archived" = "active") => {
    return mailListSchema.parse(
      resultData(await rpc(page, "listMail", { ...scope, view })),
    );
  };
  const initial = await readList();
  expect(initial.mails).toHaveLength(30);
  expect(initial.unreadCount).toBe(10);
  expect(initial.timeline?.stages).toHaveLength(3);
  const stages = initial.timeline!.stages;
  app.sql(
    `UPDATE mails SET read_at=NULL WHERE owner_id='${owner}' AND seed_key IN ('website-story-19','website-story-20')`,
  );
  await page.reload();
  await expect(
    page.getByRole("region", { name: "郵件時間軸", exact: true }),
  ).toBeVisible();
  expect((await readList()).timeline?.stages).toEqual(stages);
  const extra = initial.mails.find((m) => m.subject === "方案修訂 · 9")!;
  resultData(await rpc(page, "markMailRead", { ...scope, mailId: extra.id }));
  await page.reload();
  const read = await readList();
  expect(read.unreadCount).toBe(11);
  expect(read.timeline?.stages).toEqual(stages);
  await expect(
    page.getByRole("region", { name: "郵件時間軸", exact: true }),
  ).toBeVisible();
  const plan = await prepare(page, category.id);
  expect(plan.groups.map((g) => g.mailIds.length)).toEqual([20, 10]);
  await suggestions(page);
  await page.getByLabel("子島名稱 1", { exact: true }).fill("網站專案紀錄");
  await page
    .getByRole("button", {
      name: `取消整組 ${plan.groups[1]!.sender}`,
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "確認分拆", exact: true }).click();
  await expect(page.getByText(savedMessage, { exact: true })).toBeVisible();
  const child = (await overview(page)).domains
    .find((d) => d.id === "finance-bills")!
    .subcategories.find((c) => c.name === "網站專案紀錄")!;
  expect(child.unreadCount).toBe(10);
  const sourceActive = await readList();
  expect(
    sourceActive.mails.map((m) => m.id).toSorted((a, b) => a.localeCompare(b)),
  ).toEqual(plan.groups[1]!.mailIds.toSorted((a, b) => a.localeCompare(b)));
  expect(sourceActive.timeline).toBeNull();
  for (const view of ["active", "archived"] as const) {
    const target = mailListSchema.parse(
      resultData(
        await rpc(page, "listMail", {
          domainId: "finance-bills",
          subcategoryId: child.id,
          view,
        }),
      ),
    );
    expect(target.timeline).toBeNull();
    if (view === "active") {
      expect(target.unreadCount).toBe(10);
      expect(
        target.mails.map((m) => m.id).toSorted((a, b) => a.localeCompare(b)),
      ).toEqual(plan.groups[0]!.mailIds.toSorted((a, b) => a.localeCompare(b)));
    }
    expect((await readList(view)).timeline).toBeNull();
  }
  await page.getByRole("button", { name: "關閉積壓處理", exact: true }).click();
  await page.locator(`#subcategory-${child.id}`).click();
  await expect(
    page.getByRole("region", { name: "郵件時間軸", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: new RegExp(`^${child.name}，未讀 10 封.*Lv. 3`),
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "郵件時間軸", exact: true }),
  ).toHaveCount(0);
});
test("AC11 regression cached old-parent detail cannot block a healthy split refresh", async ({
  page,
  app,
}, testInfo) => {
  const { owner, category } = await setup(page, app);
  const initial = await list(page, category.id);
  const read = initial.mails.find(
    (mail) => mail.readAt !== null && mail.subject.startsWith("設計來源"),
  )!;
  await page
    .getByRole("button")
    .filter({ has: page.getByText(read.subject, { exact: true }) })
    .click();
  await expect(
    page.getByRole("article", { name: read.subject, exact: true }),
  ).toContainText(`內容 ${read.subject}`);
  await page.getByRole("button", { name: "返回列表", exact: true }).click();
  const responses: Promise<{ url: string; status: number; body: string }>[] =
    [];
  page.on("response", (response) => {
    if (
      response.request().method() === "GET" &&
      response.url().includes("_serverFn")
    )
      responses.push(
        response.text().then((body) => ({
          url: response.url(),
          status: response.status(),
          body,
        })),
      );
  });
  await suggestions(page);
  await page.getByRole("button", { name: "確認分拆", exact: true }).click();
  try {
    await expect(page.getByText(savedMessage, { exact: true })).toBeVisible();
  } finally {
    const reads = await Promise.all(responses);
    await testInfo.attach("post-split-real-read-responses.json", {
      body: JSON.stringify(reads, null, 2),
      contentType: "application/json",
    });
  }
  const reads = await Promise.all(responses);
  expect(
    reads.filter((response) => response.body.includes("NOT_FOUND")),
  ).toEqual([]);
  await expect(
    page.getByText("已保存，畫面尚未更新", { exact: true }),
  ).toHaveCount(0);
  const data = await overview(page);
  const domain = data.domains.find((entry) => entry.id === "newsletters")!;
  expect(domain.unreadCount).toBe(36);
  expect(
    domain.subcategories.find((entry) => entry.id === category.id)?.unreadCount,
  ).toBe(0);
  const target = records(
    app,
    `SELECT subcategory_id FROM mails WHERE owner_id='${owner}' AND id='${read.id}'`,
  )[0]?.subcategory_id;
  expect(target).not.toBe(category.id);
  expect(
    mailDetailSchema.parse(
      resultData(
        await rpc(page, "getMail", {
          domainId: "newsletters",
          subcategoryId: target,
          mailId: read.id,
        }),
      ),
    ).bodyText,
  ).toBe(`內容 ${read.subject}`);
});
