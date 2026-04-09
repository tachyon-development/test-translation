import { Elysia } from "elysia";
import { sql } from "drizzle-orm";
import { db } from "@hospiq/db";
import { redis } from "../lib/redis";

export const healthRoutes = new Elysia({ prefix: "/api/health" })

  // GET /api/health/services — Check each service
  .get("/services", async ({ set }) => {
    try {
      const services: Record<string, "up" | "down"> = {
        postgres: "down",
        redis: "down",
        ollama: "down",
        whisper: "down",
      };

      // Postgres
      try {
        await db.execute(sql`SELECT 1`);
        services.postgres = "up";
      } catch {
        // stays down
      }

      // Redis
      try {
        const pong = await redis.ping();
        if (pong === "PONG") services.redis = "up";
      } catch {
        // stays down
      }

      // Ollama
      try {
        const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`${ollamaUrl}/api/tags`, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) services.ollama = "up";
      } catch {
        // stays down
      }

      // Whisper
      try {
        const whisperUrl = process.env.WHISPER_URL || "http://localhost:9000";
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`${whisperUrl}/health`, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) services.whisper = "up";
      } catch {
        // stays down
      }

      return { services };
    } catch (err) {
      console.error("Route error:", err);
      set.status = 500;
      return { error: "Failed to check service health" };
    }
  });
