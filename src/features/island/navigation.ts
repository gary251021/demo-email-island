import { z } from "zod";
import { domainIdSchema, type Overview } from "../../lib/mailbox";

export const islandSelectionSchema = z
  .strictObject({
    domain: domainIdSchema.optional(),
    subcategory: z.uuid().optional(),
    mail: z.uuid().optional(),
  })
  .refine((value) => !value.subcategory || Boolean(value.domain))
  .refine((value) => !value.mail || Boolean(value.subcategory));

export type IslandSelection = z.infer<typeof islandSelectionSchema>;

export function resolveSelection(
  overview: Overview,
  selection: IslandSelection,
) {
  if (!selection.domain) return { domain: undefined, subcategory: undefined };
  const domain = overview.domains.find((item) => item.id === selection.domain);
  if (!domain) throw new Error("NOT_FOUND");
  const subcategory = domain.subcategories.find(
    (item) => item.id === selection.subcategory,
  );
  if (selection.subcategory && !subcategory) throw new Error("NOT_FOUND");
  return { domain, subcategory };
}

export function returnToList(selection: IslandSelection): IslandSelection {
  return { domain: selection.domain, subcategory: selection.subcategory };
}

export function closeMailPanel(selection: IslandSelection): IslandSelection {
  return { domain: selection.domain };
}
