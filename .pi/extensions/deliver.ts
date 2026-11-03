import { spawn } from "node:child_process";
import { existsSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { registerDeliveryRuntime } from "../pi-delivery/index.ts";
import { buildDeliveryArgs, deliveryPrompt } from "../pi-delivery/resources.ts";

const runtimeRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../pi-delivery",
);

const activationEntry = "delivery-activation";

type DeliveryActivation = { issue: number; repo: string };

function restoredActivation(
  ctx: ExtensionContext,
): DeliveryActivation | undefined {
  const entries = ctx.sessionManager.getBranch() as Array<{
    type?: string;
    customType?: string;
    data?: unknown;
  }>;
  const data = entries.findLast(
    (entry) => entry.type === "custom" && entry.customType === activationEntry,
  )?.data;
  if (!data || typeof data !== "object") return;
  const { issue, repo } = data as Partial<DeliveryActivation>;
  return Number.isSafeInteger(issue) && issue! > 0 && typeof repo === "string"
    ? { issue: issue!, repo }
    : undefined;
}

export default function deliverExtension(pi: ExtensionAPI): void {
  const runtime = registerDeliveryRuntime(pi, runtimeRoot);

  pi.on("session_start", (_event, ctx) => {
    const issue = Number(process.env.PI_DELIVERY_ISSUE);
    const repo = process.env.PI_DELIVERY_REPO;
    const launched =
      Number.isSafeInteger(issue) &&
      issue > 0 &&
      repo &&
      process.env.PI_DELIVERY_ROOT === runtimeRoot
        ? { issue, repo }
        : restoredActivation(ctx);
    if (!launched) return;
    try {
      runtime.activate(launched.issue, launched.repo, ctx);
      if (!restoredActivation(ctx)) pi.appendEntry(activationEntry, launched);
    } catch (error) {
      ctx.ui.notify(
        `Delivery report startup failed: ${String(error)}`,
        "error",
      );
      if (process.env.PI_DELIVERY_ROOT === runtimeRoot) ctx.shutdown();
    }
  });

  pi.registerCommand("deliver", {
    description:
      "Deliver an issue or clear local test artifacts: /deliver issue N | clear N [--apply]",
    handler: async (input, ctx) => {
      const clear = /^\s*clear\s+([1-9]\d*)(\s+--apply)?\s*$/.exec(input);
      if (clear) {
        if (!ctx.isIdle()) {
          ctx.ui.notify(
            "Wait for the current run to stop before cleanup.",
            "error",
          );
          return;
        }
        const result = await pi.exec(
          process.execPath,
          [
            resolve(runtimeRoot, "clear.ts"),
            clear[1],
            ...(clear[2] ? ["--apply"] : []),
          ],
          { cwd: ctx.cwd, timeout: 120_000 },
        );
        pi.sendMessage({
          customType: "delivery-cleanup",
          content: [result.stdout, result.stderr].filter(Boolean).join("\n"),
          display: true,
        });
        if (result.code !== 0)
          ctx.ui.notify(
            "Delivery cleanup stopped; inspect the report.",
            "error",
          );
        return;
      }
      const match = /^\s*issue\s+([1-9]\d*)\s*$/.exec(input);
      if (!match) {
        ctx.ui.notify("Usage: /deliver issue N | clear N [--apply]", "error");
        return;
      }
      if (!ctx.hasUI || !ctx.isIdle()) {
        ctx.ui.notify("/deliver requires an idle Pi UI session", "error");
        return;
      }
      const issue = Number(match[1]);
      if (!Number.isSafeInteger(issue)) {
        ctx.ui.notify("Issue number must be a positive safe integer", "error");
        return;
      }
      if (ctx.mode === "rpc") {
        try {
          const repo = realpathSync(ctx.cwd);
          runtime.activate(issue, repo, ctx);
          pi.appendEntry<DeliveryActivation>(activationEntry, { issue, repo });
          pi.sendUserMessage(deliveryPrompt(issue));
        } catch (error) {
          ctx.ui.notify(`Could not start delivery: ${String(error)}`, "error");
        }
        return;
      }
      if (ctx.mode !== "tui") {
        ctx.ui.notify("/deliver requires a terminal or RPC UI host", "error");
        return;
      }

      const model = ctx.model;
      const modelId = model ? `${model.provider}/${model.id}` : undefined;
      const thinking = pi.getThinkingLevel();
      const args = buildDeliveryArgs({
        repo: ctx.cwd,
        runtimeRoot,
        issue,
        model: modelId,
        thinking,
      });
      const cliPath = resolveRunningCli();
      const env = {
        ...process.env,
        PI_DELIVERY_ISSUE: String(issue),
        PI_DELIVERY_REPO: realpathSync(ctx.cwd),
        PI_DELIVERY_ROOT: runtimeRoot,
      };

      let clearRequested = false;
      await ctx.ui.custom<number>((tui, _theme, _keybindings, done) => {
        tui.stop();
        process.stdout.write("\x1b[2J\x1b[H");
        setImmediate(() => {
          let exitCode = 1;
          void runChild(cliPath, args, env, ctx.cwd, () => {
            clearRequested = true;
          })
            .then((code) => {
              exitCode = code;
            })
            .catch((error: unknown) => {
              process.stderr.write(
                `\nCould not start delivery session: ${error instanceof Error ? error.message : String(error)}\n`,
              );
            })
            .finally(() => {
              try {
                tui.start();
                tui.requestRender(true);
              } finally {
                done(exitCode);
              }
            });
        });
        return { render: () => [], invalidate: () => {} };
      });
      if (clearRequested) {
        const result = await pi.exec(
          process.execPath,
          [resolve(runtimeRoot, "clear.ts"), String(issue), "--apply"],
          { cwd: ctx.cwd, timeout: 120_000 },
        );
        pi.sendMessage({
          customType: "delivery-cleanup",
          content: [result.stdout, result.stderr].filter(Boolean).join("\n"),
          display: true,
        });
        if (result.code !== 0)
          ctx.ui.notify(
            "Delivery stopped; cleanup was blocked. Inspect the report.",
            "error",
          );
      }
    },
  });
}

function resolveRunningCli(): string {
  const entry = process.argv[1];
  if (!entry || !existsSync(entry))
    throw new Error("Cannot resolve the installed Pi CLI entry point");
  const cliPath = realpathSync(entry);
  if (!statSync(cliPath).isFile())
    throw new Error(`Pi CLI entry point is not a file: ${cliPath}`);
  if (
    basename(cliPath) !== "cli.js" ||
    !cliPath.split(sep).includes("pi-coding-agent")
  ) {
    throw new Error(`Cannot verify installed Pi CLI entry point: ${cliPath}`);
  }
  return cliPath;
}

function runChild(
  cliPath: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  cwd: string,
  requestClear: () => void,
): Promise<number> {
  return new Promise((resolveExit, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd,
      env,
      stdio: ["inherit", "inherit", "inherit", "ipc"],
    });
    child.on("message", (message) => {
      if (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        message.type === "delivery-clear"
      )
        requestClear();
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) resolveExit(1);
      else resolveExit(code ?? 1);
    });
  });
}
