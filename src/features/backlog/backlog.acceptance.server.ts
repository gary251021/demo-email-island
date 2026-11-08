// Test-only CLI crosses the actual mailbox/classifier services, never a product RPC.
import { z } from "zod";
import { domainIdSchema } from "../../lib/mailbox";
import {
  writeMailboxMail,
  importMail,
  importedMailSchema,
  getClassificationInputs,
  listClassificationCandidates,
} from "../mailbox/mailbox.server";
import { taxonomyHash } from "../classifier/classification-policy.server";
import { getStoredClassifications } from "../classifier/classification.server";
const owner = z.string().parse(process.argv[2]);
const input = z
  .object({
    method: z.enum(["write", "import", "evidence"]),
    data: z.unknown(),
  })
  .parse(JSON.parse(z.string().parse(process.argv[3])));
if (input.method === "write") {
  const mails = z
    .array(
      z.object({
        seedKey: z.string(),
        domainId: domainIdSchema,
        subcategoryId: z.uuid(),
        sender: z.string(),
        subject: z.string(),
        bodyText: z.string(),
        receivedAt: z.iso.datetime(),
        readAt: z.iso.datetime().nullable(),
        requiresReply: z.boolean(),
      }),
    )
    .parse(input.data);
  console.log(
    JSON.stringify(mails.map((mail) => writeMailboxMail(owner, mail))),
  );
} else if (input.method === "import") {
  console.log(
    JSON.stringify(
      importMail(owner, importedMailSchema.parse(input.data), () => {}),
    ),
  );
} else
  console.log(
    JSON.stringify({
      hash: taxonomyHash(owner),
      candidates: listClassificationCandidates(owner),
      classifications: getStoredClassifications(
        owner,
        getClassificationInputs(owner).map((mail) => mail.id),
      ),
    }),
  );
