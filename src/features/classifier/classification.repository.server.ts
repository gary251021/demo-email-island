import { z } from "zod";
import { db } from "../../lib/db.server";
import { answerSchema } from "../../lib/classification";

db.exec(`
CREATE TABLE IF NOT EXISTS classification_work (
 work_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES user(id), mail_id TEXT NOT NULL,
 content_hash TEXT NOT NULL, requested_model TEXT NOT NULL, rule_version TEXT NOT NULL, taxonomy_hash TEXT NOT NULL,
 placement_revision INTEGER NOT NULL, dispatch_generation INTEGER NOT NULL DEFAULT 0,
 outcome TEXT NOT NULL CHECK(outcome IN ('pending','succeeded','failed','superseded')),
 error_code TEXT, resolved INTEGER NOT NULL DEFAULT 0,
 UNIQUE(owner_id,mail_id,content_hash,requested_model,rule_version,taxonomy_hash)
);
CREATE TABLE IF NOT EXISTS classification_results (
 work_id TEXT PRIMARY KEY REFERENCES classification_work(work_id), owner_id TEXT NOT NULL, mail_id TEXT NOT NULL,
 domain_answer TEXT, subcategory_answer TEXT, domain_resolved_model TEXT, resolved_model TEXT,
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS classification_overrides (
 owner_id TEXT NOT NULL, mail_id TEXT NOT NULL, subcategory_id TEXT NOT NULL, updated_at TEXT NOT NULL,
 PRIMARY KEY(owner_id,mail_id)
);
CREATE INDEX IF NOT EXISTS classification_owner_outcome ON classification_work(owner_id,outcome,resolved);
`);

const workSchema = z.object({
  workId: z.string(),
  ownerId: z.string(),
  mailId: z.string(),
  contentHash: z.string(),
  requestedModel: z.string(),
  ruleVersion: z.string(),
  taxonomyHash: z.string(),
  placementRevision: z.number(),
  dispatchGeneration: z.number(),
  outcome: z.enum(["pending", "succeeded", "failed", "superseded"]),
  errorCode: z.string().nullable(),
  resolved: z.number(),
});
export type Work = z.infer<typeof workSchema>;
const columns = `work_id AS workId,owner_id AS ownerId,mail_id AS mailId,content_hash AS contentHash,
 requested_model AS requestedModel,rule_version AS ruleVersion,taxonomy_hash AS taxonomyHash,
 placement_revision AS placementRevision,dispatch_generation AS dispatchGeneration,outcome,error_code AS errorCode,resolved`;
export function findWork(workId: string) {
  const row = db
    .prepare(`SELECT ${columns} FROM classification_work WHERE work_id=?`)
    .get(workId);
  return row ? workSchema.parse(row) : null;
}
export function ownerWorks(ownerId: string) {
  return workSchema
    .array()
    .parse(
      db
        .prepare(`SELECT ${columns} FROM classification_work WHERE owner_id=?`)
        .all(ownerId),
    );
}
export function pendingWorks() {
  return workSchema
    .array()
    .parse(
      db
        .prepare(
          `SELECT ${columns} FROM classification_work WHERE outcome='pending'`,
        )
        .all(),
    );
}
export function hasOverride(ownerId: string, mailId: string) {
  return Boolean(
    db
      .prepare(
        "SELECT mail_id FROM classification_overrides WHERE owner_id=? AND mail_id=?",
      )
      .get(ownerId, mailId),
  );
}
export function finishWork(
  workId: string,
  outcome: Work["outcome"],
  errorCode: string | null,
  generation: number,
) {
  db.prepare(
    "UPDATE classification_work SET outcome=?,error_code=? WHERE work_id=? AND outcome='pending' AND dispatch_generation=?",
  ).run(outcome, errorCode, workId, generation);
}

export function savedAnswers(workId: string) {
  const row = db
    .prepare("SELECT * FROM classification_results WHERE work_id=?")
    .get(workId);
  return row
    ? {
        domainAnswer: row.domain_answer
          ? answerSchema.parse(JSON.parse(String(row.domain_answer)))
          : null,
        subcategoryAnswer: row.subcategory_answer
          ? answerSchema.parse(JSON.parse(String(row.subcategory_answer)))
          : null,
        domainResolvedModel: row.domain_resolved_model
          ? String(row.domain_resolved_model)
          : null,
        resolvedModel: row.resolved_model ? String(row.resolved_model) : null,
      }
    : null;
}
export function saveAnswer(
  work: Work,
  step: "domain" | "subcategory",
  answer: z.infer<typeof answerSchema>,
  model: string,
) {
  db.prepare(
    `INSERT INTO classification_results (work_id,owner_id,mail_id,created_at) VALUES (?,?,?,?) ON CONFLICT(work_id) DO NOTHING`,
  ).run(work.workId, work.ownerId, work.mailId, new Date().toISOString());
  const answerColumn =
    step === "domain" ? "domain_answer" : "subcategory_answer";
  const modelColumn =
    step === "domain" ? "domain_resolved_model" : "resolved_model";
  db.prepare(
    `UPDATE classification_results SET ${answerColumn}=?,${modelColumn}=? WHERE work_id=? AND owner_id=?`,
  ).run(JSON.stringify(answer), model, work.workId, work.ownerId);
}
