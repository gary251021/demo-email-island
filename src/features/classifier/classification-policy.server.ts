import { createHash } from "node:crypto";
import {
  getClassificationInputs,
  listClassificationCandidates,
} from "../mailbox/mailbox.server";
type Mail = ReturnType<typeof getClassificationInputs>[number];
const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const requestedModel = "jev-1.14.0";
export const ruleVersion =
  process.env.EMAIL_ISLAND_CLASSIFICATION_RULE_VERSION ?? "1";
export function contentHash(mail: Mail) {
  return hash([mail.sender, mail.subject, mail.bodyText, mail.receivedAt]);
}
export function taxonomyHash(ownerId: string) {
  return hash(
    listClassificationCandidates(ownerId)
      .map((domain) => ({
        ...domain,
        subcategories: [...domain.subcategories].sort((a, b) =>
          a.id.localeCompare(b.id),
        ),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  );
}
