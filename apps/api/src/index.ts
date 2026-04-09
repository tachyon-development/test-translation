import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { authRoutes } from "./routes/auth";
import { requestRoutes } from "./routes/requests";
import { workflowRoutes } from "./routes/workflows";
import { wsRoutes } from "./routes/ws";
import { analyticsRoutes } from "./routes/analytics";
import { healthRoutes } from "./routes/health";
import { adminRoutes } from "./routes/admin";
import { integrationRoutes } from "./routes/integrations";

const app = new Elysia()
  .use(cors({ origin: (process.env.CORS_ORIGINS ?? "http://localhost:80").split(",") }))
  .get("/api/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))
  .use(authRoutes)
  .use(requestRoutes)
  .use(workflowRoutes)
  .use(wsRoutes)
  .use(analyticsRoutes)
  .use(healthRoutes)
  .use(adminRoutes)
  .use(integrationRoutes)
  .listen(Number(process.env.API_PORT) || 4000);

console.log(`API running on port ${app.server?.port}`);
