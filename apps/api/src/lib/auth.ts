import { SignJWT, jwtVerify } from "jose";

export interface JWTPayload {
  sub: string; // user_id
  orgId: string;
  role: "guest" | "staff" | "manager" | "admin";
  departmentId?: string;
}

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "hospiq-dev-secret-change-in-production"
);

const expiry = process.env.JWT_EXPIRY || "1h";

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiry)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, secret);
  return {
    sub: payload.sub as string,
    orgId: payload.orgId as string,
    role: payload.role as JWTPayload["role"],
    departmentId: payload.departmentId as string | undefined,
  };
}
