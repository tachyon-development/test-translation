import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";

const app = new Elysia()
  .use(cors({ origin: (process.env.CORS_ORIGINS ?? "http://localhost:80").split(",") }))
  .get("/api/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))
  .listen(Number(process.env.API_PORT) || 4000);

console.log(`API running on port ${app.server?.port}`);
