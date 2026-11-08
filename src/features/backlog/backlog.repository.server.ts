import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../../lib/db.server";
const itemSchema = z.object({
  mailId: z.uuid(),
  fingerprint: z.string(),
  sender: z.string(),
  manual: z.boolean(),
  groupId: z.uuid(),
});
export const savedPlanSchema = z.object({
  items: z.array(itemSchema),
  groups: z.array(
    z.object({
      groupId: z.uuid(),
      sender: z.string(),
      mailIds: z.array(z.uuid()),
    }),
  ),
  reusedItems: z.number(),
  recomputedSenders: z.array(z.string()),
});
export type SavedPlan = z.infer<typeof savedPlanSchema>;
export const operationSchema = z.object({
  operationId: z.uuid(),
  affectedSubcategoryIds: z.array(z.uuid()),
});
db.exec(`CREATE TABLE IF NOT EXISTS backlog_groups (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES user(id), source_id TEXT NOT NULL,
 sender TEXT NOT NULL, UNIQUE(owner_id,source_id,sender),
 FOREIGN KEY(owner_id,source_id) REFERENCES subcategories(owner_id,id));
 CREATE TABLE IF NOT EXISTS backlog_plans (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES user(id), source_id TEXT NOT NULL,
 action TEXT NOT NULL, revision TEXT NOT NULL, snapshot TEXT NOT NULL,
 selection TEXT, result TEXT,
 UNIQUE(owner_id,source_id,action,revision),
 FOREIGN KEY(owner_id,source_id) REFERENCES subcategories(owner_id,id));
 CREATE TABLE IF NOT EXISTS backlog_prompts(owner_id TEXT NOT NULL REFERENCES user(id),scope TEXT NOT NULL,dismissed_until TEXT NOT NULL,PRIMARY KEY(owner_id,scope));`);
export function getPlan(ownerId: string, id: string) {
  const row = db
    .prepare("SELECT * FROM backlog_plans WHERE owner_id=? AND id=?")
    .get(ownerId, id);
  if (!row) throw new Error("NOT_FOUND");
  return {
    id: String(row.id),
    sourceId: String(row.source_id),
    action: String(row.action),
    revision: String(row.revision),
    snapshot: savedPlanSchema.parse(JSON.parse(String(row.snapshot))),
    selection: row.selection === null ? null : String(row.selection),
    result:
      row.result === null
        ? null
        : operationSchema.parse(JSON.parse(String(row.result))),
  };
}
export function latestPlan(ownerId: string, sourceId: string, action: string) {
  const row = db
    .prepare(
      "SELECT id FROM backlog_plans WHERE owner_id=? AND source_id=? AND action=? ORDER BY rowid DESC LIMIT 1",
    )
    .get(ownerId, sourceId, action);
  return row ? getPlan(ownerId, String(row.id)) : null;
}
export function savePlan(
  ownerId: string,
  id: string,
  sourceId: string,
  action: string,
  revision: string,
  snapshot: SavedPlan,
) {
  db.prepare(
    "INSERT OR IGNORE INTO backlog_plans(id,owner_id,source_id,action,revision,snapshot) VALUES (?,?,?,?,?,?)",
  ).run(id, ownerId, sourceId, action, revision, JSON.stringify(snapshot));
  const row = db
    .prepare(
      "SELECT id FROM backlog_plans WHERE owner_id=? AND source_id=? AND action=? AND revision=?",
    )
    .get(ownerId, sourceId, action, revision);
  return getPlan(ownerId, String(row?.id));
}
export function applyPlan(
  ownerId: string,
  id: string,
  selection: string,
  result: z.infer<typeof operationSchema>,
) {
  db.prepare(
    "UPDATE backlog_plans SET selection=?,result=? WHERE owner_id=? AND id=?",
  ).run(selection, JSON.stringify(result), ownerId, id);
}
export function dismissedUntil(ownerId: string, scope: string) {
  const row = db
    .prepare(
      "SELECT dismissed_until FROM backlog_prompts WHERE owner_id=? AND scope=?",
    )
    .get(ownerId, scope);
  return row ? String(row.dismissed_until) : null;
}
export function dismissPrompt(ownerId: string, scope: string, until: string) {
  db.prepare(
    "INSERT INTO backlog_prompts(owner_id,scope,dismissed_until) VALUES (?,?,?) ON CONFLICT(owner_id,scope) DO UPDATE SET dismissed_until=excluded.dismissed_until",
  ).run(ownerId, scope, until);
}

export function groupIdentity(
  ownerId: string,
  sourceId: string,
  sender: string,
) {
  db.prepare(
    "INSERT OR IGNORE INTO backlog_groups(id,owner_id,source_id,sender) VALUES (?,?,?,?)",
  ).run(randomUUID(), ownerId, sourceId, sender);
  const row = db
    .prepare(
      "SELECT id FROM backlog_groups WHERE owner_id=? AND source_id=? AND sender=?",
    )
    .get(ownerId, sourceId, sender);
  return z.uuid().parse(row?.id);
}
