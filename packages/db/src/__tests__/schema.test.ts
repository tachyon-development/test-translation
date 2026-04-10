import { describe, test, expect } from "bun:test";
import * as schema from "../schema";

describe("Schema Exports", () => {
  test("exports organizations table", () => {
    expect(schema.organizations).toBeDefined();
  });

  test("exports users table", () => {
    expect(schema.users).toBeDefined();
  });

  test("exports departments table", () => {
    expect(schema.departments).toBeDefined();
  });

  test("exports rooms table", () => {
    expect(schema.rooms).toBeDefined();
  });

  test("exports requests table", () => {
    expect(schema.requests).toBeDefined();
  });

  test("exports transcriptions table", () => {
    expect(schema.transcriptions).toBeDefined();
  });

  test("exports aiClassifications table", () => {
    expect(schema.aiClassifications).toBeDefined();
  });

  test("exports workflows table", () => {
    expect(schema.workflows).toBeDefined();
  });

  test("exports workflowEvents table", () => {
    expect(schema.workflowEvents).toBeDefined();
  });

  test("exports notifications table", () => {
    expect(schema.notifications).toBeDefined();
  });

  test("exports integrations table", () => {
    expect(schema.integrations).toBeDefined();
  });

  test("exports integrationEvents table", () => {
    expect(schema.integrationEvents).toBeDefined();
  });

  test("exports fieldMappings table", () => {
    expect(schema.fieldMappings).toBeDefined();
  });

  test("exports auditLog table", () => {
    expect(schema.auditLog).toBeDefined();
  });

  test("exports all 14 tables", () => {
    const tables = [
      schema.organizations,
      schema.users,
      schema.departments,
      schema.rooms,
      schema.requests,
      schema.transcriptions,
      schema.aiClassifications,
      schema.workflows,
      schema.workflowEvents,
      schema.notifications,
      schema.integrations,
      schema.integrationEvents,
      schema.fieldMappings,
      schema.auditLog,
    ];
    for (const table of tables) {
      expect(table).toBeDefined();
    }
    expect(tables).toHaveLength(14);
  });

  test("exports userRoleEnum", () => {
    expect(schema.userRoleEnum).toBeDefined();
  });

  test("exports requestStatusEnum", () => {
    expect(schema.requestStatusEnum).toBeDefined();
  });

  test("exports workflowStatusEnum", () => {
    expect(schema.workflowStatusEnum).toBeDefined();
  });

  test("exports workflowEventTypeEnum", () => {
    expect(schema.workflowEventTypeEnum).toBeDefined();
  });

  test("exports urgencyEnum", () => {
    expect(schema.urgencyEnum).toBeDefined();
  });

  test("exports notificationTypeEnum", () => {
    expect(schema.notificationTypeEnum).toBeDefined();
  });

  test("exports integrationTypeEnum", () => {
    expect(schema.integrationTypeEnum).toBeDefined();
  });

  test("exports integrationTriggerEnum", () => {
    expect(schema.integrationTriggerEnum).toBeDefined();
  });

  test("exports integrationEventStatusEnum", () => {
    expect(schema.integrationEventStatusEnum).toBeDefined();
  });

  test("exports organizationsRelations", () => {
    expect(schema.organizationsRelations).toBeDefined();
  });

  test("exports workflowsRelations", () => {
    expect(schema.workflowsRelations).toBeDefined();
  });

  test("exports requestsRelations", () => {
    expect(schema.requestsRelations).toBeDefined();
  });
});
