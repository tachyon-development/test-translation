import { Elysia, t } from "elysia";
import { eq, sql, desc } from "drizzle-orm";
import { db, schema } from "@hospiq/db";
import { requireRole } from "../middleware/auth";

export const adminRoutes = new Elysia({ prefix: "/api/org" })
  .use(requireRole("admin"))

  // GET /api/org/departments — List departments for org
  .get("/departments", async ({ user }) => {
    return db.query.departments.findMany({
      where: eq(schema.departments.orgId, user!.orgId),
      orderBy: (d, { asc }) => [asc(d.name)],
    });
  })

  // POST /api/org/departments — Create department
  .post(
    "/departments",
    async ({ user, body }) => {
      const [dept] = await db
        .insert(schema.departments)
        .values({
          orgId: user!.orgId,
          name: body.name,
          slug: body.slug,
          slaConfig: body.sla_config,
          escalationTo: body.escalation_to,
        })
        .returning();

      return dept;
    },
    {
      body: t.Object({
        name: t.String(),
        slug: t.String(),
        sla_config: t.Optional(
          t.Object({
            low: t.Number(),
            medium: t.Number(),
            high: t.Number(),
            critical: t.Number(),
          }),
        ),
        escalation_to: t.Optional(t.String()),
      }),
    },
  )

  // PATCH /api/org/departments/:id — Update SLA, escalation contact
  .patch(
    "/departments/:id",
    async ({ user, params, body, set }) => {
      const [dept] = await db
        .select()
        .from(schema.departments)
        .where(
          eq(schema.departments.id, params.id),
        )
        .limit(1);

      if (!dept || dept.orgId !== user!.orgId) {
        set.status = 404;
        return { error: "Department not found" };
      }

      const updateFields: Record<string, unknown> = {};
      if (body.sla_config !== undefined) updateFields.slaConfig = body.sla_config;
      if (body.escalation_to !== undefined) updateFields.escalationTo = body.escalation_to;
      if (body.name !== undefined) updateFields.name = body.name;

      const [updated] = await db
        .update(schema.departments)
        .set(updateFields)
        .where(eq(schema.departments.id, params.id))
        .returning();

      return updated;
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        sla_config: t.Optional(
          t.Object({
            low: t.Number(),
            medium: t.Number(),
            high: t.Number(),
            critical: t.Number(),
          }),
        ),
        escalation_to: t.Optional(t.String()),
      }),
    },
  )

  // GET /api/org/rooms — List rooms
  .get("/rooms", async ({ user }) => {
    return db.query.rooms.findMany({
      where: eq(schema.rooms.orgId, user!.orgId),
      orderBy: (r, { asc }) => [asc(r.number)],
    });
  })

  // POST /api/org/rooms — Create room
  .post(
    "/rooms",
    async ({ user, body }) => {
      const [room] = await db
        .insert(schema.rooms)
        .values({
          orgId: user!.orgId,
          number: body.number,
          floor: body.floor,
          zone: body.zone,
        })
        .returning();

      return room;
    },
    {
      body: t.Object({
        number: t.String(),
        floor: t.Number(),
        zone: t.Optional(t.String()),
      }),
    },
  )

  // GET /api/org/audit-log — Paginated audit trail
  .get(
    "/audit-log",
    async ({ user, query }) => {
      const page = parseInt(query.page ?? "1", 10);
      const limit = parseInt(query.limit ?? "50", 10);
      const offset = (page - 1) * limit;

      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.auditLog)
        .where(eq(schema.auditLog.orgId, user!.orgId));

      const rows = await db.query.auditLog.findMany({
        where: eq(schema.auditLog.orgId, user!.orgId),
        orderBy: (a, { desc: d }) => [d(a.createdAt)],
        limit,
        offset,
        with: {
          actor: {
            columns: { id: true, name: true, role: true },
          },
        },
      });

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

  // GET /api/org/users — List users for org
  .get("/users", async ({ user }) => {
    return db.query.users.findMany({
      where: eq(schema.users.orgId, user!.orgId),
      columns: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
        createdAt: true,
      },
      orderBy: (u, { asc }) => [asc(u.name)],
    });
  })

  // POST /api/org/users — Create user
  .post(
    "/users",
    async ({ user, body }) => {
      const passwordHash = await Bun.password.hash(body.password);

      const [newUser] = await db
        .insert(schema.users)
        .values({
          orgId: user!.orgId,
          name: body.name,
          email: body.email,
          role: body.role as any,
          departmentId: body.department_id,
          passwordHash,
        })
        .returning({
          id: schema.users.id,
          name: schema.users.name,
          email: schema.users.email,
          role: schema.users.role,
          departmentId: schema.users.departmentId,
          createdAt: schema.users.createdAt,
        });

      return newUser;
    },
    {
      body: t.Object({
        name: t.String(),
        email: t.String({ format: "email" }),
        role: t.String(),
        department_id: t.Optional(t.String()),
        password: t.String({ minLength: 6 }),
      }),
    },
  );
