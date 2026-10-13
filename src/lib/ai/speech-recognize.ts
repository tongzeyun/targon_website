/**
 * 录音文件转写 — 讯飞 LFASR 标准版
 */

import crypto from "node:crypto";
import { IflytekNotConfiguredError } from "./iflytek-client";
import { withProviderQuota } from "./provider-quota";

export type SpeechTranscriptMode = "minutes" | "analysis";

export interface SpeechResult {
  text: string;
  confidence: number;
  duration: number;
  analysis?: unknown;
}

export interface SpeechToTextOptions {
  userId: string;
  jobId?: string | null;
  providerTaskId?: string | null;
  onProviderTaskCreated?: (taskId: string) => Promise<void>;
  transcriptMode: SpeechTranscriptMode;
}

interface LfasrConfig {
  appId: string;
  secretKey: string;
  baseUrl: string;
}

interface LfasrOrderInfo {
  orderId?: string;
  failType?: number;
  status?: number;
  originalDuration?: number;
  realDuration?: number;
}

interface LfasrContent {
  orderId?: string;
  orderInfo?: LfasrOrderInfo;
  orderResult?: string;
  taskEstimateTime?: number;
}

interface LfasrResponse {
  code?: string;
  descInfo?: string;
  content?: LfasrContent;
}

interface TranscriptSegment {
  role: string;
  text: string;
  confidence: number | null;
}

const DEFAULT_LFASR_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_LFASR_POLL_INTERVAL_MS = 5000;
const MAX_LFASR_RESULT_QUERIES = 100;

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readLfasrConfig(): LfasrConfig {
  return {
    appId: process.env.IFLYTEK_LFASR_APP_ID?.trim() || "",
    secretKey: process.env.IFLYTEK_LFASR_SECRET_KEY?.trim() || "",
    baseUrl: (process.env.IFLYTEK_LFASR_BASE_URL?.trim() || "https://raasr.xfyun.cn/v2/api").replace(/\/+$/, ""),
  };
}

function requireLfasrConfig(): LfasrConfig {
  const config = readLfasrConfig();
  if (!config.appId || !config.secretKey) {
    throw new IflytekNotConfiguredError(
      "讯飞录音文件转写（标准版）",
      "请设置 IFLYTEK_LFASR_APP_ID / IFLYTEK_LFASR_SECRET_KEY"
    );
  }
  return config;
}

function signedLfasrUrl(
  config: LfasrConfig,
  path: "upload" | "getResult",
  params: Record<string, string>,
  now = new Date()
): string {
  const timestamp = Math.floor(now.getTime() / 1000).toString();
  const digest = crypto.createHash("md5").update(config.appId + timestamp).digest("hex");
  const signature = crypto.createHmac("sha1", config.secretKey).update(digest).digest("base64");
  const url = new URL(`${config.baseUrl}/${path}`);
  url.searchParams.set("appId", config.appId);
  url.searchParams.set("ts", timestamp);
  url.searchParams.set("signa", signature);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

function parseJsonRecord(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function parseLfasrResponse(raw: string): LfasrResponse | null {
  const parsed = parseJsonRecord(raw);
  if (!parsed) return null;
  const content = parsed.content && typeof parsed.content === "object" && !Array.isArray(parsed.content)
    ? parsed.content as Record<string, unknown>
    : null;
  const orderInfo = content?.orderInfo && typeof content.orderInfo === "object" && !Array.isArray(content.orderInfo)
    ? content.orderInfo as Record<string, unknown>
    : null;
  return {
    code: typeof parsed.code === "string" ? parsed.code : undefined,
    descInfo: typeof parsed.descInfo === "string" ? parsed.descInfo : undefined,
    content: content
      ? {
          orderId: typeof content.orderId === "string" ? content.orderId : undefined,
          orderResult: typeof content.orderResult === "string" ? content.orderResult : undefined,
          taskEstimateTime: typeof content.taskEstimateTime === "number" ? content.taskEstimateTime : undefined,
          orderInfo: orderInfo
            ? {
                orderId: typeof orderInfo.orderId === "string" ? orderInfo.orderId : undefined,
                failType: typeof orderInfo.failType === "number" ? orderInfo.failType : undefined,
                status: typeof orderInfo.status === "number" ? orderInfo.status : undefined,
                originalDuration: typeof orderInfo.originalDuration === "number" ? orderInfo.originalDuration : undefined,
                realDuration: typeof orderInfo.realDuration === "number" ? orderInfo.realDuration : undefined,
              }
            : undefined,
        }
      : undefined,
  };
}

function assertLfasrSuccess(response: LfasrResponse | null, raw: string, context: string): LfasrResponse {
  if (!response) throw new Error(`讯飞录音文件转写${context}返回非预期 JSON`);
  if (response.code !== "000000") {
    throw new Error(`讯飞录音文件转写${context}失败: ${response.code || "未知错误"} ${response.descInfo || raw.slice(0, 500)}`);
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
    throw new Error(`讯飞录音文件转写${context}网络请求失败，请检查网络、代理或 DNS 配置: ${getFetchCause(error)}`);
  }
}

function uploadModeParams(mode: SpeechTranscriptMode): Record<string, string> {
  return {
    audioMode: "fileStream",
    language: "cn",
    languageType: "1",
    roleType: "1",
    roleNum: "2",
    eng_smoothproc: mode === "minutes" ? "true" : "false",
    eng_colloqproc: mode === "minutes" ? "true" : "false",
  };
}

async function createLfasrTask(
  audioBuffer: ArrayBuffer,
  fileName: string,
  mode: SpeechTranscriptMode
): Promise<string> {
  const config = requireLfasrConfig();
  const body = Buffer.from(audioBuffer);
  const url = signedLfasrUrl(config, "upload", {
    fileName,
    fileSize: body.byteLength.toString(),
    duration: "200",
    ...uploadModeParams(mode),
  });
  const response = await fetchWithNetworkError(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
    },
    body,
  }, "创建任务");
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`讯飞录音文件转写创建任务失败: HTTP ${response.status} ${raw.slice(0, 500)}`);
  }
  const result = assertLfasrSuccess(parseLfasrResponse(raw), raw, "创建任务");
  const orderId = result.content?.orderId;
  if (!orderId) throw new Error(`讯飞录音文件转写创建任务未返回 orderId: ${raw.slice(0, 500)}`);
  return orderId;
}

async function pollLfasrTask(orderId: string): Promise<LfasrResponse> {
  const config = requireLfasrConfig();
  const timeoutMs = intFromEnv("IFLYTEK_LFASR_TIMEOUT_MS", DEFAULT_LFASR_TIMEOUT_MS);
  const basePollIntervalMs = intFromEnv("IFLYTEK_LFASR_POLL_INTERVAL_MS", DEFAULT_LFASR_POLL_INTERVAL_MS);
  const deadline = Date.now() + timeoutMs;

  for (let queryIndex = 0; queryIndex < MAX_LFASR_RESULT_QUERIES; queryIndex += 1) {
    if (Date.now() > deadline) break;
    const url = signedLfasrUrl(config, "getResult", { orderId });
    const response = await fetchWithNetworkError(url, { method: "GET" }, "查询任务");
    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`讯飞录音文件转写查询任务失败: HTTP ${response.status} ${raw.slice(0, 500)}`);
    }

    const parsed = parseLfasrResponse(raw);
    if (parsed?.code === "26605") {
      const remainingQueries = MAX_LFASR_RESULT_QUERIES - queryIndex - 1;
      const delay = Math.max(basePollIntervalMs, Math.ceil((deadline - Date.now()) / Math.max(1, remainingQueries)));
      await sleep(delay);
      continue;
    }
    const result = assertLfasrSuccess(parsed, raw, "查询任务");
    const status = result.content?.orderInfo?.status;
    if (status === 4) return result;
    if (status === -1) {
      throw new Error(`讯飞录音文件转写任务失败: failType=${result.content?.orderInfo?.failType ?? "未知"}`);
    }
    if (status !== 0 && status !== 3) {
      throw new Error(`讯飞录音文件转写查询任务返回未知状态: ${status ?? "缺失"}`);
    }

    const remainingQueries = MAX_LFASR_RESULT_QUERIES - queryIndex - 1;
    const delay = Math.max(basePollIntervalMs, Math.ceil((deadline - Date.now()) / Math.max(1, remainingQueries)));
    await sleep(delay);
  }

  throw new Error(`讯飞录音文件转写任务超时，超过 ${timeoutMs}ms 未完成`);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

function transcriptSegments(orderResult: string): TranscriptSegment[] {
  const result = parseJsonRecord(orderResult);
  const lattice = Array.isArray(result?.lattice) ? result.lattice : [];
  const segments: TranscriptSegment[] = [];

  for (const item of lattice) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const latticeItem = item as Record<string, unknown>;
    const best = typeof latticeItem.json_1best === "string"
      ? parseJsonRecord(latticeItem.json_1best)
      : latticeItem.json_1best && typeof latticeItem.json_1best === "object" && !Array.isArray(latticeItem.json_1best)
        ? latticeItem.json_1best as Record<string, unknown>
        : null;
    const st = best?.st && typeof best.st === "object" && !Array.isArray(best.st)
      ? best.st as Record<string, unknown>
      : null;
    if (!st) continue;

    const words: string[] = [];
    const realtime = Array.isArray(st.rt) ? st.rt : [];
    for (const rtItem of realtime) {
      if (!rtItem || typeof rtItem !== "object" || Array.isArray(rtItem)) continue;
      const wordSets = Array.isArray((rtItem as Record<string, unknown>).ws)
        ? (rtItem as Record<string, unknown>).ws as unknown[]
        : [];
      for (const wordSet of wordSets) {
        if (!wordSet || typeof wordSet !== "object" || Array.isArray(wordSet)) continue;
        const candidates = Array.isArray((wordSet as Record<string, unknown>).cw)
          ? (wordSet as Record<string, unknown>).cw as unknown[]
          : [];
        const candidate = candidates[0];
        if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
        const word = stringValue((candidate as Record<string, unknown>).w);
        if (word) words.push(word);
      }
    }

    const text = words.join("").trim();
    if (!text) continue;
    const confidenceValue = Number(st.sc);
    segments.push({
      role: stringValue(st.rl) || stringValue(latticeItem.spk) || "default",
      text,
      confidence: Number.isFinite(confidenceValue) ? confidenceValue : null,
    });
  }
  return segments;
}

function formatTranscript(orderResult: string): { text: string; confidence: number } {
  const segments = transcriptSegments(orderResult);
  if (!segments.length) throw new Error("讯飞录音文件转写已完成，但未返回可解析的转写文本");

  const roleLabels = new Map<string, number>();
  const lines: Array<{ speaker: number; text: string }> = [];
  for (const segment of segments) {
    if (!roleLabels.has(segment.role)) roleLabels.set(segment.role, roleLabels.size + 1);
    const speaker = roleLabels.get(segment.role) || 1;
    const previous = lines[lines.length - 1];
    if (previous?.speaker === speaker) previous.text += segment.text;
    else lines.push({ speaker, text: segment.text });
  }

  const confidenceValues = segments
    .map((segment) => segment.confidence)
    .filter((value): value is number => value !== null);
  const confidence = confidenceValues.length
    ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
    : 1;
  return {
    text: lines.map((line) => `说话人${line.speaker}：${line.text}`).join("\n"),
    confidence,
  };
}

export async function speechToText(
  audioBuffer: ArrayBuffer,
  fileName: string,
  options: SpeechToTextOptions
): Promise<SpeechResult> {
  requireLfasrConfig();
  return withProviderQuota(
    {
      userId: options.userId,
      resource: "iflytek_speech",
      operation: "speech_recognize",
      jobId: options.jobId,
      idempotencyKey: options.jobId ? `iflytek_speech:${options.jobId}` : null,
    },
    async () => {
      const orderId = options.providerTaskId || await createLfasrTask(audioBuffer, fileName, options.transcriptMode);
      if (!options.providerTaskId) await options.onProviderTaskCreated?.(orderId);
      const result = await pollLfasrTask(orderId);
      const orderResult = result.content?.orderResult;
      if (!orderResult) throw new Error("讯飞录音文件转写任务已完成，但未返回 orderResult");
      const transcript = formatTranscript(orderResult);
      return {
        text: transcript.text,
        confidence: transcript.confidence,
        duration: (result.content?.orderInfo?.realDuration || 0) / 1000,
        analysis: parseJsonRecord(orderResult),
      };
    }
  );
}

export async function batchSpeechToText(
  files: Array<{ buffer: ArrayBuffer; fileName: string; options: SpeechToTextOptions }>
): Promise<SpeechResult[]> {
  const results: SpeechResult[] = [];
  for (const file of files) results.push(await speechToText(file.buffer, file.fileName, file.options));
  return results;
}
