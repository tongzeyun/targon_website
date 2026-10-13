/**
 * 讯飞（iFlytek）API 客户端
 *
 * 语音识别和文档转换可能来自不同应用，优先读取服务专用配置，
 * 再回退到历史通用配置。
 */

import crypto from "node:crypto";

export type IflytekService = "speech" | "document";

export interface IflytekConfig {
  appId: string;
  apiKey: string;
  apiSecret: string;
  endpoint?: string;
}

function readEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

function normalizeDocumentEndpoint(endpoint: string): string {
  const trimmed = endpoint.replace(/\/+$/, "");
  if (!trimmed || trimmed === "https://iocrt.xfyun.cn/ocrzdq") {
    return "https://iocr.xfyun.cn/ocrzdq/v1/pdfOcr";
  }
  if (trimmed.endsWith("/start")) return trimmed.slice(0, -"/start".length);
  if (trimmed.endsWith("/status")) return trimmed.slice(0, -"/status".length);
  return trimmed;
}

/** 初始化讯飞客户端（从环境变量读取凭证） */
export function initIflytek(service: IflytekService = "speech"): IflytekConfig {
  if (service === "document") {
    const appId = readEnv("IFLYTEK_DOCUMENT_APP_ID", "IFLYTEK_CONVERT_APP_ID", "IFLYTEK_APP_ID");
    const endpoint =
      readEnv("IFLYTEK_DOCUMENT_BASE_URL", "IFLYTEK_DOCUMENT_ENDPOINT", "IFLYTEK_CONVERT_ENDPOINT") ||
      "https://iocr.xfyun.cn/ocrzdq/v1/pdfOcr";
    return {
      appId,
      apiKey: readEnv("IFLYTEK_DOCUMENT_API_KEY", "IFLYTEK_CONVERT_API_KEY", "IFLYTEK_API_KEY") || appId,
      apiSecret: readEnv("IFLYTEK_DOCUMENT_API_SECRET", "IFLYTEK_CONVERT_API_SECRET", "IFLYTEK_API_SECRET"),
      endpoint: normalizeDocumentEndpoint(endpoint),
    };
  }

  return {
    appId: readEnv("IFLYTEK_SPEECH_APP_ID", "IFLYTEK_APP_ID"),
    apiKey: readEnv("IFLYTEK_SPEECH_API_KEY", "IFLYTEK_API_KEY"),
    apiSecret: readEnv("IFLYTEK_SPEECH_API_SECRET", "IFLYTEK_API_SECRET"),
    endpoint: readEnv("IFLYTEK_SPEECH_BASE_URL") || "https://spark-openapi.cn-huabei-1.xf-yun.com",
  };
}

/** 检查讯飞是否已配置 */
export function isIflytekReady(service: IflytekService = "speech"): boolean {
  const cfg = initIflytek(service);
  return !!(cfg.appId && cfg.apiSecret && (service === "document" || cfg.apiKey));
}

export function buildIflytekPdfOcrHeaders(cfg: IflytekConfig, now = new Date()): Record<string, string> {
  const timestamp = Math.floor(now.getTime() / 1000).toString();
  const auth = crypto.createHash("md5").update(cfg.appId + timestamp).digest("hex");
  const signature = crypto.createHmac("sha1", cfg.apiSecret).update(auth).digest("base64");
  return {
    appId: cfg.appId,
    timestamp,
    signature,
  };
}

export function buildIflytekSparkSignedUrl(
  endpoint: string,
  cfg: IflytekConfig,
  method: "GET" | "POST",
  now = new Date()
): string {
  const url = new URL(endpoint);
  const date = now.toUTCString();
  const signatureOrigin = `host: ${url.host}\ndate: ${date}\n${method} ${url.pathname} HTTP/1.1`;
  const signature = crypto.createHmac("sha256", cfg.apiSecret).update(signatureOrigin).digest("base64");
  const authorizationOrigin = `api_key="${cfg.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  url.searchParams.set("authorization", Buffer.from(authorizationOrigin).toString("base64"));
  url.searchParams.set("date", date);
  url.searchParams.set("host", url.host);
  return url.toString();
}

export class IflytekNotConfiguredError extends Error {
  constructor(service = "讯飞服务", configurationHint?: string) {
    super(
      `${service}未配置。${configurationHint ||
        "语音识别请设置 IFLYTEK_SPEECH_APP_ID / IFLYTEK_SPEECH_API_KEY / IFLYTEK_SPEECH_API_SECRET；" +
        "文档转换请设置 IFLYTEK_DOCUMENT_APP_ID / IFLYTEK_DOCUMENT_API_SECRET"}`
    );
    this.name = "IflytekNotConfiguredError";
  }
}
