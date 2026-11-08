import { z } from "zod";
import { domainIdSchema } from "./mailbox";
export const backlogName = z
  .string()
  .transform((name) => name.trim().normalize("NFC"))
  .pipe(z.string().min(1).max(80));
const ids = z
  .array(z.uuid())
  .min(1)
  .refine((values) => new Set(values).size === values.length);
export const promptInput = z.strictObject({
  scope: z.union([
    z.strictObject({ domainId: domainIdSchema }),
    z.strictObject({ subcategoryId: z.uuid() }),
  ]),
});
export const prepareInput = z.strictObject({
  subcategoryId: z.uuid(),
  action: z.enum(["archive", "split"]),
});
export const commitInput = z.strictObject({
  planId: z.uuid(),
  revision: z.string(),
  selection: z
    .discriminatedUnion("action", [
      z.strictObject({ action: z.literal("archive"), mailIds: ids }),
      z.strictObject({
        action: z.literal("split"),
        groups: z
          .array(
            z.strictObject({
              groupId: z.uuid(),
              name: backlogName,
              mailIds: ids,
            }),
          )
          .min(1),
      }),
    ])
    .refine((selection) => {
      if (selection.action === "archive") return true;
      const all = selection.groups.flatMap((group) => group.mailIds);
      return (
        new Set(all).size === all.length &&
        new Set(selection.groups.map((group) => group.groupId)).size ===
          selection.groups.length &&
        new Set(selection.groups.map((group) => group.name)).size ===
          selection.groups.length
      );
    }),
});
export type CommitInput = z.infer<typeof commitInput>;
export type PrepareInput = z.infer<typeof prepareInput>;
export type PromptInput = z.infer<typeof promptInput>;
