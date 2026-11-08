import { z } from "zod";

export const statusSchema = z.enum([
  "pending",
  "completed",
  "complete with error",
]);
export const correctionInput = z.strictObject({
  mailId: z.uuid(),
  subcategoryId: z.uuid(),
});
export const answerSchema = z.strictObject({
  type: z.literal("choice"),
  choice: z.string(),
  probabilities: z.record(z.string(), z.number().min(0).max(1)),
  confidence: z.number().min(0).max(1),
});
