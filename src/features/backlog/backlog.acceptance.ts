import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import type { Page } from "@playwright/test";
import {
  test,
  expect,
  rpc,
  resultData,
  identity,
  overview,
} from "../mailbox/acceptance-fixtures";
import type { App } from "../mailbox/acceptance-fixtures";
export { test, expect, rpc, resultData, identity, overview };
const bridge = `import * as backlog from '/src/features/backlog/backlog.functions.ts';import * as classifier from '/src/features/classifier/classification.functions.ts';window.backlogRPC={...backlog,...classifier};`;
export async function call(page: Page, method: string, input: unknown = {}) {
  await page.addScriptTag({ type: "module", content: bridge });
  await page.waitForFunction(() => Boolean(Reflect.get(window, "backlogRPC")));
  return page.evaluate(
    async ({ method, input }) => {
      try {
        return {
          ok: true as const,
          data: await Reflect.get(window, "backlogRPC")[method]({
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
export const planSchema = z.object({
  planId: z.string(),
  revision: z.string(),
  totalCount: z.number(),
  unreadCount: z.number(),
  mails: z.array(
    z.object({
      id: z.string(),
      subject: z.string(),
      sender: z.string(),
      manual: z.boolean(),
      placementRevision: z.number().int().nonnegative(),
      readAt: z.string().nullable(),
    }),
  ),
  groups: z.array(
    z.object({
      groupId: z.uuid(),
      sender: z.string(),
      mailIds: z.array(z.string()),
    }),
  ),
  diagnostics: z.object({
    reusedItems: z.number(),
    recomputedSenders: z.array(z.string()),
  }),
});
export type Plan = z.infer<typeof planSchema>;
export async function prepare(
  page: Page,
  sourceId: string,
  action: "split" | "archive" = "split",
) {
  return planSchema.parse(
    resultData(
      await call(page, "prepareBacklog", { subcategoryId: sourceId, action }),
    ),
  );
}
export function selection(plan: Plan, names?: string[]) {
  return {
    action: "split" as const,
    groups: plan.groups.map((group, index) => ({
      groupId: group.groupId,
      name: names?.[index] ?? group.sender,
      mailIds: group.mailIds,
    })),
  };
}
export function commit(page: Page, plan: Plan, choice = selection(plan)) {
  return call(page, "commitBacklog", {
    planId: plan.planId,
    revision: plan.revision,
    selection: choice,
  });
}
export function records(app: App, sql: string) {
  const db = new DatabaseSync(app.dbPath);
  try {
    return db.prepare(sql).all();
  } finally {
    db.close();
  }
}
export function service(
  app: App,
  owner: string,
  method: string,
  data: unknown = {},
) {
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        resolve("node_modules/tsx/dist/cli.mjs"),
        "src/features/backlog/backlog.acceptance.server.ts",
        owner,
        JSON.stringify({ method, data }),
      ],
      {
        env: { ...process.env, EMAIL_ISLAND_DB_PATH: app.dbPath },
        encoding: "utf8",
      },
    ),
  );
}
export async function setup(
  page: Page,
  app: App,
  groups = [
    { sender: "設計來源", count: 18, read: 2 },
    { sender: "產品來源", count: 12, read: 1 },
    { sender: "其他來源", count: 10, read: 1 },
  ],
) {
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
  const data = await overview(page);
  const domain = data.domains.find((entry) => entry.id === "newsletters")!;
  const category = domain.subcategories[0]!;
  app.sql(`DELETE FROM mails WHERE owner_id='${owner}';`);
  service(
    app,
    owner,
    "write",
    groups.flatMap((group) =>
      Array.from({ length: group.count }, (_, index) => ({
        seedKey: `${group.sender}-${index}`,
        domainId: "newsletters",
        subcategoryId: category.id,
        sender: group.sender,
        subject: `${group.sender} ${index}`,
        bodyText: `內容 ${group.sender} ${index}`,
        receivedAt: new Date(Date.UTC(2026, 9, 1, index)).toISOString(),
        readAt: index < group.read ? "2026-10-02T00:00:00.000Z" : null,
        requiresReply: index % 2 === 0,
      })),
    ),
  );
  await page.goto(
    app.url + `/island?domain=newsletters&subcategory=${category.id}`,
  );
  // This fixed behavioral assertion also reaches the exact baseline's missing entry.
  await expect(page.locator(`#subcategory-${category.id}`)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "處理積壓", exact: true }).last(),
  ).toBeVisible();
  return { owner, domain, category };
}
export async function card(page: Page) {
  const mailbox = page.getByRole("dialog", { name: /郵件$/ });
  await expect(mailbox).toBeVisible();
  const name = await mailbox.getByRole("heading", { level: 1 }).innerText();
  const entry = page.getByRole("group", {
    name: `${name}手動積壓處理`,
    exact: true,
  });
  await entry.getByRole("button", { name: "處理積壓", exact: true }).click();
  await expect(page.getByRole("dialog", { name: /積壓處理/ })).toBeVisible();
}
