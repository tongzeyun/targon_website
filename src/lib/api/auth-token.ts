/**
 * Lightweight JWT helpers for Proxy and auth routes.
 * Depends only on jose + JWT_SECRET — no password libs, DB, or repositories.
 */

import { SignJWT, jwtVerify } from "jose";
import { ACCESS_TOKEN_TTL_SECONDS } from "@/lib/api/auth-config";

function getJwtSecret(): Uint8Array {
  const raw = process.env.JWT_SECRET;
  if (raw) return new TextEncoder().encode(raw);
  throw new Error(
    "JWT_SECRET 环境变量必须设置 (当前 NODE_ENV=" + process.env.NODE_ENV + ")"
  );
}

export interface AuthUser {
  userId: string;
  email: string;
  fullName: string;
  organizationId: string;
  role: string;
}

export async function signToken(user: AuthUser): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TOKEN_TTL_SECONDS)
    .sign(getJwtSecret());
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as AuthUser;
  } catch {
    return null;
  }
}
