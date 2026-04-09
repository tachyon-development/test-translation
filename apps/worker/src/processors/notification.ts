import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";

interface NotificationJob {
  channel: string;
  message: string;
}

export function createNotificationWorker() {
  const connection = new IORedis(
    process.env.REDIS_URL || "redis://localhost:6379",
    { maxRetriesPerRequest: null },
  );

  const pubRedis = new IORedis(
    process.env.REDIS_URL || "redis://localhost:6379",
    { maxRetriesPerRequest: null },
  );

  const worker = new Worker<NotificationJob>(
    "notification",
    async (job: Job<NotificationJob>) => {
      const { channel, message } = job.data;
      await pubRedis.publish(channel, message);
      console.log(`Notification published to ${channel}`);
    },
    { connection, concurrency: 10 },
  );

  worker.on("failed", (job, err) => {
    console.error(`Notification job ${job?.id} failed:`, err);
  });

  return worker;
}
