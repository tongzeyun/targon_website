import { db } from "@/lib/db";
import { serializeJson } from "@/lib/db/json";
import { camelize, camelizeAll } from "@/lib/db/transform";
import { v4 as uuid } from "uuid";

const now = () => new Date().toISOString();

export interface CreateSignalInput {
  id?: string;
  signalType: string;
  sourceUrl?: string;
  sourceName?: string;
  title?: string;
  publishDate?: string;
  rawContent?: string;
  extractedData?: unknown;
  relevanceScore?: number;
  isProcessed?: boolean;
  processedAt?: string;
  aiRunId?: string;
}

export interface SignalInferenceRow {
  id: string;
  signal_type?: string | null;
  title?: string | null;
  source_name?: string | null;
  publish_date?: string | null;
  extracted_data?: string | null;
}

/** 新代码统一用此函数，organizationId 由服务端显式传入 */
export async function createSignalForOrg(organizationId: string, data: CreateSignalInput) {
  const id = data.id || uuid();
  const timestamp = now();
  await db.execute(
    `INSERT INTO project_signals (id, organization_id, signal_type, source_url, source_name, title, publish_date, raw_content, extracted_data, relevance_score, is_processed, processed_at, created_at, ai_run_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      id,
      organizationId,
      data.signalType,
      data.sourceUrl || "",
      data.sourceName || "",
      data.title || "未知",
      data.publishDate || timestamp,
      data.rawContent || "",
      serializeJson(data.extractedData, {}),
      data.relevanceScore ?? 50,
      data.isProcessed ? true : false,
      data.processedAt || timestamp,
      timestamp,
      data.aiRunId || null,
    ]
  );
  return camelize(await db.queryOne(
    "SELECT * FROM project_signals WHERE id = $1 AND organization_id = $2",
    [id, organizationId]
  ));
}

/** @deprecated use createSignalForOrg instead */
export async function createSignal(data: Record<string, unknown>) {
  const id = (data.id as string) || uuid();
  await db.execute(
    `INSERT INTO project_signals (id, project_id, organization_id, signal_type, source_url, source_name, title, publish_date, raw_content, extracted_data, relevance_score, is_processed, processing_notes, processed_at, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [
      id,
      data.projectId,
      data.organizationId,
      data.signalType,
      data.sourceUrl,
      data.sourceName,
      data.title,
      data.publishDate,
      data.rawContent,
      serializeJson(data.extractedData, {}),
      data.relevanceScore,
      data.isProcessed ? true : false,
      data.processingNotes,
      data.processedAt,
      now(),
    ]
  );
  return camelize(await db.queryOne(
    "SELECT * FROM project_signals WHERE id = $1 AND organization_id = $2",
    [id, data.organizationId]
  ));
}

export async function getUnprocessedSignals(organizationId: string) {
  return camelizeAll(await db.query("SELECT * FROM project_signals WHERE organization_id = $1 AND is_processed = FALSE", [organizationId]));
}

export async function listSignalSourceUrls(organizationId: string): Promise<string[]> {
  const rows = await db.query<{ source_url: string }>(
    "SELECT source_url FROM project_signals WHERE organization_id = $1",
    [organizationId]
  );
  return rows.map((row) => row.source_url || "");
}

export async function listProcessedSignals(organizationId: string) {
  return camelizeAll(await db.query(
    "SELECT * FROM project_signals WHERE organization_id = $1 AND is_processed = TRUE",
    [organizationId]
  ));
}

export async function listSignalsForInference(organizationId: string): Promise<SignalInferenceRow[]> {
  return db.query<SignalInferenceRow>(
    "SELECT id, signal_type, title, source_name, publish_date, extracted_data FROM project_signals WHERE organization_id = $1",
    [organizationId]
  );
}

export async function listProcessedSignalsForInference(organizationId: string): Promise<SignalInferenceRow[]> {
  return db.query<SignalInferenceRow>(
    "SELECT id, signal_type, title, source_name, publish_date, extracted_data FROM project_signals WHERE organization_id = $1 AND is_processed = TRUE",
    [organizationId]
  );
}
