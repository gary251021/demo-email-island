import { describe, expect, it, vi } from "vitest";
import type {
  ExtensionCommandContext,
  Theme,
} from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";
import { renderDeliverySummary } from "./graph.ts";
import type { RunState } from "./types.ts";

// Vitest loads TypeScript; use the real installed TUI through its config alias.
const piTui = process.env.PI_TEST_TUI;
const { deliveryCompletions, showDeliveryGraph } = piTui
  ? await import("./ui.ts")
  : ({} as typeof import("./ui.ts"));
const { visibleWidth } = piTui
  ? ((await import(
      /* @vite-ignore */ piTui
    )) as typeof import("@earendil-works/pi-tui"))
  : ({} as typeof import("@earendil-works/pi-tui"));

function makeState(): RunState {
  return {
    schemaVersion: 1,
    issue: 31,
    repo: "/test",
    revision: 3,
    phase: "prepare",
    tickets: [],
    implementations: [],
    verifications: [],
    reviews: [],
    previews: [],
    legacyEvidence: [],
  };
}

function makePopup(state: RunState, rows = 24) {
  let component: Component;
  let options: unknown;
  const done = vi.fn();
  const requestRender = vi.fn();
  const theme = {
    fg: (_color: string, text: string) => text,
    bold: (text: string) => text,
  } as unknown as Theme;
  const ctx = {
    mode: "tui",
    hasUI: true,
    ui: {
      custom: vi.fn(async (factory, config) => {
        options = config;
        component = factory(
          { terminal: { rows }, requestRender } as unknown as TUI,
          theme,
          undefined,
          done,
        );
      }),
      notify: vi.fn(),
    },
  } as unknown as ExtensionCommandContext;
  return {
    ctx,
    done,
    requestRender,
    component: () => component!,
    options: () => options,
  };
}

describe.skipIf(!piTui)("delivery display (requires installed Pi)", () => {
  it("shows the current issue, workflow round, stage and checkout branch in one line", () => {
    const state = makeState();
    expect(renderDeliverySummary(state, 100)).toBe(
      "DELIVERY #31 | round: 1 | stage: PREPARE | branch: unavailable",
    );
    state.phase = "review";
    state.head = "0123456789abcdef";
    state.verifications.push({
      status: "blocked",
      revision: state.head,
      blocker: "Needs a decision",
      evidence: [],
      checks: [],
    });
    expect(renderDeliverySummary(state, 100)).toBe(
      "DELIVERY #31 | round: 1 | stage: REVIEW | branch: unavailable",
    );
    expect(renderDeliverySummary(state, 40).length).toBeLessThanOrEqual(40);
  });

  it("offers every subcommand and searches names and descriptions", () => {
    expect(deliveryCompletions("")?.map((item) => item.value)).toEqual([
      "graph",
      "toggle",
      "hide",
      "show",
      "exit",
      "clear",
    ]);
    expect(deliveryCompletions("gr")?.[0].value).toBe("graph");
    expect(deliveryCompletions("widget")?.map((item) => item.value)).toEqual([
      "hide",
      "show",
    ]);
    expect(deliveryCompletions("xyzxyz")).toBeNull();
  });

  it("opens an overlay, scrolls evidence, and closes without stopping delivery", async () => {
    const state = makeState();
    state.verifications.push({
      status: "running",
      evidence: [],
      checks: Array.from({ length: 30 }, (_, index) => ({
        name: `check-${index}`,
        command: "test",
        kind: "automated" as const,
        outcome: "passed" as const,
      })),
    });
    const popup = makePopup(state);
    await showDeliveryGraph(popup.ctx, () => state);
    const component = popup.component();
    expect(popup.options()).toMatchObject({ overlay: true });
    const initial = component.render(100);
    expect(initial.join("\n")).toContain("PREPARE");
    expect(initial.join("\n")).not.toContain("check-29");
    expect(initial.length).toBeLessThanOrEqual(24);
    component.handleInput?.("\u001b[F");
    expect(component.render(100).join("\n")).toContain("check-29");
    component.handleInput?.("\u001b[H");
    expect(component.render(100).join("\n")).not.toContain("check-29");
    state.phase = "building";
    expect(component.render(100).join("\n")).toContain(
      "DELIVERY #31 | round: 1 | stage: BUILDING | branch: unavailable",
    );
    component.handleInput?.("\u001b");
    expect(popup.done).toHaveBeenCalledOnce();
    expect(state.phase).toBe("building");
    expect(popup.requestRender).toHaveBeenCalled();
  });

  it("keeps the narrow graph and all popup lines within terminal bounds", async () => {
    const popup = makePopup(makeState(), 12);
    await showDeliveryGraph(popup.ctx, makeState);
    for (const width of [1, 20, 49, 80, 120]) {
      const lines = popup.component().render(width);
      expect(lines.length).toBeLessThanOrEqual(12);
      expect(lines.every((line) => visibleWidth(line) <= width)).toBe(true);
    }
  });

  it("opens the same graph through an RPC host custom panel", async () => {
    const popup = makePopup(makeState());
    const ctx = { ...popup.ctx, mode: "rpc" as const };
    await showDeliveryGraph(ctx, makeState);
    expect(popup.ctx.ui.custom).toHaveBeenCalledOnce();
    expect(popup.ctx.ui.notify).not.toHaveBeenCalled();
  });

  it("rejects the graph when no UI is available", async () => {
    const popup = makePopup(makeState());
    const ctx = { ...popup.ctx, mode: "print" as const, hasUI: false };
    await showDeliveryGraph(ctx, makeState);
    expect(popup.ctx.ui.custom).not.toHaveBeenCalled();
    expect(popup.ctx.ui.notify).toHaveBeenCalled();
  });
});
