import { describe, test, expect } from "bun:test";
import { applyMappings, type FieldMapping } from "../integrations/fieldMapper";

describe("Field Mapper", () => {
  test("none transform passes through", () => {
    const result = applyMappings(
      { workflow: { id: "abc" } },
      [{ sourceField: "workflow.id", targetField: "ref_id", transform: "none" }],
    );
    expect(result.ref_id).toBe("abc");
  });

  test("empty transform string passes through", () => {
    const result = applyMappings(
      { name: "test" },
      [{ sourceField: "name", targetField: "out", transform: "" }],
    );
    expect(result.out).toBe("test");
  });

  test("uppercase transform", () => {
    const result = applyMappings(
      { name: "maintenance" },
      [{ sourceField: "name", targetField: "dept", transform: "uppercase" }],
    );
    expect(result.dept).toBe("MAINTENANCE");
  });

  test("uppercase on non-string passes through", () => {
    const result = applyMappings(
      { count: 42 },
      [{ sourceField: "count", targetField: "out", transform: "uppercase" }],
    );
    expect(result.out).toBe(42);
  });

  test("lowercase transform", () => {
    const result = applyMappings(
      { name: "KITCHEN" },
      [{ sourceField: "name", targetField: "dept", transform: "lowercase" }],
    );
    expect(result.dept).toBe("kitchen");
  });

  test("truncate:N transform", () => {
    const result = applyMappings(
      { text: "This is a very long description that should be truncated" },
      [{ sourceField: "text", targetField: "short", transform: "truncate:20" }],
    );
    expect(result.short).toHaveLength(20);
    expect(result.short).toBe("This is a very long ");
  });

  test("truncate on non-string passes through", () => {
    const result = applyMappings(
      { num: 12345 },
      [{ sourceField: "num", targetField: "out", transform: "truncate:3" }],
    );
    expect(result.out).toBe(12345);
  });

  test("prefix transform", () => {
    const result = applyMappings(
      { room: "412" },
      [{ sourceField: "room", targetField: "location", transform: 'prefix:"Room "' }],
    );
    expect(result.location).toBe("Room 412");
  });

  test("suffix transform", () => {
    const result = applyMappings(
      { name: "John" },
      [{ sourceField: "name", targetField: "greeting", transform: 'suffix:" (Guest)"' }],
    );
    expect(result.greeting).toBe("John (Guest)");
  });

  test("map transform", () => {
    const result = applyMappings(
      { priority: "critical" },
      [{ sourceField: "priority", targetField: "level", transform: "map:{critical:1,high:2,medium:3,low:4}" }],
    );
    expect(result.level).toBe("1");
  });

  test("map transform with unmatched key passes through", () => {
    const result = applyMappings(
      { priority: "unknown" },
      [{ sourceField: "priority", targetField: "level", transform: "map:{critical:1,high:2}" }],
    );
    expect(result.level).toBe("unknown");
  });

  test("iso8601 transform on Date", () => {
    const date = new Date("2025-06-15T12:00:00Z");
    const result = applyMappings(
      { created: date },
      [{ sourceField: "created", targetField: "ts", transform: "iso8601" }],
    );
    expect(result.ts).toBe("2025-06-15T12:00:00.000Z");
  });

  test("iso8601 transform on string date", () => {
    const result = applyMappings(
      { created: "2025-06-15" },
      [{ sourceField: "created", targetField: "ts", transform: "iso8601" }],
    );
    expect(result.ts).toContain("2025-06-15");
  });

  test("iso639_to_name transform", () => {
    const result = applyMappings(
      { lang: "es" },
      [{ sourceField: "lang", targetField: "language", transform: "iso639_to_name" }],
    );
    expect(result.language).toBe("Spanish");
  });

  test("iso639_to_name with unknown code passes through", () => {
    const result = applyMappings(
      { lang: "xx" },
      [{ sourceField: "lang", targetField: "language", transform: "iso639_to_name" }],
    );
    expect(result.language).toBe("xx");
  });

  test("dot notation resolves nested fields", () => {
    const result = applyMappings(
      { workflow: { department: { name: "Kitchen" } } },
      [{ sourceField: "workflow.department.name", targetField: "dept", transform: "none" }],
    );
    expect(result.dept).toBe("Kitchen");
  });

  test("deeply nested dot notation", () => {
    const result = applyMappings(
      { a: { b: { c: { d: "deep" } } } },
      [{ sourceField: "a.b.c.d", targetField: "val", transform: "none" }],
    );
    expect(result.val).toBe("deep");
  });

  test("missing source field returns undefined", () => {
    const result = applyMappings(
      { foo: "bar" },
      [{ sourceField: "missing.field", targetField: "out", transform: "none" }],
    );
    expect(result.out).toBeUndefined();
  });

  test("multiple mappings applied together", () => {
    const result = applyMappings(
      { name: "maintenance", room: "301", priority: "high" },
      [
        { sourceField: "name", targetField: "department", transform: "uppercase" },
        { sourceField: "room", targetField: "location", transform: 'prefix:"Room "' },
        { sourceField: "priority", targetField: "level", transform: "map:{high:2,low:4}" },
      ],
    );
    expect(result.department).toBe("MAINTENANCE");
    expect(result.location).toBe("Room 301");
    expect(result.level).toBe("2");
  });

  test("unknown transform passes through", () => {
    const result = applyMappings(
      { val: "hello" },
      [{ sourceField: "val", targetField: "out", transform: "some_unknown_transform" }],
    );
    expect(result.out).toBe("hello");
  });

  test("empty mappings array returns empty object", () => {
    const result = applyMappings({ foo: "bar" }, []);
    expect(result).toEqual({});
  });
});
