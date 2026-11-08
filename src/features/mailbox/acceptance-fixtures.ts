import { test as base, expect } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { once } from "node:events";
import { mailListSchema, overviewSchema } from "../../lib/mailbox";
import { identitySchema } from "../../lib/session";

const transportSource = `import {getIdentity} from '/src/features/session/session.functions.ts';
import {startDemo,getOverview,listMail,getMail,markMailRead} from '/src/features/mailbox/mailbox.functions.ts';
window.mailboxAcceptanceTransport = {getIdentity,startDemo,getOverview,listMail,getMail,markMailRead};`;

type RpcMethod =
  | "getIdentity"
  | "startDemo"
  | "getOverview"
  | "listMail"
  | "getMail"
  | "markMailRead";
type RpcResult = { ok: true; data: unknown } | { ok: false; error: string };
// Test-only browser bridge invokes the actual Vite-generated Start RPC client.
declare global {
  interface Window {
    mailboxAcceptanceTransport: Record<
      RpcMethod,
      (options: { data: unknown }) => Promise<unknown>
    >;
  }
}

export async function rpc(
  page: Page,
  method: RpcMethod,
  input: unknown = {},
): Promise<RpcResult> {
  await page.addScriptTag({ type: "module", content: transportSource });
  await page.waitForFunction(() => Boolean(window.mailboxAcceptanceTransport));
  return page.evaluate(
    async ({ method, input }) => {
      try {
        return {
          ok: true,
          data: await window.mailboxAcceptanceTransport[method]({
            data: input,
          }),
        };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
    { method, input },
  );
}
export function resultData(result: RpcResult) {
  expect(result.ok, JSON.stringify(result)).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.data;
}
export async function identity(page: Page) {
  return identitySchema.parse(resultData(await rpc(page, "getIdentity")));
}
export async function overview(page: Page) {
  return overviewSchema.parse(resultData(await rpc(page, "getOverview")));
}
export async function q4(page: Page) {
  const data = await overview(page);
  const domain = data.domains.find((entry) => entry.id === "core-projects");
  const subcategory = domain?.subcategories.find(
    (entry) => entry.name === "Q4 報價",
  );
  expect(subcategory).toBeDefined();
  if (!subcategory) throw new Error("Missing Q4 報價");
  const input = { domainId: "core-projects", subcategoryId: subcategory.id };
  const { mails } = mailListSchema.parse(
    resultData(await rpc(page, "listMail", input)),
  );
  const mail = mails.find((entry) => entry.subject === "請確認報價項目");
  if (!mail) throw new Error("Missing 請確認報價項目");
  return {
    domain,
    subcategory,
    mails,
    input: { ...input, mailId: mail.id },
    mail,
  };
}
export function subjectButton(page: Page, subject: string) {
  return page
    .getByRole("button")
    .filter({ has: page.getByText(subject, { exact: true }) });
}
export async function enter(page: Page, url: string) {
  await page.goto(url);
  await expect(
    page.getByRole("button", { name: "Google 登入", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "進入群島", exact: true }).click();
  await expect(page.getByRole("button", { name: /核心專案/ })).toBeVisible();
}
export async function openQ4(page: Page) {
  await page.getByRole("button", { name: /核心專案/ }).click();
  await page.getByRole("button", { name: /Q4 報價/ }).click();
  await expect(page.getByRole("dialog", { name: "Q4 報價郵件" })).toBeVisible();
}
export async function readQ4(page: Page) {
  await openQ4(page);
  await subjectButton(page, "請確認報價項目").click();
  await expect(
    page.getByText("第四季的報價已整理完成", { exact: false }),
  ).toBeVisible();
  await expect.poll(async () => (await q4(page)).mail.readAt).not.toBeNull();
}

type App = {
  url: string;
  dbPath: string;
  restart: () => Promise<void>;
  time: (date: Date) => void;
  sql: (statement: string) => void;
  withContext: (context: BrowserContext) => Promise<Page>;
};

export const test = base.extend<{ app: App; browserErrors: string[] }>({
  page: async ({ page }, providePage, testInfo) => {
    const messages: string[] = [];
    page.on("console", (message) => {
      messages.push(`${message.type()}: ${message.text()}`);
    });
    page.on("pageerror", (error) => {
      messages.push(`pageerror: ${error.message}`);
    });
    await providePage(page);
    await testInfo.attach("browser-console.log", {
      body: messages.join("\n"),
      contentType: "text/plain",
    });
  },
  browserErrors: async ({ page }, provideErrors) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });
    await provideErrors(errors);
  },
  // Playwright requires a destructured fixture argument.
  // eslint-disable-next-line no-empty-pattern
  app: async ({}, provideApp, testInfo) => {
    const directory = mkdtempSync(join(tmpdir(), "email-island-e2e-"));
    const dbPath = join(directory, "mail.sqlite");
    const clockPath = join(directory, "clock");
    const preload = join(directory, "clock.mjs");
    writeFileSync(clockPath, String(Date.now()));
    writeFileSync(
      preload,
      `import {readFileSync} from 'node:fs';
const NativeDate=Date;
const now=()=>Number(readFileSync(${JSON.stringify(clockPath)},'utf8'));
globalThis.Date=class extends NativeDate {
constructor(...args){super(...(args.length?args:[now()]));}
static now(){return now();}
};`,
    );
    const port =
      Number(process.env.EMAIL_ISLAND_E2E_PORT ?? 3210) +
      testInfo.parallelIndex;
    const url = `http://127.0.0.1:${port}`;
    let output = "";
    let startupOutput = "";
    const launch = () => {
      startupOutput = "";
      const child = spawn(
        process.execPath,
        [
          resolve("node_modules/vite/bin/vite.js"),
          "--host",
          "127.0.0.1",
          "--port",
          String(port),
          "--strictPort",
        ],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            EMAIL_ISLAND_DB_PATH: dbPath,
            EMAIL_ISLAND_VITE_CACHE: join(directory, "vite-cache"),
            BETTER_AUTH_URL: url,
            BETTER_AUTH_SECRET:
              "acceptance-only-local-secret-of-at-least-32-characters",
            NODE_OPTIONS: `--import=${preload}`,
          },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      child.stdout.on("data", (data: Buffer) => {
        output += data.toString();
        startupOutput += data.toString();
      });
      child.stderr.on("data", (data: Buffer) => {
        output += data.toString();
        startupOutput += data.toString();
      });
      return child;
    };
    let child = launch();
    async function ready() {
      await expect
        .poll(
          async () => {
            if (child.exitCode !== null || child.signalCode !== null)
              throw new Error(
                `Local application exited before ready: ${startupOutput}`,
              );
            if (!startupOutput.includes(url)) return 0;
            try {
              return (await fetch(url)).status;
            } catch {
              return 0;
            }
          },
          { timeout: 20_000, message: "Local application startup" },
        )
        .toBe(200);
    }
    async function stop() {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const ended = once(child, "exit");
      child.kill("SIGTERM");
      await ended;
    }
    try {
      await ready();
      await provideApp({
        url,
        dbPath,
        restart: async () => {
          await stop();
          child = launch();
          await ready();
        },
        time: (date) => writeFileSync(clockPath, String(date.getTime())),
        sql: (statement) => {
          const database = new DatabaseSync(dbPath);
          try {
            database.exec(statement);
          } finally {
            database.close();
          }
        },
        withContext: async (context) => {
          const page = await context.newPage();
          await page.goto(url);
          return page;
        },
      });
    } finally {
      await stop();
      await testInfo.attach("app-server.log", {
        body: output,
        contentType: "text/plain",
      });
      rmSync(directory, { recursive: true, force: true });
    }
  },
});
export { expect };
