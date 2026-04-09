import { describe, test, expect } from "bun:test";
import { matchDepartment, type Department } from "../lib/matchDepartment";

const departments: Department[] = [
  { id: "1", name: "Maintenance", slug: "maintenance" },
  { id: "2", name: "Housekeeping", slug: "housekeeping" },
  { id: "3", name: "Kitchen / Room Service", slug: "kitchen" },
  { id: "4", name: "Concierge", slug: "concierge" },
  { id: "5", name: "Front Desk", slug: "front-desk" },
];

describe("Department Matching", () => {
  test("matches exact name", () => {
    const result = matchDepartment("Maintenance", departments);
    expect(result?.id).toBe("1");
  });

  test("matches case-insensitive name", () => {
    const result = matchDepartment("maintenance", departments);
    expect(result?.id).toBe("1");
  });

  test("matches UPPERCASE name", () => {
    const result = matchDepartment("HOUSEKEEPING", departments);
    expect(result?.id).toBe("2");
  });

  test("matches by slug", () => {
    const result = matchDepartment("kitchen", departments);
    expect(result?.id).toBe("3");
  });

  test("matches slug with mixed case", () => {
    const result = matchDepartment("Front-Desk", departments);
    expect(result?.id).toBe("5");
  });

  test("matches when AI response contains slug (partial)", () => {
    // deptLower.includes(d.slug) — "the kitchen department" includes "kitchen"
    const result = matchDepartment("the kitchen department", departments);
    expect(result?.id).toBe("3");
  });

  test("matches partial name — 'Kitchen' matches 'Kitchen / Room Service'", () => {
    const result = matchDepartment("Kitchen", departments);
    expect(result?.id).toBe("3");
  });

  test("matches 'Room Service' to 'Kitchen / Room Service'", () => {
    // d.name.toLowerCase().includes(deptLower) — "kitchen / room service".includes("room service")
    const result = matchDepartment("Room Service", departments);
    expect(result?.id).toBe("3");
  });

  test("matches first word of department name", () => {
    // deptLower.includes(d.name.split(" ")[0]) — "front office".includes("front")
    const result = matchDepartment("front office", departments);
    expect(result?.id).toBe("5");
  });

  test("returns undefined when no match and empty array", () => {
    const result = matchDepartment("Nonexistent", []);
    expect(result).toBeUndefined();
  });

  test("returns undefined when no match found", () => {
    const result = matchDepartment("Spa & Wellness", departments);
    expect(result).toBeUndefined();
  });

  test("trims whitespace from input", () => {
    const result = matchDepartment("  Maintenance  ", departments);
    expect(result?.id).toBe("1");
  });

  test("prefers exact name match over slug match", () => {
    const depts: Department[] = [
      { id: "a", name: "kitchen", slug: "food" },
      { id: "b", name: "Food Services", slug: "kitchen" },
    ];
    const result = matchDepartment("kitchen", depts);
    // Should match name "kitchen" first (id "a"), not slug "kitchen" (id "b")
    expect(result?.id).toBe("a");
  });

  test("handles single department", () => {
    const result = matchDepartment("Maintenance", [departments[0]]);
    expect(result?.id).toBe("1");
  });
});
