import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { eq } from "drizzle-orm";
import { db, schema } from "@hospiq/db";

interface EscalationJob {
  workflowId: string;
  orgId: string;
}

export function createEscalationWorker() {
  const connection = new IORedis(
    process.env.REDIS_URL || "redis://localhost:6379",
    { maxRetriesPerRequest: null },
  );

  const pubRedis = new IORedis(
    process.env.REDIS_URL || "redis://localhost:6379",
    { maxRetriesPerRequest: null },
  );

  const worker = new Worker<EscalationJob>(
    "escalation-check",
    async (job: Job<EscalationJob>) => {
      const { workflowId, orgId } = job.data;
      console.log(`Checking escalation for workflow ${workflowId}`);

      // 1. Check workflow status — if already resolved/cancelled, no-op
      const workflow = await db.query.workflows.findFirst({
        where: eq(schema.workflows.id, workflowId),
        with: { department: true },
      });

      if (!workflow) {
        console.warn(`Workflow ${workflowId} not found, skipping escalation`);
        return;
      }

      if (
        workflow.status === "resolved" ||
        workflow.status === "cancelled" ||
        workflow.status === "escalated"
      ) {
        console.log(
          `Workflow ${workflowId} already ${workflow.status}, skipping`,
        );
        return;
      }

      // 2. If still pending/claimed: escalate
      console.log(`Escalating workflow ${workflowId} (was ${workflow.status})`);

      const dept = workflow.department;
      const now = new Date();

      // 3. UPDATE workflow
      await db
        .update(schema.workflows)
        .set({
          status: "escalated",
          escalated: true,
          escalatedTo: dept?.escalationTo ?? null,
          escalatedAt: now,
        })
        .where(eq(schema.workflows.id, workflowId));

      // 4. INSERT workflow_events (sla_breach + escalated)
      await db.insert(schema.workflowEvents).values([
        {
          workflowId,
          eventType: "sla_breach",
          payload: {
            slaDeadline: workflow.slaDeadline?.toISOString(),
            breachedAt: now.toISOString(),
          },
        },
        {
          workflowId,
          eventType: "escalated",
          payload: {
            escalatedTo: dept?.escalationTo,
            reason: "SLA breach",
          },
        },
      ]);

      // 5. Publish escalation to org workflows channel
      const escalationPayload = JSON.stringify({
        type: "workflow.escalated",
        workflowId,
        departmentId: workflow.departmentId,
        department: dept?.name,
        priority: workflow.priority,
        escalatedTo: dept?.escalationTo,
        escalatedAt: now.toISOString(),
      });

      await pubRedis.publish(`org:${orgId}:workflows`, escalationPayload);
      if (workflow.departmentId) {
        await pubRedis.publish(
          `org:${orgId}:dept:${workflow.departmentId}`,
          escalationPayload,
        );
      }

      console.log(`Workflow ${workflowId} escalated due to SLA breach`);
    },
    { connection, concurrency: 5 },
  );

  worker.on("failed", (job, err) => {
    console.error(`Escalation job ${job?.id} failed:`, err);
  });

  return worker;
}
