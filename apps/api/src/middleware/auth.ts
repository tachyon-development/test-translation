import { Elysia } from "elysia";
import { verifyToken, type JWTPayload } from "../lib/auth";

export const authMiddleware = new Elysia({ name: "auth-middleware" }).derive(
  async ({ headers }): Promise<{ user: JWTPayload | null }> => {
    const authorization = headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
      return { user: null };
    }

    try {
      const token = authorization.slice(7);
      const user = await verifyToken(token);
      return { user };
    } catch {
      return { user: null };
    }
  }
);

export const requireAuth = new Elysia({ name: "require-auth" })
  .use(authMiddleware)
  .onBeforeHandle({ as: "local" }, ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
  });

export function requireRole(...roles: JWTPayload["role"][]) {
  return new Elysia({ name: `require-role-${roles.join("-")}` })
    .use(requireAuth)
    .onBeforeHandle({ as: "local" }, ({ user, set }) => {
      if (!roles.includes(user!.role)) {
        set.status = 403;
        return { error: "Forbidden" };
      }
    });
}
