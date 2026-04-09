import { Worker, Queue, type Job } from "bullmq";
import IORedis from "ioredis";
import { eq } from "drizzle-orm";
import { db, schema } from "@hospiq/db";

const WHISPER_URL = process.env.WHISPER_URL || "http://whisper:8080";

interface TranscriptionJob {
  requestId: string;
  audioPath: string;
  orgId: string;
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

  const worker = new Worker<TranscriptionJob>(
    "transcription",
    async (job: Job<TranscriptionJob>) => {
      const { requestId, audioPath, orgId } = job.data;
      console.log(`Transcribing request ${requestId}`);

      // 1. Publish "transcribing" status
      await pubRedis.publish(
        `request:${requestId}:status`,
        JSON.stringify({ type: "processing", step: "transcribing" }),
      );

      // 2. Send audio to Whisper
      const audioFile = Bun.file(audioPath);
      const formData = new FormData();
      formData.append("file", audioFile, "audio.webm");
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

      // 3. Parse result
      const whisperData = (await whisperRes.json()) as {
        text: string;
        language?: string;
      };

      const transcript = whisperData.text;
      const language = whisperData.language ?? "en";

      // 4. INSERT transcription record
      await db.insert(schema.transcriptions).values({
        requestId,
        audioUrl: audioPath,
        sourceLang: language,
        transcript,
        confidence: 0.9, // Whisper doesn't always return confidence
      });

      // 5. UPDATE request (originalText, originalLang)
      await db
        .update(schema.requests)
        .set({
          originalText: transcript,
          originalLang: language,
        })
        .where(eq(schema.requests.id, requestId));

      // 6. Publish "transcribed" status
      await pubRedis.publish(
        `request:${requestId}:status`,
        JSON.stringify({
          type: "processing",
          step: "transcribed",
          text: transcript,
          lang: language,
        }),
      );

      // 7. Chain to classification queue
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
