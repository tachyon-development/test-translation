import { describe, test, expect } from "bun:test";
import {
  ORG_ID,
  DEPT_IDS,
  USER_IDS,
  ROOM_IDS,
  FLOOR_DATA,
  requestId,
  workflowId,
  INTEGRATION_IDS,
} from "../seed-data/ids";

describe("Seed IDs", () => {
  test("org ID is a valid UUID-like string", () => {
    expect(ORG_ID).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  test("has 5 department IDs", () => {
    expect(Object.keys(DEPT_IDS)).toHaveLength(5);
  });

  test("department IDs cover expected keys", () => {
    expect(DEPT_IDS.maintenance).toBeDefined();
    expect(DEPT_IDS.housekeeping).toBeDefined();
    expect(DEPT_IDS.concierge).toBeDefined();
    expect(DEPT_IDS.frontDesk).toBeDefined();
    expect(DEPT_IDS.kitchen).toBeDefined();
  });

  test("has 12 user IDs", () => {
    expect(Object.keys(USER_IDS)).toHaveLength(12);
  });

  test("all IDs are unique", () => {
    const allIds = [
      ORG_ID,
      ...Object.values(DEPT_IDS),
      ...Object.values(USER_IDS),
      ...Object.values(ROOM_IDS),
      ...Object.values(INTEGRATION_IDS),
    ];
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  test("ROOM_IDS covers all rooms from FLOOR_DATA", () => {
    let totalRooms = 0;
    for (const f of FLOOR_DATA) {
      totalRooms += f.rooms.length;
      for (const roomNum of f.rooms) {
        expect(ROOM_IDS[roomNum]).toBeDefined();
      }
    }
    expect(Object.keys(ROOM_IDS)).toHaveLength(totalRooms);
  });

  test("requestId generates deterministic UUIDs", () => {
    expect(requestId(1)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
    expect(requestId(1)).toBe(requestId(1)); // same input = same output
    expect(requestId(1)).not.toBe(requestId(2));
  });

  test("workflowId generates deterministic UUIDs", () => {
    expect(workflowId(1)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
    expect(workflowId(1)).toBe(workflowId(1));
    expect(workflowId(1)).not.toBe(workflowId(2));
  });

  test("has 3 integration IDs", () => {
    expect(Object.keys(INTEGRATION_IDS)).toHaveLength(3);
    expect(INTEGRATION_IDS.opera).toBeDefined();
    expect(INTEGRATION_IDS.slack).toBeDefined();
    expect(INTEGRATION_IDS.jira).toBeDefined();
  });

  test("FLOOR_DATA has expected structure", () => {
    expect(FLOOR_DATA.length).toBeGreaterThan(0);
    for (const f of FLOOR_DATA) {
      expect(f.floor).toBeNumber();
      expect(f.zone).toBeString();
      expect(f.rooms.length).toBeGreaterThan(0);
    }
  });
});
