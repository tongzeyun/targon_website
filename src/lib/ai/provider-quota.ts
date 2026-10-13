import { db } from "@/lib/db";
import { v4 as uuid } from "uuid";

export type ProviderQuotaResource =
  | "deepseek"
  | "iflytek_document"
  | "iflytek_speech";

export interface ProviderQuotaConfig {
  dailySuccessfulLimit: number;
  maxConcurrent: number;
  leaseSeconds: number;
}

export interface AcquireProviderQuotaInput {
  userId: string;
  resource: ProviderQuotaResource;
  operation: string;
  jobId?: string | null;
  aiRunId?: string | null;
  idempotencyKey?: string | null;
}

export interface ProviderQuotaLease {
  id: string;
  userId: string;
  resource: ProviderQuotaResource;
  expiresAt: string;
  alreadySucceeded?: boolean;
}

export interface ProviderDailyQuotaStatus {
  resource: ProviderQuotaResource;
  dailyLimit: number;
  successfulCount: number;
  activeCount: number;
  available: boolean;
  retryAfterSeconds: number;
  resetsAt: string;
}

type QuotaStatsRow = {
  successful_count: string | number;
  active_count: string | number;
  earliest_expiry: Date | string | null;
};

type ExistingLeaseRow = {
  id: string;
  status: string;
  expires_at: Date | string;
};

const CHINA_STANDARD_TIME_OFFSET_MS = 8 * 60 * 60 * 1000;

function chinaDayBounds(now: Date): { dayStart: Date; nextDayStart: Date } {
  const chinaTime = new Date(now.getTime() + CHINA_STANDARD_TIME_OFFSET_MS);
  const dayStartUtc =
    Date.UTC(
      chinaTime.getUTCFullYear(),
      chinaTime.getUTCMonth(),
      chinaTime.getUTCDate()
    ) - CHINA_STANDARD_TIME_OFFSET_MS;
  return {
    dayStart: new Date(dayStartUtc),
    nextDayStart: new Date(dayStartUtc + 24 * 60 * 60 * 1000),
  };
}

const DEFAULT_CONFIG: Record<ProviderQuotaResource, ProviderQuotaConfig> = {
  deepseek: {
    dailySuccessfulLimit: 50,
    maxConcurrent: 2,
    leaseSeconds: 10 * 60,
  },
  iflytek_document: {
    dailySuccessfulLimit: 20,
    maxConcurrent: 2,
    leaseSeconds: 30 * 60,
  },
  iflytek_speech: {
    dailySuccessfulLimit: 20,
    maxConcurrent: 2,
    leaseSeconds: 30 * 60,
  },
};

const ENV_PREFIX: Record<ProviderQuotaResource, string> = {
  deepseek: "DEEPSEEK_QUOTA",
  iflytek_document: "IFLYTEK_DOCUMENT_QUOTA",
  iflytek_speech: "IFLYTEK_SPEECH_QUOTA",
};

function positiveIntFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function providerMinimumLeaseSeconds(resource: ProviderQuotaResource): number {
  if (resource === "deepseek") return 10 * 60;
  const timeoutEnv = resource === "iflytek_speech"
    ? "IFLYTEK_SPEECH_TIMEOUT_MS"
    : "IFLYTEK_DOCUMENT_TIMEOUT_MS";
  const timeoutMs = positiveIntFromEnv(timeoutEnv, 10 * 60 * 1000);
  return Math.ceil(timeoutMs / 1000) + 5 * 60;
}

export function getProviderQuotaConfig(resource: ProviderQuotaResource): ProviderQuotaConfig {
  const defaults = DEFAULT_CONFIG[resource];
  const prefix = ENV_PREFIX[resource];
  return {
    dailySuccessfulLimit: positiveIntFromEnv(
      `${prefix}_DAILY_SUCCESS_LIMIT`,
      defaults.dailySuccessfulLimit
    ),
    maxConcurrent: positiveIntFromEnv(`${prefix}_MAX_CONCURRENT`, defaults.maxConcurrent),
    leaseSeconds: Math.max(
      positiveIntFromEnv(`${prefix}_LEASE_SECONDS`, defaults.leaseSeconds),
      providerMinimumLeaseSeconds(resource)
    ),
  };
}

export class ProviderQuotaExceededError extends Error {
  readonly retryAfterSeconds: number;
  readonly reason: "quota" | "concurrency";

  constructor(
    message: string,
    options: { retryAfterSeconds: number; reason: "quota" | "concurrency" }
  ) {
    super(message);
    this.name = "ProviderQuotaExceededError";
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.reason = options.reason;
  }
}

function retryAfterSeconds(value: Date | string | null, fallback: number, now: Date): number {
  if (!value) return Math.max(1, fallback);
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(time)) return Math.max(1, fallback);
  return Math.max(1, Math.ceil((time - now.getTime()) / 1000));
}

async function lockQuotaUser(userId: string): Promise<void> {
  const user = await db.queryOne<{ id: string }>(
    "SELECT id FROM users WHERE id = $1 FOR UPDATE",
    [userId]
  );
  if (!user) throw new Error(`Provider quota user does not exist: ${userId}`);
}

async function expireStaleLeases(
  userId: string,
  resource: ProviderQuotaResource,
  nowIso: string
): Promise<void> {
  await db.execute(
    `UPDATE provider_quota_leases
     SET status = $1, finished_at = $2, error_message = COALESCE(error_message, $3)
     WHERE user_id = $4 AND resource = $5 AND status = $6 AND expires_at <= $7`,
    [
      "expired",
      nowIso,
      "Provider quota lease expired before completion",
      userId,
      resource,
      "active",
      nowIso,
    ]
  );
}

async function loadQuotaStats(
  userId: string,
  resource: ProviderQuotaResource,
  dayStart: Date,
  nextDayStart: Date
): Promise<QuotaStatsRow | null> {
  return db.queryOne<QuotaStatsRow>(
    `SELECT
       COUNT(*) FILTER (WHERE status = $3) AS successful_count,
       COUNT(*) FILTER (WHERE status = $6) AS active_count,
       MIN(expires_at) FILTER (WHERE status = $6) AS earliest_expiry
     FROM provider_quota_leases
     WHERE user_id = $1
       AND resource = $2
       AND (
         (status = $3 AND finished_at >= $4 AND finished_at < $5)
         OR status = $6
       )`,
    [
      userId,
      resource,
      "succeeded",
      dayStart.toISOString(),
      nextDayStart.toISOString(),
      "active",
    ]
  );
}

export async function getProviderDailyQuotaStatus(input: {
  userId: string;
  resource: ProviderQuotaResource;
}): Promise<ProviderDailyQuotaStatus> {
  if (!input.userId.trim()) {
    throw new Error("Provider quota requires an authenticated userId");
  }

  const config = getProviderQuotaConfig(input.resource);
  const now = new Date();
  const nowIso = now.toISOString();
  const { dayStart, nextDayStart } = chinaDayBounds(now);

  return db.transaction(async () => {
    await lockQuotaUser(input.userId);
    await expireStaleLeases(input.userId, input.resource, nowIso);
    const stats = await loadQuotaStats(
      input.userId,
      input.resource,
      dayStart,
      nextDayStart
    );
    const successfulCount = Number(stats?.successful_count ?? 0);
    const activeCount = Number(stats?.active_count ?? 0);
    const available = successfulCount + activeCount < config.dailySuccessfulLimit;
    const retryAt = successfulCount >= config.dailySuccessfulLimit
      ? nextDayStart
      : stats?.earliest_expiry ?? nextDayStart;

    return {
      resource: input.resource,
      dailyLimit: config.dailySuccessfulLimit,
      successfulCount,
      activeCount,
      available,
      retryAfterSeconds: available ? 0 : retryAfterSeconds(retryAt, 24 * 60 * 60, now),
      resetsAt: nextDayStart.toISOString(),
    };
  });
}

export async function acquireProviderQuotaLease(
  input: AcquireProviderQuotaInput
): Promise<ProviderQuotaLease> {
  if (!input.userId.trim()) {
    throw new Error("Provider quota requires an authenticated userId");
  }

  const config = getProviderQuotaConfig(input.resource);
  const now = new Date();
  const nowIso = now.toISOString();
  const { dayStart, nextDayStart } = chinaDayBounds(now);
  const expiresAt = new Date(now.getTime() + config.leaseSeconds * 1000).toISOString();

  return db.transaction(async () => {
    await lockQuotaUser(input.userId);
    await expireStaleLeases(input.userId, input.resource, nowIso);

    const idempotencyKey = input.idempotencyKey?.trim() || null;
    const existingLease = idempotencyKey
      ? await db.queryOne<ExistingLeaseRow>(
          `SELECT id, status, expires_at
           FROM provider_quota_leases
           WHERE user_id = $1 AND resource = $2 AND idempotency_key = $3`,
          [input.userId, input.resource, idempotencyKey]
        )
      : null;

    if (existingLease?.status === "succeeded") {
      return {
        id: existingLease.id,
        userId: input.userId,
        resource: input.resource,
        expiresAt: new Date(existingLease.expires_at).toISOString(),
        alreadySucceeded: true,
      };
    }
    if (existingLease?.status === "active") {
      throw new ProviderQuotaExceededError("同一供应商任务正在执行，请稍后重试", {
        reason: "concurrency",
        retryAfterSeconds: retryAfterSeconds(existingLease.expires_at, 5, now),
      });
    }

    const stats = await loadQuotaStats(
      input.userId,
      input.resource,
      dayStart,
      nextDayStart
    );

    const successfulCount = Number(stats?.successful_count ?? 0);
    const activeCount = Number(stats?.active_count ?? 0);

    if (activeCount >= config.maxConcurrent) {
      throw new ProviderQuotaExceededError("当前供应商调用并发已满，请稍后重试", {
        reason: "concurrency",
        retryAfterSeconds: retryAfterSeconds(stats?.earliest_expiry ?? null, 5, now),
      });
    }

    if (successfulCount + activeCount >= config.dailySuccessfulLimit) {
      const dailyQuotaExhausted = successfulCount >= config.dailySuccessfulLimit;
      const retryAt = dailyQuotaExhausted
        ? nextDayStart
        : stats?.earliest_expiry ?? null;
      throw new ProviderQuotaExceededError(dailyQuotaExhausted
        ? "今日供应商调用额度已用尽，请明日再试"
        : "今日供应商调用额度已被进行中的请求预占，请稍后重试", {
        reason: "quota",
        retryAfterSeconds: retryAfterSeconds(retryAt, 24 * 60 * 60, now),
      });
    }

    const id = existingLease?.id ?? uuid();
    if (existingLease) {
      await db.execute(
        `UPDATE provider_quota_leases
         SET operation = $1, job_id = $2, ai_run_id = $3, status = $4,
             acquired_at = $5, expires_at = $6, finished_at = NULL,
             error_message = NULL
         WHERE id = $7 AND status IN ($8, $9)`,
        [
          input.operation,
          input.jobId ?? null,
          input.aiRunId ?? null,
          "active",
          nowIso,
          expiresAt,
          id,
          "failed",
          "expired",
        ]
      );
    } else {
      await db.execute(
        `INSERT INTO provider_quota_leases (
           id, user_id, resource, operation, job_id, ai_run_id, idempotency_key,
           status, acquired_at, expires_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          id,
          input.userId,
          input.resource,
          input.operation,
          input.jobId ?? null,
          input.aiRunId ?? null,
          idempotencyKey,
          "active",
          nowIso,
          expiresAt,
        ]
      );
    }

    return { id, userId: input.userId, resource: input.resource, expiresAt };
  });
}

export async function succeedProviderQuotaLease(id: string): Promise<void> {
  const finishedAt = new Date().toISOString();
  const active = await db.execute(
    `UPDATE provider_quota_leases
     SET status = $1, finished_at = $2, error_message = NULL
     WHERE id = $3 AND status = $4`,
    ["succeeded", finishedAt, id, "active"]
  );
  if (active.changes === 1) return;

  const expired = await db.execute(
    `UPDATE provider_quota_leases
     SET status = $1, finished_at = $2, error_message = NULL
     WHERE id = $3 AND status = $4`,
    ["succeeded", finishedAt, id, "expired"]
  );
  if (expired.changes === 1) {
    console.warn(`[provider-quota] late success for expired lease ${id}`);
  }
}

export async function failProviderQuotaLease(id: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await db.execute(
    `UPDATE provider_quota_leases
     SET status = $1, finished_at = $2, error_message = $3
     WHERE id = $4 AND status IN ($5, $6)`,
    ["failed", new Date().toISOString(), message, id, "active", "expired"]
  );
}

export async function withProviderQuota<T>(
  input: AcquireProviderQuotaInput,
  operation: () => Promise<T>
): Promise<T> {
  const lease = await acquireProviderQuotaLease(input);
  let result: T;
  try {
    result = await operation();
  } catch (error) {
    try {
      if (!lease.alreadySucceeded) await failProviderQuotaLease(lease.id, error);
    } catch (finalizeError) {
      console.error(`Failed to release provider quota lease ${lease.id}`, finalizeError);
    }
    throw error;
  }

  // Do not turn a successful paid provider call into a failed quota row when
  // finalization itself fails. Leaving the active lease is conservative: it
  // continues reserving capacity until expiry and makes the DB error visible.
  if (!lease.alreadySucceeded) await succeedProviderQuotaLease(lease.id);
  return result;
}

export async function cleanupProviderQuotaLeases(retentionDays = 30): Promise<number> {
  const days = Number.isSafeInteger(retentionDays) && retentionDays > 0 ? retentionDays : 30;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const result = await db.execute(
    `DELETE FROM provider_quota_leases
     WHERE (status IN ($1, $2, $3) AND finished_at < $4)
        OR (status = $5 AND expires_at < $4)`,
    ["succeeded", "failed", "expired", cutoff, "active"]
  );
  return result.changes;
}
