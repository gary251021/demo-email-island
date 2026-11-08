import { z } from "zod";
import { getBuildingTier } from "../../lib/buildingTier";
import { timelineSchema } from "../../lib/mailbox";
import type { MailDetail } from "../../lib/mailbox";
import { timelineTemplates } from "./timelineTemplates.server";
import type { TimelineTemplate } from "./timelineTemplates.server";

export const timelineMailSchema = z.object({
  seedKey: z.string(),
  sender: z.string(),
  subject: z.string(),
  bodyText: z.string(),
  receivedAt: z.iso.datetime(),
});
type TimelineMail = z.infer<typeof timelineMailSchema>;

export function validateTimelineTemplate(template: TimelineTemplate) {
  const stages = [...template.stages];
  const keys = template.sourceMails.map((mail) => mail.seedKey);
  const sources = new Map(
    template.sourceMails.map((mail) => [mail.seedKey, mail]),
  );
  const assigned = template.stages.flatMap((stage) => stage.sourceSeedKeys);
  if (
    stages.length !== 3 ||
    new Set(keys).size !== keys.length ||
    new Set(assigned).size !== assigned.length ||
    assigned.length !== keys.length ||
    assigned.some((key) => !sources.has(key))
  )
    throw new Error(`INVALID_TIMELINE_TEMPLATE: ${template.id}`);
  let previousEnd = "";
  for (const stage of template.stages) {
    if (
      !stage.title.trim() ||
      !stage.summary.trim() ||
      stage.sourceSeedKeys.length === 0
    )
      throw new Error(`INVALID_TIMELINE_TEMPLATE: ${template.id}`);
    const dates = stage.sourceSeedKeys
      .map((key) => {
        const source = sources.get(key);
        if (!source)
          throw new Error(`INVALID_TIMELINE_TEMPLATE: ${template.id}`);
        return timelineMailSchema.parse(source).receivedAt;
      })
      .sort((a, b) => a.localeCompare(b));
    const from = dates[0];
    const to = dates.at(-1);
    if (!from || !to || (previousEnd && from <= previousEnd))
      throw new Error(`INVALID_TIMELINE_ORDER: ${template.id}`);
    previousEnd = to;
  }
}

export function matchMailTimeline(
  mails: TimelineMail[],
  unreadCount: number,
  templates: TimelineTemplate[] = timelineTemplates,
) {
  for (const template of templates) validateTimelineTemplate(template);
  const byKey = new Map(mails.map((mail) => [mail.seedKey, mail]));
  const matching = templates.filter(
    (template) =>
      mails.length === template.sourceMails.length &&
      byKey.size === mails.length &&
      template.sourceMails.every((source) => {
        const mail = byKey.get(source.seedKey);
        return (
          mail &&
          mail.sender === source.sender &&
          mail.subject === source.subject &&
          mail.bodyText === source.bodyText &&
          mail.receivedAt === source.receivedAt
        );
      }),
  );
  if (matching.length > 1) throw new Error("AMBIGUOUS_TIMELINE_TEMPLATE");
  const template = matching[0];
  if (!template || getBuildingTier(unreadCount) !== 3) return null;
  return timelineSchema.parse({
    stages: template.stages.map((stage) => {
      // All keys were verified above against this owner's complete list snapshot.
      const dates = mails
        .filter((mail) => stage.sourceSeedKeys.includes(mail.seedKey))
        .map((mail) => mail.receivedAt)
        .sort((a, b) => a.localeCompare(b));
      return {
        title: stage.title,
        summary: stage.summary,
        from: dates[0],
        to: dates.at(-1),
      };
    }),
  });
}

export function unreadMailCount(mails: Pick<MailDetail, "readAt">[]) {
  return mails.filter((mail) => mail.readAt === null).length;
}
