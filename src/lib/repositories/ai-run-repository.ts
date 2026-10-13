import { db } from "@/lib/db";
import { serializeJson } from "@/lib/db/json";
import { v4 as uuid } from "uuid";

const now = () => new Date().toISOString();

export type AiRunStatus = "running" | "succeeded" | "failed";
export type AiValidationStatus = "not_validated" | "valid" | "invalid" | "parse_error" | "error";

export interface CreateAiRunInput {
  organizationId: string;
  userId?: string | null;
  taskType: string;
  promptVersion: string;
  schemaName?: string | null;
  model?: string | null;
  provider?: string | null;
  input: unknown;
}

export interface CompleteAiRunInput {
  rawOutput: string;
  parsedOutput: unknown;
  validationStatus: AiValidationStatus;
  validationErrors?: string[] | null;
  latencyMs: number;
  tokenUsage?: unknown;
  costEstimate?: number | null;
}

export interface FailAiRunInput {
  rawOutput?: string | null;
  parsedOutput?: unknown;
  validationStatus: AiValidationStatus;
  validationErrors?: string[] | null;
  latencyMs: number;
  tokenUsage?: unknown;
  errorMessage: string;
}

export async function createAiRun(input: CreateAiRunInput): Promise<string> {
  const id = uuid();
  const timestamp = now();
  await db.execute(
    `INSERT INTO ai_runs (
      id, organization_id, user_id, task_type, prompt_version, schema_name, model, provider,
      input_json, validation_status, status, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      id,
      input.organizationId,
      input.userId || null,
      input.taskType,
      input.promptVersion,
      input.schemaName || null,
      input.model || null,
      input.provider || null,
      serializeJson(input.input, {}),
      "not_validated",
      "running",
      timestamp,
      timestamp,
    ]
  );
  return id;
}

export async function completeAiRun(id: string, input: CompleteAiRunInput): Promise<void> {
  await db.execute(
    `UPDATE ai_runs
     SET raw_output = $1, parsed_output = $2, validation_status = $3, validation_errors = $4,
         latency_ms = $5, token_usage = $6, cost_estimate = $7, status = $8, updated_at = $9
     WHERE id = $10`,
    [
      input.rawOutput,
      serializeJson(input.parsedOutput, null),
      input.validationStatus,
      serializeJson(input.validationErrors || [], []),
      input.latencyMs,
      serializeJson(input.tokenUsage || null, null),
      input.costEstimate ?? null,
      input.validationStatus === "valid" ? "succeeded" : "failed",
      now(),
      id,
    ]
  );
}

export async function failAiRun(id: string, input: FailAiRunInput): Promise<void> {
  await db.execute(
    `UPDATE ai_runs
     SET raw_output = $1, parsed_output = $2, validation_status = $3, validation_errors = $4,
         latency_ms = $5, token_usage = $6, status = $7, error_message = $8, updated_at = $9
     WHERE id = $10`,
    [
      input.rawOutput || null,
      input.parsedOutput === undefined ? null : serializeJson(input.parsedOutput, null),
      input.validationStatus,
      serializeJson(input.validationErrors || [], []),
      input.latencyMs,
      serializeJson(input.tokenUsage || null, null),
      "failed",
      input.errorMessage,
      now(),
      id,
    ]
  );
}
