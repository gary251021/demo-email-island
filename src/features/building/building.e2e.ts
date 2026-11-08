import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { Page } from "@playwright/test";
import {
  test,
  expect,
  enter,
  identity,
  overview,
} from "../mailbox/acceptance-fixtures";

function tier(count: number) {
  if (count === 0) return "地基";
  if (count < 3) return "Lv. 1";
  if (count < 10) return "Lv. 2";
  if (count < 30) return "Lv. 3";
  return "Lv. 4";
}
const label = (name: string, count: number) =>
  `${name}，未讀 ${count} 封，${tier(count)}`;

async function seed(
  page: Page,
  dbPath: string,
  counts: number[],
  read = false,
) {
  const owner = await identity(page);
  const data = await overview(page);
  const domain = required(data.domains[0]);
  const db = new DatabaseSync(dbPath);
  const categories = counts.map((count, index) => ({
    id: randomUUID(),
    name: `積壓 ${index}`,
    count,
  }));
  try {
    db.prepare("DELETE FROM mails WHERE owner_id = ?").run(owner.ownerKey);
    db.prepare("DELETE FROM subcategories WHERE owner_id = ?").run(
      owner.ownerKey,
    );
    for (const category of categories) {
      db.prepare(
        "INSERT INTO subcategories (id,owner_id,seed_key,domain_id,name) VALUES (?,?,?,?,?)",
      ).run(category.id, owner.ownerKey, category.id, domain.id, category.name);
      for (let index = 0; index < category.count + (read ? 1 : 0); index++) {
        const id = randomUUID();
        db.prepare(
          "INSERT INTO mails (id,owner_id,seed_key,subcategory_id,sender,subject,body_text,received_at,read_at) VALUES (?,?,?,?,?,?,?,?,?)",
        ).run(
          id,
          owner.ownerKey,
          id,
          category.id,
          "寄件者 <sender@example.com>",
          "相同主旨",
          `可讀內文 ${index}`,
          "2026-01-01T00:00:00.000Z",
          index < category.count ? null : "2026-01-02T00:00:00.000Z",
        );
      }
    }
  } finally {
    db.close();
  }
  await page.reload();
  return { domain, categories };
}
async function domain(page: Page, name: string, count: number) {
  const button = page.getByRole("button", {
    name: label(name, count),
    exact: true,
  });
  await expect(button).toBeVisible();
  return button;
}
async function openMail(page: Page, name: string) {
  await page.getByRole("button", { name: new RegExp(`^${name}，`) }).click();
  await page
    .getByRole("button")
    .filter({ has: page.getByText("相同主旨", { exact: true }) })
    .first()
    .click();
  await expect(page.getByRole("article", { name: "相同主旨" })).toContainText(
    "可讀內文",
  );
}

test("AC-1 both layers derive tiers from unread email counts", async ({
  page,
  app,
}) => {
  await enter(page, app.url);
  for (const count of [0, 1, 2, 3, 9, 10, 29, 30, 31]) {
    const state = await seed(page, app.dbPath, [count]);
    await (await domain(page, state.domain.name, count)).click();
    await expect(
      page.getByRole("button", {
        name: label(required(state.categories[0]).name, count),
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "返回群島", exact: true }).click();
  }
  const state = await seed(page, app.dbPath, [2, 9, 30]);
  await (await domain(page, state.domain.name, 41)).click();
  for (const category of state.categories) {
    await expect(
      page.getByRole("button", {
        name: label(category.name, category.count),
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: label(category.name, category.count),
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("list", { name: "郵件列表" }).getByRole("listitem"),
    ).toHaveCount(category.count);
    await page.getByRole("button", { name: "關閉郵件", exact: true }).click();
  }
});

test("AC-2 reading crosses every tier boundary once", async ({ page, app }) => {
  await enter(page, app.url);
  for (const [count, other] of [
    [30, 0],
    [10, 0],
    [3, 0],
    [1, 0],
    [30, 2],
  ] as const) {
    const state = await seed(page, app.dbPath, [count, other]);
    await (await domain(page, state.domain.name, count + other)).click();
    await openMail(page, required(state.categories[0]).name);
    await expect(
      page.getByLabel(
        `${required(state.categories[0]).name}未讀 ${count - 1}`,
        {
          exact: true,
        },
      ),
    ).toBeVisible();
    const mailUrl = page.url();
    await page.getByRole("button", { name: "關閉郵件", exact: true }).click();
    await expect(
      page.getByRole("button", {
        name: label(required(state.categories[0]).name, count - 1),
        exact: true,
      }),
    ).toBeFocused();
    await page.getByRole("button", { name: "返回群島", exact: true }).click();
    await expect(
      await domain(page, state.domain.name, count + other - 1),
    ).toBeVisible();
    await page.goto(mailUrl);
    await expect(page.getByRole("article", { name: "相同主旨" })).toBeVisible();
    expect(required((await overview(page)).domains[0]).unreadCount).toBe(
      count + other - 1,
    );
    await page.getByRole("button", { name: "關閉郵件", exact: true }).click();
    await expect(
      page.getByRole("button", {
        name: label(required(state.categories[0]).name, count - 1),
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "返回群島", exact: true }).click();
  }
});

test("AC-3 zero foundations remain navigable", async ({ page, app }) => {
  await enter(page, app.url);
  const state = await seed(page, app.dbPath, [0, 0], true);
  const db = new DatabaseSync(app.dbPath);
  db.prepare("DELETE FROM mails WHERE subcategory_id = ?").run(
    required(state.categories[1]).id,
  );
  db.close();
  for (const keyboard of [false, true]) {
    const main = await domain(page, state.domain.name, 0);
    if (keyboard) {
      await main.focus();
      await page.keyboard.press("Enter");
    } else {
      const anchor = await page
        .locator('[data-building="core-projects"]')
        .boundingBox();
      if (!anchor) throw new Error("No foundation anchor");
      await page.mouse.click(
        anchor.x + anchor.width / 2,
        anchor.y + anchor.height / 2,
      );
    }
    const category = page.getByRole("button", {
      name: label(required(state.categories[0]).name, 0),
      exact: true,
    });
    if (keyboard) {
      await category.focus();
      await page.keyboard.press("Enter");
    } else {
      await category.click();
    }
    await page
      .getByRole("button")
      .filter({ has: page.getByText("相同主旨", { exact: true }) })
      .click();
    await expect(page.getByRole("article", { name: "相同主旨" })).toContainText(
      "可讀內文",
    );
    await page.getByRole("button", { name: "關閉郵件", exact: true }).click();
    const empty = page.getByRole("button", {
      name: label(required(state.categories[1]).name, 0),
      exact: true,
    });
    if (keyboard) {
      await empty.focus();
      await page.keyboard.press("Enter");
    } else {
      await empty.click();
    }
    await expect(
      page.getByText("這裡還沒有郵件。", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "關閉郵件", exact: true }).click();
    await page.getByRole("button", { name: "返回群島", exact: true }).click();
  }
  await expect(page.getByRole("button", { name: /Lv\. 0/ })).toHaveCount(0);
});

test("AC-4 counts survive reload and remain owner scoped", async ({
  page,
  browser,
  app,
}) => {
  await enter(page, app.url);
  const a = await seed(page, app.dbPath, [30]);
  const context = await browser.newContext();
  try {
    const b = await context.newPage();
    await enter(b, app.url);
    await seed(b, app.dbPath, [30]);
    await (await domain(page, a.domain.name, 30)).click();
    await openMail(page, required(a.categories[0]).name);
    await expect(
      page.getByLabel("積壓 0未讀 29", { exact: true }),
    ).toBeVisible();
    await page.goto(`${app.url}/island`);
    await expect(await domain(page, a.domain.name, 29)).toBeVisible();
    await page.reload();
    await expect(await domain(page, a.domain.name, 29)).toBeVisible();
    const saved = await page.context().storageState();
    const reopened = await browser.newContext({ storageState: saved });
    try {
      const fresh = await reopened.newPage();
      await fresh.goto(`${app.url}/island`);
      await expect(await domain(fresh, a.domain.name, 29)).toBeVisible();
    } finally {
      await reopened.close();
    }
    await expect(await domain(b, a.domain.name, 30)).toBeVisible();
    await page.context().clearCookies();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "進入群島", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /核心專案，/ })).toHaveCount(
      0,
    );
  } finally {
    await context.close();
  }
});

test("AC-5 exact tokens and stable placement", async ({ page, app }) => {
  await enter(page, app.url);
  const state = await seed(page, app.dbPath, [0, 1, 30, 100]);
  const main = await domain(page, state.domain.name, 131);
  await main.click();
  for (const category of state.categories)
    await expect(
      page.getByLabel(`${category.name}未讀 ${category.count}`, {
        exact: true,
      }),
    ).toHaveText(`未讀 ${category.count}`);
  const target = page.getByRole("button", {
    name: label("積壓 2", 30),
    exact: true,
  });
  const before = await target.boundingBox();
  const model = page.locator(
    `[data-building="${required(state.categories[2]).id}"]`,
  );
  const originalAnchor = await model.boundingBox();
  await target.focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("button")
    .filter({ has: page.getByText("相同主旨", { exact: true }) })
    .first()
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("積壓 2未讀 29", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "關閉郵件", exact: true }).focus();
  await page.keyboard.press("Enter");
  const after = page.getByRole("button", {
    name: label("積壓 2", 29),
    exact: true,
  });
  await expect(after).toBeFocused();
  await expect.poll(async () => await after.boundingBox()).toEqual(before);
  const labelUrl = async () => {
    await after.click();
    const url = page.url();
    await page.getByRole("button", { name: "關閉郵件", exact: true }).click();
    return url;
  };
  const expected = await labelUrl();
  await expect.poll(() => model.boundingBox()).toEqual(originalAnchor);
  const anchor = await model.boundingBox();
  if (!anchor) throw new Error("No building anchor");
  await page.mouse.click(
    anchor.x + anchor.width / 2,
    anchor.y + anchor.height / 2,
  );
  await expect(page).toHaveURL(expected);
});

test("AC-6 failed reads and overview refreshes preserve truthful counts", async ({
  page,
  app,
}) => {
  await enter(page, app.url);
  const state = await seed(page, app.dbPath, [30]);
  const functions = await page.request.get(
    `${app.url}/src/features/mailbox/mailbox.functions.ts`,
  );
  const source = await functions.text();
  const rpcId = (name: string) => {
    const line = source
      .split("\n")
      .find((line) => line.startsWith(`export const ${name} =`));
    const id = line?.match(/createClientRpc\("([^"]+)"/)?.[1];
    if (!id) throw new Error(`No RPC ID for ${name}`);
    return id;
  };
  const readId = rpcId("markMailRead");
  const overviewId = rpcId("getOverview");
  await (await domain(page, state.domain.name, 30)).click();
  await page
    .getByRole("button", { name: label("積壓 0", 30), exact: true })
    .click();
  let failRead = true;
  let failOverview = false;
  let armOverviewFailure = false;
  await page.route("**/_serverFn/**", async (route) => {
    const request = route.request();
    if (request.url().includes(readId) && failRead) {
      await route.abort();
      return;
    }
    if (request.url().includes(readId) && armOverviewFailure) {
      const response = await route.fetch();
      failOverview = true;
      await route.fulfill({ response });
      return;
    }
    if (request.url().includes(overviewId) && failOverview) {
      await route.abort();
      return;
    }
    await route.continue();
  });
  await page
    .getByRole("button")
    .filter({ has: page.getByText("相同主旨", { exact: true }) })
    .first()
    .click();
  await expect(page.getByRole("alert")).toContainText("保存失敗");
  await expect(page.getByRole("article", { name: "相同主旨" })).toContainText(
    "可讀內文",
  );
  await expect(page.getByLabel("積壓 0未讀 30", { exact: true })).toBeVisible();
  failRead = false;
  await page.getByRole("button", { name: "重試", exact: true }).click();
  await expect(page.getByLabel("積壓 0未讀 29", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "返回列表", exact: true }).click();
  await expect(page.getByRole("list", { name: "郵件列表" })).toBeVisible();
  armOverviewFailure = true;
  await page
    .getByRole("button")
    .filter({ has: page.getByText("相同主旨", { exact: true }) })
    .nth(1)
    .click();
  await expect(page.getByRole("alert")).toContainText("未能更新群島");
  await expect(page.getByRole("article", { name: "相同主旨" })).toContainText(
    "可讀內文",
  );
  await expect(page.getByLabel("積壓 0未讀 29", { exact: true })).toBeVisible();
  failOverview = false;
  await page.getByRole("button", { name: "重試", exact: true }).click();
  await expect(page.getByLabel("積壓 0未讀 28", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "關閉郵件", exact: true }).click();
  await page.getByRole("button", { name: "返回群島", exact: true }).click();
  await expect(await domain(page, state.domain.name, 28)).toBeVisible();
});

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Missing acceptance fixture");
  return value;
}
