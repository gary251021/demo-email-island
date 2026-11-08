import { createHash, randomUUID } from "node:crypto";
import { transaction } from "../../lib/db.server";
import type { CommitInput, PrepareInput, PromptInput } from "../../lib/backlog";
import {
  readBacklogScope,
  createSplitCategory,
  readOverview,
} from "../mailbox/mailbox.server";
import { archiveInTransaction } from "../mailbox/mail-actions.server";
import {
  getStoredClassifications,
  applyManualCategory,
} from "../classifier/classification.server";
import {
  groupIdentity,
  getPlan,
  latestPlan,
  savePlan,
  applyPlan,
  dismissedUntil,
  dismissPrompt,
} from "./backlog.repository.server";
import type { SavedPlan } from "./backlog.repository.server";
const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
function snapshot(ownerId: string, sourceId: string) {
  const scope = readBacklogScope(ownerId, sourceId);
  const classifications = new Map(
    getStoredClassifications(
      ownerId,
      scope.mails.map((mail) => mail.id),
    ).map((result) => [result.mailId, result]),
  );
  const items = scope.mails.map((mail) => ({
    mailId: mail.id,
    sender: mail.sender,
    groupId: groupIdentity(ownerId, sourceId, mail.sender),
    manual: classifications.get(mail.id)?.source === "manual",
    fingerprint: hash([
      mail.id,
      mail.subcategoryId,
      mail.sender,
      mail.subject,
      mail.bodyText,
      mail.receivedAt,
      mail.placementRevision,
      mail.archivedAt,
      classifications.get(mail.id)?.override,
    ]),
  }));
  return { ...scope, items };
}
function prepare(ownerId: string, input: PrepareInput) {
  const current = snapshot(ownerId, input.subcategoryId);
  const revision = hash(["sender-v1", current.items]);
  const previous = latestPlan(ownerId, input.subcategoryId, input.action);
  const old = new Map(
    previous?.snapshot.items.map((item) => [item.mailId, item]) ?? [],
  );
  const changed = new Set<string>();
  let reusedItems = 0;
  for (const item of current.items) {
    const before = old.get(item.mailId);
    if (before?.fingerprint === item.fingerprint) reusedItems++;
    else {
      changed.add(item.sender);
      if (before) changed.add(before.sender);
    }
    old.delete(item.mailId);
  }
  for (const item of old.values()) changed.add(item.sender);
  const bySender = new Map<string, typeof current.items>();
  for (const item of current.items) {
    const group = bySender.get(item.sender) ?? [];
    group.push(item);
    bySender.set(item.sender, group);
  }
  const groups =
    bySender.size < 2
      ? []
      : [...bySender.entries()]
          .filter(([, items]) => items.length >= 3)
          .sort(
            ([a, am], [b, bm]) => bm.length - am.length || a.localeCompare(b),
          )
          .slice(0, 5)
          .map(([sender, items]) => {
            const cached = previous?.snapshot.groups.find(
              (group) => group.sender === sender,
            );
            return !changed.has(sender) && cached
              ? cached
              : {
                  sender,
                  groupId: items[0]!.groupId,
                  mailIds: items.map((item) => item.mailId),
                };
          });
  const saved: SavedPlan = {
    items: current.items.map(
      (item) =>
        previous?.snapshot.items.find(
          (before) =>
            before.mailId === item.mailId &&
            before.fingerprint === item.fingerprint,
        ) ?? item,
    ),
    groups,
    reusedItems,
    recomputedSenders: [...changed].sort((a, b) => a.localeCompare(b)),
  };
  const plan = savePlan(
    ownerId,
    randomUUID(),
    input.subcategoryId,
    input.action,
    revision,
    saved,
  );
  return {
    planId: plan.id,
    revision: plan.revision,
    totalCount: current.mails.length,
    unreadCount: current.mails.filter((mail) => mail.readAt === null).length,
    groups: plan.snapshot.groups,
    mails: current.mails.map((mail) => ({
      id: mail.id,
      sender: mail.sender,
      subject: mail.subject,
      readAt: mail.readAt,
      manual: classificationsManual(plan.snapshot, mail.id),
    })),
    diagnostics: {
      reusedItems:
        previous?.revision === revision ? current.items.length : reusedItems,
      recomputedSenders:
        previous?.revision === revision ? [] : saved.recomputedSenders,
    },
  };
}
const classificationsManual = (plan: SavedPlan, id: string) =>
  plan.items.find((item) => item.mailId === id)?.manual === true;
export function prepareBacklog(ownerId: string, input: PrepareInput) {
  return transaction(() => prepare(ownerId, input));
}
export function commitBacklog(ownerId: string, input: CommitInput) {
  return transaction(() => {
    const plan = getPlan(ownerId, input.planId);
    const selection =
      input.selection.action === "archive"
        ? {
            action: "archive",
            mailIds: input.selection.mailIds.toSorted((a, b) =>
              a.localeCompare(b),
            ),
          }
        : {
            action: "split",
            groups: input.selection.groups
              .map((group) => ({
                ...group,
                mailIds: group.mailIds.toSorted((a, b) => a.localeCompare(b)),
              }))
              .sort((a, b) => a.groupId.localeCompare(b.groupId)),
          };
    const key = JSON.stringify(selection);
    if (plan.result) {
      if (plan.selection !== key) throw new Error("PLAN_ALREADY_APPLIED");
      return plan.result;
    }
    if (
      plan.revision !== input.revision ||
      plan.action !== input.selection.action
    )
      throw new Error("STALE_PLAN");
    const selected =
      input.selection.action === "archive"
        ? input.selection.mailIds
        : input.selection.groups.flatMap((group) => group.mailIds);
    // Validate membership before comparing freshness, so forged IDs never disclose a resource.
    for (const id of selected)
      if (!plan.snapshot.items.some((item) => item.mailId === id))
        throw new Error("NOT_FOUND");
    if (input.selection.action === "split")
      for (const group of input.selection.groups) {
        const candidate = plan.snapshot.groups.find(
          (entry) => entry.groupId === group.groupId,
        );
        if (
          !candidate ||
          !group.mailIds.every((id) => candidate.mailIds.includes(id))
        )
          throw new Error("NOT_FOUND");
      }
    const current = snapshot(ownerId, plan.sourceId);
    for (const id of selected)
      if (
        current.items.find((item) => item.mailId === id)?.fingerprint !==
        plan.snapshot.items.find((item) => item.mailId === id)?.fingerprint
      )
        throw new Error("STALE_PLAN");
    const affected = [plan.sourceId];
    if (input.selection.action === "archive")
      for (const mailId of selected)
        archiveInTransaction(ownerId, {
          domainId: current.category.domainId,
          subcategoryId: plan.sourceId,
          mailId,
        });
    else
      for (const group of input.selection.groups) {
        const id = createSplitCategory(
          ownerId,
          current.category.domainId,
          group.name,
        );
        affected.push(id);
        for (const mailId of group.mailIds)
          applyManualCategory(ownerId, mailId, id);
      }
    const result = {
      operationId: randomUUID(),
      affectedSubcategoryIds: affected,
    };
    applyPlan(ownerId, plan.id, key, result);
    return result;
  });
}
function promptScope(ownerId: string, input: PromptInput) {
  if ("subcategoryId" in input.scope) {
    const { mails } = readBacklogScope(ownerId, input.scope.subcategoryId);
    return {
      key: `subcategory:${input.scope.subcategoryId}`,
      count: mails.filter((mail) => mail.readAt === null).length,
    };
  }
  const domainId = input.scope.domainId;
  const domain = readOverview(ownerId).domains.find(
    (entry) => entry.id === domainId,
  );
  if (!domain) throw new Error("NOT_FOUND");
  return { key: `domain:${domain.id}`, count: domain.unreadCount };
}
export function getBacklogPrompt(ownerId: string, input: PromptInput) {
  const scope = promptScope(ownerId, input);
  const until = dismissedUntil(ownerId, scope.key);
  return {
    eligible: scope.count >= 30 && (!until || Date.parse(until) <= Date.now()),
    dismissedUntil: until,
  };
}
export function dismissBacklogPrompt(ownerId: string, input: PromptInput) {
  const scope = promptScope(ownerId, input);
  const until = new Date(Date.now() + 86400000).toISOString();
  dismissPrompt(ownerId, scope.key, until);
  return { dismissedUntil: until };
}
