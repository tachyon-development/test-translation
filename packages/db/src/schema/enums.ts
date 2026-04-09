import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "guest",
  "staff",
  "manager",
  "admin",
]);

export const requestStatusEnum = pgEnum("request_status", [
  "queued",
  "processing",
  "classified",
  "manual_review",
  "completed",
  "failed",
]);

export const workflowStatusEnum = pgEnum("workflow_status", [
  "pending",
  "claimed",
  "in_progress",
  "escalated",
  "resolved",
  "cancelled",
]);

export const workflowEventTypeEnum = pgEnum("workflow_event_type", [
  "created",
  "claimed",
  "status_change",
  "escalated",
  "resolved",
  "comment",
  "sla_breach",
  "reassigned",
]);

export const urgencyEnum = pgEnum("urgency", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "assignment",
  "escalation",
  "resolution",
  "sla_warning",
]);

export const integrationTypeEnum = pgEnum("integration_type", [
  "webhook",
  "pms",
  "ticketing",
  "messaging",
  "custom_rest",
]);

export const integrationTriggerEnum = pgEnum("integration_trigger", [
  "workflow.created",
  "workflow.claimed",
  "workflow.escalated",
  "workflow.resolved",
  "request.created",
  "sla.breached",
  "all",
]);

export const integrationEventStatusEnum = pgEnum("integration_event_status", [
  "success",
  "failed",
  "pending",
]);
