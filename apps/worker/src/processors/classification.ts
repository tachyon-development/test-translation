import { Worker, Queue, type Job } from "bullmq";
import IORedis from "ioredis";
import { eq } from "drizzle-orm";
import { db, schema } from "@hospiq/db";

type SlaConfig = {
  low: number;
  medium: number;
  high: number;
  critical: number;
};
import { buildClassifyPrompt } from "../prompts/classify";
import { matchDepartment } from "../lib/matchDepartment";
import {
  CircuitBreaker,
  CircuitOpenError,
} from "../../../api/src/lib/circuitBreaker";

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
// Fallback to Ollama if no Groq key
const OLLAMA_URL = process.env.OLLAMA_URL || "http://ollama:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3";
const USE_GROQ = !!GROQ_API_KEY;

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

  const ollamaBreaker = new CircuitBreaker({
    name: "ollama",
    threshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || "3"),
    resetTimeMs: parseInt(process.env.CIRCUIT_BREAKER_RESET_MS || "30000"),
    redis: connection,
  });

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

      // 4. Call AI for classification (Groq or Ollama fallback)
      const prompt = buildClassifyPrompt(text, deptNames);

      let aiResponseText: string;
      try {
        if (USE_GROQ) {
          // Groq — fast cloud inference via OpenAI-compatible API
          const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${GROQ_API_KEY}`,
            },
            body: JSON.stringify({
              model: GROQ_MODEL,
              messages: [{ role: "user", content: prompt }],
              temperature: 0.1,
              max_tokens: 256,
            }),
          });

          if (!groqRes.ok) {
            throw new Error(`Groq request failed: ${groqRes.status} ${await groqRes.text()}`);
          }

          const groqData = await groqRes.json() as { choices: { message: { content: string } }[] };
          aiResponseText = groqData.choices[0]?.message?.content || "";
          console.log(`Groq classified in ~${groqRes.headers.get("x-groq-latency") || "?"}ms`);
        } else {
          // Ollama fallback (wrapped in circuit breaker)
          const ollamaData = await ollamaBreaker.execute(async () => {
            const ollamaRes = await fetch(`${OLLAMA_URL}/api/generate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
            });
            if (!ollamaRes.ok) {
              throw new Error(`Ollama request failed: ${ollamaRes.status} ${await ollamaRes.text()}`);
            }
            return (await ollamaRes.json()) as { response: string };
          });
          aiResponseText = ollamaData.response;
        }
      } catch (error) {
        if (error instanceof CircuitOpenError) {
          console.warn(
            `Circuit breaker OPEN for Ollama — falling back to manual review for request ${requestId}`,
          );

          // Fallback: mark as manual_review
          await db
            .update(schema.requests)
            .set({ status: "manual_review" })
            .where(eq(schema.requests.id, requestId));

          // Create workflow without AI classification
          const [workflow] = await db
            .insert(schema.workflows)
            .values({
              requestId,
              orgId,
              departmentId: null as unknown as string, // no department — needs manual assignment
              priority: "medium",
              status: "pending",
            })
            .returning({ id: schema.workflows.id });

          await db.insert(schema.workflowEvents).values({
            workflowId: workflow.id,
            eventType: "created",
            payload: {
              reason:
                "AI service unavailable — manual classification required",
            },
          });

          // Publish for staff dashboard
          await pubRedis.publish(
            `org:${orgId}:workflows`,
            JSON.stringify({
              type: "workflow_created",
              workflow: { ...workflow, manualReview: true },
            }),
          );

          await pubRedis.publish(
            `request:${requestId}:status`,
            JSON.stringify({
              type: "manual_review",
              message:
                "AI classification unavailable. Staff will review your request shortly.",
            }),
          );

          return;
        }
        throw error; // Re-throw for BullMQ retry
      }

      // 5. Parse JSON response
      const jsonMatch = aiResponseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error(
          `Failed to parse AI response as JSON: ${aiResponseText}`,
        );
      }

      const result: ClassifyResult = JSON.parse(jsonMatch[0]);

      // 6. Find matching department (exact match, then slug match, then fuzzy)
      const matchedDept = matchDepartment(result.department, departments);

      if (!matchedDept) {
        console.warn(
          `Department "${result.department}" not found in [${departments.map(d => d.name).join(", ")}], using first`,
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
        rawResponse: { response: aiResponseText },
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
        .returning();

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

      // 12. Publish to org and department channels (include full workflow for real-time UI)
      const workflowPayload = JSON.stringify({
        type: "workflow.created",
        workflow: {
          ...workflow,
          department: dept,
          request: {
            id: requestId,
            originalText: text,
            translated: result.translated,
            originalLang: "detected",
          },
          aiClassification: {
            summary: result.summary,
            confidence: 0.85,
            urgency: result.urgency,
            aiCategory: result.department,
          },
        },
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
          summary: result.summary,
          translated: result.translated,
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
