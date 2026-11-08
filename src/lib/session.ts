import { z } from "zod";

export const emptyInput = z.strictObject({});
export const identitySchema = z.object({ ownerKey: z.uuid() });
export type Identity = z.infer<typeof identitySchema>;
