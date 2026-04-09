import { Worker, Queue, type Job } from "bullmq";
import IORedis from "ioredis";
import { eq } from "drizzle-orm";
import { db, schema } from "@hospiq/db";
import type { SlaConfig } from "@hospiq/db/src/schema/departments";
import { buildClassifyPrompt } from "../prompts/classify";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://ollama:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3";

interface ClassificationJob {
  requestId: string;
  text: string;
  orgId: string;
}

interface ClassifyResult {
  translated: string;
  department: string;
  urgency: "low" | "medium" | "high" | "critical";
  summary: string;
}

export function createClassificationWorker() {
  const connection = new IORedis(
    process.env.REDIS_URL || "redis://localhost:6379",
    { maxRetriesPerRequest: null },
  );

  const pubRedis = new IORedis(
    process.env.REDIS_URL || "redis://localhost:6379",
    { maxRetriesPerRequest: null },
  );

  const escalationQueue = new Queue("escalation-check", { connection });

  const worker = new Worker<ClassificationJob>(
    "classification",
    async (job: Job<ClassificationJob>) => {
      const { requestId, text, orgId } = job.data;
      console.log(`Classifying request ${requestId}`);

      // 1. Update request status to "processing"
      await db
        .update(schema.requests)
        .set({ status: "processing" })
        .where(eq(schema.requests.id, requestId));

      // 2. Publish processing status
      await pubRedis.publish(
        `request:${requestId}:status`,
        JSON.stringify({ type: "processing", step: "classifying" }),
      );

      // 3. Get departments for the org
      const departments = await db.query.departments.findMany({
        where: eq(schema.departments.orgId, orgId),
      });

      const deptNames = departments.map((d) => d.name);

      // 4. Call Ollama
      const prompt = buildClassifyPrompt(text, deptNames);
      const ollamaRes = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt,
          stream: false,
        }),
      });

      if (!ollamaRes.ok) {
        throw new Error(
          `Ollama request failed: ${ollamaRes.status} ${await ollamaRes.text()}`,
        );
      }

      const ollamaData = (await ollamaRes.json()) as { response: string };

      // 5. Parse JSON response
      const jsonMatch = ollamaData.response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error(
          `Failed to parse Ollama response as JSON: ${ollamaData.response}`,
        );
      }

      const result: ClassifyResult = JSON.parse(jsonMatch[0]);

      // 6. Find matching department
      const matchedDept = departments.find(
        (d) => d.name.toLowerCase() === result.department.toLowerCase(),
      );

      if (!matchedDept) {
        console.warn(
          `Department "${result.department}" not found, using first department`,
        );
      }

      const dept = matchedDept ?? departments[0];

      // 7. INSERT ai_classification record
      await db.insert(schema.aiClassifications).values({
        requestId,
        model: OLLAMA_MODEL,
        aiCategory: result.department,
        matchedDepartmentId: dept.id,
        urgency: result.urgency,
        summary: result.summary,
        confidence: 0.85, // Ollama doesn't provide confidence; use default
        rawResponse: ollamaData,
      });

      // 8. UPDATE request status to "classified", set translated text
      await db
        .update(schema.requests)
        .set({
          status: "classified",
          translated: result.translated,
          originalLang: result.translated !== text ? "detected" : "en",
        })
        .where(eq(schema.requests.id, requestId));

      // 9. Publish classification result
      await pubRedis.publish(
        `request:${requestId}:status`,
        JSON.stringify({
          type: "classified",
          department: dept.name,
          urgency: result.urgency,
          summary: result.summary,
        }),
      );

      // 10. CREATE workflow with SLA deadline
      const slaConfig = (dept.slaConfig ?? {
        low: 120,
        medium: 60,
        high: 30,
        critical: 15,
      }) as SlaConfig;

      const slaMinutes = slaConfig[result.urgency] ?? 60;
      const slaDeadline = new Date(Date.now() + slaMinutes * 60 * 1000);

      const [workflow] = await db
        .insert(schema.workflows)
        .values({
          requestId,
          orgId,
          departmentId: dept.id,
          priority: result.urgency,
          slaDeadline,
          status: "pending",
        })
        .returning({ id: schema.workflows.id });

      // 11. INSERT workflow_event (created)
      await db.insert(schema.workflowEvents).values({
        workflowId: workflow.id,
        eventType: "created",
        payload: {
          department: dept.name,
          priority: result.urgency,
          summary: result.summary,
        },
      });

      // 12. Publish to org and department channels
      const workflowPayload = JSON.stringify({
        type: "workflow.created",
        workflowId: workflow.id,
        requestId,
        department: dept.name,
        departmentId: dept.id,
        priority: result.urgency,
        summary: result.summary,
        slaDeadline: slaDeadline.toISOString(),
      });

      await pubRedis.publish(`org:${orgId}:workflows`, workflowPayload);
      await pubRedis.publish(
        `org:${orgId}:dept:${dept.id}`,
        workflowPayload,
      );

      // 13. Publish routed status to request channel
      await pubRedis.publish(
        `request:${requestId}:status`,
        JSON.stringify({
          type: "routed",
          department: dept.name,
          priority: result.urgency,
          slaDeadline: slaDeadline.toISOString(),
        }),
      );

      // 14. Schedule delayed escalation job
      await escalationQueue.add(
        "check-escalation",
        { workflowId: workflow.id, orgId },
        { delay: slaMinutes * 60 * 1000 },
      );

      console.log(
        `Request ${requestId} classified → ${dept.name} (${result.urgency}), workflow ${workflow.id}`,
      );
    },
    { connection, concurrency: 3 },
  );

  worker.on("failed", (job, err) => {
    console.error(`Classification job ${job?.id} failed:`, err);
  });

  return worker;
}
