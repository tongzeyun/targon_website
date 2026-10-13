import { createHash } from "crypto";
import type { AuthContext } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { serializeJson } from "@/lib/db/json";
import { camelize } from "@/lib/db/transform";
import { getFileStorageAdapter, getFileStorageDescriptor } from "@/lib/storage/file-storage";
import { v4 as uuid } from "uuid";

/** Default upload cap for stored input files (50 MB). */
export const DEFAULT_MAX_STORED_FILE_BYTES = 50 * 1024 * 1024;

/** Default retention for uploaded input files (7 days). Output files in generated_documents are not affected. */
export const DEFAULT_STORED_FILE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class StoredFileTooLargeError extends Error {
  constructor(
    public readonly maxBytes: number,
    public readonly actualBytes: number
  ) {
    super(`File exceeds maximum size of ${maxBytes} bytes (received ${actualBytes} bytes)`);
    this.name = "StoredFileTooLargeError";
  }
}

export interface CreateStoredFileInput {
  purpose: string;
  originalName: string;
  mimeType: string;
  fileBuffer: Buffer;
  metadata?: unknown;
  storagePrefix?: string;
  /** Omit for default TTL; null to retain without auto-expiry; ISO string or Date for explicit expiry. */
  expiresAt?: string | Date | null;
  maxBytes?: number;
}

export interface CreateStoredFileOptions {
  /** Test hook — defaults to current time. */
  now?: Date;
}

export interface StoredFileRecord {
  id: string;
  organizationId: string;
  userId: string | null;
  purpose: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  sha256: string | null;
  metadataJson: unknown | null;
  storageDriver: string | null;
  storageKey: string | null;
  storageBucket: string | null;
  storageMetadataJson: unknown | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface StoredFileWithBuffer extends StoredFileRecord {
  fileBuffer: Buffer;
}

const METADATA_COLUMNS = [
  "id",
  "organization_id",
  "user_id",
  "purpose",
  "original_name",
  "mime_type",
  "file_size",
  "sha256",
  "metadata_json",
  "storage_driver",
  "storage_key",
  "storage_bucket",
  "storage_metadata_json",
  "expires_at",
  "created_at",
].join(", ");

function computeSha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function assertFileSize(buffer: Buffer, maxBytes: number): void {
  if (buffer.length > maxBytes) {
    throw new StoredFileTooLargeError(maxBytes, buffer.length);
  }
}

function resolveExpiresAt(
  expiresAt: string | Date | null | undefined,
  nowDate: Date
): string | null {
  if (expiresAt === null) return null;
  if (expiresAt !== undefined) {
    return expiresAt instanceof Date ? expiresAt.toISOString() : expiresAt;
  }
  return new Date(nowDate.getTime() + DEFAULT_STORED_FILE_TTL_MS).toISOString();
}

function normalizeStoragePrefix(prefix: string | undefined): string {
  const trimmed = prefix?.trim().replace(/^\/+|\/+$/g, "") || "";
  if (!trimmed) return "";
  if (trimmed.includes("\\") || trimmed.includes("..")) {
    throw new Error("storagePrefix must be a relative object key prefix");
  }
  return trimmed;
}

function buildStorageKey(organizationId: string, id: string, prefix?: string): string {
  const normalizedPrefix = normalizeStoragePrefix(prefix);
  const baseKey = `${organizationId}/${id}`;
  return normalizedPrefix ? `${normalizedPrefix}/${baseKey}` : baseKey;
}

export async function createStoredFile(
  ctx: AuthContext,
  input: CreateStoredFileInput,
  options?: CreateStoredFileOptions
): Promise<StoredFileRecord> {
  const maxBytes = input.maxBytes ?? DEFAULT_MAX_STORED_FILE_BYTES;
  assertFileSize(input.fileBuffer, maxBytes);

  const nowDate = options?.now ?? new Date();
  const id = uuid();
  const timestamp = nowDate.toISOString();
  const sha256 = computeSha256(input.fileBuffer);
  const expiresAt = resolveExpiresAt(input.expiresAt, nowDate);
  const storageKey = buildStorageKey(ctx.organizationId, id, input.storagePrefix);
  const storageMetadata = {
    contentType: input.mimeType,
    sha256,
    originalName: input.originalName,
  };

  const fileStorage = getFileStorageAdapter();
  const storageDescriptor = getFileStorageDescriptor();
  let storageWritten = false;

  try {
    await fileStorage.put({
      key: storageKey,
      buffer: input.fileBuffer,
      contentType: input.mimeType,
      metadata: {
        sha256,
        originalName: input.originalName,
      },
    });
    storageWritten = true;

    await db.execute(
      `INSERT INTO stored_files (
        id, organization_id, user_id, purpose, original_name, mime_type,
        file_size, file_data, sha256, metadata_json,
        storage_driver, storage_key, storage_bucket, storage_metadata_json,
        expires_at, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        id,
        ctx.organizationId,
        ctx.userId || null,
        input.purpose,
        input.originalName,
        input.mimeType,
        input.fileBuffer.length,
        "",
        sha256,
        serializeJson(input.metadata ?? {}, {}),
        storageDescriptor.driver,
        storageKey,
        storageDescriptor.bucket,
        serializeJson(storageMetadata, {}),
        expiresAt,
        timestamp,
      ]
    );

    const record = await getStoredFileMetadata(ctx, id);
    if (!record) throw new Error("Stored file was not created");
    return record;
  } catch (error) {
    if (storageWritten) {
      try {
        await fileStorage.delete(storageKey);
      } catch (cleanupError) {
        console.error(
          "[stored-files] failed to rollback storage object:",
          cleanupError instanceof Error ? cleanupError.message : cleanupError
        );
      }
    }
    throw error;
  }
}

export async function getStoredFileMetadata(
  ctx: AuthContext,
  id: string
): Promise<StoredFileRecord | null> {
  return camelize<StoredFileRecord>(
    await db.queryOne(
      `SELECT ${METADATA_COLUMNS} FROM stored_files WHERE id = $1 AND organization_id = $2`,
      [id, ctx.organizationId]
    )
  );
}

export async function getStoredFile(
  ctx: AuthContext,
  id: string
): Promise<StoredFileWithBuffer | null> {
  const row = await db.queryOne<Record<string, unknown>>(
    `SELECT ${METADATA_COLUMNS} FROM stored_files WHERE id = $1 AND organization_id = $2`,
    [id, ctx.organizationId]
  );
  if (!row) return null;

  const record = camelize<StoredFileRecord>(row);
  if (!record) return null;

  const storageKey = typeof row.storage_key === "string" ? row.storage_key : "";
  if (!storageKey) return null;

  const fileStorage = getFileStorageAdapter();
  const fileBuffer = await fileStorage.get(storageKey);
  if (!fileBuffer) return null;

  return {
    ...record,
    fileBuffer,
  } as StoredFileWithBuffer;
}

export async function deleteStoredFile(ctx: AuthContext, id: string): Promise<boolean> {
  const row = await db.queryOne<{ storage_key: string | null }>(
    "SELECT storage_key FROM stored_files WHERE id = $1 AND organization_id = $2",
    [id, ctx.organizationId]
  );
  if (!row) return false;

  if (row.storage_key) {
    try {
      const fileStorage = getFileStorageAdapter();
      await fileStorage.delete(row.storage_key);
    } catch (error) {
      console.error(
        `[stored-files] failed to delete storage object for ${id}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  const result = await db.execute(
    "DELETE FROM stored_files WHERE id = $1 AND organization_id = $2",
    [id, ctx.organizationId]
  );
  return result.changes === 1;
}

/** System-wide cleanup of expired input files. Does not touch generated_documents. */
export async function cleanupExpiredStoredFiles(nowDate = new Date()): Promise<number> {
  const cutoff = nowDate.toISOString();
  const expiredRows = await db.query<{ id: string; storage_key: string | null }>(
    `SELECT id, storage_key FROM stored_files
     WHERE expires_at IS NOT NULL AND expires_at < $1`,
    [cutoff]
  );

  if (expiredRows.length > 0) {
    const fileStorage = getFileStorageAdapter();
    for (const row of expiredRows) {
      if (!row.storage_key) continue;
      try {
        await fileStorage.delete(row.storage_key);
      } catch (error) {
        console.error(
          `[stored-files] cleanup failed to delete storage object for ${row.id}:`,
          error instanceof Error ? error.message : error
        );
      }
    }
  }

  const result = await db.execute(
    "DELETE FROM stored_files WHERE expires_at IS NOT NULL AND expires_at < $1",
    [cutoff]
  );
  return result.changes;
}
