import { createTranscriptionWorker } from "./processors/transcription";
import { createClassificationWorker } from "./processors/classification";
import { createEscalationWorker } from "./processors/escalation";
import { createNotificationWorker } from "./processors/notification";
import { createIntegrationWorker } from "./processors/integration";

console.log("Worker starting...");

const transcriptionWorker = createTranscriptionWorker();
const classificationWorker = createClassificationWorker();
const escalationWorker = createEscalationWorker();
const notificationWorker = createNotificationWorker();
const integrationWorker = createIntegrationWorker();

console.log("All workers registered:");
console.log("  - transcription (concurrency: 2)");
console.log("  - classification (concurrency: 3)");
console.log("  - escalation-check (concurrency: 5)");
console.log("  - notification (concurrency: 10)");
console.log("  - integration (concurrency: 5)");

// Graceful shutdown on SIGTERM
const shutdown = async () => {
  console.log("Shutting down workers...");
  await Promise.all([
    transcriptionWorker.close(),
    classificationWorker.close(),
    escalationWorker.close(),
    notificationWorker.close(),
    integrationWorker.close(),
  ]);
  console.log("All workers stopped.");
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
