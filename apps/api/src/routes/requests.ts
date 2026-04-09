import { Elysia, t } from "elysia";
import { eq, and } from "drizzle-orm";
import { db, schema } from "@hospiq/db";
import { redis, redisSub } from "../lib/redis";
import { classificationQueue, transcriptionQueue } from "../lib/queue";
import { authMiddleware } from "../middleware/auth";

export const requestRoutes = new Elysia({ prefix: "/api/requests" })
  .use(authMiddleware)

  // POST /api/requests — Text request submission
  .post(
    "/",
    async ({ body, set }) => {
      const { text, room_number, org_id, lang } = body;

      // Look up room by number + org_id
      const room = await db.query.rooms.findFirst({
        where: and(
          eq(schema.rooms.number, room_number),
          eq(schema.rooms.orgId, org_id),
        ),
      });

      if (!room) {
        set.status = 404;
        return { error: "Room not found" };
      }

      // INSERT request with status "queued"
      const [request] = await db
        .insert(schema.requests)
        .values({
          orgId: org_id,
          roomId: room.id,
          originalText: text,
          originalLang: lang ?? "en",
          status: "queued",
        })
        .returning({ id: schema.requests.id });

      // Enqueue to classification queue (text requests skip transcription)
      await classificationQueue.add("classify", {
        requestId: request.id,
        text,
        orgId: org_id,
      });

      return { request_id: request.id };
    },
    {
      body: t.Object({
        text: t.String(),
        room_number: t.String(),
        org_id: t.String(),
        lang: t.Optional(t.String()),
      }),
    },
  )

  // POST /api/requests/voice — Voice request submission
  .post(
    "/voice",
    async ({ body, set }) => {
      const { audio, room_number, org_id } = body;

      const room = await db.query.rooms.findFirst({
        where: and(
          eq(schema.rooms.number, room_number),
          eq(schema.rooms.orgId, org_id),
        ),
      });

      if (!room) {
        set.status = 404;
        return { error: "Room not found" };
      }

      // Convert audio to base64 for passing through the job queue
      // (API and worker run in separate containers, can't share /tmp)
      const audioBuffer = await audio.arrayBuffer();
      const audioBase64 = Buffer.from(audioBuffer).toString("base64");

      // INSERT request with status "queued"
      const [request] = await db
        .insert(schema.requests)
        .values({
          orgId: org_id,
          roomId: room.id,
          status: "queued",
        })
        .returning({ id: schema.requests.id });

      // Enqueue to transcription queue with audio data inline
      await transcriptionQueue.add("transcribe", {
        requestId: request.id,
        audioBase64,
        audioMimeType: audio.type || "audio/webm",
        orgId: org_id,
      });

      return { request_id: request.id };
    },
    {
      body: t.Object({
        audio: t.File(),
        room_number: t.String(),
        org_id: t.String(),
      }),
    },
  )

  // GET /api/requests/:id/status — Poll fallback
  .get("/:id/status", async ({ params, set }) => {
    const request = await db.query.requests.findFirst({
      where: eq(schema.requests.id, params.id),
      columns: {
        id: true,
        status: true,
        translated: true,
        originalText: true,
        originalLang: true,
        createdAt: true,
      },
    });

    if (!request) {
      set.status = 404;
      return { error: "Request not found" };
    }

    return request;
  })

  // GET /api/requests/:id/stream — SSE for guest progress
  .get("/:id/stream", ({ params }) => {
    const requestId = params.id;
    const channel = `request:${requestId}:status`;

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();

        const send = (data: string) => {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        };

        // Subscribe to Redis channel
        redisSub.subscribe(channel);

        const messageHandler = (ch: string, message: string) => {
          if (ch === channel) {
            send(message);
          }
        };

        redisSub.on("message", messageHandler);

        // Send initial heartbeat
        send(JSON.stringify({ type: "connected" }));

        // Heartbeat every 15s
        const heartbeat = setInterval(() => {
          try {
            send(JSON.stringify({ type: "heartbeat" }));
          } catch {
            clearInterval(heartbeat);
          }
        }, 15_000);

        // Cleanup when stream closes
        const cleanup = () => {
          clearInterval(heartbeat);
          redisSub.off("message", messageHandler);
          redisSub.unsubscribe(channel);
        };

        // Store cleanup for cancel
        (controller as unknown as Record<string, unknown>).__cleanup = cleanup;
      },
      cancel(controller) {
        const cleanup = (controller as unknown as Record<string, unknown>)
          .__cleanup as (() => void) | undefined;
        cleanup?.();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  });
