import { Worker, Queue } from "bullmq";
import { processClassification } from "./classification.processor.server";
import { queueName, redisConnection, dispatchPending } from "./queue.server";

const connection = redisConnection(true);
const queue = new Queue(queueName, { connection });
const worker = new Worker(
  queueName,
  async (job) => {
    if (job.name === "reconcile") await dispatchPending();
    else if (typeof job.data.workId === "string")
      await processClassification(job.data.workId);
  },
  { connection, concurrency: 4, stalledInterval: 1000, lockDuration: 5000 },
);
worker.on("error", (error) =>
  console.error("Classifier queue:", error.message),
);
async function start() {
  await queue.upsertJobScheduler(
    "classification-reconciliation",
    { every: 5000 },
    { name: "reconcile", data: {} },
  );
  await dispatchPending();
  console.log("Classifier worker ready");
}
void start();
async function stop() {
  await worker.close();
  await queue.close();
  connection.disconnect();
}
process.once("SIGTERM", () => void stop());
process.once("SIGINT", () => void stop());
