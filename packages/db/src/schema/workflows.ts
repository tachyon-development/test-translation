import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { requests } from "./requests";
import { departments } from "./departments";
import { users } from "./users";
import { urgencyEnum, workflowStatusEnum } from "./enums";

export const workflows = pgTable(
  "workflows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => requests.id),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    departmentId: uuid("department_id").references(() => departments.id),
    assignedTo: uuid("assigned_to").references(() => users.id),
    priority: urgencyEnum("priority").default("medium").notNull(),
    slaDeadline: timestamp("sla_deadline"),
    escalated: boolean("escalated").default(false).notNull(),
    escalatedTo: uuid("escalated_to").references(() => users.id),
    escalatedAt: timestamp("escalated_at"),
    resolvedAt: timestamp("resolved_at"),
    resolutionNote: text("resolution_note"),
    status: workflowStatusEnum("status").default("pending").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("workflows_org_dept_status_idx").on(
      table.orgId,
      table.departmentId,
      table.status,
    ),
    index("workflows_sla_deadline_idx").on(table.slaDeadline),
  ],
);

export const workflowsRelations = relations(workflows, ({ one }) => ({
  request: one(requests, {
    fields: [workflows.requestId],
    references: [requests.id],
  }),
  organization: one(organizations, {
    fields: [workflows.orgId],
    references: [organizations.id],
  }),
  department: one(departments, {
    fields: [workflows.departmentId],
    references: [departments.id],
  }),
  assignee: one(users, {
    fields: [workflows.assignedTo],
    references: [users.id],
    relationName: "workflowAssignee",
  }),
  escalatedToUser: one(users, {
    fields: [workflows.escalatedTo],
    references: [users.id],
    relationName: "workflowEscalatedTo",
  }),
}));
