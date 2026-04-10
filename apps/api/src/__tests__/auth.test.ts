import { describe, test, expect } from "bun:test";
import { signToken, verifyToken } from "../lib/auth";

describe("JWT Auth", () => {
  test("signToken returns a valid JWT string", async () => {
    const token = await signToken({ sub: "user-1", orgId: "org-1", role: "staff" });
    expect(token).toBeString();
    expect(token.split(".")).toHaveLength(3);
  });

  test("verifyToken decodes a valid token", async () => {
    const token = await signToken({ sub: "user-1", orgId: "org-1", role: "admin" });
    const payload = await verifyToken(token);
    expect(payload.sub).toBe("user-1");
    expect(payload.orgId).toBe("org-1");
    expect(payload.role).toBe("admin");
  });

  test("verifyToken preserves optional departmentId", async () => {
    const token = await signToken({
      sub: "user-2",
      orgId: "org-1",
      role: "staff",
      departmentId: "dept-42",
    });
    const payload = await verifyToken(token);
    expect(payload.departmentId).toBe("dept-42");
  });

  test("verifyToken throws on invalid token", async () => {
    expect(verifyToken("invalid.token.here")).rejects.toThrow();
  });

  test("verifyToken throws on tampered token", async () => {
    const token = await signToken({ sub: "user-1", orgId: "org-1", role: "staff" });
    // Tamper with the payload section
    const parts = token.split(".");
    parts[1] = parts[1] + "tampered";
    expect(verifyToken(parts.join("."))).rejects.toThrow();
  });

  test("verifyToken throws on garbage JWT-shaped string", async () => {
    expect(verifyToken("eyJ.eyJ.abc")).rejects.toThrow();
  });

  test("roundtrip preserves all role types", async () => {
    for (const role of ["guest", "staff", "manager", "admin"] as const) {
      const token = await signToken({ sub: "u1", orgId: "o1", role });
      const payload = await verifyToken(token);
      expect(payload.role).toBe(role);
    }
  });
});
