import { z } from "zod";

export const domainIdSchema = z.enum([
  "core-projects",
  "internal-team",
  "newsletters",
  "finance-bills",
  "system-alerts",
  "social-events",
  "shopping-delivery",
  "low-priority",
]);
export type DomainId = z.infer<typeof domainIdSchema>;
export const mailScopeInput = z.strictObject({
  domainId: domainIdSchema,
  subcategoryId: z.uuid(),
});
export const mailViewSchema = z.enum(["active", "archived"]);
export const listMailInput = mailScopeInput.extend({ view: mailViewSchema });
export const mailInput = mailScopeInput.extend({ mailId: z.uuid() });
export const replyBodySchema = z
  .string()
  .max(10000)
  .refine((value) => value.trim().length > 0);
export const replyInput = mailInput.extend({
  replyId: z.uuid(),
  bodyText: replyBodySchema,
});
export const snapshotInput = mailScopeInput.extend({
  mailIds: z
    .array(z.uuid())
    .min(1)
    .max(2)
    .refine((ids) => new Set(ids).size === ids.length),
});
export const replySchema = z.object({
  id: z.uuid(),
  bodyText: z.string(),
  createdAt: z.iso.datetime(),
});
export type MailScope = z.infer<typeof mailScopeInput>;
export type MailView = z.infer<typeof mailViewSchema>;
export type ReplyInput = z.infer<typeof replyInput>;
export type SnapshotInput = z.infer<typeof snapshotInput>;
export type ListMailInput = z.infer<typeof listMailInput>;
export type MailInput = z.infer<typeof mailInput>;
export const mailSummarySchema = z.object({
  id: z.uuid(),
  subcategoryId: z.uuid(),
  subject: z.string(),
  sender: z.string(),
  receivedAt: z.iso.datetime(),
  readAt: z.iso.datetime().nullable(),
  archivedAt: z.iso.datetime().nullable(),
  requiresReply: z.boolean(),
  hasPendingReply: z.boolean(),
});
export const mailDetailSchema = mailSummarySchema.extend({
  bodyText: z.string(),
  replies: z.array(replySchema),
});
export type MailSummary = z.infer<typeof mailSummarySchema>;
export type MailDetail = z.infer<typeof mailDetailSchema>;
const subcategorySchema = z.object({
  origin: z.enum(["seed", "split"]),
  automaticEligible: z.boolean(),
  layoutSlot: z.number().int().nonnegative(),
  id: z.uuid(),
  name: z.string(),
  unreadCount: z.number().int().nonnegative(),
  pendingReplyCount: z.number().int().nonnegative(),
});
export const overviewSchema = z.object({
  domains: z.array(
    z.object({
      id: domainIdSchema,
      name: z.string(),
      unreadCount: z.number().int().nonnegative(),
      pendingReplyCount: z.number().int().nonnegative(),
      subcategories: z.array(subcategorySchema),
    }),
  ),
});
export type Overview = z.infer<typeof overviewSchema>;

const timelineStageSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  from: z.iso.datetime(),
  to: z.iso.datetime(),
});
export const timelineSchema = z.object({
  stages: z.tuple([
    timelineStageSchema,
    timelineStageSchema,
    timelineStageSchema,
  ]),
});
export type MailTimeline = z.infer<typeof timelineSchema>;
export const mailListSchema = z.object({
  mails: z.array(mailSummarySchema),
  unreadCount: z.number().int().nonnegative(),
  timeline: timelineSchema.nullable(),
});
export type MailList = z.infer<typeof mailListSchema>;
