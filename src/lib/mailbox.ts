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
export const listMailInput = z.strictObject({
  domainId: domainIdSchema,
  subcategoryId: z.uuid(),
});
export const mailInput = listMailInput.extend({ mailId: z.uuid() });
export type ListMailInput = z.infer<typeof listMailInput>;
export type MailInput = z.infer<typeof mailInput>;
export const mailSummarySchema = z.object({
  id: z.uuid(),
  subcategoryId: z.uuid(),
  subject: z.string(),
  sender: z.string(),
  receivedAt: z.iso.datetime(),
  readAt: z.iso.datetime().nullable(),
});
export const mailDetailSchema = mailSummarySchema.extend({
  bodyText: z.string(),
});
export type MailSummary = z.infer<typeof mailSummarySchema>;
export type MailDetail = z.infer<typeof mailDetailSchema>;
const subcategorySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  unreadCount: z.number().int().nonnegative(),
});
export const overviewSchema = z.object({
  domains: z.array(
    z.object({
      id: domainIdSchema,
      name: z.string(),
      unreadCount: z.number().int().nonnegative(),
      subcategories: z.array(subcategorySchema),
    }),
  ),
});
export type Overview = z.infer<typeof overviewSchema>;
