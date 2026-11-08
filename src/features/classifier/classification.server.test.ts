import { processClassification } from "./classification.processor.server";
import { contentHash, taxonomyHash } from "./classification-policy.server";
// @vitest-environment node
import { beforeAll, afterAll, beforeEach, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { dirname } from "node:path";
import { db, databasePath, transaction } from "../../lib/db.server";
import {
  initializeMailbox,
  getClassificationInputs,
  listClassificationCandidates,
  saveMailRead,
} from "../mailbox/mailbox.server";
import {
  enqueueChangedMail,
  classificationStatus,
  retryFailed,
  setCategory,
  getStoredClassifications,
  importClassifiedMail,
  refreshStale,
} from "./classification.server";
import { ownerWorks, savedAnswers } from "./classification.repository.server";

const provider = process.env.TYPESAFE_BASE_URL ?? "http://127.0.0.1:4302";
async function control(plans: unknown[]) {
  await fetch(provider + "/control", {
    method: "POST",
    body: JSON.stringify(plans),
  });
}
async function callCount() {
  return (await (await fetch(provider + "/calls")).json()).length;
}
function owner(count = 1) {
  const id = randomUUID();
  db.prepare(
    "INSERT INTO user (id,name,email,emailVerified,createdAt,updatedAt,isAnonymous) VALUES (?,?,?,0,?,?,1)",
  ).run(id, "Reader", `${id}@example.com`, Date.now(), Date.now());
  initializeMailbox(id);
  db.prepare(
    "DELETE FROM mails WHERE owner_id=? AND id NOT IN (SELECT id FROM mails WHERE owner_id=? ORDER BY rowid LIMIT ?)",
  ).run(id, id, count);
  return id;
}
async function processOwner(id: string) {
  for (const work of ownerWorks(id))
    await processClassification(
      work.workId,
      `${work.workId}-${work.dispatchGeneration}`,
    );
}
beforeAll(() => {
  process.env.TYPESAFE_BASE_URL = provider;
  process.env.JEV_API_KEY = "acceptance-provider-only";
});
beforeEach(async () => {
  await fetch(provider + "/release");
  await fetch(provider + "/reset");
});
afterAll(() => {
  db.close();
  rmSync(dirname(databasePath), { recursive: true, force: true });
});

it("persists exact two-step provider evidence and reuses cache without leaking fixture answers", async () => {
  const id = owner();
  transaction(() => enqueueChangedMail(id));
  await processOwner(id);
  expect(classificationStatus(id)).toEqual({
    status: "completed",
    revision: expect.stringMatching(/^[a-f0-9]{64}$/),
  });
  const work = ownerWorks(id)[0]!;
  const answers = savedAnswers(work.workId)!;
  expect(work).toMatchObject({
    requestedModel: "jev-1.14.0",
    ruleVersion: "1",
    outcome: "succeeded",
  });
  expect(work.contentHash).toMatch(/^[a-f0-9]{64}$/);
  expect(work.taxonomyHash).toMatch(/^[a-f0-9]{64}$/);
  expect(answers).toMatchObject({
    domainResolvedModel: "jev-1.14.0",
    resolvedModel: "jev-1.14.0",
    domainAnswer: { choice: "core-projects", confidence: 0.93 },
    subcategoryAnswer: { confidence: 0.93 },
  });
  expect(Object.keys(answers.domainAnswer!.probabilities)).toHaveLength(8);
  expect(Object.keys(answers.subcategoryAnswer!.probabilities)).toHaveLength(2);
  const before = await callCount();
  await processOwner(id);
  transaction(() => enqueueChangedMail(id));
  expect(await callCount()).toBe(before);
  expect(ownerWorks(id)).toHaveLength(1);
  const requests = await (await fetch(provider + "/calls")).json();
  const candidates = listClassificationCandidates(id);
  expect(
    candidates.every(
      (domain) =>
        domain.description === null &&
        domain.subcategories.every((category) => category.description === null),
    ),
  ).toBe(true);
  for (const request of requests)
    for (const criterion of Object.values(
      request.body.questions.category.criteria,
    ))
      expect(criterion).toMatchObject({
        name: expect.any(String),
        description: null,
      });

  for (const request of requests)
    expect(Object.keys(request.body.state).sort()).toEqual([
      "bodyText",
      "receivedAt",
      "sender",
      "subject",
    ]);
});

it("readAt and placement do not change content hash; content and taxonomy do invalidate", async () => {
  const id = owner();
  const mail = getClassificationInputs(id)[0]!;
  const original = contentHash(mail);
  const taxonomy = taxonomyHash(id);
  saveMailRead(id, {
    domainId: "core-projects",
    subcategoryId: mail.subcategoryId,
    mailId: mail.id,
  });
  expect(contentHash(getClassificationInputs(id)[0]!)).toBe(original);
  const team = listClassificationCandidates(id).find(
    (domain) => domain.id === "internal-team",
  )!.subcategories[0]!;
  setCategory(id, mail.id, team.id);
  expect(contentHash(getClassificationInputs(id)[0]!)).toBe(original);
  expect(taxonomyHash(id)).toBe(taxonomy);
  db.prepare("UPDATE subcategories SET name=? WHERE owner_id=? AND id=?").run(
    "新團隊名稱",
    id,
    team.id,
  );
  expect(taxonomyHash(id)).not.toBe(taxonomy);
  db.prepare("UPDATE mails SET subject=? WHERE owner_id=? AND id=?").run(
    "changed",
    id,
    mail.id,
  );
  expect(contentHash(getClassificationInputs(id)[0]!)).not.toBe(original);
});

it("keeps identical content owner-private, validates candidate ownership, and records manual source", async () => {
  const a = owner();
  const b = owner();
  transaction(() => {
    enqueueChangedMail(a);
    enqueueChangedMail(b);
  });
  await processOwner(a);
  await processOwner(b);
  expect(await callCount()).toBe(4);
  const am = getClassificationInputs(a)[0]!;
  const bm = getClassificationInputs(b)[0]!;
  expect(() => setCategory(a, am.id, bm.subcategoryId)).toThrow("NOT_FOUND");
  expect(() => setCategory(a, bm.id, am.subcategoryId)).toThrow("NOT_FOUND");
  setCategory(
    a,
    am.id,
    listClassificationCandidates(a).find(
      (domain) => domain.id === "internal-team",
    )!.subcategories[0]!.id,
  );
  const evidence = getStoredClassifications(a, [am.id])[0]!;
  expect(evidence.source).toBe("manual");
  expect(evidence.history[0]?.domainAnswer?.choice).toBe("core-projects");
  expect(getStoredClassifications(a, [bm.id])).toEqual([]);
});

it("failed second step reuses saved first answer, including a real single-candidate provider call", async () => {
  const id = owner();
  await control([
    { subject: "請確認報價項目", step: "domain", choice: "internal-team" },
    { subject: "請確認報價項目", step: "subcategory", fail: true },
  ]);
  transaction(() => enqueueChangedMail(id));
  await processOwner(id);
  expect(classificationStatus(id).status).toBe("complete with error");
  expect(savedAnswers(ownerWorks(id)[0]!.workId)?.domainAnswer?.choice).toBe(
    "internal-team",
  );
  retryFailed(id);
  await processOwner(id);
  expect(await callCount()).toBe(3);
  expect(classificationStatus(id).status).toBe("completed");
  expect(
    Object.keys(
      savedAnswers(ownerWorks(id)[0]!.workId)!.subcategoryAnswer!.probabilities,
    ),
  ).toHaveLength(1);
});

it("invalid provider selection and empty candidates preserve placement and surface error", async () => {
  const invalid = owner();
  const original = getClassificationInputs(invalid)[0]!.subcategoryId;
  await control([{ subject: "請確認報價項目", step: "domain", invalid: true }]);
  transaction(() => enqueueChangedMail(invalid));
  await processOwner(invalid);
  expect(classificationStatus(invalid).status).toBe("complete with error");
  expect(getClassificationInputs(invalid)[0]!.subcategoryId).toBe(original);
  const empty = owner();
  const mail = getClassificationInputs(empty)[0]!;
  const team = listClassificationCandidates(empty).find(
    (domain) => domain.id === "internal-team",
  )!.subcategories[0]!;
  db.prepare("UPDATE mails SET subcategory_id=? WHERE owner_id=?").run(
    team.id,
    empty,
  );
  db.prepare(
    "DELETE FROM subcategories WHERE owner_id=? AND domain_id='core-projects'",
  ).run(empty);
  transaction(() => enqueueChangedMail(empty));
  await processOwner(empty);
  expect(classificationStatus(empty).status).toBe("complete with error");
  expect(getClassificationInputs(empty)[0]!.subcategoryId).toBe(team.id);
  expect(ownerWorks(empty)[0]?.errorCode).toContain("EMPTY_CANDIDATES");
  expect(mail.id).toBe(getClassificationInputs(empty)[0]!.id);
});

it("mail import commits intent atomically, deduplicates content and protects overrides on refresh", async () => {
  const id = owner();
  const mail = getClassificationInputs(id)[0]!;
  const input = {
    key: "import-test",
    subcategoryId: mail.subcategoryId,
    sender: "sender@example.com",
    subject: "new",
    bodyText: "content",
    receivedAt: "2026-11-01T00:00:00.000Z",
    requiresReply: false,
  };
  const added = importClassifiedMail(id, input);
  expect(added.changed).toBe(true);
  expect(ownerWorks(id)).toHaveLength(1);
  expect(importClassifiedMail(id, input)).toEqual({ ...added, changed: false });
  expect(ownerWorks(id)).toHaveLength(1);
  db.exec(
    "CREATE TRIGGER reject_intent BEFORE INSERT ON classification_work BEGIN SELECT RAISE(ABORT, 'intent failure'); END;",
  );
  expect(() => importClassifiedMail(id, { ...input, key: "rollback" })).toThrow(
    "intent failure",
  );
  db.exec("DROP TRIGGER reject_intent");
  expect(getClassificationInputs(id)).toHaveLength(2);
  setCategory(id, added.mailId, mail.subcategoryId);
  refreshStale(id);
  expect(
    ownerWorks(id).filter((work) => work.mailId === added.mailId),
  ).toHaveLength(1);
  expect(classificationStatus(id).status).toBe("pending");
});

it("refreshes changed owner work and placements without refreshing identical status polls or reads", async () => {
  const id = owner();
  transaction(() => enqueueChangedMail(id));
  await processOwner(id);
  const completed = classificationStatus(id);
  expect(classificationStatus(id)).toEqual(completed);
  const mail = getClassificationInputs(id)[0]!;
  const domain = listClassificationCandidates(id).find((entry) =>
    entry.subcategories.some((category) => category.id === mail.subcategoryId),
  )!;
  saveMailRead(id, {
    domainId: domain.id,
    subcategoryId: mail.subcategoryId,
    mailId: mail.id,
  });
  expect(classificationStatus(id)).toEqual(completed);
  const other = owner();
  transaction(() => enqueueChangedMail(other));
  await processOwner(other);
  expect(classificationStatus(id)).toEqual(completed);
  importClassifiedMail(id, {
    key: "fast-import",
    subcategoryId: mail.subcategoryId,
    sender: mail.sender,
    subject: "請確認報價項目 · 新信",
    bodyText: "new content",
    receivedAt: "2026-11-01T00:00:00.000Z",
    requiresReply: false,
  });
  await processOwner(id);
  const fastCompleted = classificationStatus(id);
  expect(fastCompleted.status).toBe("completed");
  expect(fastCompleted.revision).not.toBe(completed.revision);
  setCategory(id, mail.id, mail.subcategoryId);
  const firstManual = classificationStatus(id);
  expect(firstManual.revision).not.toBe(fastCompleted.revision);
  setCategory(id, mail.id, mail.subcategoryId);
  expect(classificationStatus(id).revision).not.toBe(firstManual.revision);
});
