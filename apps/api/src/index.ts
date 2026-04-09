import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";

const app = new Elysia()
  .use(cors())
  .get("/api/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))
  .listen(4000);

console.log(`API running on port ${app.server?.port}`);
