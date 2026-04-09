import { Worker, Queue, type Job } from "bullmq";
import IORedis from "ioredis";
import { eq } from "drizzle-orm";
import { db, schema } from "@hospiq/db";
import {
  CircuitBreaker,
  CircuitOpenError,
} from "../../../api/src/lib/circuitBreaker";

const WHISPER_URL = process.env.WHISPER_URL || "http://whisper:8080";

interface TranscriptionJob {
  requestId: string;
  audioBase64: string;
  audioMimeType?: string;
  orgId: string;
  // Legacy field for local dev
  audioPath?: string;
}

export function createTranscriptionWorker() {
  const connection = new IORedis(
    process.env.REDIS_URL || "redis://localhost:6379",
    { maxRetriesPerRequest: null },
  );

  const pubRedis = new IORedis(
    process.env.REDIS_URL || "redis://localhost:6379",
    { maxRetriesPerRequest: null },
  );

  const classificationQueue = new Queue("classification", { connection });

  const whisperBreaker = new CircuitBreaker({
    name: "whisper",
    threshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || "3"),
    resetTimeMs: parseInt(process.env.CIRCUIT_BREAKER_RESET_MS || "30000"),
    redis: connection,
  });

  const worker = new Worker<TranscriptionJob>(
    "transcription",
    async (job: Job<TranscriptionJob>) => {
      const { requestId, audioBase64, audioMimeType, orgId } = job.data;
      console.log(`Transcribing request ${requestId}`);

      // 1. Publish "transcribing" status
      await pubRedis.publish(
        `request:${requestId}:status`,
        JSON.stringify({ type: "processing", step: "transcribing" }),
      );

      // 2. Send audio to Whisper (wrapped in circuit breaker)
      let whisperData: { text: string; language?: string };
      try {
        whisperData = await whisperBreaker.execute(async () => {
          // Decode base64 audio from job queue
          const audioBuffer = Buffer.from(audioBase64, "base64");
          const audioBlob = new Blob([audioBuffer], { type: audioMimeType || "audio/webm" });
          const formData = new FormData();
          formData.append("file", audioBlob, "audio.webm");
          formData.append("model", "whisper-1");

          const whisperRes = await fetch(
            `${WHISPER_URL}/v1/audio/transcriptions`,
            {
              method: "POST",
              body: formData,
            },
          );

          if (!whisperRes.ok) {
            throw new Error(
              `Whisper request failed: ${whisperRes.status} ${await whisperRes.text()}`,
            );
          }

          return (await whisperRes.json()) as {
            text: string;
            language?: string;
          };
        });
      } catch (error) {
        if (error instanceof CircuitOpenError) {
          console.warn(
            `Circuit breaker OPEN for Whisper — voice request ${requestId} cannot be transcribed`,
          );
          // Re-throw so BullMQ retries / eventually sends to DLQ
          throw error;
        }
        throw error; // Re-throw other errors for BullMQ retry
      }

      const transcript = whisperData.text;
      const language = whisperData.language ?? "en";

      // 3. INSERT transcription record
      await db.insert(schema.transcriptions).values({
        requestId,
        audioUrl: audioPath,
        sourceLang: language,
        transcript,
        confidence: 0.9, // Whisper doesn't always return confidence
      });

      // 4. UPDATE request (originalText, originalLang)
      await db
        .update(schema.requests)
        .set({
          originalText: transcript,
          originalLang: language,
        })
        .where(eq(schema.requests.id, requestId));

      // 5. Publish "transcribed" status
      await pubRedis.publish(
        `request:${requestId}:status`,
        JSON.stringify({
          type: "processing",
          step: "transcribed",
          text: transcript,
          lang: language,
        }),
      );

      // 6. Chain to classification queue
      await classificationQueue.add("classify", {
        requestId,
        text: transcript,
        orgId,
      });

      console.log(
        `Request ${requestId} transcribed (${language}): "${transcript.slice(0, 80)}..."`,
      );
    },
    { connection, concurrency: 2 },
  );

  worker.on("failed", (job, err) => {
    console.error(`Transcription job ${job?.id} failed:`, err);
  });

  return worker;
}
