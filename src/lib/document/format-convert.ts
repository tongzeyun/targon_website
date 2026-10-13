/**
 * 文档格式转换
 *
 * 当前支持：本地基础转换；生产 worker 路径可调用讯飞文档 OCR。
 *
 */

import { parsePdfTemplate } from "./template-parser";
import { buildDocxFromText } from "./docx-builder";
import { parseDocxTemplate } from "./template-parser";
import {
  buildIflytekPdfOcrHeaders,
  IflytekNotConfiguredError,
  initIflytek,
  isIflytekReady,
} from "@/lib/ai/iflytek-client";
import { withProviderQuota } from "@/lib/ai/provider-quota";

export type TargetFormat = "txt" | "docx" | "html";

export interface ConvertResult {
  buffer: Buffer;
  fileName: string;
  contentType: string;
}

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type PdfOcrStatus = "CREATE" | "WAITING" | "DOING" | "FINISH" | "FAILED" | "ANY_FAILED" | "STOP";

interface PdfOcrResponse {
  flag?: boolean;
  code?: number;
  desc?: string;
  data?: {
    taskNo?: string;
    exportFormat?: string;
    status?: PdfOcrStatus;
    downUrl?: string;
    tip?: string | null;
  };
}

const PDF_OCR_FINISHED_STATUSES = new Set<PdfOcrStatus>(["FINISH"]);
const PDF_OCR_FAILED_STATUSES = new Set<PdfOcrStatus>(["FAILED", "ANY_FAILED", "STOP"]);
const DEFAULT_PDF_OCR_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_PDF_OCR_POLL_INTERVAL_MS = 5000;

function toBuffer(input: Buffer | ArrayBuffer): Buffer {
  return Buffer.isBuffer(input) ? input : Buffer.from(input);
}

function baseNameOf(originalName: string): string {
  return originalName.replace(/\.[^.]+$/i, "");
}

function isPdfFile(originalName: string, mimeType: string): boolean {
  return originalName.toLowerCase().endsWith(".pdf") || mimeType.toLowerCase().includes("pdf");
}

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tryParseJson(value: string): JsonValue | null {
  try {
    return JSON.parse(value) as JsonValue;
  } catch {
    return null;
  }
}

function isJsonRecord(value: JsonValue): value is { [key: string]: JsonValue } {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toPdfOcrResponse(value: JsonValue | null): PdfOcrResponse | null {
  if (!value || !isJsonRecord(value)) return null;
  const data = isJsonRecord(value.data) ? value.data : undefined;
  return {
    flag: typeof value.flag === "boolean" ? value.flag : undefined,
    code: typeof value.code === "number" ? value.code : undefined,
    desc: typeof value.desc === "string" ? value.desc : undefined,
    data: data
      ? {
          taskNo: typeof data.taskNo === "string" ? data.taskNo : undefined,
          exportFormat: typeof data.exportFormat === "string" ? data.exportFormat : undefined,
          status: typeof data.status === "string" ? (data.status as PdfOcrStatus) : undefined,
          downUrl: typeof data.downUrl === "string" ? data.downUrl : undefined,
          tip: typeof data.tip === "string" || data.tip === null ? data.tip : undefined,
        }
      : undefined,
  };
}

function assertPdfOcrSuccess(response: PdfOcrResponse | null, context: string): PdfOcrResponse {
  if (!response) throw new Error(`讯飞 PDF OCR ${context}返回非预期 JSON`);
  if (response.code != null && response.code !== 0) {
    throw new Error(`讯飞 PDF OCR ${context}失败: ${response.code} ${response.desc || "未知错误"}`);
  }
  if (response.flag === false) {
    throw new Error(`讯飞 PDF OCR ${context}失败: ${response.desc || "未知错误"}`);
  }
  return response;
}

function getFetchCause(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause;
  if (cause instanceof Error) return cause.message;
  return cause ? String(cause) : error.message;
}

async function fetchWithNetworkError(url: string, init: RequestInit, context: string): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    throw new Error(`讯飞 PDF OCR ${context}网络请求失败，请检查网络、代理或 DNS 配置: ${getFetchCause(error)}`);
  }
}

function pdfOcrUrl(baseUrl: string, path: "start" | "status"): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path}`;
}

function exportFormatForTarget(targetFormat: TargetFormat): "word" | "markdown" {
  return targetFormat === "docx" ? "word" : "markdown";
}

function resultContentType(targetFormat: TargetFormat): string {
  switch (targetFormat) {
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "html":
      return "text/html; charset=utf-8";
    case "txt":
      return "text/plain; charset=utf-8";
  }
}

async function startPdfOcrTask(input: {
  buffer: Buffer | ArrayBuffer;
  originalName: string;
  mimeType: string;
  targetFormat: TargetFormat;
}): Promise<{ taskNo: string; baseUrl: string }> {
  if (!isIflytekReady("document")) {
    throw new IflytekNotConfiguredError("文档转换");
  }

  const cfg = initIflytek("document");
  if (!cfg.endpoint) throw new IflytekNotConfiguredError("文档转换");

  const fileBytes = toBuffer(input.buffer);
  const fileBlob = new Blob([new Uint8Array(fileBytes)], { type: input.mimeType || "application/pdf" });
  const formData = new FormData();
  formData.append("file", fileBlob, input.originalName);
  formData.append("exportFormat", exportFormatForTarget(input.targetFormat));

  const res = await fetchWithNetworkError(pdfOcrUrl(cfg.endpoint, "start"), {
    method: "POST",
    headers: buildIflytekPdfOcrHeaders(cfg),
    body: formData,
  }, "开始任务");
  const raw = await res.text();

  if (!res.ok) {
    throw new Error(`讯飞 PDF OCR 开始任务失败: HTTP ${res.status} ${raw.slice(0, 500)}`);
  }
  const json = assertPdfOcrSuccess(toPdfOcrResponse(tryParseJson(raw)), "开始任务");
  const taskNo = json.data?.taskNo;
  if (!taskNo) {
    throw new Error(`讯飞 PDF OCR 开始任务未返回 taskNo: ${raw.slice(0, 500)}`);
  }
  return { taskNo, baseUrl: cfg.endpoint };
}

async function pollPdfOcrTask(taskNo: string, baseUrl: string): Promise<string> {
  const cfg = initIflytek("document");
  const timeoutMs = intFromEnv("IFLYTEK_DOCUMENT_TIMEOUT_MS", DEFAULT_PDF_OCR_TIMEOUT_MS);
  const pollIntervalMs = intFromEnv("IFLYTEK_DOCUMENT_POLL_INTERVAL_MS", DEFAULT_PDF_OCR_POLL_INTERVAL_MS);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const url = new URL(pdfOcrUrl(baseUrl, "status"));
    url.searchParams.set("taskNo", taskNo);
    const res = await fetchWithNetworkError(url.toString(), {
      method: "GET",
      headers: buildIflytekPdfOcrHeaders(cfg),
    }, "查询状态");
    const raw = await res.text();

    if (!res.ok) {
      throw new Error(`讯飞 PDF OCR 查询状态失败: HTTP ${res.status} ${raw.slice(0, 500)}`);
    }

    const json = assertPdfOcrSuccess(toPdfOcrResponse(tryParseJson(raw)), "查询状态");
    const status = json.data?.status;
    if (status && PDF_OCR_FINISHED_STATUSES.has(status)) {
      const downUrl = json.data?.downUrl;
      if (!downUrl) throw new Error(`讯飞 PDF OCR 已完成但未返回下载地址`);
      return downUrl;
    }
    if (status && PDF_OCR_FAILED_STATUSES.has(status)) {
      throw new Error(`讯飞 PDF OCR 任务失败: ${status} ${json.data?.tip || json.desc || "未知错误"}`);
    }

    await sleep(pollIntervalMs);
  }

  throw new Error(`讯飞 PDF OCR 任务超时，超过 ${timeoutMs}ms 未完成`);
}

async function downloadPdfOcrResult(downUrl: string): Promise<Buffer> {
  const res = await fetchWithNetworkError(downUrl, { method: "GET" }, "下载结果");
  const bytes = Buffer.from(await res.arrayBuffer());

  if (!res.ok) {
    const detail = bytes.toString("utf-8").slice(0, 500);
    if (res.status === 403 || res.status === 404 || res.status === 410) {
      throw new Error(`讯飞 PDF OCR 下载地址失效或已过期: HTTP ${res.status} ${detail}`);
    }
    throw new Error(`讯飞 PDF OCR 下载结果失败: HTTP ${res.status} ${detail}`);
  }
  if (bytes.length === 0) {
    throw new Error("讯飞 PDF OCR 下载结果为空，可能是下载地址失效或网络代理中断");
  }
  return bytes;
}

function formatDownloadedResult(buffer: Buffer, targetFormat: TargetFormat, originalName: string): ConvertResult {
  const baseName = baseNameOf(originalName);
  if (targetFormat === "html") {
    const markdown = buffer.toString("utf-8");
    return {
      buffer: Buffer.from(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${htmlEscape(baseName)}</title></head><body><pre>${htmlEscape(markdown)}</pre></body></html>`,
        "utf-8"
      ),
      fileName: `${baseName}.html`,
      contentType: resultContentType(targetFormat),
    };
  }
  if (targetFormat === "txt") {
    return {
      buffer,
      fileName: `${baseName}.txt`,
      contentType: resultContentType(targetFormat),
    };
  }
  return {
    buffer,
    fileName: `${baseName}.docx`,
    contentType: resultContentType(targetFormat),
  };
}

/**
 * PDF 转其他格式
 * 当前：PDF → TXT（本地解析）/ PDF → DOCX（提取文本后构建）
 * 讯飞接入后：调用讯飞文档转换 API 实现高质量转换
 */
export async function convertPdf(
  buffer: ArrayBuffer,
  targetFormat: TargetFormat,
  originalName: string
): Promise<ConvertResult> {
  const baseName = originalName.replace(/\.pdf$/i, "");

  // 先用本地解析提取文本
  const { text } = await parsePdfTemplate(buffer);

  if (!text.trim()) {
    throw new Error("PDF 无法提取文字内容，可能是扫描件。如需 OCR 识别，请配置讯飞 API。");
  }

  switch (targetFormat) {
    case "txt":
      return {
        buffer: Buffer.from(text, "utf-8"),
        fileName: `${baseName}.txt`,
        contentType: "text/plain; charset=utf-8",
      };

    case "docx":
      return {
        buffer: await buildDocxFromText(baseName, text),
        fileName: `${baseName}.docx`,
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      };

    case "html":
      return {
        buffer: Buffer.from(
          `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${baseName}</title></head><body><pre>${text}</pre></body></html>`,
          "utf-8"
        ),
        fileName: `${baseName}.html`,
        contentType: "text/html; charset=utf-8",
      };

    default:
      throw new Error(`不支持的转换格式: ${targetFormat}`);
  }
}

/**
 * DOCX 转其他格式
 */
export async function convertDocx(
  buffer: ArrayBuffer,
  targetFormat: TargetFormat,
  originalName: string
): Promise<ConvertResult> {
  const baseName = originalName.replace(/\.docx$/i, "");
  const { text } = await parseDocxTemplate(buffer);

  switch (targetFormat) {
    case "txt":
      return {
        buffer: Buffer.from(text, "utf-8"),
        fileName: `${baseName}.txt`,
        contentType: "text/plain; charset=utf-8",
      };
    case "html":
      return {
        buffer: Buffer.from(
          `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${baseName}</title></head><body><pre>${text}</pre></body></html>`,
          "utf-8"
        ),
        fileName: `${baseName}.html`,
        contentType: "text/html; charset=utf-8",
      };
    default:
      throw new Error(`不支持的转换格式: ${targetFormat}`);
  }
}

// ============================================================
// 讯飞文档转换（生产路径 — worker 调用）
// ============================================================

/**
 * 讯飞文档转换。未配置或 API 未接入时抛错；不调用本地 convertPdf / convertDocx。
 */
export async function convertDocumentViaIflytek(input: {
  userId: string;
  jobId?: string | null;
  providerTaskId?: string | null;
  onProviderTaskCreated?: (taskId: string) => Promise<void>;
  buffer: Buffer | ArrayBuffer;
  originalName: string;
  mimeType: string;
  targetFormat: TargetFormat;
}): Promise<ConvertResult> {
  if (!isPdfFile(input.originalName, input.mimeType)) {
    throw new Error("讯飞文档转换仅支持 PDF 文件");
  }
  return withProviderQuota(
    {
      userId: input.userId,
      resource: "iflytek_document",
      operation: "document_convert",
      jobId: input.jobId,
      idempotencyKey: input.jobId ? `iflytek_document:${input.jobId}` : null,
    },
    async () => {
      const started = input.providerTaskId
        ? { taskNo: input.providerTaskId, baseUrl: initIflytek("document").endpoint }
        : await startPdfOcrTask(input);
      if (!started.baseUrl) throw new IflytekNotConfiguredError("文档转换");
      if (!input.providerTaskId) {
        await input.onProviderTaskCreated?.(started.taskNo);
      }
      const downUrl = await pollPdfOcrTask(started.taskNo, started.baseUrl);
      const downloaded = await downloadPdfOcrResult(downUrl);
      return formatDownloadedResult(downloaded, input.targetFormat, input.originalName);
    }
  );
}

// ============================================================
// 本地转换（保留供测试/脚本；非 API 生产路径）
// ============================================================

/**
 * [讯飞待启用 — 旧注释保留] 高质量 PDF 转 Word（保留排版）
 * 调用讯飞文档转换 API: POST https://rest-api.iflytek.com/v1/document/convert
 */
/*
export async function convertPdfToDocxViaIflytek(
  buffer: ArrayBuffer,
  originalName: string
): Promise<ConvertResult> {
  const cfg = initIflytek();
  if (!isIflytekReady()) throw new IflytekNotConfiguredError("文档转换");

  // TODO: 替换为真实讯飞 API 调用
  // const formData = new FormData();
  // formData.append("file", new Blob([buffer]));
  // formData.append("target", "docx");
  // const res = await fetch("https://rest-api.iflytek.com/v1/document/convert", {
  //   method: "POST",
  //   headers: { "X-Appid": cfg.appId, "X-Api-Key": cfg.apiKey },
  //   body: formData,
  // });
  // ...

  throw new Error("讯飞文档转换 API 接入中，请先使用基础转换功能");
}
*/
