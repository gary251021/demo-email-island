// Test fixture executable. Uses the real import transaction and queue service.
import { importedMailSchema } from "../mailbox/mailbox.server";
import { importClassifiedMail } from "./classification.server";
import { dispatchPending } from "./queue.server";
import { db } from "../../lib/db.server";
async function main() {
  const owner = process.argv[2];
  if (!owner) throw new Error("Owner required");
  const input = importedMailSchema.parse(JSON.parse(process.argv[3] ?? "null"));
  const result = importClassifiedMail(owner, input);
  await dispatchPending();
  console.log(JSON.stringify(result));
  db.close();
}
void main();
