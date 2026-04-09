import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { db, schema } from "@hospiq/db";
import { eq, and, or } from "drizzle-orm";
import {
  getAdapter,
  // Importing registry triggers adapter registration
} from "../../../api/src/integrations/registry";

interface IntegrationJob {
  workflowId: string;
  eventType: string;
  orgId: string;
}

export function createIntegrationWorker() {
  const connection = new IORedis(
    process.env.REDIS_URL || "redis://localhost:6379",
    { maxRetriesPerRequest: null },
  );

  const worker = new Worker<IntegrationJob>(
    "integration",
    async (job: Job<IntegrationJob>) => {
      const { workflowId, eventType, orgId } = job.data;
      console.log(
        `Integration job ${job.id}: workflow=${workflowId} event=${eventType} org=${orgId}`,
      );

      // 1. Query integrations matching org, active, and trigger
      const allIntegrations = await db.query.integrations.findMany({
        where: and(
          eq(schema.integrations.orgId, orgId),
          eq(schema.integrations.active, true),
        ),
      });

      // Filter by triggerOn matching eventType or "all"
      const matchingIntegrations = allIntegrations.filter(
        (i) => i.triggerOn === "all" || i.triggerOn === eventType,
      );

      if (matchingIntegrations.length === 0) {
        console.log(`No matching integrations for event ${eventType}`);
        return { dispatched: 0 };
      }

      // 2. Load full workflow with relations
      const workflow = await db.query.workflows.findFirst({
        where: eq(schema.workflows.id, workflowId),
        with: {
          request: true,
          department: true,
          assignee: true,
        },
      });

      if (!workflow) {
        console.error(`Workflow ${workflowId} not found`);
        throw new Error(`Workflow ${workflowId} not found`);
      }

      let successCount = 0;
      let failCount = 0;

      // 3. Process each matching integration
      for (const integration of matchingIntegrations) {
        const provider = integration.provider || integration.type;
        const adapter = getAdapter(provider);

        if (!adapter) {
          console.warn(
            `No adapter for provider "${provider}" (integration ${integration.id})`,
          );
          await db.insert(schema.integrationEvents).values({
            integrationId: integration.id,
            workflowId,
            status: "failed",
            error: `No adapter for provider: ${provider}`,
          });
          failCount++;
          continue;
        }

        // Load field mappings for this integration
        const mappings = await db.query.fieldMappings.findMany({
          where: eq(schema.fieldMappings.integrationId, integration.id),
        });

        // Build workflow data with config attached
        const workflowData = {
          ...workflow,
          _config: integration.config,
        };

        try {
          // Build payload
          const payload = adapter.buildPayload(workflowData, mappings);

          // Send
          const startTime = Date.now();
          const result = await adapter.send(
            payload,
            integration.config,
            integration.auth,
          );
          const latencyMs = Date.now() - startTime;

          const success = result.status >= 200 && result.status < 300;

          // Record result
          await db.insert(schema.integrationEvents).values({
            integrationId: integration.id,
            workflowId,
            status: success ? "success" : "failed",
            httpStatus: result.status,
            requestPayload: payload,
            responseBody: result.body,
            latencyMs,
          });

          if (success) {
            successCount++;
            console.log(
              `Integration ${integration.id} (${provider}): success (${result.status}) in ${latencyMs}ms`,
            );
          } else {
            failCount++;
            console.warn(
              `Integration ${integration.id} (${provider}): HTTP ${result.status} in ${latencyMs}ms`,
            );
          }
        } catch (err: any) {
          failCount++;
          console.error(
            `Integration ${integration.id} (${provider}): error - ${err.message}`,
          );

          await db.insert(schema.integrationEvents).values({
            integrationId: integration.id,
            workflowId,
            status: "failed",
            error: err.message,
          });
        }
      }

      console.log(
        `Integration dispatch complete: ${successCount} success, ${failCount} failed`,
      );

      // If all failed, throw to trigger BullMQ retry
      if (failCount > 0 && successCount === 0) {
        throw new Error(
          `All ${failCount} integrations failed for workflow ${workflowId}`,
        );
      }

      return { dispatched: matchingIntegrations.length, successCount, failCount };
    },
    {
      connection,
      concurrency: 5,
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  );

  worker.on("failed", (job, err) => {
    console.error(`Integration job ${job?.id} failed:`, err.message);
  });

  return worker;
}
