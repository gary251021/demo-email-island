import { describe, expect, it } from "vitest";
import type { Overview } from "../../lib/mailbox";
import {
  closeMailPanel,
  islandSelectionSchema,
  resolveSelection,
  returnToList,
} from "./navigation";

const quoteId = "10000000-0000-4000-8000-000000000001";
const designId = "10000000-0000-4000-8000-000000000002";
const mailId = "10000000-0000-4000-8000-000000000003";
const overview: Overview = {
  domains: [
    {
      id: "core-projects",
      name: "核心專案",
      unreadCount: 3,
      subcategories: [{ id: quoteId, name: "Q4 報價", unreadCount: 3 }],
    },
    {
      id: "internal-team",
      name: "團隊溝通",
      unreadCount: 0,
      subcategories: [{ id: designId, name: "團隊週報", unreadCount: 0 }],
    },
  ],
};

describe("island selection", () => {
  it("rejects orphaned subcategory/mail selections and malformed identifiers", () => {
    for (const selection of [
      { subcategory: quoteId },
      { mail: mailId },
      { domain: "core-projects", mail: mailId },
      { domain: "core-projects", subcategory: "unknown" },
      { domain: "other" },
    ]) {
      expect(islandSelectionSchema.safeParse(selection).success).toBe(false);
    }
  });

  it("rejects cross-domain selections rather than substituting another category", () => {
    expect(() =>
      resolveSelection(overview, {
        domain: "core-projects",
        subcategory: designId,
      }),
    ).toThrow("NOT_FOUND");
  });

  it("keeps zero-unread categories navigable", () => {
    const result = resolveSelection(overview, {
      domain: "internal-team",
      subcategory: designId,
    });
    expect(result.subcategory).toEqual({
      id: designId,
      name: "團隊週報",
      unreadCount: 0,
    });
  });

  it("returns from mail to its list, then from its panel to the same domain", () => {
    const selection = {
      domain: "core-projects" as const,
      subcategory: quoteId,
      mail: mailId,
    };
    expect(returnToList(selection)).toEqual({
      domain: "core-projects",
      subcategory: quoteId,
    });
    expect(closeMailPanel(selection)).toEqual({ domain: "core-projects" });
    expect(resolveSelection(overview, {})).toEqual({
      domain: undefined,
      subcategory: undefined,
    });
  });
});
