import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  createAuthSession,
  findAuthSessionById,
  revokeAuthSession,
  rotateAuthSession,
} from "@/lib/repositories/auth-session-repository";
import { validate as validateUuid, v4 as uuid, version as uuidVersion } from "uuid";

export const REFRESH_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const REFRESH_SESSION_SECRET_BYTES = 32;
export const REFRESH_TOKEN_MAX_LENGTH = 512;
export const REFRESH_ROTATION_CONCURRENCY_GRACE_MS = 5_000;

const REFRESH_SECRET_LENGTH = 43;
const REFRESH_SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;

export interface RefreshSessionOptions {
  now?: Date;
}

export interface CreatedRefreshSession {
  refreshToken: string;
  expiresAt: Date;
}

export interface VerifiedRefreshSession {
  sessionId: string;
  userId: string;
  expiresAt: Date;
}

export type RotatedRefreshSession =
  | {
      status: "rotated";
      refreshToken: string;
      expiresAt: Date;
    }
  | { status: "concurrent" | "replayed" | "invalid" };

interface ParsedRefreshToken {
  sessionId: string;
  secret: string;
}

function hashSecret(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

function parseRefreshToken(refreshToken: unknown): ParsedRefreshToken | null {
  if (
    typeof refreshToken !== "string" ||
    refreshToken.length === 0 ||
    refreshToken.length > REFRESH_TOKEN_MAX_LENGTH
  ) {
    return null;
  }

  const separator = refreshToken.indexOf(".");
  if (
    separator <= 0 ||
    separator !== refreshToken.lastIndexOf(".") ||
    separator === refreshToken.length - 1
  ) {
    return null;
  }

  const sessionId = refreshToken.slice(0, separator);
  const secret = refreshToken.slice(separator + 1);
  if (
    !validateUuid(sessionId) ||
    uuidVersion(sessionId) !== 4 ||
    secret.length !== REFRESH_SECRET_LENGTH ||
    !REFRESH_SECRET_PATTERN.test(secret)
  ) {
    return null;
  }

  return { sessionId, secret };
}

function secretMatchesHash(secret: string, storedHash: unknown): boolean {
  if (typeof storedHash !== "string" || !SHA256_HEX_PATTERN.test(storedHash)) {
    return false;
  }

  const actualHash = hashSecret(secret);
  const expectedHash = Buffer.from(storedHash, "hex");
  if (actualHash.length !== expectedHash.length) {
    return false;
  }
  return timingSafeEqual(actualHash, expectedHash);
}

function createSessionMaterial(now: Date) {
  const sessionId = uuid();
  const secret = randomBytes(REFRESH_SESSION_SECRET_BYTES).toString("base64url");
  return {
    sessionId,
    secret,
    tokenHash: hashSecret(secret).toString("hex"),
    expiresAt: new Date(now.getTime() + REFRESH_SESSION_TTL_MS),
  };
}

export async function createRefreshSession(
  userId: string,
  options?: RefreshSessionOptions
): Promise<CreatedRefreshSession> {
  const now = options?.now ?? new Date();
  const material = createSessionMaterial(now);

  await createAuthSession({
    id: material.sessionId,
    userId,
    tokenHash: material.tokenHash,
    expiresAt: material.expiresAt,
  });

  return {
    refreshToken: `${material.sessionId}.${material.secret}`,
    expiresAt: material.expiresAt,
  };
}

export async function rotateRefreshSession(
  refreshToken: unknown,
  options?: RefreshSessionOptions
): Promise<RotatedRefreshSession> {
  const parsed = parseRefreshToken(refreshToken);
  if (!parsed) return { status: "invalid" };

  const now = options?.now ?? new Date();
  const material = createSessionMaterial(now);
  const result = await rotateAuthSession({
    currentSessionId: parsed.sessionId,
    currentTokenHash: hashSecret(parsed.secret).toString("hex"),
    newSessionId: material.sessionId,
    newTokenHash: material.tokenHash,
    now,
    concurrencyGraceMs: REFRESH_ROTATION_CONCURRENCY_GRACE_MS,
  });

  if (result.status !== "rotated") return result;
  return {
    status: "rotated",
    refreshToken: `${material.sessionId}.${material.secret}`,
    expiresAt: result.expiresAt,
  };
}

async function loadRefreshSession(
  refreshToken: unknown,
  options: RefreshSessionOptions | undefined,
  allowRevoked: boolean
): Promise<VerifiedRefreshSession | null> {
  const parsed = parseRefreshToken(refreshToken);
  if (!parsed) return null;

  const session = await findAuthSessionById(parsed.sessionId);
  if (
    !session ||
    (!allowRevoked && session.revoked_at !== null) ||
    !(session.expires_at instanceof Date) ||
    !Number.isFinite(session.expires_at.getTime()) ||
    typeof session.user_id !== "string" ||
    session.user_id.length === 0
  ) {
    return null;
  }

  const now = options?.now ?? new Date();
  if (session.expires_at.getTime() <= now.getTime()) {
    return null;
  }
  if (!secretMatchesHash(parsed.secret, session.token_hash)) {
    return null;
  }

  return {
    sessionId: parsed.sessionId,
    userId: session.user_id,
    expiresAt: session.expires_at,
  };
}

export async function verifyRefreshSession(
  refreshToken: unknown,
  options?: RefreshSessionOptions
): Promise<VerifiedRefreshSession | null> {
  return loadRefreshSession(refreshToken, options, false);
}

/**
 * Validates token ownership while deferring revoked/rotated state decisions to
 * the row-locked rotation transaction. This is only for the Refresh endpoint.
 */
export async function inspectRefreshSessionForRotation(
  refreshToken: unknown,
  options?: RefreshSessionOptions
): Promise<VerifiedRefreshSession | null> {
  return loadRefreshSession(refreshToken, options, true);
}

export async function revokeRefreshSession(
  refreshToken: unknown,
  options?: RefreshSessionOptions
): Promise<boolean> {
  const session = await verifyRefreshSession(refreshToken, options);
  if (!session) return false;
  return revokeAuthSession(session.sessionId);
}
