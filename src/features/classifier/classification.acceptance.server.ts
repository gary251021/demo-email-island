// Observes the real BullMQ acknowledgement when a held provider response is released.
import { createHash } from "node:crypto";
import { Queue } from "bullmq";
import { Redis } from "ioredis";

export async function queueJobState(
  databasePath: string,
  workId: string,
  generation: number,
) {
  const connection = new Redis(
    process.env.EMAIL_ISLAND_REDIS_URL ?? "redis://127.0.0.1:6402",
    { maxRetriesPerRequest: 1 },
  );
  const name = `email-island-classification-${createHash("sha256").update(databasePath).digest("hex").slice(0, 16)}`;
  const queue = new Queue(name, { connection });
  try {
    return await queue.getJobState(`${workId}-${generation}`);
  } finally {
    await queue.close();
    connection.disconnect();
  }
}
