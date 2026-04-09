import { Elysia, t } from "elysia";
import { eq, and, sql, gte, notInArray } from "drizzle-orm";
import { db, schema } from "@hospiq/db";
import { redisGet, redisSet } from "../lib/redis";
import { requireRole } from "../middleware/auth";

export const analyticsRoutes = new Elysia({ prefix: "/api/analytics" })
  .use(requireRole("manager", "admin"))

  // GET /api/analytics/overview — KPIs
  .get("/overview", async ({ user, set }) => {
    try {
      const orgId = user?.orgId ?? "";
      const cacheKey = `org:${orgId}:stats`;

      // Check Redis cache
      const cached = await redisGet(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Active workflows (not resolved/cancelled)
      const [activeResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.workflows)
        .where(
          and(
            eq(schema.workflows.orgId, orgId),
            notInArray(schema.workflows.status, ["resolved", "cancelled"]),
          ),
        );

      // Average response time (minutes) for resolved workflows in last 7 days
      const [avgResponseResult] = await db
        .select({
          avgMinutes: sql<number>`coalesce(avg(extract(epoch from (resolved_at - created_at)) / 60), 0)::float`,
        })
        .from(schema.workflows)
        .where(
          and(
            eq(schema.workflows.orgId, orgId),
            eq(schema.workflows.status, "resolved"),
            gte(schema.workflows.createdAt, sevenDaysAgo),
          ),
        );

      // Resolution rate (last 7 days)
      const [totalLast7] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.workflows)
        .where(
          and(
            eq(schema.workflows.orgId, orgId),
            gte(schema.workflows.createdAt, sevenDaysAgo),
          ),
        );

      const [resolvedLast7] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.workflows)
        .where(
          and(
            eq(schema.workflows.orgId, orgId),
            eq(schema.workflows.status, "resolved"),
            gte(schema.workflows.createdAt, sevenDaysAgo),
          ),
        );

      const resolutionRate =
        totalLast7.count > 0
          ? Math.round((resolvedLast7.count / totalLast7.count) * 100)
          : 0;

      // SLA miss rate (resolved after deadline OR escalated, last 7 days)
      const [slaMissResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.workflows)
        .where(
          and(
            eq(schema.workflows.orgId, orgId),
            gte(schema.workflows.createdAt, sevenDaysAgo),
            sql`(
              (resolved_at IS NOT NULL AND sla_deadline IS NOT NULL AND resolved_at > sla_deadline)
              OR status = 'escalated'
            )`,
          ),
        );

      const slaMissRate =
        totalLast7.count > 0
          ? Math.round((slaMissResult.count / totalLast7.count) * 100)
          : 0;

      const result = {
        active: activeResult.count,
        avgResponseTime: Math.round(avgResponseResult.avgMinutes * 100) / 100,
        resolutionRate,
        slaMissRate,
      };

      // Cache for 10 seconds
      await redisSet(cacheKey, JSON.stringify(result), 10);

      return result;
    } catch (err) {
      console.error("Route error:", err);
      set.status = 500;
      return { error: "Failed to load analytics" };
    }
  })

  // GET /api/analytics/departments — Per-department breakdown
  .get("/departments", async ({ user, set }) => {
    try {
      const orgId = user?.orgId ?? "";
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const rows = await db
        .select({
          departmentName: schema.departments.name,
          departmentId: schema.departments.id,
          active: sql<number>`count(*) filter (where ${schema.workflows.status} not in ('resolved', 'cancelled'))::int`,
          resolved: sql<number>`count(*) filter (where ${schema.workflows.status} = 'resolved')::int`,
          avgResponseTime: sql<number>`coalesce(avg(extract(epoch from (${schema.workflows.resolvedAt} - ${schema.workflows.createdAt})) / 60) filter (where ${schema.workflows.status} = 'resolved' and ${schema.workflows.createdAt} >= ${sevenDaysAgo}), 0)::float`,
          total: sql<number>`count(*)::int`,
          slaCompliant: sql<number>`count(*) filter (where ${schema.workflows.status} = 'resolved' and (${schema.workflows.slaDeadline} is null or ${schema.workflows.resolvedAt} <= ${schema.workflows.slaDeadline}))::int`,
        })
        .from(schema.departments)
        .leftJoin(
          schema.workflows,
          and(
            eq(schema.workflows.departmentId, schema.departments.id),
            eq(schema.workflows.orgId, orgId),
          ),
        )
        .where(eq(schema.departments.orgId, orgId))
        .groupBy(schema.departments.id, schema.departments.name);

      return rows.map((r) => ({
        departmentName: r.departmentName,
        departmentId: r.departmentId,
        active: r.active,
        resolved: r.resolved,
        avgResponseTime: Math.round(r.avgResponseTime * 100) / 100,
        slaCompliance:
          r.resolved > 0 ? Math.round((r.slaCompliant / r.resolved) * 100) : 100,
      }));
    } catch (err) {
      console.error("Route error:", err);
      set.status = 500;
      return { error: "Failed to load analytics" };
    }
  })

  // GET /api/analytics/ai — AI performance
  .get("/ai", async ({ user, set }) => {
    try {
      const orgId = user?.orgId ?? "";

      // Get all AI classifications for this org (join through requests)
      const classifications = await db
        .select({
          confidence: schema.aiClassifications.confidence,
          urgency: schema.aiClassifications.urgency,
        })
        .from(schema.aiClassifications)
        .innerJoin(
          schema.requests,
          eq(schema.aiClassifications.requestId, schema.requests.id),
        )
        .where(eq(schema.requests.orgId, orgId));

      // Confidence histogram
      const buckets = {
        "0.5-0.6": 0,
        "0.6-0.7": 0,
        "0.7-0.8": 0,
        "0.8-0.9": 0,
        "0.9-1.0": 0,
      };

      let totalConfidence = 0;
      const urgencyCounts: Record<string, number> = {};

      for (const row of classifications) {
        totalConfidence += row.confidence;

        // Bucket
        if (row.confidence >= 0.9) buckets["0.9-1.0"]++;
        else if (row.confidence >= 0.8) buckets["0.8-0.9"]++;
        else if (row.confidence >= 0.7) buckets["0.7-0.8"]++;
        else if (row.confidence >= 0.6) buckets["0.6-0.7"]++;
        else buckets["0.5-0.6"]++;

        // Urgency counts
        urgencyCounts[row.urgency] = (urgencyCounts[row.urgency] || 0) + 1;
      }

      return {
        confidenceDistribution: buckets,
        averageConfidence:
          classifications.length > 0
            ? Math.round((totalConfidence / classifications.length) * 1000) / 1000
            : 0,
        countByUrgency: urgencyCounts,
        totalClassifications: classifications.length,
      };
    } catch (err) {
      console.error("Route error:", err);
      set.status = 500;
      return { error: "Failed to load analytics" };
    }
  });
