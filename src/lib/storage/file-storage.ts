import crypto from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

export interface StoredObject {
  key: string;
  buffer: Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface FileStorageAdapter {
  put(input: {
    key: string;
    buffer: Buffer;
    contentType?: string;
    metadata?: Record<string, string>;
  }): Promise<void>;

  get(key: string): Promise<Buffer | null>;

  delete(key: string): Promise<void>;

  createReadUrl?(key: string, expiresInSeconds?: number): string;
}

export interface FileStorageDescriptor {
  driver: "local" | "oss";
  bucket: string | null;
}

export class InvalidStorageKeyError extends Error {
  constructor(key: string, reason: string) {
    super(`Invalid storage key "${key}": ${reason}`);
    this.name = "InvalidStorageKeyError";
  }
}

function resolveSafePath(root: string, key: string): string {
  if (!key || key.trim() === "") {
    throw new InvalidStorageKeyError(key, "key must not be empty");
  }
  if (key.includes("\\") || path.isAbsolute(key)) {
    throw new InvalidStorageKeyError(key, "absolute paths and backslashes are not allowed");
  }

  const segments = key.split("/").filter((segment) => segment.length > 0);
  if (segments.some((segment) => segment === "..")) {
    throw new InvalidStorageKeyError(key, "path traversal is not allowed");
  }

  const normalizedRoot = path.resolve(root);
  const resolved = path.resolve(normalizedRoot, ...segments);
  const rootPrefix = normalizedRoot.endsWith(path.sep)
    ? normalizedRoot
    : `${normalizedRoot}${path.sep}`;

  if (resolved !== normalizedRoot && !resolved.startsWith(rootPrefix)) {
    throw new InvalidStorageKeyError(key, "path escapes storage root");
  }

  return resolved;
}

export class LocalFileStorageAdapter implements FileStorageAdapter {
  constructor(private readonly rootDir: string) {}

  async put(input: {
    key: string;
    buffer: Buffer;
    contentType?: string;
    metadata?: Record<string, string>;
  }): Promise<void> {
    const filePath = resolveSafePath(this.rootDir, input.key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, input.buffer);
  }

  async get(key: string): Promise<Buffer | null> {
    const filePath = resolveSafePath(this.rootDir, key);
    try {
      return await readFile(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = resolveSafePath(this.rootDir, key);
    try {
      await unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return;
      }
      throw error;
    }
  }
}

interface OssConfig {
  bucket: string;
  accessKeyId: string;
  accessKeySecret: string;
  endpoint: string;
  forcePathStyle: boolean;
}

const OSS_NETWORK_MAX_ATTEMPTS = 3;
const OSS_NETWORK_RETRY_BASE_DELAY_MS = 250;

export class OssFileStorageAdapter implements FileStorageAdapter {
  constructor(private readonly config: OssConfig) {}

  async put(input: {
    key: string;
    buffer: Buffer;
    contentType?: string;
    metadata?: Record<string, string>;
  }): Promise<void> {
    validateObjectKey(input.key);
    const contentType = input.contentType || "application/octet-stream";
    const headers: Record<string, string> = {
      Date: new Date().toUTCString(),
      "Content-Type": contentType,
    };
    // OSS user metadata is intentionally disabled. Business metadata is already
    // persisted in the database, and raw UTF-8 values (for example, Chinese file
    // names) cannot be sent safely as HTTP header values by the Fetch API.
    //
    // Keep the previous implementation commented for traceability. If OSS
    // metadata is restored later, values must be encoded to visible ASCII before
    // both signing and sending the request.
    // for (const [key, value] of Object.entries(input.metadata || {})) {
    //   headers[`x-oss-meta-${normalizeMetadataKey(key)}`] = value;
    // }
    headers.Authorization = this.authorization("PUT", input.key, headers, contentType);

    const res = await this.fetchObject(input.key, {
      method: "PUT",
      headers,
      body: new Uint8Array(input.buffer),
    }, "put");
    if (!res.ok) {
      throw new Error(`OSS put failed: HTTP ${res.status} ${(await res.text()).slice(0, 500)}`);
    }
  }

  async get(key: string): Promise<Buffer | null> {
    validateObjectKey(key);
    const headers: Record<string, string> = { Date: new Date().toUTCString() };
    headers.Authorization = this.authorization("GET", key, headers, "");
    const res = await this.fetchObject(key, { method: "GET", headers }, "get");
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`OSS get failed: HTTP ${res.status} ${(await res.text()).slice(0, 500)}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    validateObjectKey(key);
    const headers: Record<string, string> = { Date: new Date().toUTCString() };
    headers.Authorization = this.authorization("DELETE", key, headers, "");
    const res = await this.fetchObject(key, { method: "DELETE", headers }, "delete");
    if (!res.ok && res.status !== 404) {
      throw new Error(`OSS delete failed: HTTP ${res.status} ${(await res.text()).slice(0, 500)}`);
    }
  }

  createReadUrl(key: string, expiresInSeconds = 1800): string {
    validateObjectKey(key);
    const expires = Math.floor(Date.now() / 1000) + Math.max(1, Math.floor(expiresInSeconds));
    const signature = this.signature("GET", key, {
      expires: String(expires),
      contentType: "",
      ossHeaders: {},
    });
    const url = new URL(this.objectUrl(key));
    url.searchParams.set("OSSAccessKeyId", this.config.accessKeyId);
    url.searchParams.set("Expires", String(expires));
    url.searchParams.set("Signature", signature);
    return url.toString();
  }

  private objectUrl(key: string): string {
    const endpoint = new URL(this.config.endpoint);
    if (this.config.forcePathStyle) {
      endpoint.pathname = joinUrlPath(endpoint.pathname, this.config.bucket, encodeObjectKey(key));
      return endpoint.toString();
    }
    endpoint.hostname = `${this.config.bucket}.${endpoint.hostname}`;
    endpoint.pathname = joinUrlPath(endpoint.pathname, encodeObjectKey(key));
    return endpoint.toString();
  }

  private async fetchObject(key: string, init: RequestInit, action: "put" | "get" | "delete"): Promise<Response> {
    const url = this.objectUrl(key);
    let lastError: unknown;

    for (let attempt = 1; attempt <= OSS_NETWORK_MAX_ATTEMPTS; attempt += 1) {
      try {
        return await fetch(url, init);
      } catch (error) {
        lastError = error;
        if (isAbortError(error) || attempt === OSS_NETWORK_MAX_ATTEMPTS) break;

        console.warn(
          `[storage:oss] ${action} network failed; retrying (${attempt}/${OSS_NETWORK_MAX_ATTEMPTS}): ${getFetchErrorCause(error)}`
        );
        await delay(OSS_NETWORK_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
      }
    }

    throw new Error(`OSS ${action} network failed for ${url}: ${getFetchErrorCause(lastError)}`);
  }

  private authorization(method: "GET" | "PUT" | "DELETE", key: string, headers: Record<string, string>, contentType: string): string {
    const signature = this.signature(method, key, {
      date: headers.Date,
      contentType,
      ossHeaders: ossHeaders(headers),
    });
    return `OSS ${this.config.accessKeyId}:${signature}`;
  }

  private signature(
    method: "GET" | "PUT" | "DELETE",
    key: string,
    input: { date?: string; expires?: string; contentType: string; ossHeaders: Record<string, string> }
  ): string {
    const canonicalizedHeaders = Object.entries(input.ossHeaders)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([header, value]) => `${header}:${value.trim()}\n`)
      .join("");
    const dateOrExpires = input.expires ?? input.date ?? "";
    const stringToSign = [
      method,
      "",
      input.contentType,
      dateOrExpires,
      `${canonicalizedHeaders}/${this.config.bucket}/${key}`,
    ].join("\n");
    return crypto.createHmac("sha1", this.config.accessKeySecret).update(stringToSign).digest("base64");
  }
}

let adapter: FileStorageAdapter | null = null;

function resolveLocalRootDir(): string {
  const configured = process.env.STORAGE_LOCAL_DIR?.trim();
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.join(/*turbopackIgnore: true*/ process.cwd(), configured);
  }
  return path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "stored-files");
}

export function getFileStorageAdapter(): FileStorageAdapter {
  const driver = process.env.FILE_STORAGE_DRIVER ?? "local";
  if (driver === "oss") {
    if (!adapter) {
      adapter = new OssFileStorageAdapter(resolveOssConfig());
    }
    return adapter;
  }
  if (driver !== "local") {
    throw new Error(`Unsupported FILE_STORAGE_DRIVER: ${driver}. Only "local" is supported.`);
  }

  if (!adapter) {
    adapter = new LocalFileStorageAdapter(resolveLocalRootDir());
  }
  return adapter;
}

export function getFileStorageDescriptor(): FileStorageDescriptor {
  const driver = process.env.FILE_STORAGE_DRIVER ?? "local";
  if (driver === "oss") {
    const config = resolveOssConfig();
    return { driver: "oss", bucket: config.bucket };
  }
  return { driver: "local", bucket: null };
}

function resolveOssConfig(): OssConfig {
  const bucket = requiredEnv("OSS_BUCKET");
  const accessKeyId = requiredEnv("OSS_ACCESS_KEY_ID");
  const accessKeySecret = requiredEnv("OSS_ACCESS_KEY_SECRET");
  const endpoint = normalizeEndpoint(
    process.env.OSS_INTERNAL_ENDPOINT?.trim() ||
      process.env.OSS_ENDPOINT?.trim() ||
      endpointFromRegion(requiredEnv("OSS_REGION"))
  );
  return {
    bucket,
    accessKeyId,
    accessKeySecret,
    endpoint,
    forcePathStyle: (process.env.OSS_FORCE_PATH_STYLE || "false").toLowerCase() === "true",
  };
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required when FILE_STORAGE_DRIVER=oss`);
  return value;
}

function endpointFromRegion(region: string): string {
  return `https://oss-${region}.aliyuncs.com`;
}

function normalizeEndpoint(endpoint: string): string {
  return /^https?:\/\//i.test(endpoint) ? endpoint : `https://${endpoint}`;
}

function validateObjectKey(key: string): void {
  if (!key || key.trim() === "") throw new InvalidStorageKeyError(key, "key must not be empty");
  if (key.includes("\\") || key.startsWith("/") || key.includes("..")) {
    throw new InvalidStorageKeyError(key, "absolute paths, backslashes, and traversal are not allowed");
  }
}

function encodeObjectKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

function joinUrlPath(...parts: string[]): string {
  return parts
    .filter(Boolean)
    .map((part, index) => (index === 0 ? part.replace(/\/+$/g, "") : part.replace(/^\/+|\/+$/g, "")))
    .filter(Boolean)
    .join("/");
}

// Retained with the disabled OSS metadata implementation above.
// function normalizeMetadataKey(key: string): string {
//   return key.toLowerCase().replace(/[^a-z0-9-]/g, "-");
// }

function ossHeaders(headers: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (lower.startsWith("x-oss-")) normalized[lower] = value;
  }
  return normalized;
}

function getFetchErrorCause(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause;
  if (cause instanceof Error) return cause.message;
  return cause ? String(cause) : error.message;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
