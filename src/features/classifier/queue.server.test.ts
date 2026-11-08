// @vitest-environment node
import { it, expect, afterAll, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { resolve, dirname } from "node:path";
import { rmSync } from "node:fs";
import { Queue } from "bullmq";
import { db, databasePath, transaction } from "../../lib/db.server";
import { initializeMailbox } from "../mailbox/mailbox.server";
import {
  enqueueChangedMail,
  classificationStatus,
} from "./classification.server";
import { ownerWorks } from "./classification.repository.server";
import { queueName, redisConnection, dispatchPending } from "./queue.server";

const provider = "http://127.0.0.1:4302";
process.env.EMAIL_ISLAND_REDIS_URL ??= "redis://127.0.0.1:6402";
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
        EMAIL_ISLAND_REDIS_URL: "redis://127.0.0.1:6402",
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
  // eslint-disable-next-line sonarjs/publicly-writable-directories -- Fixed isolated runtime supplied for acceptance.
  const binary =
    process.env.EMAIL_ISLAND_REDIS_BINARY ??
    "/private/tmp/email-island-02-evidence/redis-8.10.3/src/redis-server";
  startWorker();
  await expect
    .poll(async () => (await queue.getWorkers()).length)
    .toBeGreaterThan(0);
  execFileSync(binary.replace(/redis-server$/, "redis-cli"), [
    "-p",
    "6402",
    "shutdown",
  ]);
  // eslint-disable-next-line sonarjs/publicly-writable-directories -- Same persistent isolated Redis directory before and after restart.
  execFileSync(binary, [
    "--port",
    "6402",
    "--bind",
    "127.0.0.1",
    "--appendonly",
    "yes",
    "--appendfsync",
    "everysec",
    "--maxmemory-policy",
    "noeviction",
    "--dir",
    "/private/tmp/email-island-02-evidence/redis-data",
    "--daemonize",
    "yes",
    "--pidfile",
    "/private/tmp/email-island-02-evidence/redis.pid",
    "--logfile",
    "/private/tmp/email-island-02-evidence/redis.log",
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
