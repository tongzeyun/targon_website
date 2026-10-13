import { db } from "@/lib/db";
import { v4 as uuid } from "uuid";

const now = () => new Date().toISOString();

export interface AuthSessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  family_id: string;
  expires_at: Date;
  revoked_at: Date | null;
  rotated_at: Date | null;
  replaced_by_id: string | null;
  created_at: Date;
}

export interface CreateAuthSessionInput {
  id?: string;
  userId: string;
  tokenHash: string;
  expiresAt: string | Date;
  familyId?: string;
}

export const DEFAULT_MAX_ACTIVE_AUTH_SESSIONS = 10;
export const AUTH_SESSION_CLEANUP_BATCH_SIZE = 1_000;

function maxActiveSessions(): number {
  const value = Number(process.env.AUTH_MAX_ACTIVE_SESSIONS);
  return Number.isSafeInteger(value) && value > 0 && value <= 100
    ? value
    : DEFAULT_MAX_ACTIVE_AUTH_SESSIONS;
}

export async function createAuthSession(
  input: CreateAuthSessionInput
): Promise<{ id: string }> {
  const id = input.id || uuid();
  const createdAt = now();
  const familyId = input.familyId || id;

  await db.transaction(async () => {
    const user = await db.queryOne<{ id: string }>(
      "SELECT id FROM users WHERE id = $1 FOR UPDATE",
      [input.userId]
    );
    if (!user) throw new Error("Cannot create auth session for a missing user");

    await db.execute(
      `INSERT INTO auth_sessions (
        id, user_id, token_hash, family_id, expires_at,
        revoked_at, rotated_at, replaced_by_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        input.userId,
        input.tokenHash,
        familyId,
        input.expiresAt,
        null,
        null,
        null,
        createdAt,
      ]
    );

    await db.execute(
      `WITH overflow AS (
         SELECT id
         FROM auth_sessions
         WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > $2
         ORDER BY created_at DESC, id DESC
         OFFSET $3
       )
       UPDATE auth_sessions
       SET revoked_at = $2
       WHERE id IN (SELECT id FROM overflow)`,
      [input.userId, createdAt, maxActiveSessions()]
    );
  });

  return { id };
}

export async function findAuthSessionById(id: string): Promise<AuthSessionRow | null> {
  return db.queryOne<AuthSessionRow>(
    `SELECT id, user_id, token_hash, family_id, expires_at, revoked_at,
            rotated_at, replaced_by_id, created_at
     FROM auth_sessions
     WHERE id = $1`,
    [id]
  );
}

export interface RotateAuthSessionInput {
  currentSessionId: string;
  currentTokenHash: string;
  newSessionId: string;
  newTokenHash: string;
  now: Date;
  concurrencyGraceMs: number;
}

export type RotateAuthSessionResult =
  | { status: "rotated"; userId: string; expiresAt: Date }
  | { status: "concurrent" }
  | { status: "replayed" }
  | { status: "invalid" };

export async function rotateAuthSession(
  input: RotateAuthSessionInput
): Promise<RotateAuthSessionResult> {
  return db.transaction(async () => {
    const session = await db.queryOne<AuthSessionRow>(
      `SELECT id, user_id, token_hash, family_id, expires_at, revoked_at,
              rotated_at, replaced_by_id, created_at
       FROM auth_sessions
       WHERE id = $1
       FOR UPDATE`,
      [input.currentSessionId]
    );

    if (!session || session.token_hash !== input.currentTokenHash) {
      return { status: "invalid" };
    }

    const expiresAt = session.expires_at instanceof Date
      ? session.expires_at
      : new Date(String(session.expires_at));
    const revokedAt = session.revoked_at instanceof Date
      ? session.revoked_at
      : session.revoked_at
        ? new Date(String(session.revoked_at))
        : null;
    const rotatedAt = session.rotated_at instanceof Date
      ? session.rotated_at
      : session.rotated_at
        ? new Date(String(session.rotated_at))
        : null;
    if (!Number.isFinite(expiresAt.getTime())) return { status: "invalid" };

    if (revokedAt) {
      if (rotatedAt && Number.isFinite(rotatedAt.getTime())) {
        const elapsedMs = input.now.getTime() - rotatedAt.getTime();
        if (elapsedMs >= 0 && elapsedMs <= input.concurrencyGraceMs) {
          return { status: "concurrent" };
        }

        await db.execute(
          `UPDATE auth_sessions
           SET revoked_at = COALESCE(revoked_at, $1)
           WHERE family_id = $2 AND revoked_at IS NULL`,
          [input.now.toISOString(), session.family_id]
        );
        return { status: "replayed" };
      }
      return { status: "invalid" };
    }

    if (expiresAt.getTime() <= input.now.getTime()) {
      return { status: "invalid" };
    }

    const nowIso = input.now.toISOString();
    const updated = await db.execute(
      `UPDATE auth_sessions
       SET revoked_at = $1, rotated_at = $1, replaced_by_id = $2
       WHERE id = $3 AND revoked_at IS NULL`,
      [nowIso, input.newSessionId, input.currentSessionId]
    );
    if (updated.changes !== 1) return { status: "invalid" };

    await db.execute(
      `INSERT INTO auth_sessions (
        id, user_id, token_hash, family_id, expires_at,
        revoked_at, rotated_at, replaced_by_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        input.newSessionId,
        session.user_id,
        input.newTokenHash,
        session.family_id,
        expiresAt,
        null,
        null,
        null,
        nowIso,
      ]
    );

    return {
      status: "rotated",
      userId: session.user_id,
      expiresAt,
    };
  });
}

/** Returns true when the session record exists, including when it was already revoked. */
export async function revokeAuthSession(id: string): Promise<boolean> {
  const result = await db.execute(
    `UPDATE auth_sessions
     SET revoked_at = COALESCE(revoked_at, $1)
     WHERE id = $2`,
    [now(), id]
  );
  return result.changes === 1;
}

export async function cleanupAuthSessionsBatch(
  cutoff: Date,
  limit = AUTH_SESSION_CLEANUP_BATCH_SIZE
): Promise<number> {
  const safeLimit = Number.isSafeInteger(limit) && limit > 0
    ? Math.min(limit, AUTH_SESSION_CLEANUP_BATCH_SIZE)
    : AUTH_SESSION_CLEANUP_BATCH_SIZE;
  const result = await db.execute(
    `WITH cleanup_candidates AS (
       SELECT id
       FROM auth_sessions
       WHERE expires_at < $1
          OR (rotated_at IS NULL AND revoked_at IS NOT NULL AND revoked_at < $1)
       ORDER BY COALESCE(revoked_at, expires_at), id
       LIMIT $2
       FOR UPDATE SKIP LOCKED
     )
     DELETE FROM auth_sessions
     WHERE id IN (SELECT id FROM cleanup_candidates)`,
    [cutoff.toISOString(), safeLimit]
  );
  return result.changes;
}
