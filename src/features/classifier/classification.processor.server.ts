import { transaction } from "../../lib/db.server";
import {
  getClassificationInputs,
  listClassificationCandidates,
  applyCategory,
} from "../mailbox/mailbox.server";
import { contentHash, taxonomyHash } from "./classification-policy.server";
import {
  findWork,
  hasOverride,
  finishWork,
  savedAnswers,
  saveAnswer,
} from "./classification.repository.server";
import type { Work } from "./classification.repository.server";
import { askJev } from "./jev.server";
function currentSnapshot(work: Work) {
  const current = findWork(work.workId);
  if (
    current?.outcome !== "pending" ||
    current.dispatchGeneration !== work.dispatchGeneration
  )
    return null;
  const mail = getClassificationInputs(work.ownerId, [work.mailId])[0];
  if (
    !mail ||
    hasOverride(work.ownerId, work.mailId) ||
    mail.placementRevision !== work.placementRevision ||
    contentHash(mail) !== work.contentHash ||
    taxonomyHash(work.ownerId) !== work.taxonomyHash
  )
    return null;
  return mail;
}
export async function processClassification(workId: string) {
  const work = findWork(workId);
  if (!work || work.outcome !== "pending") return;
  try {
    const mail = currentSnapshot(work);
    if (!mail) {
      finishWork(workId, "superseded", null, work.dispatchGeneration);
      return;
    }
    const state = {
      sender: mail.sender,
      subject: mail.subject,
      bodyText: mail.bodyText,
      receivedAt: mail.receivedAt,
    };
    const candidates = listClassificationCandidates(work.ownerId);
    let stored = savedAnswers(workId);
    if (!stored?.domainAnswer) {
      const result = await askJev(
        state,
        candidates,
        work.requestedModel,
        "domain",
      );
      transaction(() => {
        if (currentSnapshot(work))
          saveAnswer(work, "domain", result.answer, result.resolvedModel);
      });
      stored = savedAnswers(workId);
    }
    if (!currentSnapshot(work)) {
      finishWork(workId, "superseded", null, work.dispatchGeneration);
      return;
    }
    const domain = candidates.find(
      (candidate) => candidate.id === stored?.domainAnswer?.choice,
    );
    if (!domain) throw new Error("INVALID_DOMAIN");
    if (!stored?.subcategoryAnswer) {
      const result = await askJev(
        state,
        domain.subcategories,
        work.requestedModel,
        "subcategory",
      );
      transaction(() => {
        if (!currentSnapshot(work)) {
          finishWork(workId, "superseded", null, work.dispatchGeneration);
          return;
        }
        saveAnswer(work, "subcategory", result.answer, result.resolvedModel);
        if (
          !applyCategory(
            work.ownerId,
            work.mailId,
            result.answer.choice,
            work.placementRevision,
          )
        )
          throw new Error("STALE_PLACEMENT");
        finishWork(workId, "succeeded", null, work.dispatchGeneration);
      });
    } else {
      transaction(() => {
        if (!currentSnapshot(work)) {
          finishWork(workId, "superseded", null, work.dispatchGeneration);
          return;
        }
        if (
          !applyCategory(
            work.ownerId,
            work.mailId,
            stored.subcategoryAnswer!.choice,
            work.placementRevision,
          )
        )
          throw new Error("STALE_PLACEMENT");
        finishWork(workId, "succeeded", null, work.dispatchGeneration);
      });
    }
  } catch (error) {
    finishWork(
      workId,
      "failed",
      error instanceof Error
        ? error.name + ":" + error.message
        : "CLASSIFICATION_ERROR",
      work.dispatchGeneration,
    );
  }
}
