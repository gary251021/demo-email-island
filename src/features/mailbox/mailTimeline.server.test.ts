// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  matchMailTimeline,
  validateTimelineTemplate,
} from "./mailTimeline.server";
import { websiteTimeline } from "./timelineTemplates.server";

describe("full-list timeline provenance", () => {
  it("covers every source once in contiguous stages with actual source dates", () => {
    expect(() => validateTimelineTemplate(websiteTimeline)).not.toThrow();
    const timeline = matchMailTimeline(websiteTimeline.sourceMails, 12);
    expect(timeline?.stages.map((stage) => [stage.from, stage.to])).toEqual([
      ["2026-10-01T04:00:00.000Z", "2026-10-10T04:00:00.000Z"],
      ["2026-10-11T04:00:00.000Z", "2026-10-20T04:00:00.000Z"],
      ["2026-10-21T04:00:00.000Z", "2026-10-30T04:00:00.000Z"],
    ]);
    expect(
      matchMailTimeline([...websiteTimeline.sourceMails].reverse(), 10),
    ).toEqual(timeline);
  });

  it("requires exact fields, known identity, and complete one-to-one membership", () => {
    for (const field of [
      "seedKey",
      "sender",
      "subject",
      "bodyText",
      "receivedAt",
    ] as const) {
      const mails = structuredClone(websiteTimeline.sourceMails);
      const source = mails[0];
      if (!source) throw new Error("Missing source");
      source[field] =
        field === "receivedAt" ? "2026-10-01T05:00:00.000Z" : "changed";
      expect(matchMailTimeline(mails, 12), field).toBeNull();
    }
    expect(
      matchMailTimeline(websiteTimeline.sourceMails.slice(1), 12),
    ).toBeNull();
    expect(
      matchMailTimeline(
        [...websiteTimeline.sourceMails, websiteTimeline.sourceMails[0]!],
        12,
      ),
    ).toBeNull();
    const duplicate = structuredClone(websiteTimeline.sourceMails);
    duplicate[0] = duplicate[1]!;
    expect(matchMailTimeline(duplicate, 12)).toBeNull();
  });

  it("excludes read state from content identity while sharing the building tier rule", () => {
    const sources = websiteTimeline.sourceMails.map((mail, index) => ({
      ...mail,
      readAt: index < 18 ? mail.receivedAt : null,
    }));
    for (const count of [0, 1, 2, 3, 9, 10, 29, 30])
      expect(matchMailTimeline(sources, count) !== null).toBe(
        count === 10 || count === 29,
      );
    expect(matchMailTimeline(sources, 11)).toEqual(
      matchMailTimeline(sources, 10),
    );
  });

  it("reports ambiguous templates instead of choosing one", () => {
    expect(() =>
      matchMailTimeline(websiteTimeline.sourceMails, 12, [
        websiteTimeline,
        { ...websiteTimeline, id: "duplicate" },
      ]),
    ).toThrow("AMBIGUOUS_TIMELINE_TEMPLATE");
  });

  it("reports missing, duplicate, unknown, empty, and out-of-order stage sources", () => {
    for (const change of [
      "missing",
      "duplicate",
      "unknown",
      "empty",
      "order",
      "title",
      "summary",
    ] as const) {
      const template = structuredClone(websiteTimeline);
      if (change === "missing") template.stages[0].sourceSeedKeys.pop();
      if (change === "duplicate")
        template.stages[1].sourceSeedKeys.push(
          template.stages[0].sourceSeedKeys[0]!,
        );
      if (change === "unknown")
        template.stages[0].sourceSeedKeys[0] = "unknown";
      if (change === "empty") template.stages[0].sourceSeedKeys = [];
      if (change === "order")
        [template.stages[0], template.stages[1]] = [
          template.stages[1],
          template.stages[0],
        ];
      if (change === "title") template.stages[0].title = " ";
      if (change === "summary") template.stages[0].summary = " ";
      expect(() => matchMailTimeline([], 0, [template]), change).toThrow(
        /INVALID_TIMELINE/,
      );
    }
  });
});
