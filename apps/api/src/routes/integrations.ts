import { Elysia, t } from "elysia";
import { eq, and, sql, desc } from "drizzle-orm";
import { db, schema } from "@hospiq/db";
import { requireRole } from "../middleware/auth";
import { getAdapter, listAdapters } from "../integrations/registry";

export const integrationRoutes = new Elysia({ prefix: "/api/integrations" })
  .use(requireRole("admin"))

  // GET /api/integrations/providers — list available adapters
  .get("/providers", () => {
    return { providers: listAdapters() };
  })

  // GET /api/integrations — list org integrations
  .get(
    "/",
    async ({ user, query }) => {
      const page = parseInt(query.page ?? "1", 10);
      const limit = parseInt(query.limit ?? "50", 10);
      const offset = (page - 1) * limit;

      const rows = await db.query.integrations.findMany({
        where: eq(schema.integrations.orgId, user!.orgId),
        orderBy: (i, { desc: d }) => [d(i.createdAt)],
        limit,
        offset,
      });

      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.integrations)
        .where(eq(schema.integrations.orgId, user!.orgId));

      return {
        data: rows,
        pagination: {
          page,
          limit,
          total: countResult.count,
          totalPages: Math.ceil(countResult.count / limit),
        },
      };
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    },
  )

  // POST /api/integrations — create integration
  .post(
    "/",
    async ({ user, body }) => {
      const [integration] = await db
        .insert(schema.integrations)
        .values({
          orgId: user!.orgId,
          name: body.name,
          type: body.type as any,
          provider: body.provider,
          config: body.config,
          auth: body.auth,
          active: body.active ?? true,
          triggerOn: (body.trigger_on as any) ?? "all",
          filterDepartments: body.filter_departments,
        })
        .returning();

      return integration;
    },
    {
      body: t.Object({
        name: t.String(),
        type: t.String(),
        provider: t.Optional(t.String()),
        config: t.Any(),
        auth: t.Optional(t.Any()),
        active: t.Optional(t.Boolean()),
        trigger_on: t.Optional(t.String()),
        filter_departments: t.Optional(t.String()),
      }),
    },
  )

  // GET /api/integrations/:id — detail + config
  .get("/:id", async ({ user, params, set }) => {
    const integration = await db.query.integrations.findFirst({
      where: and(
        eq(schema.integrations.id, params.id),
        eq(schema.integrations.orgId, user!.orgId),
      ),
    });

    if (!integration) {
      set.status = 404;
      return { error: "Integration not found" };
    }

    return integration;
  })

  // PATCH /api/integrations/:id — update config, auth, mappings
  .patch(
    "/:id",
    async ({ user, params, body, set }) => {
      const existing = await db.query.integrations.findFirst({
        where: and(
          eq(schema.integrations.id, params.id),
          eq(schema.integrations.orgId, user!.orgId),
        ),
      });

      if (!existing) {
        set.status = 404;
        return { error: "Integration not found" };
      }

      const updateFields: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      if (body.name !== undefined) updateFields.name = body.name;
      if (body.config !== undefined) updateFields.config = body.config;
      if (body.auth !== undefined) updateFields.auth = body.auth;
      if (body.active !== undefined) updateFields.active = body.active;
      if (body.trigger_on !== undefined) updateFields.triggerOn = body.trigger_on;
      if (body.filter_departments !== undefined)
        updateFields.filterDepartments = body.filter_departments;

      const [updated] = await db
        .update(schema.integrations)
        .set(updateFields)
        .where(eq(schema.integrations.id, params.id))
        .returning();

      return updated;
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        config: t.Optional(t.Any()),
        auth: t.Optional(t.Any()),
        active: t.Optional(t.Boolean()),
        trigger_on: t.Optional(t.String()),
        filter_departments: t.Optional(t.String()),
      }),
    },
  )

  // DELETE /api/integrations/:id — remove
  .delete("/:id", async ({ user, params, set }) => {
    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(schema.integrations.id, params.id),
        eq(schema.integrations.orgId, user!.orgId),
      ),
    });

    if (!existing) {
      set.status = 404;
      return { error: "Integration not found" };
    }

    // Delete related field mappings and events first
    await db
      .delete(schema.integrationEvents)
      .where(eq(schema.integrationEvents.integrationId, params.id));
    await db
      .delete(schema.fieldMappings)
      .where(eq(schema.fieldMappings.integrationId, params.id));
    await db
      .delete(schema.integrations)
      .where(eq(schema.integrations.id, params.id));

    return { success: true };
  })

  // POST /api/integrations/:id/test — send test payload, return request/response
  .post("/:id/test", async ({ user, params, set }) => {
    const integration = await db.query.integrations.findFirst({
      where: and(
        eq(schema.integrations.id, params.id),
        eq(schema.integrations.orgId, user!.orgId),
      ),
    });

    if (!integration) {
      set.status = 404;
      return { error: "Integration not found" };
    }

    const provider = integration.provider || integration.type;
    const adapter = getAdapter(provider);
    if (!adapter) {
      set.status = 400;
      return { error: `No adapter found for provider: ${provider}` };
    }

    // Load field mappings
    const mappings = await db.query.fieldMappings.findMany({
      where: eq(schema.fieldMappings.integrationId, params.id),
    });

    // Build test workflow payload
    const testWorkflow = {
      id: "test-00000000-0000-0000-0000-000000000000",
      status: "pending",
      priority: "medium",
      slaDeadline: new Date().toISOString(),
      request: {
        originalText: "Test integration request from HospiQ",
        translated: "Test integration request from HospiQ",
        room: { number: "101" },
        language: "en",
      },
      department: { name: "Housekeeping", slug: "housekeeping" },
      _config: (integration.config as any) || {},
    };

    const payload = adapter.buildPayload(testWorkflow, mappings);

    try {
      const startTime = Date.now();
      const result = await adapter.send(
        payload,
        integration.config,
        integration.auth,
      );
      const latencyMs = Date.now() - startTime;

      // Record the test event
      await db.insert(schema.integrationEvents).values({
        integrationId: integration.id,
        status: result.status >= 200 && result.status < 300 ? "success" : "failed",
        httpStatus: result.status,
        requestPayload: payload,
        responseBody: result.body,
        latencyMs,
      });

      return {
        success: result.status >= 200 && result.status < 300,
        request: payload,
        response: result,
        latencyMs,
      };
    } catch (err: any) {
      // Record failure
      await db.insert(schema.integrationEvents).values({
        integrationId: integration.id,
        status: "failed",
        requestPayload: payload,
        error: err.message,
      });

      set.status = 502;
      return {
        success: false,
        request: payload,
        error: err.message,
      };
    }
  })

  // PATCH /api/integrations/:id/toggle — enable/disable
  .patch("/:id/toggle", async ({ user, params, set }) => {
    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(schema.integrations.id, params.id),
        eq(schema.integrations.orgId, user!.orgId),
      ),
    });

    if (!existing) {
      set.status = 404;
      return { error: "Integration not found" };
    }

    const [updated] = await db
      .update(schema.integrations)
      .set({ active: !existing.active, updatedAt: new Date() })
      .where(eq(schema.integrations.id, params.id))
      .returning();

    return updated;
  })

  // GET /api/integrations/:id/events — paginated event log
  .get(
    "/:id/events",
    async ({ user, params, query, set }) => {
      // Verify integration belongs to org
      const integration = await db.query.integrations.findFirst({
        where: and(
          eq(schema.integrations.id, params.id),
          eq(schema.integrations.orgId, user!.orgId),
        ),
      });

      if (!integration) {
        set.status = 404;
        return { error: "Integration not found" };
      }

      const page = parseInt(query.page ?? "1", 10);
      const limit = parseInt(query.limit ?? "50", 10);
      const offset = (page - 1) * limit;

      const rows = await db.query.integrationEvents.findMany({
        where: eq(schema.integrationEvents.integrationId, params.id),
        orderBy: (e, { desc: d }) => [d(e.createdAt)],
        limit,
        offset,
      });

      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.integrationEvents)
        .where(eq(schema.integrationEvents.integrationId, params.id));

      return {
        data: rows,
        pagination: {
          page,
          limit,
          total: countResult.count,
          totalPages: Math.ceil(countResult.count / limit),
        },
      };
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    },
  )

  // GET /api/integrations/:id/mappings — list field mappings
  .get("/:id/mappings", async ({ user, params, set }) => {
    const integration = await db.query.integrations.findFirst({
      where: and(
        eq(schema.integrations.id, params.id),
        eq(schema.integrations.orgId, user!.orgId),
      ),
    });

    if (!integration) {
      set.status = 404;
      return { error: "Integration not found" };
    }

    return db.query.fieldMappings.findMany({
      where: eq(schema.fieldMappings.integrationId, params.id),
      orderBy: (m, { asc }) => [asc(m.createdAt)],
    });
  })

  // PUT /api/integrations/:id/mappings — replace all mappings
  .put(
    "/:id/mappings",
    async ({ user, params, body, set }) => {
      const integration = await db.query.integrations.findFirst({
        where: and(
          eq(schema.integrations.id, params.id),
          eq(schema.integrations.orgId, user!.orgId),
        ),
      });

      if (!integration) {
        set.status = 404;
        return { error: "Integration not found" };
      }

      // Delete existing mappings
      await db
        .delete(schema.fieldMappings)
        .where(eq(schema.fieldMappings.integrationId, params.id));

      // Insert new mappings
      if (body.mappings.length > 0) {
        const rows = body.mappings.map(
          (m: { source_field: string; target_field: string; transform?: string }) => ({
            integrationId: params.id,
            sourceField: m.source_field,
            targetField: m.target_field,
            transform: m.transform ?? "none",
          }),
        );

        await db.insert(schema.fieldMappings).values(rows);
      }

      return db.query.fieldMappings.findMany({
        where: eq(schema.fieldMappings.integrationId, params.id),
        orderBy: (m, { asc }) => [asc(m.createdAt)],
      });
    },
    {
      body: t.Object({
        mappings: t.Array(
          t.Object({
            source_field: t.String(),
            target_field: t.String(),
            transform: t.Optional(t.String()),
          }),
        ),
      }),
    },
  );
