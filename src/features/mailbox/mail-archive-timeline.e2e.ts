import {
  test,
  expect,
  enter,
  rpc,
  resultData,
  overview,
  subjectButton,
} from "./acceptance-fixtures";
import { mailListSchema, mailDetailSchema } from "../../lib/mailbox";

// The actual service retains all thirty exact story sources, including ten unread.
// Archived unread mail never qualifies the active building as a city.
test("archived story keeps ten unread without an active city timeline", async ({
  page,
  app,
  browser,
}) => {
  await enter(page, app.url);
  const finance = (await overview(page)).domains.find(
    (domain) => domain.id === "finance-bills",
  )!;
  const category = finance.subcategories[0]!;
  const scope = { domainId: finance.id, subcategoryId: category.id };
  await page.getByRole("button", { name: /^財務帳單，/ }).click();
  await page.getByRole("button", { name: /^待處理帳單，/ }).click();
  const timeline = page.getByRole("region", {
    name: "郵件時間軸",
    exact: true,
  });
  await expect(timeline).toBeVisible();
  const archivedTab = page.getByRole("button", { name: "已封存", exact: true });
  await expect(archivedTab).toBeVisible();
  const original = mailListSchema.parse(
    resultData(await rpc(page, "listMail", { ...scope, view: "active" })),
  );
  expect(original.mails).toHaveLength(30);
  expect(original.unreadCount).toBe(10);
  expect(original.timeline).not.toBeNull();
  const read = original.mails.find((mail) => mail.readAt !== null)!;
  // Preserve every unread flag while exercising the actual archive RPC.
  for (const mail of original.mails)
    resultData(await rpc(page, "archiveMail", { ...scope, mailId: mail.id }));
  await archivedTab.click();
  await expect(
    page.getByRole("heading", { name: "已封存列表", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("list", { name: "郵件列表", exact: true })
      .getByRole("listitem"),
  ).toHaveCount(30);
  await expect(timeline).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^待處理帳單，/ }),
  ).toHaveAccessibleName(/未讀 0 封，待回覆 0 封，地基/);
  const archived = mailListSchema.parse(
    resultData(await rpc(page, "listMail", { ...scope, view: "archived" })),
  );
  expect(archived.mails).toHaveLength(30);
  expect(archived.unreadCount).toBe(10);
  expect(archived.timeline).toBeNull();
  expect(archived.mails.filter((mail) => mail.readAt === null)).toHaveLength(
    10,
  );
  const active = mailListSchema.parse(
    resultData(await rpc(page, "listMail", { ...scope, view: "active" })),
  );
  expect(active).toEqual({ mails: [], unreadCount: 0, timeline: null });
  await subjectButton(page, read.subject).click();
  const saved = mailDetailSchema.parse(
    resultData(await rpc(page, "getMail", { ...scope, mailId: read.id })),
  );
  expect(saved.readAt).toBe(read.readAt);
  expect(saved.archivedAt).not.toBeNull();
  expect(saved.replies).toEqual([]);
  await page.getByRole("button", { name: "返回列表", exact: true }).click();
  await expect(archivedTab).toHaveAttribute("aria-pressed", "true");

  // The active query still has its old city result cached. Pending/error states
  // must hide it when switching views until this exact owner/view is refreshed.
  const source = await (
    await page.request.get(
      `${app.url}/src/features/mailbox/mailbox.functions.ts`,
    )
  ).text();
  const line = source
    .split("\n")
    .find((line) => line.startsWith("export const listMail ="));
  const id = line?.match(/createClientRpc\("([^"]+)"/)?.[1];
  if (!id) throw new Error("Missing list RPC");
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let intercepted = false;
  await page.route(`**/_serverFn/${id}**`, async (route) => {
    intercepted = true;
    await gate;
    await route.abort();
  });
  await page.getByRole("button", { name: "郵件", exact: true }).click();
  await expect.poll(() => intercepted).toBe(true);
  await expect(timeline).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("正在載入郵件");
  release();
  await expect(page.getByRole("alert")).toContainText("郵件載入失敗");
  await expect(timeline).toHaveCount(0);
  await page.unroute(`**/_serverFn/${id}**`);
  await page
    .getByRole("alert")
    .getByRole("button", { name: "重試", exact: true })
    .click();
  await expect(
    page.getByText("這裡還沒有郵件。", { exact: true }),
  ).toBeVisible();
  await expect(timeline).toHaveCount(0);
  await archivedTab.click();
  await expect(
    page
      .getByRole("list", { name: "郵件列表", exact: true })
      .getByRole("listitem"),
  ).toHaveCount(30);
  await expect(timeline).toHaveCount(0);

  const other = await browser.newContext();
  try {
    const b = await other.newPage();
    await enter(b, app.url);
    for (const view of ["active", "archived"])
      expect(await rpc(b, "listMail", { ...scope, view })).toEqual({
        ok: false,
        error: "NOT_FOUND",
      });
    const own = (await overview(b)).domains.find(
      (domain) => domain.id === finance.id,
    )!;
    expect(own.unreadCount).toBe(10);
    const ownList = mailListSchema.parse(
      resultData(
        await rpc(b, "listMail", {
          domainId: own.id,
          subcategoryId: own.subcategories[0]!.id,
          view: "active",
        }),
      ),
    );
    expect(ownList.mails).toHaveLength(30);
    expect(ownList.timeline).not.toBeNull();
  } finally {
    await other.close();
  }
});
