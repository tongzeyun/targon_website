import type { AuthContext } from "@/lib/api/auth";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { serializeJson } from "@/lib/db/json";
import { camelize, camelizeAll } from "@/lib/db/transform";
import { getFileStorageAdapter, getFileStorageDescriptor } from "@/lib/storage/file-storage";
import { v4 as uuid } from "uuid";

const now = () => new Date().toISOString();

export type GeneratedDocumentStatus = "available" | "failed";

export interface CreateGeneratedDocumentInput {
  organizationId: string;
  userId?: string | null;
  jobId?: string | null;
  templateId?: string | null;
  aiRunId?: string | null;
  documentType: string;
  sourceType: string;
  title: string;
  fileName: string;
  fileMimeType: string;
  fileBuffer: Buffer;
  status?: GeneratedDocumentStatus;
  errorMessage?: string | null;
  metadata?: unknown;
}

export interface ListGeneratedDocumentsFilters {
  documentType?: string;
}

export interface GeneratedDocumentRecord {
  id: string;
  organizationId: string;
  userId: string | null;
  jobId: string | null;
  templateId: string | null;
  aiRunId: string | null;
  documentType: string;
  sourceType: string;
  title: string;
  fileName: string;
  fileMimeType: string;
  fileSize: number;
  status: GeneratedDocumentStatus;
  errorMessage: string | null;
  metadataJson: unknown | null;
  storageDriver: string | null;
  storageKey: string | null;
  storageBucket: string | null;
  storageMetadataJson: unknown | null;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedDocumentDownload extends GeneratedDocumentRecord {
  fileBuffer: Buffer;
}

const LIST_COLUMNS = [
  "id",
  "organization_id",
  "user_id",
  "job_id",
  "template_id",
  "ai_run_id",
  "document_type",
  "source_type",
  "title",
  "file_name",
  "file_mime_type",
  "file_size",
  "status",
  "error_message",
  "metadata_json",
  "storage_driver",
  "storage_key",
  "storage_bucket",
  "storage_metadata_json",
  "created_at",
  "updated_at",
].join(", ");

function computeSha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function safeStorageFileName(fileName: string): string {
  const cleaned = fileName.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_").trim();
  return cleaned || "document.bin";
}

function buildStorageKey(organizationId: string, id: string, fileName: string): string {
  return `generated-documents/${organizationId}/${id}/${safeStorageFileName(fileName)}`;
}

export async function createGeneratedDocument(input: CreateGeneratedDocumentInput): Promise<GeneratedDocumentRecord> {
  const id = uuid();
  const timestamp = now();
  const storageKey = buildStorageKey(input.organizationId, id, input.fileName);
  const sha256 = computeSha256(input.fileBuffer);
  const storageMetadata = {
    contentType: input.fileMimeType,
    sha256,
    fileName: input.fileName,
    originalSize: String(input.fileBuffer.length),
  };
  const fileStorage = getFileStorageAdapter();
  const storageDescriptor = getFileStorageDescriptor();
  let storageWritten = false;

  try {
    await fileStorage.put({
      key: storageKey,
      buffer: input.fileBuffer,
      contentType: input.fileMimeType,
      metadata: storageMetadata,
    });
    storageWritten = true;

    await db.execute(
      `INSERT INTO generated_documents (
        id, organization_id, user_id, job_id, template_id, ai_run_id,
        document_type, source_type, title, file_name, file_mime_type, file_size,
        file_data, status, error_message, metadata_json,
        storage_driver, storage_key, storage_bucket, storage_metadata_json,
        created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
      [
        id,
        input.organizationId,
        input.userId || null,
        input.jobId || null,
        input.templateId || null,
        input.aiRunId || null,
        input.documentType,
        input.sourceType,
        input.title,
        input.fileName,
        input.fileMimeType,
        input.fileBuffer.length,
        "",
        input.status || "available",
        input.errorMessage || null,
        serializeJson(input.metadata || {}, {}),
        storageDescriptor.driver,
        storageKey,
        storageDescriptor.bucket,
        serializeJson(storageMetadata, {}),
        timestamp,
        timestamp,
      ]
    );

    const record = await getGeneratedDocumentSummary(
      { userId: input.userId || "", organizationId: input.organizationId, role: "system" },
      id
    );
    if (!record) throw new Error("Generated document was not created");
    return record;
  } catch (error) {
    if (storageWritten) {
      try {
        await fileStorage.delete(storageKey);
      } catch (cleanupError) {
        console.error(
          "[generated-documents] failed to rollback storage object:",
          cleanupError instanceof Error ? cleanupError.message : cleanupError
        );
      }
    }
    throw error;
  }
}

export async function listGeneratedDocuments(
  ctx: AuthContext,
  filters: ListGeneratedDocumentsFilters = {}
): Promise<GeneratedDocumentRecord[]> {
  const where = ["organization_id = $1"];
  const params: unknown[] = [ctx.organizationId];

  if (filters.documentType) {
    params.push(filters.documentType);
    where.push(`document_type = $${params.length}`);
  }

  const rows = await db.query(
    `SELECT ${LIST_COLUMNS}
     FROM generated_documents
     WHERE ${where.join(" AND ")}
     ORDER BY created_at DESC
     LIMIT 50`,
    params
  );

  return camelizeAll<GeneratedDocumentRecord>(rows);
}

export async function getGeneratedDocumentSummary(
  ctx: AuthContext,
  id: string
): Promise<GeneratedDocumentRecord | null> {
  return camelize<GeneratedDocumentRecord>(
    await db.queryOne(
      `SELECT ${LIST_COLUMNS} FROM generated_documents WHERE id = $1 AND organization_id = $2`,
      [id, ctx.organizationId]
    )
  );
}

export async function getGeneratedDocumentDownload(
  ctx: AuthContext,
  id: string
): Promise<GeneratedDocumentDownload | null> {
  const row = await db.queryOne<Record<string, unknown>>(
    "SELECT * FROM generated_documents WHERE id = $1 AND organization_id = $2 AND status = $3",
    [id, ctx.organizationId, "available"]
  );
  if (!row) return null;

  const record = camelize<GeneratedDocumentRecord>(row);
  if (!record) return null;

  const storageKey = typeof row.storage_key === "string" ? row.storage_key : "";
  if (!storageKey) return null;

  const fileStorage = getFileStorageAdapter();
  const fileBuffer = await fileStorage.get(storageKey);
  if (!fileBuffer) return null;

  return {
    ...record,
    fileBuffer,
  };
}
