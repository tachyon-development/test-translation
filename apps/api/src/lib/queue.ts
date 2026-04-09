import { Queue } from "bullmq";
import { redis } from "./redis";

export const transcriptionQueue = new Queue("transcription", {
  connection: redis,
});

export const classificationQueue = new Queue("classification", {
  connection: redis,
});

export const notificationQueue = new Queue("notification", {
  connection: redis,
});

export const escalationQueue = new Queue("escalation-check", {
  connection: redis,
});

export const integrationQueue = new Queue("integration", {
  connection: redis,
});
