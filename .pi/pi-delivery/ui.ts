import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import {
  fuzzyFilter,
  matchesKey,
  ScrollView,
  truncateToWidth,
} from "@earendil-works/pi-tui";
import { renderDeliveryGraph, renderDeliverySummary } from "./graph.ts";
import { lastHookDecision } from "./hooks.ts";
import type { Phase, RunState } from "./types.ts";

export const stageColors = {
  prepare: "mdLink",
  planning: "syntaxType",
  building: "accent",
  verification: "success",
  review: "syntaxKeyword",
  corrections: "warning",
  preview: "toolDiffAdded",
} as const satisfies Record<Phase, string>;

const commands = [
  {
    value: "graph",
    label: "graph",
    description: "Open the delivery graph popup",
  },
  {
    value: "toggle",
    label: "toggle",
    description: "Open the delivery graph panel",
  },
  {
    value: "hide",
    label: "hide",
    description: "Hide the one-line delivery widget",
  },
  {
    value: "show",
    label: "show",
    description: "Show the one-line delivery widget",
  },
  {
    value: "exit",
    label: "exit",
    description: "Exit delivery and return to the original session",
  },
  {
    value: "clear",
    label: "clear",
    description: "Exit and permanently clear this local test delivery",
  },
];

export function deliveryCompletions(prefix: string) {
  const matches = fuzzyFilter(
    commands,
    prefix.trim(),
    (command) => `${command.value} ${command.description}`,
  );
  return matches.length ? matches : null;
}

export async function showDeliveryGraph(
  ctx: ExtensionCommandContext,
  getState: () => RunState,
  runDir?: string,
): Promise<void> {
  if (!ctx.hasUI) {
    ctx.ui.notify(
      "The delivery graph requires a UI host with custom panel support.",
      "error",
    );
    return;
  }
  await ctx.ui.custom<void>(
    (tui, theme, _keys, done) => {
      const scroll = new ScrollView(
        {
          render: (width) =>
            renderDeliveryGraph(getState(), width, false, (phase, text) =>
              theme.bold(theme.fg(stageColors[phase], text)),
              runDir ? lastHookDecision(runDir) : undefined,
            ).slice(1),
          invalidate() {},
        },
        { scrollbar: "hidden" },
      );
      const refresh = () => tui.requestRender();
      return {
        render(width: number) {
          const innerWidth = Math.max(1, width - 4);
          const body = scroll.render(innerWidth);
          const height = Math.max(
            1,
            Math.min(body.length, tui.terminal.rows - 6),
          );
          scroll.updateLayout(body.length, height, refresh);
          const border = (text: string) => theme.fg("border", text);
          const row = (text: string) =>
            truncateToWidth(
              `${border("│")} ${truncateToWidth(text, innerWidth, "...", true)} ${border("│")}`,
              width,
            );
          const rule = (left: string, right: string) =>
            truncateToWidth(
              border(`${left}${"─".repeat(innerWidth + 2)}${right}`),
              width,
            );
          return [
            rule("╭", "╮"),
            row(
              theme.fg("accent", renderDeliverySummary(getState(), innerWidth)),
            ),
            ...body.slice(scroll.scrollTop, scroll.scrollTop + height).map(row),
            row(
              theme.fg(
                "dim",
                `↑↓ / PgUp PgDn scroll · Esc close · ${scroll.scrollTop + 1}-${Math.min(body.length, scroll.scrollTop + height)}/${body.length}`,
              ),
            ),
            rule("╰", "╯"),
          ];
        },
        handleInput(data: string) {
          if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c")) {
            done();
            return;
          }
          if (matchesKey(data, "up")) scroll.scrollBy(-1);
          else if (matchesKey(data, "down")) scroll.scrollBy(1);
          else if (matchesKey(data, "pageUp"))
            scroll.scrollBy(-scroll.viewportHeight);
          else if (matchesKey(data, "pageDown"))
            scroll.scrollBy(scroll.viewportHeight);
          else if (matchesKey(data, "home")) scroll.scrollToStart();
          else if (matchesKey(data, "end")) scroll.scrollToEnd();
          refresh();
        },
        invalidate() {
          scroll.invalidate();
        },
      };
    },
    {
      overlay: true,
      overlayOptions: { anchor: "top-center", width: "95%", margin: 1 },
    },
  );
}
