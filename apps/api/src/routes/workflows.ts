import { Elysia, t } from "elysia";
import { eq, and, sql } from "drizzle-orm";
import { db, schema } from "@hospiq/db";
import { redisPublish } from "../lib/redis";
import { requireAuth } from "../middleware/auth";

function publishWorkflowUpdate(
  orgId: string,
  deptId: string | null | undefined,
  requestId: string,
  payload: Record<string, unknown>,
) {
  const msg = JSON.stringify(payload);
  redisPublish(`org:${orgId}:workflows`, msg);
  if (deptId) redisPublish(`org:${orgId}:dept:${deptId}`, msg);
  redisPublish(`request:${requestId}:status`, msg);
}

export const workflowRoutes = new Elysia({ prefix: "/api/workflows" })
  .use(requireAuth)

  // GET /api/workflows — List workflows filtered by dept, status, priority
  .get(
    "/",
    async ({ user, query, set }) => {
      try {
        const conditions = [eq(schema.workflows.orgId, user?.orgId ?? "")];

        if (query.department_id) {
          conditions.push(eq(schema.workflows.departmentId, query.department_id));
        }
        if (query.status) {
          conditions.push(eq(schema.workflows.status, query.status as any));
        }
        if (query.priority) {
          conditions.push(eq(schema.workflows.priority, query.priority as any));
        }

        const rows = await db.query.workflows.findMany({
          where: and(...conditions),
          with: {
            department: true,
            request: true,
          },
          orderBy: (w, { desc }) => [desc(w.createdAt)],
        });

        return rows;
      } catch (err) {
        console.error("Route error:", err);
        set.status = 500;
        return { error: "Failed to load workflows" };
      }
    },
    {
      query: t.Object({
        department_id: t.Optional(t.String()),
        status: t.Optional(t.String()),
        priority: t.Optional(t.String()),
      }),
    },
  )

  // GET /api/workflows/:id — Detail with events timeline
  .get("/:id", async ({ params, user, set }) => {
    try {
      const workflow = await db.query.workflows.findFirst({
        where: and(
          eq(schema.workflows.id, params.id),
          eq(schema.workflows.orgId, user?.orgId ?? ""),
        ),
        with: {
          department: true,
          request: true,
        },
      });

      if (!workflow) {
        set.status = 404;
        return { error: "Workflow not found" };
      }

      // Get AI classification for this request
      const aiClassification = await db.query.aiClassifications.findFirst({
        where: eq(schema.aiClassifications.requestId, workflow.requestId),
      });

      // Get workflow events ordered by createdAt
      const events = await db.query.workflowEvents.findMany({
        where: eq(schema.workflowEvents.workflowId, params.id),
        orderBy: (e, { asc }) => [asc(e.createdAt)],
        with: {
          actor: {
            columns: { id: true, name: true, role: true },
          },
        },
      });

      return { ...workflow, aiClassification, workflowEvents: events };
    } catch (err) {
      console.error("Route error:", err);
      set.status = 500;
      return { error: "Failed to load workflow" };
    }
  })

  // POST /api/workflows/:id/claim — Staff claims a task
  .post("/:id/claim", async ({ params, user, set }) => {
    try {
      const [workflow] = await db
        .select()
        .from(schema.workflows)
        .where(
          and(
            eq(schema.workflows.id, params.id),
            eq(schema.workflows.orgId, user?.orgId ?? ""),
          ),
        )
        .limit(1);

      if (!workflow) {
        set.status = 404;
        return { error: "Workflow not found" };
      }

      if (workflow.status !== "pending") {
        set.status = 409;
        return { error: "Workflow is not in pending status" };
      }

      const [updated] = await db
        .update(schema.workflows)
        .set({ assignedTo: user?.sub ?? "", status: "claimed" })
        .where(eq(schema.workflows.id, params.id))
        .returning();

      await db.insert(schema.workflowEvents).values({
        workflowId: params.id,
        actorId: user?.sub ?? "",
        eventType: "claimed",
        payload: { claimedBy: user?.sub ?? "" },
      });

      publishWorkflowUpdate(user?.orgId ?? "", workflow.departmentId, workflow.requestId, {
        type: "workflow.claimed",
        workflowId: params.id,
        assignedTo: user?.sub ?? "",
      });

      return updated;
    } catch (err) {
      console.error("Route error:", err);
      set.status = 500;
      return { error: "Failed to claim workflow" };
    }
  })

  // PATCH /api/workflows/:id/status — Update status
  .patch(
    "/:id/status",
    async ({ params, user, body, set }) => {
      try {
        const [workflow] = await db
          .select()
          .from(schema.workflows)
          .where(
            and(
              eq(schema.workflows.id, params.id),
              eq(schema.workflows.orgId, user?.orgId ?? ""),
            ),
          )
          .limit(1);

        if (!workflow) {
          set.status = 404;
          return { error: "Workflow not found" };
        }

        const updateFields: Record<string, unknown> = { status: body.status };
        if (body.status === "resolved") {
          updateFields.resolvedAt = new Date();
          if (body.resolution_note) {
            updateFields.resolutionNote = body.resolution_note;
          }
        }

        const [updated] = await db
          .update(schema.workflows)
          .set(updateFields)
          .where(eq(schema.workflows.id, params.id))
          .returning();

        const eventType = body.status === "resolved" ? "resolved" : "status_change";
        await db.insert(schema.workflowEvents).values({
          workflowId: params.id,
          actorId: user?.sub ?? "",
          eventType,
          payload: { status: body.status, resolution_note: body.resolution_note },
        });

        publishWorkflowUpdate(user?.orgId ?? "", workflow.departmentId, workflow.requestId, {
          type: `workflow.${body.status}`,
          workflowId: params.id,
          status: body.status,
        });

        return updated;
      } catch (err) {
        console.error("Route error:", err);
        set.status = 500;
        return { error: "Failed to update workflow status" };
      }
    },
    {
      body: t.Object({
        status: t.Union([t.Literal("in_progress"), t.Literal("resolved")]),
        resolution_note: t.Optional(t.String()),
      }),
    },
  )

  // POST /api/workflows/:id/escalate — Manual escalation
  .post("/:id/escalate", async ({ params, user, set }) => {
    try {
      const workflow = await db.query.workflows.findFirst({
        where: and(
          eq(schema.workflows.id, params.id),
          eq(schema.workflows.orgId, user?.orgId ?? ""),
        ),
        with: { department: true },
      });

      if (!workflow) {
        set.status = 404;
        return { error: "Workflow not found" };
      }

      const [updated] = await db
        .update(schema.workflows)
        .set({
          status: "escalated",
          escalated: true,
          escalatedTo: workflow.department?.escalationTo ?? null,
          escalatedAt: new Date(),
        })
        .where(eq(schema.workflows.id, params.id))
        .returning();

      await db.insert(schema.workflowEvents).values({
        workflowId: params.id,
        actorId: user?.sub ?? "",
        eventType: "escalated",
        payload: { escalatedTo: workflow.department?.escalationTo },
      });

      publishWorkflowUpdate(user?.orgId ?? "", workflow.departmentId, workflow.requestId, {
        type: "workflow.escalated",
        workflowId: params.id,
      });

      return updated;
    } catch (err) {
      console.error("Route error:", err);
      set.status = 500;
      return { error: "Failed to escalate workflow" };
    }
  })

  // POST /api/workflows/:id/comment — Add note
  .post(
    "/:id/comment",
    async ({ params, user, body, set }) => {
      try {
        const [workflow] = await db
          .select()
          .from(schema.workflows)
          .where(
            and(
              eq(schema.workflows.id, params.id),
              eq(schema.workflows.orgId, user?.orgId ?? ""),
            ),
          )
          .limit(1);

        if (!workflow) {
          set.status = 404;
          return { error: "Workflow not found" };
        }

        const [event] = await db
          .insert(schema.workflowEvents)
          .values({
            workflowId: params.id,
            actorId: user?.sub ?? "",
            eventType: "comment",
            payload: { text: body.text },
          })
          .returning();

        publishWorkflowUpdate(user?.orgId ?? "", workflow.departmentId, workflow.requestId, {
          type: "workflow.comment",
          workflowId: params.id,
          text: body.text,
        });

        return event;
      } catch (err) {
        console.error("Route error:", err);
        set.status = 500;
        return { error: "Failed to add comment" };
      }
    },
    {
      body: t.Object({ text: t.String() }),
    },
  )

  // PATCH /api/workflows/:id/classify — Manager overrides AI classification
  .patch(
    "/:id/classify",
    async ({ params, user, body, set }) => {
      try {
        const [workflow] = await db
          .select()
          .from(schema.workflows)
          .where(
            and(
              eq(schema.workflows.id, params.id),
              eq(schema.workflows.orgId, user?.orgId ?? ""),
            ),
          )
          .limit(1);

        if (!workflow) {
          set.status = 404;
          return { error: "Workflow not found" };
        }

        const [updated] = await db
          .update(schema.workflows)
          .set({
            departmentId: body.department_id,
            priority: body.priority as any,
          })
          .where(eq(schema.workflows.id, params.id))
          .returning();

        await db.insert(schema.workflowEvents).values({
          workflowId: params.id,
          actorId: user?.sub ?? "",
          eventType: "reassigned",
          payload: {
            department_id: body.department_id,
            priority: body.priority,
            previousDepartmentId: workflow.departmentId,
            previousPriority: workflow.priority,
          },
        });

        publishWorkflowUpdate(user?.orgId ?? "", body.department_id, workflow.requestId, {
          type: "workflow.reassigned",
          workflowId: params.id,
          department_id: body.department_id,
          priority: body.priority,
        });

        // Also publish to old department if different
        if (workflow.departmentId && workflow.departmentId !== body.department_id) {
          redisPublish(
            `org:${user?.orgId ?? ""}:dept:${workflow.departmentId}`,
            JSON.stringify({
              type: "workflow.reassigned",
              workflowId: params.id,
              department_id: body.department_id,
            }),
          );
        }

        return updated;
      } catch (err) {
        console.error("Route error:", err);
        set.status = 500;
        return { error: "Failed to reclassify workflow" };
      }
    },
    {
      body: t.Object({
        department_id: t.String(),
        priority: t.String(),
      }),
    },
  )

  // DELETE /api/workflows/:id — Delete a workflow (manager/admin only)
  .delete("/:id", async ({ params, user, set }) => {
    try {
      if (!user || (user.role !== "manager" && user.role !== "admin")) {
        set.status = 403;
        return { error: "Only managers and admins can delete workflows" };
      }

      const [workflow] = await db
        .select()
        .from(schema.workflows)
        .where(
          and(
            eq(schema.workflows.id, params.id),
            eq(schema.workflows.orgId, user?.orgId ?? ""),
          ),
        )
        .limit(1);

      if (!workflow) {
        set.status = 404;
        return { error: "Workflow not found" };
      }

      // Delete related records first
      await db.delete(schema.workflowEvents).where(eq(schema.workflowEvents.workflowId, params.id));
      await db.delete(schema.workflows).where(eq(schema.workflows.id, params.id));

      // Publish removal event
      publishWorkflowUpdate(user.orgId ?? "", workflow.departmentId, workflow.requestId, {
        type: "workflow.deleted",
        workflowId: params.id,
      });

      return { ok: true };
    } catch (err) {
      console.error("Route error:", err);
      set.status = 500;
      return { error: "Failed to delete workflow" };
    }
  });
