import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { pendingWorks, finishWork } from "./classification.repository.server";

import { createHash } from "node:crypto";
import { databasePath } from "../../lib/db.server";
export const queueName = `email-island-classification-${createHash("sha256").update(databasePath).digest("hex").slice(0, 16)}`;
export function redisConnection(worker = false) {
  const url = process.env.EMAIL_ISLAND_REDIS_URL ?? "redis://127.0.0.1:6379";
  const connection = new Redis(url, {
    lazyConnect: !worker,
    maxRetriesPerRequest: worker ? null : 1,
    connectTimeout: 1000,
    retryStrategy: worker ? undefined : () => null,
    enableOfflineQueue: worker,
  });
  connection.on("error", () => {}); // Queue callers persist failures; worker reconnects using ioredis.
  return connection;
}
export async function dispatchPending() {
  const pending = pendingWorks();
  if (!pending.length) return;
  const connection = redisConnection();
  let queue: Queue | undefined;
  try {
    await connection.connect();
    queue = new Queue(queueName, { connection });
    await queue.waitUntilReady();
    for (const work of pending) {
      try {
        const jobId = `${work.workId}-${work.dispatchGeneration}`;
        const job = await queue.getJob(jobId);
        if (!job)
          await queue.add(
            "classify",
            { workId: work.workId },
            { jobId, attempts: 1 },
          );
        else if ((await job.getState()) === "failed")
          finishWork(
            work.workId,
            "failed",
            "QUEUE_JOB_FAILED",
            work.dispatchGeneration,
          );
      } catch {
        finishWork(
          work.workId,
          "failed",
          "QUEUE_DISPATCH_FAILED",
          work.dispatchGeneration,
        );
      }
    }
  } catch {
    for (const work of pending)
      finishWork(
        work.workId,
        "failed",
        "QUEUE_DISPATCH_FAILED",
        work.dispatchGeneration,
      );
  } finally {
    if (queue) await queue.close();
    connection.disconnect();
  }
}
