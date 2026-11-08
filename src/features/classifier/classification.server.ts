import { statusSchema } from "../../lib/classification";
import { createHash, randomUUID } from "node:crypto";
import { db, transaction } from "../../lib/db.server";
import {
  getClassificationInputs,
  applyCategory,
  initializeMailbox,
  importMail,
} from "../mailbox/mailbox.server";
import type { importedMailSchema } from "../mailbox/mailbox.server";
import type { z } from "zod";
import {
  ownerWorks,
  hasOverride,
  savedAnswers,
  type Work,
} from "./classification.repository.server";
import {
  contentHash,
  taxonomyHash,
  requestedModel,
  ruleVersion,
} from "./classification-policy.server";

// Called inside the mailbox transaction so content and intent commit together.
export function enqueueChangedMail(
  ownerId: string,
  ids?: string[],
  mode: "changed" | "refresh" = "changed",
) {
  const taxonomy = taxonomyHash(ownerId);
  const works = ownerWorks(ownerId);
  for (const mail of getClassificationInputs(ownerId, ids)) {
    if (hasOverride(ownerId, mail.id)) continue;
    const content = contentHash(mail);
    const existing = works.find(
      (work) =>
        work.mailId === mail.id &&
        work.contentHash === content &&
        work.requestedModel === requestedModel &&
        work.ruleVersion === ruleVersion &&
        work.taxonomyHash === taxonomy,
    );
    const otherUnfinishedContent = works.some(
      (work) =>
        work.mailId === mail.id &&
        work.contentHash !== content &&
        (work.outcome === "pending" || work.outcome === "failed"),
    );
    if (
      existing &&
      isCurrentPlacement(existing, mail) &&
      !otherUnfinishedContent
    )
      continue;
    if (
      mode === "changed" &&
      works.some(
        (work) =>
          work.mailId === mail.id &&
          work.contentHash === content &&
          isCurrentPlacement(work, mail) &&
          !otherUnfinishedContent,
      )
    )
      continue;
    db.prepare(
      "UPDATE classification_work SET outcome='superseded' WHERE owner_id=? AND mail_id=? AND outcome IN ('pending','failed')",
    ).run(ownerId, mail.id);
    if (existing) {
      db.prepare(
        "UPDATE classification_work SET outcome='pending',error_code=NULL,resolved=0,placement_revision=?,dispatch_generation=dispatch_generation+1 WHERE work_id=? AND owner_id=?",
      ).run(mail.placementRevision, existing.workId, ownerId);
      continue;
    }
    db.prepare(
      `INSERT INTO classification_work (work_id,owner_id,mail_id,content_hash,requested_model,rule_version,taxonomy_hash,placement_revision,outcome) VALUES (?,?,?,?,?,?,?,?,'pending')`,
    ).run(
      randomUUID(),
      ownerId,
      mail.id,
      content,
      requestedModel,
      ruleVersion,
      taxonomy,
      mail.placementRevision,
    );
  }
}
export function classificationStatus(ownerId: string) {
  const works = ownerWorks(ownerId);
  const revision = createHash("sha256")
    .update(
      JSON.stringify({
        works: works
          .toSorted((a, b) => a.workId.localeCompare(b.workId))
          .map((work) => [
            work.workId,
            work.dispatchGeneration,
            work.outcome,
            work.resolved,
          ]),
        placements: getClassificationInputs(ownerId).map((mail) => [
          mail.id,
          mail.placementRevision,
        ]),
      }),
    )
    .digest("hex");
  if (works.some((work) => work.outcome === "pending"))
    return { status: statusSchema.parse("pending"), revision };
  if (works.some((work) => work.outcome === "failed" && !work.resolved))
    return { status: statusSchema.parse("complete with error"), revision };
  return { status: statusSchema.parse("completed"), revision };
}
export function retryFailed(ownerId: string) {
  transaction(() => {
    db.prepare(
      "UPDATE classification_work SET outcome='pending',error_code=NULL,dispatch_generation=dispatch_generation+1 WHERE owner_id=? AND outcome='failed' AND resolved=0",
    ).run(ownerId);
  });
}
export function refreshStale(ownerId: string) {
  transaction(() => enqueueChangedMail(ownerId, undefined, "refresh"));
}
export function startClassifiedMailbox(ownerId: string) {
  return initializeMailbox(ownerId, () => enqueueChangedMail(ownerId));
}
export function importClassifiedMail(
  ownerId: string,
  input: z.infer<typeof importedMailSchema>,
) {
  return importMail(ownerId, input, (id) => enqueueChangedMail(ownerId, [id]));
}
export function setCategory(
  ownerId: string,
  mailId: string,
  subcategoryId: string,
) {
  return transaction(() => applyManualCategory(ownerId, mailId, subcategoryId));
}
// Used by a confirmed batch under the shared SQLite transaction.
export function applyManualCategory(
  ownerId: string,
  mailId: string,
  subcategoryId: string,
) {
  const mail = getClassificationInputs(ownerId, [mailId])[0];
  if (
    !mail ||
    !applyCategory(ownerId, mailId, subcategoryId, mail.placementRevision)
  )
    throw new Error("NOT_FOUND");
  db.prepare(
    `INSERT INTO classification_overrides (owner_id,mail_id,subcategory_id,updated_at) VALUES (?,?,?,?) ON CONFLICT(owner_id,mail_id) DO UPDATE SET subcategory_id=excluded.subcategory_id,updated_at=excluded.updated_at`,
  ).run(ownerId, mailId, subcategoryId, new Date().toISOString());
  db.prepare(
    "UPDATE classification_work SET resolved=1,outcome=CASE WHEN outcome='pending' THEN 'superseded' ELSE outcome END WHERE owner_id=? AND mail_id=?",
  ).run(ownerId, mailId);
  return { mailId, subcategoryId };
}
// Downstream 06 receives original evidence and an explicit validity/source decision.
export function getStoredClassifications(ownerId: string, mailIds: string[]) {
  const taxonomy = taxonomyHash(ownerId);
  return getClassificationInputs(ownerId, mailIds).map((mail) => {
    const works = ownerWorks(ownerId).filter((work) => work.mailId === mail.id);
    const current = works.find(
      (work) =>
        work.contentHash === contentHash(mail) &&
        work.requestedModel === requestedModel &&
        work.ruleVersion === ruleVersion &&
        work.taxonomyHash === taxonomy &&
        work.outcome === "succeeded",
    );
    const override = db
      .prepare(
        "SELECT subcategory_id AS subcategoryId,updated_at AS updatedAt FROM classification_overrides WHERE owner_id=? AND mail_id=?",
      )
      .get(ownerId, mail.id);
    return {
      mailId: mail.id,
      subcategoryId: mail.subcategoryId,
      source: classificationSource(Boolean(override), Boolean(current)),
      override: override ?? null,
      current: current ? { ...current, ...savedAnswers(current.workId) } : null,
      history: works.map((work) => ({ ...work, ...savedAnswers(work.workId) })),
    };
  });
}

function classificationSource(manual: boolean, automatic: boolean) {
  if (manual) return "manual" as const;
  if (automatic) return "automatic" as const;
  return "unclassified" as const;
}

// applyCategory advances the revision exactly once in the same success transaction.
function isCurrentPlacement(
  work: Work,
  mail: ReturnType<typeof getClassificationInputs>[number],
) {
  if (work.outcome === "superseded") return false;
  if (work.outcome === "succeeded")
    return (
      work.placementRevision + 1 === mail.placementRevision &&
      savedAnswers(work.workId)?.subcategoryAnswer?.choice ===
        mail.subcategoryId
    );
  return work.placementRevision === mail.placementRevision;
}
