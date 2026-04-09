import { Elysia } from "elysia";
import IORedis from "ioredis";
import { and, eq, notInArray } from "drizzle-orm";
import { db, schema } from "@hospiq/db";
import { verifyToken, type JWTPayload } from "../lib/auth";

export const wsRoutes = new Elysia().ws("/ws/dashboard", {
  async open(ws) {
    const url = new URL(ws.data.request.url);
    const token = url.searchParams.get("token");

    if (!token) {
      ws.close(4001, "Missing token");
      return;
    }

    let user: JWTPayload;
    try {
      user = await verifyToken(token);
    } catch {
      ws.close(4001, "Invalid token");
      return;
    }

    // Create dedicated Redis subscriber for this connection
    const sub = new IORedis(
      process.env.REDIS_URL || "redis://localhost:6379",
      { maxRetriesPerRequest: null },
    );

    // Store subscriber and user info on the ws context for cleanup
    (ws.data as any)._redisSub = sub;
    (ws.data as any)._user = user;

    const orgChannel = `org:${user.orgId}:workflows`;
    const channels = [orgChannel];

    if (user.departmentId) {
      channels.push(`org:${user.orgId}:dept:${user.departmentId}`);
    }

    // Subscribe to channels
    await sub.subscribe(...channels);

    sub.on("message", (_channel: string, message: string) => {
      // Send raw JSON string — don't double-parse/serialize
      ws.send(message);
    });

    // Send snapshot of active workflows
    try {
      const conditions = [
        eq(schema.workflows.orgId, user.orgId),
        notInArray(schema.workflows.status, ["resolved", "cancelled"]),
      ];

      if (user.departmentId) {
        conditions.push(eq(schema.workflows.departmentId, user.departmentId));
      }

      const activeWorkflows = await db.query.workflows.findMany({
        where: and(...conditions),
        with: {
          department: true,
          request: true,
        },
        orderBy: (w, { desc }) => [desc(w.createdAt)],
      });

      ws.send({ type: "snapshot", workflows: activeWorkflows });
    } catch (err) {
      console.error("Error fetching workflow snapshot:", err);
    }
  },

  message(ws, message) {
    // Handle ping/pong heartbeat
    if (typeof message === "object" && message !== null && (message as any).type === "ping") {
      ws.send({ type: "pong" });
    }
  },

  close(ws) {
    const sub = (ws.data as any)?._redisSub as IORedis | undefined;
    if (sub) {
      sub.unsubscribe();
      sub.disconnect();
      (ws.data as any)._redisSub = null;
    }
  },
});
