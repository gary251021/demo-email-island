import type { Page } from "@playwright/test";
import type { App } from "../mailbox/acceptance-fixtures";
import { mailListSchema } from "../../lib/mailbox";
import {
  expect,
  rpc,
  resultData,
  records,
  overview,
  card,
} from "./backlog.acceptance";
export function facts(app: App, owner: string) {
  return {
    mails: records(
      app,
      `SELECT * FROM mails WHERE owner_id='${owner}' ORDER BY id`,
    ),
    categories: records(
      app,
      `SELECT * FROM subcategories WHERE owner_id='${owner}' ORDER BY id`,
    ),
    overrides: records(
      app,
      `SELECT * FROM classification_overrides WHERE owner_id='${owner}' ORDER BY mail_id`,
    ),
    replies: records(
      app,
      `SELECT * FROM mail_replies WHERE owner_id='${owner}' ORDER BY id`,
    ),
  };
}
export async function source(page: Page, app: App, id: string) {
  await page.goto(app.url + `/island?domain=newsletters&subcategory=${id}`);
  await expect(page.locator(`#subcategory-${id}`)).toBeVisible();
}
export async function suggestions(page: Page) {
  await card(page);
  await page.getByRole("button", { name: "查看分拆建議", exact: true }).click();
  await expect(page.getByLabel("子島名稱 1", { exact: true })).toBeVisible();
}
export async function list(
  page: Page,
  id: string,
  view: "active" | "archived" = "active",
) {
  return mailListSchema.parse(
    resultData(
      await rpc(page, "listMail", {
        domainId: "newsletters",
        subcategoryId: id,
        view,
      }),
    ),
  );
}
export async function counts(
  page: Page,
  id: string,
  unread: number,
  pending: number,
  tier: string,
) {
  const data = await overview(page);
  const domain = data.domains.find((entry) => entry.id === "newsletters")!;
  const category = domain.subcategories.find((entry) => entry.id === id)!;
  expect(category).toMatchObject({
    unreadCount: unread,
    pendingReplyCount: pending,
  });
  expect(domain).toMatchObject({
    unreadCount: unread,
    pendingReplyCount: pending,
  });
  await expect(
    page.getByRole("button", {
      name: `${category.name}，未讀 ${unread} 封，待回覆 ${pending} 封，${tier}`,
      exact: true,
    }),
  ).toBeVisible();
  return domain;
}
