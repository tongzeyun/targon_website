import type { AuthContext } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { buildPgPlaceholders } from "@/lib/db/sql-params";
import { serializeJson } from "@/lib/db/json";
import { camelize, camelizeAll } from "@/lib/db/transform";
import { v4 as uuid } from "uuid";
import { defaultJobMaxAttempts } from "@/lib/jobs/provider-quota-policy";

const now = () => new Date().toISOString();

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";

export type JobType =
  | "crawler_discover_companies"
  | "crawler_ingest"
  | "crawler_search_extract"
  | "batch_extract_url"
  | "deep_research"
  | "document_generate_quotation"
  | "document_generate_contract"
  | "document_generate_bid"
  | "document_generate_meeting"
  | "document_convert"
  | "document_speech_recognize"
  | "document_analyze_bid"
  | "ai_discover_accounts"
  | "ai_match_accounts"
  | "ai_enrich_account";

export interface CreateJobInput {
  organizationId: string;
  userId: string;
  type: JobType;
  payload: unknown;
  priority?: number;
  maxAttempts?: number;
}

export interface ListJobsFilters {
  status?: JobStatus;
  type?: JobType;
}

export interface JobRecord {
  id: string;
  organizationId: string;
  userId: string | null;
  type: JobType;
  status: JobStatus;
  priority: number;
  payloadJson: unknown | null;
  resultJson: unknown | null;
  errorMessage: string | null;
  progress: number;
  currentStep: string | null;
  providerTaskId: string | null;
  providerTaskResource: string | null;
  providerTaskStatus: string | null;
  attempts: number;
  maxAttempts: number;
  lockedAt: string | null;
  lockedBy: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecoverStaleJobsResult {
  requeued: number;
  failed: number;
}

type JobRow = Record<string, unknown>;

function toJobRecord(row: JobRow | null): JobRecord | null {
  return camelize<JobRecord>(row);
}

async function getJobById(id: string): Promise<JobRecord | null> {
  return toJobRecord(await db.queryOne("SELECT * FROM jobs WHERE id = $1", [id]));
}

export async function createJob(input: CreateJobInput): Promise<JobRecord> {
  const id = uuid();
  const timestamp = now();

  await db.execute(
    `INSERT INTO jobs (
      id, organization_id, user_id, type, status, priority, payload_json,
      progress, attempts, max_attempts, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      id,
      input.organizationId,
      input.userId,
      input.type,
      "queued",
      input.priority ?? 0,
      serializeJson(input.payload, {}),
      0,
      0,
      input.maxAttempts ?? defaultJobMaxAttempts(input.type),
      timestamp,
      timestamp,
    ]
  );

  const job = await getJobById(id);
  if (!job) throw new Error("Job was not created");
  return job;
}

export async function getJob(ctx: AuthContext, id: string): Promise<JobRecord | null> {
  return toJobRecord(
    await db.queryOne("SELECT * FROM jobs WHERE id = $1 AND organization_id = $2", [
      id,
      ctx.organizationId,
    ])
  );
}

export async function listJobs(ctx: AuthContext, filters: ListJobsFilters = {}): Promise<JobRecord[]> {
  const where = ["organization_id = $1"];
  const params: unknown[] = [ctx.organizationId];

  if (filters.status) {
    params.push(filters.status);
    where.push(`status = $${params.length}`);
  }

  if (filters.type) {
    params.push(filters.type);
    where.push(`type = $${params.length}`);
  }

  const rows = await db.query<JobRow>(
    `SELECT * FROM jobs
     WHERE ${where.join(" AND ")}
     ORDER BY created_at DESC
     LIMIT 50`,
    params
  );
  return camelizeAll<JobRecord>(rows);
}

export async function cancelJob(ctx: AuthContext, id: string): Promise<boolean> {
  const timestamp = now();
  const result = await db.execute(
    `UPDATE jobs
     SET status = $1, finished_at = $2, updated_at = $3
     WHERE id = $4 AND organization_id = $5 AND status IN ($6, $7)`,
    [
      "canceled",
      timestamp,
      timestamp,
      id,
      ctx.organizationId,
      "queued",
      "running",
    ]
  );
  return result.changes === 1;
}

export async function recoverStaleRunningJobs(
  staleAfterMs: number,
  nowDate = new Date()
): Promise<RecoverStaleJobsResult> {
  const staleMs = Math.max(1, Math.floor(staleAfterMs));
  const timestamp = nowDate.toISOString();
  const cutoff = new Date(nowDate.getTime() - staleMs).toISOString();

  return db.transaction(async () => {
    const requeued = await db.execute(
      `UPDATE jobs
       SET status = $1,
           error_message = COALESCE(error_message, $2),
           locked_at = NULL,
           locked_by = NULL,
           updated_at = $3
       WHERE status = $4
         AND locked_at IS NOT NULL
         AND locked_at < $5
         AND attempts < max_attempts`,
      [
        "queued",
        "Worker timed out before completing the job",
        timestamp,
        "running",
        cutoff,
      ]
    );

    const failed = await db.execute(
      `UPDATE jobs
       SET status = $1,
           error_message = COALESCE(error_message, $2),
           locked_at = NULL,
           locked_by = NULL,
           finished_at = $3,
           updated_at = $4
       WHERE status = $5
         AND locked_at IS NOT NULL
         AND locked_at < $6
         AND attempts >= max_attempts`,
      [
        "failed",
        "Worker timed out before completing the job",
        timestamp,
        timestamp,
        "running",
        cutoff,
      ]
    );

    return {
      requeued: requeued.changes,
      failed: failed.changes,
    };
  });
}

export async function claimNextJob(workerId: string, supportedTypes: JobType[]): Promise<JobRecord | null> {
  if (supportedTypes.length === 0) return null;

  const params: unknown[] = ["queued"];
  const typeStart = params.length + 1;
  params.push(...supportedTypes);
  const typeList = buildPgPlaceholders(supportedTypes.length, typeStart);
  const timestamp = now();
  params.push("running");
  const runningPh = `$${params.length}`;
  params.push(timestamp);
  const lockedAtPh = `$${params.length}`;
  params.push(workerId);
  const lockedByPh = `$${params.length}`;
  params.push(timestamp);
  const startedAtPh = `$${params.length}`;
  params.push(timestamp);
  const updatedAtPh = `$${params.length}`;

  const row = await db.queryOne<JobRow>(
    `WITH next_job AS (
       SELECT id
       FROM jobs
       WHERE status = $1 AND attempts < max_attempts AND type IN (${typeList})
       ORDER BY priority DESC, created_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     UPDATE jobs j
     SET status = ${runningPh},
         attempts = j.attempts + 1,
         locked_at = ${lockedAtPh},
         locked_by = ${lockedByPh},
         started_at = COALESCE(j.started_at, ${startedAtPh}),
         updated_at = ${updatedAtPh}
     FROM next_job
     WHERE j.id = next_job.id
     RETURNING j.*`,
    params
  );

  return toJobRecord(row);
}

export async function updateJobProgress(
  id: string,
  progress: number,
  currentStep?: string | null
): Promise<boolean> {
  const clampedProgress = Math.max(0, Math.min(100, Math.round(progress)));
  const timestamp = now();
  const result = await db.execute(
    `UPDATE jobs
     SET progress = $1, current_step = COALESCE($2, current_step), updated_at = $3
     WHERE id = $4 AND status = $5`,
    [
      clampedProgress,
      currentStep ?? null,
      timestamp,
      id,
      "running",
    ]
  );
  return result.changes === 1;
}

export async function saveJobProviderTask(
  id: string,
  input: { taskId: string; resource: string; status?: string }
): Promise<boolean> {
  const timestamp = now();
  const result = await db.execute(
    `UPDATE jobs
     SET provider_task_id = $1, provider_task_resource = $2,
         provider_task_status = $3, updated_at = $4
     WHERE id = $5 AND status = $6
       AND (provider_task_id IS NULL OR provider_task_id = $1)`,
    [input.taskId, input.resource, input.status ?? "created", timestamp, id, "running"]
  );
  return result.changes === 1;
}

export async function updateJobProviderTaskStatus(
  id: string,
  taskId: string,
  status: string
): Promise<boolean> {
  const result = await db.execute(
    `UPDATE jobs
     SET provider_task_status = $1, updated_at = $2
     WHERE id = $3 AND provider_task_id = $4 AND status = $5`,
    [status, now(), id, taskId, "running"]
  );
  return result.changes === 1;
}

export async function completeJob(id: string, result: unknown): Promise<boolean> {
  const timestamp = now();
  const updateResult = await db.execute(
    `UPDATE jobs
     SET status = $1,
         progress = $2,
         result_json = $3,
         finished_at = $4,
         locked_at = NULL,
         locked_by = NULL,
         updated_at = $5
     WHERE id = $6 AND status = $7`,
    [
      "succeeded",
      100,
      serializeJson(result, null),
      timestamp,
      timestamp,
      id,
      "running",
    ]
  );
  return updateResult.changes === 1;
}

export async function failJob(
  id: string,
  errorMessage: string,
  options: { retryable?: boolean } = {}
): Promise<boolean> {
  return db.transaction(async () => {
    const job = await db.queryOne<{ attempts: number; max_attempts: number }>(
      "SELECT attempts, max_attempts FROM jobs WHERE id = $1 AND status = $2",
      [id, "running"]
    );

    if (!job) return false;

    const timestamp = now();
    const shouldRetry = options.retryable !== false && job.attempts < job.max_attempts;
    const result = await db.execute(
      `UPDATE jobs
       SET status = $1,
           error_message = $2,
           locked_at = NULL,
           locked_by = NULL,
           finished_at = $3,
           updated_at = $4
       WHERE id = $5 AND status = $6`,
      [
        shouldRetry ? "queued" : "failed",
        errorMessage,
        shouldRetry ? null : timestamp,
        timestamp,
        id,
        "running",
      ]
    );

    return result.changes === 1;
  });
}
