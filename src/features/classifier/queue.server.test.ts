import { tmpdir } from "node:os";
// @vitest-environment node
import { it, expect, afterAll, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { resolve, dirname } from "node:path";
import { rmSync } from "node:fs";
import { Queue } from "bullmq";
import { db, databasePath, transaction } from "../../lib/db.server";
import {
  initializeMailbox,
  getClassificationInputs,
} from "../mailbox/mailbox.server";
import {
  enqueueChangedMail,
  classificationStatus,
  importClassifiedMail,
} from "./classification.server";
import { ownerWorks } from "./classification.repository.server";
import { queueName, redisConnection, dispatchPending } from "./queue.server";

const provider = process.env.TYPESAFE_BASE_URL ?? "http://127.0.0.1:4302";
process.env.EMAIL_ISLAND_REDIS_URL ??= "redis://127.0.0.1:6402";
const redisURL = process.env.EMAIL_ISLAND_REDIS_URL;
const redisPort = new URL(redisURL).port;
const redisData =
  process.env.EMAIL_ISLAND_REDIS_DATA ??
  resolve(tmpdir(), "email-island-test-redis");
const connection = redisConnection(true);
const queue = new Queue(queueName, { connection });
let worker: ReturnType<typeof spawn> | null = null;
function newOwner(subject: string) {
  const id = randomUUID();
  db.prepare(
    "INSERT INTO user (id,name,email,emailVerified,createdAt,updatedAt,isAnonymous) VALUES (?,?,?,0,?,?,1)",
  ).run(id, "Reader", `${id}@example.com`, Date.now(), Date.now());
  initializeMailbox(id);
  db.prepare("DELETE FROM mails WHERE owner_id=? AND seed_key<>?").run(
    id,
    "q4-0",
  );
  db.prepare("UPDATE mails SET subject=? WHERE owner_id=?").run(subject, id);
  transaction(() => enqueueChangedMail(id));
  return id;
}
function startWorker() {
  worker = spawn(
    process.execPath,
    [
      "--import",
      resolve("node_modules/tsx/dist/loader.mjs"),
      "src/features/classifier/worker.server.ts",
    ],
    {
      env: {
        ...process.env,
        EMAIL_ISLAND_DB_PATH: databasePath,
        EMAIL_ISLAND_REDIS_URL: redisURL,
        TYPESAFE_BASE_URL: provider,
        JEV_API_KEY: "acceptance-provider-only",
      },
      stdio: "ignore",
    },
  );
}
async function stopWorker() {
  if (!worker || worker.exitCode !== null || worker.signalCode !== null) return;
  const exit = once(worker, "exit");
  worker.kill("SIGTERM");
  await exit;
  worker = null;
}
async function completed(owner: string) {
  await expect
    .poll(() => classificationStatus(owner).status, { timeout: 20000 })
    .toBe("completed");
}
beforeAll(async () => {
  await fetch(provider + "/reset");
});
afterAll(async () => {
  await stopWorker();
  await queue.obliterate({ force: true });
  await queue.close();
  connection.disconnect();
  db.close();
  rmSync(dirname(databasePath), { recursive: true, force: true });
});

it("deduplicates Queue.add and stores only a trusted workId in Redis", async () => {
  const owner = newOwner("請確認報價項目");
  await Promise.all([dispatchPending(), dispatchPending()]);
  const waiting = await queue.getJobs(["waiting"]);
  expect(waiting).toHaveLength(1);
  expect(waiting[0]?.data).toEqual({ workId: ownerWorks(owner)[0]?.workId });
  expect(waiting[0]?.id).toBe(`${ownerWorks(owner)[0]!.workId}-0`);
  startWorker();
  await completed(owner);
  await stopWorker();
  const calls = await (await fetch(provider + "/calls")).json();
  expect(calls).toHaveLength(2);
  expect(ownerWorks(owner)[0]?.outcome).toBe("succeeded");
  const schedulers = await queue.getJobSchedulers();
  expect(
    schedulers.some(
      (scheduler) => scheduler.key === "classification-reconciliation",
    ),
  ).toBe(true);
});

it("rebuilds pending intents after Redis queue-data loss and never recomputes persisted success", async () => {
  const owner = newOwner("請確認報價項目 · 恢復");
  await queue.obliterate({ force: true });
  startWorker();
  await completed(owner);
  await stopWorker();
  const calls = await (await fetch(provider + "/calls")).json();
  expect(calls).toHaveLength(4);
  expect(
    calls.filter(
      (call: { subject: string }) => call.subject === "請確認報價項目",
    ),
  ).toHaveLength(2);
  expect(
    (await queue.getJobSchedulers()).some(
      (scheduler) => scheduler.key === "classification-reconciliation",
    ),
  ).toBe(true);
});

it("keeps the Job Scheduler working after persistent Redis restarts", async () => {
  const binary = process.env.EMAIL_ISLAND_REDIS_BINARY ?? "redis-server";
  startWorker();
  await expect
    .poll(async () => (await queue.getWorkers()).length)
    .toBeGreaterThan(0);
  execFileSync(binary.replace(/redis-server$/, "redis-cli"), [
    "-p",
    redisPort,
    "shutdown",
  ]);
  execFileSync(binary, [
    "--port",
    redisPort,
    "--bind",
    "127.0.0.1",
    "--appendonly",
    "yes",
    "--appendfsync",
    "everysec",
    "--maxmemory-policy",
    "noeviction",
    "--dir",
    redisData,
    "--daemonize",
    "yes",
    "--pidfile",
    resolve(redisData, "redis.pid"),
    "--logfile",
    resolve(redisData, "redis.log"),
  ]);
  const owner = newOwner("請確認報價項目 · 排程恢復");
  // No dispatch call here. Only the persisted BullMQ scheduler can discover this intent.
  await completed(owner);
  await stopWorker();
  expect(
    (await queue.getJobSchedulers()).some(
      (scheduler) => scheduler.key === "classification-reconciliation",
    ),
  ).toBe(true);
  expect(await (await fetch(provider + "/calls")).json()).toHaveLength(6);
}, 30000);

it("ignores a stale waiting generation before the current A performs its two provider steps", async () => {
  const subject = "請確認報價項目 · waiting A";
  await queue.pause();
  try {
    const owner = newOwner(subject);
    const mail = getClassificationInputs(owner)[0]!;
    const original = {
      key: "q4-0",
      subcategoryId: mail.subcategoryId,
      sender: mail.sender,
      subject: mail.subject,
      bodyText: mail.bodyText,
      receivedAt: mail.receivedAt,
      requiresReply: mail.requiresReply,
    };
    const a0 = ownerWorks(owner)[0]!;
    await dispatchPending();
    expect(await queue.isPaused()).toBe(true);
    expect(await queue.getJobState(`${a0.workId}-0`)).toBe("waiting");
    importClassifiedMail(owner, {
      ...original,
      subject: "團隊 waiting B",
      bodyText: "Changed B content",
    });
    await dispatchPending();
    importClassifiedMail(owner, original);
    await dispatchPending();
    const a1 = ownerWorks(owner).find((work) => work.workId === a0.workId)!;
    expect(a1.dispatchGeneration).toBe(1);
    const ids = [`${a0.workId}-0`, `${a0.workId}-1`];
    for (const id of ids) {
      expect(await queue.getJobState(id)).toBe("waiting");
      expect((await queue.getJob(id))!.data).toEqual({ workId: a0.workId });
    }
    expect(classificationStatus(owner).status).toBe("pending");
    await fetch(provider + "/control", {
      method: "POST",
      body: JSON.stringify([
        { subject, step: "domain", hold: true },
        { subject, step: "domain", hold: true },
      ]),
    });
    startWorker();
    await expect
      .poll(async () => (await queue.getWorkers()).length)
      .toBeGreaterThan(0);
    expect(await queue.isPaused()).toBe(true);
    expect(
      (await (await fetch(provider + "/calls")).json()).filter(
        (call: { subject: string }) => call.subject === subject,
      ),
    ).toHaveLength(0);
    await queue.resume();
    await expect
      .poll(() => queue.getJobState(ids[0]!), { timeout: 3000 })
      .toBe("completed");
    await expect
      .poll(async () => {
        const held = await (await fetch(provider + "/held")).json();
        return held.filter(
          (request: { subject: string }) => request.subject === subject,
        ).length;
      })
      .toBe(1);
    expect(await queue.getJobState(ids[1]!)).toBe("active");
    expect(
      ownerWorks(owner).find((work) => work.workId === a0.workId),
    ).toMatchObject({ outcome: "pending", dispatchGeneration: 1 });
    expect(getClassificationInputs(owner)[0]!.placementRevision).toBe(
      mail.placementRevision,
    );
    await fetch(provider + "/release");
    await completed(owner);
    await expect.poll(() => queue.getJobState(ids[1]!)).toBe("completed");
    const calls = await (await fetch(provider + "/calls")).json();
    expect(
      calls
        .filter((call: { subject: string }) => call.subject === subject)
        .map((call: { step: string }) => call.step),
    ).toEqual(["domain", "subcategory"]);
    expect(
      calls.filter(
        (call: { subject: string }) => call.subject === "團隊 waiting B",
      ),
    ).toHaveLength(0);
    const current = getClassificationInputs(owner);
    expect(current).toHaveLength(1);
    expect(current[0]).toMatchObject({
      id: mail.id,
      subcategoryId: mail.subcategoryId,
      placementRevision: mail.placementRevision + 1,
    });
    expect(classificationStatus(owner).status).toBe("completed");
  } finally {
    await fetch(provider + "/release");
    await queue.resume();
    await stopWorker();
  }
}, 20000);
