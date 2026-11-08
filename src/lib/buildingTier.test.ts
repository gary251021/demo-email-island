import { describe, expect, it } from "vitest";
import { getBuildingTier } from "./buildingTier";

describe("unread building tiers", () => {
  it.each([
    [0, null],
    [1, 1],
    [2, 1],
    [3, 2],
    [9, 2],
    [10, 3],
    [29, 3],
    [30, 4],
    [31, 4],
    [100, 4],
  ] as const)("derives %s unread emails as %s", (count, expected) => {
    expect(getBuildingTier(count)).toBe(expected);
  });
});
