import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { db, schema } from "@hospiq/db";
import { signToken } from "../lib/auth";

export const authRoutes = new Elysia({ prefix: "/api/auth" }).post(
  "/login",
  async ({ body, set }) => {
    const { email, password } = body;

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (!user || !user.passwordHash) {
      set.status = 401;
      return { error: "Invalid credentials" };
    }

    const valid = await Bun.password.verify(password, user.passwordHash);
    if (!valid) {
      set.status = 401;
      return { error: "Invalid credentials" };
    }

    const token = await signToken({
      sub: user.id,
      orgId: user.orgId,
      role: user.role,
      departmentId: user.departmentId ?? undefined,
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        email: user.email,
      },
    };
  },
  {
    body: t.Object({
      email: t.String({ format: "email" }),
      password: t.String({ minLength: 1 }),
    }),
  }
);
