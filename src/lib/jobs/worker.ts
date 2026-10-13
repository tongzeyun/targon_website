import { discoverCompaniesFromWeb } from "@/lib/crawler/discover-companies";
import { ingestCrawlerSignals, type CrawlerIngestPayload } from "@/lib/crawler/ingest-service";
import { searchAndExtract } from "@/lib/crawler/search";
import { batchExtractUrl } from "@/lib/ai/batch-extract-service";
import { deepResearch } from "@/lib/ai/deep-research";
import { discoverAccountsForProduct } from "@/lib/ai/discover";
import { matchProductToAccounts } from "@/lib/ai/matching";
import { enrichAccount } from "@/lib/ai/enrich-account";
import type { AnalysisMode } from "@/lib/ai/meeting-analysis";
import { analyzeBidTemplateSemantics } from "@/lib/ai/bid-template-analyze";
import { fillBidTemplateContent } from "@/lib/ai/bid-content-fill";
import {
  assembleFilledBid,
  createBidFillContract,
  emptyBidFillResult,
  sanitizeBidFillResult,
} from "@/lib/document/bid-fill";
import { parseBidDocxOoxml, rawBidDocumentText } from "@/lib/document/bid-ooxml-parser";
import {
  compileBidTemplateDefinition,
  createSystemDefaultBidTemplate,
  findEmbeddedBidTemplateRegion,
  validateTemplateSemanticMap,
} from "@/lib/document/bid-template-compiler";
import type {
  BidTemplateDefinition,
  BidTemplateRegion,
  BidTemplateSemanticMap,
  RawBidTemplateDocument,
} from "@/lib/document/bid-template-model";
import {
  isBidSectionArray,
  parseBidTemplateSource,
  type BidSection,
  type BidTemplateSource,
} from "@/lib/document/bid-document-model";
import type { ContractData } from "@/lib/document/contract-template";
import {
  generateBidDocument,
  generateContractDocument,
  generateMeetingDocument,
  generateQuotationDocument,
  toJobDocumentResult,
} from "@/lib/document/generated-document-service";
import { speechToText } from "@/lib/ai/speech-recognize";
import { convertDocumentViaIflytek, type TargetFormat } from "@/lib/document/format-convert";
import type { QuotationData } from "@/lib/document/quotation-template";
import type { AuthContext } from "@/lib/api/auth";
import { createGeneratedDocument } from "@/lib/repositories/generated-document-repository";
import {
  AUTH_SESSION_CLEANUP_BATCH_SIZE,
  cleanupAuthSessionsBatch,
} from "@/lib/repositories/auth-session-repository";
import { cleanupExpiredStoredFiles, getStoredFile } from "@/lib/repositories/stored-file-repository";
import { isSupportedAudioFileName } from "@/lib/api/upload-limits";
import { ProviderQuotaExceededError, cleanupProviderQuotaLeases } from "@/lib/ai/provider-quota";
import {
  claimNextJob,
  completeJob,
  failJob,
  recoverStaleRunningJobs,
  saveJobProviderTask,
  updateJobProgress,
  updateJobProviderTaskStatus,
  type JobRecord,
  type JobType,
} from "@/lib/repositories/job-repository";

const DEFAULT_STALE_JOB_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_STORED_FILE_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_AUTH_SESSION_RETENTION_DAYS = 7;
const MAX_AUTH_SESSION_CLEANUP_BATCHES = 10;

let lastStoredFileCleanupAtMs = 0;
let lastProviderQuotaCleanupAtMs = 0;
let lastAuthSessionCleanupAtMs = 0;

const SUPPORTED_JOB_TYPES: JobType[] = [
  "crawler_discover_companies",
  "crawler_ingest",
  "crawler_search_extract",
  "batch_extract_url",
  "deep_research",
  "document_generate_quotation",
  "document_generate_contract",
  "document_generate_bid",
  "document_generate_meeting",
  "document_convert",
  "document_speech_recognize",
  "document_analyze_bid",
  "ai_discover_accounts",
  "ai_match_accounts",
  "ai_enrich_account",
];

interface CrawlerDiscoverCompaniesPayload {
  keywords: string[];
  industry?: string;
}

interface CrawlerSearchExtractPayload {
  keywords: string[];
  sites?: string[];
}

function getErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause;
  if (cause instanceof Error && cause.message) {
    return `${error.message}: ${cause.message}`;
  }
  if (cause) {
    return `${error.message}: ${String(cause)}`;
  }
  return error.message;
}

function getStaleJobTimeoutMs(): number {
  const raw = process.env.JOB_STALE_TIMEOUT_MS;
  if (!raw) return DEFAULT_STALE_JOB_TIMEOUT_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_STALE_JOB_TIMEOUT_MS;
}

function getStoredFileCleanupIntervalMs(): number {
  const raw = process.env.STORED_FILE_CLEANUP_INTERVAL_MS;
  if (!raw) return DEFAULT_STORED_FILE_CLEANUP_INTERVAL_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_STORED_FILE_CLEANUP_INTERVAL_MS;
  return parsed;
}

function getAuthSessionCleanupIntervalMs(): number {
  const raw = process.env.AUTH_SESSION_CLEANUP_INTERVAL_MS;
  if (!raw) return DEFAULT_STORED_FILE_CLEANUP_INTERVAL_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : DEFAULT_STORED_FILE_CLEANUP_INTERVAL_MS;
}

async function maybeCleanupExpiredStoredFiles(nowMs = Date.now()): Promise<number | null> {
  const interval = getStoredFileCleanupIntervalMs();
  if (interval === 0) return null;
  if (lastStoredFileCleanupAtMs && nowMs - lastStoredFileCleanupAtMs < interval) return null;

  lastStoredFileCleanupAtMs = nowMs;
  try {
    const deleted = await cleanupExpiredStoredFiles(new Date(nowMs));
    if (deleted > 0) {
      console.log(`[stored-files] cleaned ${deleted} expired files`);
    }
    return deleted;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[stored-files] cleanup failed: ${message}`);
    return null;
  }
}

async function maybeCleanupProviderQuotaLeases(nowMs = Date.now()): Promise<number | null> {
  const interval = getStoredFileCleanupIntervalMs();
  if (interval === 0) return null;
  if (lastProviderQuotaCleanupAtMs && nowMs - lastProviderQuotaCleanupAtMs < interval) return null;

  lastProviderQuotaCleanupAtMs = nowMs;
  try {
    const deleted = await cleanupProviderQuotaLeases(30);
    if (deleted > 0) console.log(`[provider-quota] cleaned ${deleted} old leases`);
    return deleted;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[provider-quota] cleanup failed: ${message}`);
    return null;
  }
}

async function maybeCleanupAuthSessions(nowMs = Date.now()): Promise<number | null> {
  const interval = getAuthSessionCleanupIntervalMs();
  if (interval === 0) return null;
  if (lastAuthSessionCleanupAtMs && nowMs - lastAuthSessionCleanupAtMs < interval) {
    return null;
  }

  lastAuthSessionCleanupAtMs = nowMs;
  const startedAt = Date.now();
  const cutoff = new Date(
    nowMs - DEFAULT_AUTH_SESSION_RETENTION_DAYS * 24 * 60 * 60 * 1000
  );
  try {
    let deleted = 0;
    for (let batch = 0; batch < MAX_AUTH_SESSION_CLEANUP_BATCHES; batch++) {
      const batchDeleted = await cleanupAuthSessionsBatch(
        cutoff,
        AUTH_SESSION_CLEANUP_BATCH_SIZE
      );
      deleted += batchDeleted;
      if (batchDeleted < AUTH_SESSION_CLEANUP_BATCH_SIZE) break;
    }
    if (deleted > 0) {
      console.log(
        `[auth-sessions] cleanup deleted=${deleted} durationMs=${Date.now() - startedAt}`
      );
    }
    return deleted;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[auth-sessions] cleanup failed durationMs=${Date.now() - startedAt}: ${message}`
    );
    return null;
  }
}

function existingProviderTaskId(job: JobRecord, resource: string): string | null {
  if (!job.providerTaskId) return null;
  if (job.providerTaskResource !== resource) {
    throw new Error(
      `Job ${job.id} provider task resource mismatch: ${job.providerTaskResource} != ${resource}`
    );
  }
  return job.providerTaskId;
}

async function persistProviderTask(job: JobRecord, resource: string, taskId: string): Promise<void> {
  const saved = await saveJobProviderTask(job.id, { taskId, resource, status: "created" });
  if (!saved) throw new Error(`Failed to persist provider task ${taskId} for job ${job.id}`);
}

async function markProviderTaskSucceeded(jobId: string, taskId: string): Promise<void> {
  const updated = await updateJobProviderTaskStatus(jobId, taskId, "succeeded");
  if (!updated) throw new Error(`Failed to mark provider task ${taskId} as succeeded`);
}

function parseCrawlerDiscoverPayload(payload: unknown): CrawlerDiscoverCompaniesPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Invalid crawler_discover_companies payload");
  }

  const data = payload as Record<string, unknown>;
  const keywords = Array.isArray(data.keywords)
    ? data.keywords.filter((keyword): keyword is string => typeof keyword === "string" && keyword.trim().length > 0)
    : [];

  if (keywords.length === 0) {
    throw new Error("crawler_discover_companies payload.keywords is required");
  }

  return {
    keywords,
    industry: typeof data.industry === "string" && data.industry.trim() ? data.industry : undefined,
  };
}

function parseCrawlerSearchExtractPayload(payload: unknown): CrawlerSearchExtractPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Invalid crawler_search_extract payload");
  }

  const data = payload as Record<string, unknown>;
  const keywords = Array.isArray(data.keywords)
    ? data.keywords
        .filter((keyword): keyword is string => typeof keyword === "string" && keyword.trim().length > 0)
        .map((keyword) => keyword.trim())
    : [];

  if (keywords.length === 0) {
    throw new Error("crawler_search_extract payload.keywords is required");
  }

  let sites: string[] | undefined;
  if (data.sites !== undefined) {
    if (!Array.isArray(data.sites)) {
      throw new Error("crawler_search_extract payload.sites must be an array");
    }
    sites = data.sites
      .filter((site): site is string => typeof site === "string" && site.trim().length > 0)
      .map((site) => site.trim());
  }

  return { keywords, sites };
}

function parseCrawlerIngestPayload(payload: unknown): CrawlerIngestPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Invalid crawler_ingest payload");
  }

  const data = payload as Record<string, unknown>;
  if (!Array.isArray(data.signals)) {
    throw new Error("crawler_ingest payload.signals must be an array");
  }

  return { signals: data.signals };
}

interface DeepResearchPayload {
  productId: string;
  preview?: boolean;
  industry?: string;
  province?: string;
}

interface DocumentTraceFields {
  templateId: string | null;
  aiRunId: string | null;
}

interface QuotationDocumentPayload extends DocumentTraceFields {
  data: QuotationData;
}

interface ContractDocumentPayload extends DocumentTraceFields {
  data: ContractData;
}

interface BidDocumentPayload extends DocumentTraceFields {
  sections: BidSection[];
  projectName: string;
  bidUnit?: string;
  bidDeadline?: string;
  templateSource: BidTemplateSource;
  templateStoredFileId: string | null;
}

interface BatchExtractUrlPayload {
  url: string;
}

interface MeetingDocumentPayload extends DocumentTraceFields {
  textContent?: string;
  storedFileId?: string;
  originalName?: string;
  mimeType?: string;
  analysisMode: AnalysisMode;
}

interface DocumentConvertPayload {
  storedFileId: string;
  target: TargetFormat;
  originalName: string;
  mimeType: string;
}

interface DocumentSpeechRecognizePayload {
  storedFileId: string;
  originalName: string;
  mimeType: string;
  transcriptMode: AnalysisMode;
}

interface DocumentAnalyzeBidPayload {
  storedFileId: string;
  companyInfo: string;
  originalName: string;
  mimeType: string;
  templateStoredFileId: string | null;
  templateOriginalName: string;
  templateMimeType: string;
}

const VALID_CONVERT_TARGETS: TargetFormat[] = ["txt", "docx", "html"];

function jobAuthContext(job: JobRecord): AuthContext {
  if (!job.userId) {
    throw new Error(`Job ${job.id} (${job.type}) requires an authenticated userId`);
  }
  return {
    organizationId: job.organizationId,
    userId: job.userId,
    role: "system",
  };
}

function requireJobUserId(job: JobRecord): string {
  return jobAuthContext(job).userId;
}

function parseDeepResearchPayload(payload: unknown): DeepResearchPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Invalid deep_research payload");
  }

  const data = payload as Record<string, unknown>;
  const productId = typeof data.productId === "string" ? data.productId.trim() : "";
  if (!productId) {
    throw new Error("deep_research payload.productId is required");
  }
  if (data.industry !== undefined && typeof data.industry !== "string") {
    throw new Error("deep_research payload.industry must be a string");
  }
  if (data.province !== undefined && typeof data.province !== "string") {
    throw new Error("deep_research payload.province must be a string");
  }

  return {
    productId,
    preview: typeof data.preview === "boolean" ? data.preview : undefined,
    industry: typeof data.industry === "string" ? data.industry.trim() || undefined : undefined,
    province: typeof data.province === "string" ? data.province.trim() || undefined : undefined,
  };
}

function asObject(payload: unknown, jobType: string): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(`Invalid ${jobType} payload`);
  }
  return payload as Record<string, unknown>;
}

function parseDocumentTraceFields(data: Record<string, unknown>): DocumentTraceFields {
  const pick = (key: string) =>
    typeof data[key] === "string" && data[key].trim() ? data[key].trim() : null;
  return { templateId: pick("templateId"), aiRunId: pick("aiRunId") };
}

function parseQuotationDocumentPayload(payload: unknown): QuotationDocumentPayload {
  const data = asObject(payload, "document_generate_quotation");
  if (!data.data || typeof data.data !== "object" || Array.isArray(data.data)) {
    throw new Error("document_generate_quotation payload.data is required");
  }
  return { data: data.data as QuotationData, ...parseDocumentTraceFields(data) };
}

function parseContractDocumentPayload(payload: unknown): ContractDocumentPayload {
  const data = asObject(payload, "document_generate_contract");
  if (!data.data || typeof data.data !== "object" || Array.isArray(data.data)) {
    throw new Error("document_generate_contract payload.data is required");
  }
  return { data: data.data as ContractData, ...parseDocumentTraceFields(data) };
}

function parseBidDocumentPayload(payload: unknown): BidDocumentPayload {
  const data = asObject(payload, "document_generate_bid");
  if (!isBidSectionArray(data.sections)) {
    throw new Error("document_generate_bid payload.sections is required");
  }
  const sections = data.sections;
  const projectName = typeof data.projectName === "string" && data.projectName.trim()
    ? data.projectName.trim()
    : "投标文件";
  const templateSource = parseBidTemplateSource(data.templateSource);
  return {
    sections,
    projectName,
    bidUnit: typeof data.bidUnit === "string" ? data.bidUnit : undefined,
    bidDeadline: typeof data.bidDeadline === "string" ? data.bidDeadline : undefined,
    templateSource,
    templateStoredFileId: typeof data.templateStoredFileId === "string"
      ? data.templateStoredFileId.trim() || null
      : null,
    ...parseDocumentTraceFields(data),
  };
}

function parseBatchExtractUrlPayload(payload: unknown): BatchExtractUrlPayload {
  const data = asObject(payload, "batch_extract_url");
  const url = typeof data.url === "string" ? data.url.trim() : "";
  if (!url) {
    throw new Error("batch_extract_url payload.url is required");
  }
  return { url };
}

function parseMeetingDocumentPayload(payload: unknown): MeetingDocumentPayload {
  const data = asObject(payload, "document_generate_meeting");
  const textContent = typeof data.textContent === "string" ? data.textContent.trim() : "";
  const storedFileId = typeof data.storedFileId === "string" ? data.storedFileId.trim() : "";
  const modeRaw = data.analysisMode;
  const analysisMode: AnalysisMode =
    modeRaw === "analysis" ? "analysis" : "minutes";

  const trace = parseDocumentTraceFields(data);

  if (textContent.length >= 10) {
    return { textContent, analysisMode, ...trace };
  }
  if (storedFileId) {
    return {
      storedFileId,
      originalName: typeof data.originalName === "string" ? data.originalName : "",
      mimeType: typeof data.mimeType === "string" ? data.mimeType : "",
      analysisMode,
      ...trace,
    };
  }
  throw new Error("document_generate_meeting payload.textContent or storedFileId is required");
}

async function extractMeetingText(
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<string> {
  const lower = originalName.toLowerCase();
  if (isSupportedAudioFileName(lower) || mimeType.startsWith("audio/")) {
    throw new Error("音频文件请先使用语音识别转写");
  }

  const arrayBuffer = toArrayBuffer(buffer);

  if (lower.endsWith(".docx") || mimeType.includes("wordprocessingml")) {
    const { parseDocxTemplate } = await import("@/lib/document/template-parser");
    const parsed = await parseDocxTemplate(arrayBuffer);
    return parsed.text;
  }
  if (lower.endsWith(".txt") || lower.endsWith(".md") || mimeType.startsWith("text/")) {
    return buffer.toString("utf-8");
  }
  throw new Error(`document_generate_meeting unsupported file type: ${originalName}`);
}

function parseDocumentConvertPayload(payload: unknown): DocumentConvertPayload {
  const data = asObject(payload, "document_convert");
  const storedFileId = typeof data.storedFileId === "string" ? data.storedFileId.trim() : "";
  if (!storedFileId) {
    throw new Error("document_convert payload.storedFileId is required");
  }
  const targetRaw = typeof data.target === "string" ? data.target : "";
  if (!VALID_CONVERT_TARGETS.includes(targetRaw as TargetFormat)) {
    throw new Error("document_convert payload.target is required");
  }
  return {
    storedFileId,
    target: targetRaw as TargetFormat,
    originalName: typeof data.originalName === "string" ? data.originalName : "",
    mimeType: typeof data.mimeType === "string" ? data.mimeType : "",
  };
}

function parseDocumentSpeechRecognizePayload(payload: unknown): DocumentSpeechRecognizePayload {
  const data = asObject(payload, "document_speech_recognize");
  const storedFileId = typeof data.storedFileId === "string" ? data.storedFileId.trim() : "";
  if (!storedFileId) {
    throw new Error("document_speech_recognize payload.storedFileId is required");
  }
  return {
    storedFileId,
    originalName: typeof data.originalName === "string" ? data.originalName : "",
    mimeType: typeof data.mimeType === "string" ? data.mimeType : "",
    transcriptMode: data.transcriptMode === "analysis" ? "analysis" : "minutes",
  };
}

function parseDocumentAnalyzeBidPayload(payload: unknown): DocumentAnalyzeBidPayload {
  const data = asObject(payload, "document_analyze_bid");
  const storedFileId = typeof data.storedFileId === "string" ? data.storedFileId.trim() : "";
  if (!storedFileId) {
    throw new Error("document_analyze_bid payload.storedFileId is required");
  }
  return {
    storedFileId,
    companyInfo: typeof data.companyInfo === "string" ? data.companyInfo : "",
    originalName: typeof data.originalName === "string" ? data.originalName : "",
    mimeType: typeof data.mimeType === "string" ? data.mimeType : "",
    templateStoredFileId: typeof data.templateStoredFileId === "string"
      ? data.templateStoredFileId.trim() || null
      : null,
    templateOriginalName: typeof data.templateOriginalName === "string"
      ? data.templateOriginalName
      : "",
    templateMimeType: typeof data.templateMimeType === "string" ? data.templateMimeType : "",
  };
}

async function extractBidText(
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<string> {
  const lower = originalName.toLowerCase();
  const arrayBuffer = toArrayBuffer(buffer);

  if (lower.endsWith(".pdf") || mimeType === "application/pdf") {
    const { parsePdfTemplate } = await import("@/lib/document/template-parser");
    const parsed = await parsePdfTemplate(arrayBuffer);
    return parsed.text;
  }
  if (lower.endsWith(".txt") || mimeType.startsWith("text/plain")) {
    const { parseTextFile } = await import("@/lib/document/template-parser");
    return parseTextFile(arrayBuffer);
  }
  throw new Error(`document_analyze_bid unsupported file type: ${originalName}`);
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
}

async function runCrawlerDiscoverCompanies(job: JobRecord): Promise<unknown> {
  const payload = parseCrawlerDiscoverPayload(job.payloadJson);

  await updateJobProgress(job.id, 10, "准备搜索关键词");
  const result = await discoverCompaniesFromWeb(
    payload.keywords,
    job.organizationId,
    requireJobUserId(job),
    payload.industry
  );
  await updateJobProgress(job.id, 90, "保存候选情报");

  return result;
}

async function runCrawlerSearchExtract(job: JobRecord): Promise<unknown> {
  const payload = parseCrawlerSearchExtractPayload(job.payloadJson);

  await updateJobProgress(job.id, 10, "准备搜索");
  const result = await searchAndExtract(
    payload.keywords,
    job.organizationId,
    requireJobUserId(job),
    payload.sites
  );
  await updateJobProgress(job.id, 90, "保存候选情报");

  return result;
}

async function runCrawlerIngest(job: JobRecord): Promise<unknown> {
  const { signals } = parseCrawlerIngestPayload(job.payloadJson);

  await updateJobProgress(job.id, 10, "读取爬虫信号");
  const result = await ingestCrawlerSignals(job.organizationId, { signals });
  await updateJobProgress(job.id, 90, "爬虫入库完成");

  return { type: "crawler_ingest", ...result };
}

async function runDeepResearch(job: JobRecord): Promise<unknown> {
  const payload = parseDeepResearchPayload(job.payloadJson);

  await updateJobProgress(job.id, 10, "准备深度研究");
  const result = await deepResearch(
    payload.productId,
    job.organizationId,
    requireJobUserId(job),
    payload.preview ?? true,
    { industry: payload.industry, province: payload.province }
  );
  await updateJobProgress(job.id, 90, "保存研究结果");

  return result;
}

interface AiDiscoverAccountsPayload {
  productId: string;
  count: number;
}

interface AiMatchAccountsPayload {
  productId: string;
}

interface AiEnrichAccountPayload {
  accountId: string;
}

function parseAiDiscoverAccountsPayload(payload: unknown): AiDiscoverAccountsPayload {
  const data = asObject(payload, "ai_discover_accounts");
  const productId = typeof data.productId === "string" ? data.productId.trim() : "";
  if (!productId) {
    throw new Error("ai_discover_accounts payload.productId is required");
  }
  const count = typeof data.count === "number" && data.count > 0 ? data.count : 5;
  return { productId, count };
}

function parseAiMatchAccountsPayload(payload: unknown): AiMatchAccountsPayload {
  const data = asObject(payload, "ai_match_accounts");
  const productId = typeof data.productId === "string" ? data.productId.trim() : "";
  if (!productId) {
    throw new Error("ai_match_accounts payload.productId is required");
  }
  return { productId };
}

function parseAiEnrichAccountPayload(payload: unknown): AiEnrichAccountPayload {
  const data = asObject(payload, "ai_enrich_account");
  const accountId = typeof data.accountId === "string" ? data.accountId.trim() : "";
  if (!accountId) {
    throw new Error("ai_enrich_account payload.accountId is required");
  }
  return { accountId };
}

async function runAiDiscoverAccounts(job: JobRecord): Promise<unknown> {
  const payload = parseAiDiscoverAccountsPayload(job.payloadJson);

  await updateJobProgress(job.id, 10, "准备执行");
  await updateJobProgress(job.id, 40, "AI 执行中");
  const result = await discoverAccountsForProduct(
    payload.productId,
    job.organizationId,
    requireJobUserId(job),
    payload.count
  );
  await updateJobProgress(job.id, 90, "保存结果完成");

  return { type: "ai_discover_accounts", result };
}

async function runAiMatchAccounts(job: JobRecord): Promise<unknown> {
  const payload = parseAiMatchAccountsPayload(job.payloadJson);

  await updateJobProgress(job.id, 10, "准备执行");
  await updateJobProgress(job.id, 40, "AI 执行中");
  const results = await matchProductToAccounts(
    payload.productId,
    job.organizationId,
    requireJobUserId(job)
  );
  await updateJobProgress(job.id, 90, "保存结果完成");

  return { type: "ai_match_accounts", matches: results.length, results };
}

async function runAiEnrichAccount(job: JobRecord): Promise<unknown> {
  const payload = parseAiEnrichAccountPayload(job.payloadJson);

  await updateJobProgress(job.id, 10, "准备执行");
  await updateJobProgress(job.id, 40, "AI 执行中");
  const result = await enrichAccount(
    payload.accountId,
    job.organizationId,
    requireJobUserId(job)
  );
  await updateJobProgress(job.id, 90, "保存结果完成");

  return { type: "ai_enrich_account", result };
}

async function runQuotationDocument(job: JobRecord): Promise<unknown> {
  const payload = parseQuotationDocumentPayload(job.payloadJson);

  await updateJobProgress(job.id, 20, "生成报价单文件");
  const result = await generateQuotationDocument({
    organizationId: job.organizationId,
    userId: job.userId,
    jobId: job.id,
    sourceType: "job",
    templateId: payload.templateId,
    aiRunId: payload.aiRunId,
    data: payload.data,
  });
  await updateJobProgress(job.id, 90, "保存报价单历史记录");

  return toJobDocumentResult(result.document);
}

async function runContractDocument(job: JobRecord): Promise<unknown> {
  const payload = parseContractDocumentPayload(job.payloadJson);

  await updateJobProgress(job.id, 20, "生成合同文件");
  const result = await generateContractDocument({
    organizationId: job.organizationId,
    userId: job.userId,
    jobId: job.id,
    sourceType: "job",
    templateId: payload.templateId,
    aiRunId: payload.aiRunId,
    data: payload.data,
  });
  await updateJobProgress(job.id, 90, "保存合同历史记录");

  return toJobDocumentResult(result.document);
}

async function runBidDocument(job: JobRecord): Promise<unknown> {
  const payload = parseBidDocumentPayload(job.payloadJson);

  await updateJobProgress(job.id, 20, "生成投标文件");
  const result = await generateBidDocument({
    organizationId: job.organizationId,
    userId: job.userId,
    jobId: job.id,
    sourceType: "job",
    templateId: payload.templateId,
    aiRunId: payload.aiRunId,
    sections: payload.sections,
    projectName: payload.projectName,
    bidUnit: payload.bidUnit,
    bidDeadline: payload.bidDeadline,
    templateSource: payload.templateSource,
    templateStoredFileId: payload.templateStoredFileId,
  });
  await updateJobProgress(job.id, 90, "保存投标文件历史记录");

  return toJobDocumentResult(result.document);
}

async function runBatchExtractUrl(job: JobRecord): Promise<unknown> {
  const payload = parseBatchExtractUrlPayload(job.payloadJson);

  await updateJobProgress(job.id, 10, "抓取网页内容");
  const result = await batchExtractUrl(
    job.organizationId,
    requireJobUserId(job),
    payload.url
  );
  await updateJobProgress(job.id, 90, "保存候选情报");

  return result;
}

async function runMeetingDocument(job: JobRecord): Promise<unknown> {
  const payload = parseMeetingDocumentPayload(job.payloadJson);
  const userId = requireJobUserId(job);
  let textContent = payload.textContent || "";

  if (payload.storedFileId) {
    const ctx = jobAuthContext(job);
    await updateJobProgress(job.id, 10, "读取会议文件");
    const stored = await getStoredFile(ctx, payload.storedFileId);
    if (!stored) {
      throw new Error(`document_generate_meeting stored file not found: ${payload.storedFileId}`);
    }
    await updateJobProgress(job.id, 15, "解析会议文件");
    textContent = await extractMeetingText(
      stored.fileBuffer,
      payload.originalName || stored.originalName,
      payload.mimeType || stored.mimeType
    );
  }

  if (!textContent || textContent.length < 10) {
    throw new Error("document_generate_meeting text content is too short (min 10 characters)");
  }

  await updateJobProgress(job.id, 20, "分析会议内容");
  const result = await generateMeetingDocument({
    organizationId: job.organizationId,
    userId,
    jobId: job.id,
    sourceType: "job",
    templateId: payload.templateId,
    aiRunId: payload.aiRunId,
    textContent,
    analysisMode: payload.analysisMode,
  });
  await updateJobProgress(job.id, 90, "保存会议纪要");

  return toJobDocumentResult(result.document);
}

async function runDocumentConvert(job: JobRecord): Promise<unknown> {
  const payload = parseDocumentConvertPayload(job.payloadJson);
  const ctx = jobAuthContext(job);

  await updateJobProgress(job.id, 10, "读取上传文件");
  const stored = await getStoredFile(ctx, payload.storedFileId);
  if (!stored) {
    throw new Error(`document_convert stored file not found: ${payload.storedFileId}`);
  }

  await updateJobProgress(job.id, 30, "调用讯飞文档转换");
  let providerTaskId = existingProviderTaskId(job, "iflytek_document");
  const converted = await convertDocumentViaIflytek({
    userId: requireJobUserId(job),
    jobId: job.id,
    providerTaskId,
    onProviderTaskCreated: async (taskId) => {
      await persistProviderTask(job, "iflytek_document", taskId);
      providerTaskId = taskId;
    },
    buffer: stored.fileBuffer,
    originalName: payload.originalName || stored.originalName,
    mimeType: payload.mimeType || stored.mimeType,
    targetFormat: payload.target,
  });
  if (providerTaskId) {
    await markProviderTaskSucceeded(job.id, providerTaskId);
  }

  await updateJobProgress(job.id, 80, "保存转换结果");
  const document = await createGeneratedDocument({
    organizationId: job.organizationId,
    userId: job.userId,
    jobId: job.id,
    documentType: "converted",
    sourceType: "job",
    title: converted.fileName,
    fileName: converted.fileName,
    fileMimeType: converted.contentType,
    fileBuffer: converted.buffer,
    metadata: {
      target: payload.target,
      storedFileId: payload.storedFileId,
      originalName: payload.originalName || stored.originalName,
    },
  });

  await updateJobProgress(job.id, 90, "转换完成");
  return toJobDocumentResult(document);
}

async function runDocumentSpeechRecognize(job: JobRecord): Promise<unknown> {
  const payload = parseDocumentSpeechRecognizePayload(job.payloadJson);
  const ctx = jobAuthContext(job);

  await updateJobProgress(job.id, 10, "读取上传音频");
  const stored = await getStoredFile(ctx, payload.storedFileId);
  if (!stored) {
    throw new Error(`document_speech_recognize stored file not found: ${payload.storedFileId}`);
  }

  const originalName = payload.originalName || stored.originalName;
  await updateJobProgress(job.id, 30, "调用讯飞语音识别");
  let providerTaskId = existingProviderTaskId(job, "iflytek_speech");
  const result = await speechToText(toArrayBuffer(stored.fileBuffer), originalName, {
    userId: requireJobUserId(job),
    jobId: job.id,
    providerTaskId,
    onProviderTaskCreated: async (taskId) => {
      await persistProviderTask(job, "iflytek_speech", taskId);
      providerTaskId = taskId;
    },
    transcriptMode: payload.transcriptMode,
  });
  if (providerTaskId) {
    await markProviderTaskSucceeded(job.id, providerTaskId);
  }

  await updateJobProgress(job.id, 90, "识别完成");
  return {
    text: result.text,
    confidence: result.confidence,
    duration: result.duration,
    storedFileId: payload.storedFileId,
    fileName: originalName,
    transcriptMode: payload.transcriptMode,
  };
}

async function runDocumentAnalyzeBid(job: JobRecord): Promise<unknown> {
  const payload = parseDocumentAnalyzeBidPayload(job.payloadJson);
  const ctx = jobAuthContext(job);
  const startedAt = Date.now();
  const generationWarnings: string[] = [];
  const aiRunIds: string[] = [];

  await updateJobProgress(job.id, 10, "读取招标文件");
  const stored = await getStoredFile(ctx, payload.storedFileId);
  if (!stored) {
    throw new Error(`document_analyze_bid stored file not found: ${payload.storedFileId}`);
  }

  const originalName = payload.originalName || stored.originalName;
  const mimeType = payload.mimeType || stored.mimeType;
  const isBidDocx = originalName.toLowerCase().endsWith(".docx")
    || mimeType.includes("wordprocessingml");
  const isBidPdf = originalName.toLowerCase().endsWith(".pdf")
    || mimeType === "application/pdf";

  await updateJobProgress(job.id, 30, "解析招标文件");
  let bidDocument: RawBidTemplateDocument | null = null;
  let tenderText: string;
  if (isBidDocx) {
    bidDocument = parseBidDocxOoxml(toArrayBuffer(stored.fileBuffer), "embedded");
    tenderText = rawBidDocumentText(bidDocument);
  } else {
    tenderText = await extractBidText(stored.fileBuffer, originalName, mimeType);
  }
  if (!tenderText || tenderText.length < 50) {
    throw new Error("招标文件无法提取足够的文字，请确认文件不是扫描件或空文件");
  }

  let templateDocument: RawBidTemplateDocument | null = null;
  let fallbackRegion: BidTemplateRegion | null = null;
  if (payload.templateStoredFileId) {
    await updateJobProgress(job.id, 40, "读取投标模板");
    const templateStored = await getStoredFile(ctx, payload.templateStoredFileId);
    if (!templateStored || templateStored.purpose !== "bid_template_input") {
      throw new Error(`document_analyze_bid template file not found: ${payload.templateStoredFileId}`);
    }
    const templateName = payload.templateOriginalName || templateStored.originalName;
    const templateMimeType = payload.templateMimeType || templateStored.mimeType;
    if (!templateName.toLowerCase().endsWith(".docx") && !templateMimeType.includes("wordprocessingml")) {
      throw new Error("投标模板仅支持 DOCX 文件");
    }
    templateDocument = parseBidDocxOoxml(
      toArrayBuffer(templateStored.fileBuffer),
      "separate_upload"
    );
    if (templateDocument.nodes.length) {
      fallbackRegion = {
        startNodeId: templateDocument.nodes[0].nodeId,
        endNodeId: templateDocument.nodes[templateDocument.nodes.length - 1].nodeId,
      };
    }
  } else if (bidDocument) {
    fallbackRegion = findEmbeddedBidTemplateRegion(bidDocument);
    templateDocument = bidDocument;
  } else if (isBidPdf) {
    generationWarnings.push("PDF 内嵌模板暂不支持识别，本次使用系统默认投标模板");
  }

  let templateDefinition: BidTemplateDefinition;
  if (templateDocument) {
    await updateJobProgress(job.id, 48, "AI 标注投标模板语义");
    let semanticMap: BidTemplateSemanticMap = {
      templateRegions: fallbackRegion ? [fallbackRegion] : [],
      nodeSemantics: {},
    };
    try {
      const analyzed = await analyzeBidTemplateSemantics({
        document: templateDocument,
        candidateRegion: fallbackRegion,
        organizationId: job.organizationId,
        userId: requireJobUserId(job),
        jobId: job.id,
      });
      semanticMap = analyzed.data;
      aiRunIds.push(analyzed.aiRunId);
    } catch (error) {
      const message = getErrorMessage(error);
      generationWarnings.push(`模板语义分析失败，已按 DOCX 原始顺序降级解析：${message}`);
      console.error(`[bid] template semantic fallback jobId=${job.id}: ${message}`);
    }
    const validatedMap = validateTemplateSemanticMap(
      templateDocument,
      semanticMap,
      fallbackRegion
    );
    if (validatedMap.templateRegions.length) {
      templateDefinition = compileBidTemplateDefinition(templateDocument, validatedMap);
      generationWarnings.push(...templateDefinition.warnings);

      if (templateDefinition.source === "embedded" && bidDocument) {
        const withoutTemplate = rawBidDocumentText(bidDocument, validatedMap.templateRegions);
        if (withoutTemplate.trim().length >= 50) {
          tenderText = withoutTemplate;
        } else {
          generationWarnings.push("识别出的 DOCX 内嵌模板区域覆盖范围异常，已改用系统默认模板");
          templateDefinition = createSystemDefaultBidTemplate();
        }
      }
    } else {
      templateDefinition = createSystemDefaultBidTemplate();
      if (templateDocument.source === "embedded") {
        generationWarnings.push("DOCX 中未识别到内嵌投标模板，本次使用系统默认模板");
      }
    }
  } else {
    templateDefinition = createSystemDefaultBidTemplate();
  }

  const fillContract = createBidFillContract(templateDefinition);
  await updateJobProgress(job.id, 68, "AI 提取投标内容");
  let fillResult = emptyBidFillResult();
  try {
    const filled = await fillBidTemplateContent({
      tenderText,
      companyInfo: payload.companyInfo,
      contract: fillContract,
      organizationId: job.organizationId,
      userId: requireJobUserId(job),
      jobId: job.id,
    });
    aiRunIds.push(filled.aiRunId);
    const sanitized = sanitizeBidFillResult(fillContract, filled.data);
    fillResult = sanitized.data;
    generationWarnings.push(...sanitized.warnings);
  } catch (error) {
    const message = getErrorMessage(error);
    generationWarnings.push(`内容提取失败，已保留完整模板并将字段标记为待填写：${message}`);
    console.error(`[bid] content fill fallback jobId=${job.id}: ${message}`);
  }

  const bidData = assembleFilledBid(templateDefinition, fillResult);
  const tableCount = templateDefinition.sections.reduce(
    (total, section) => total + section.nodes.filter((node) => node.type === "table").length,
    0
  );
  console.info(
    `[bid] analyze complete jobId=${job.id} source=${templateDefinition.source} sections=${templateDefinition.sections.length} tables=${tableCount} aiRuns=${aiRunIds.length} durationMs=${Date.now() - startedAt}`
  );

  await updateJobProgress(job.id, 90, "分析完成");
  return {
    ...bidData,
    aiRunId: aiRunIds[aiRunIds.length - 1],
    aiRunIds,
    templateId: templateDefinition.templateId,
    templateSource: templateDefinition.source,
    templateStoredFileId: payload.templateStoredFileId,
    formatRequirements: `${templateDefinition.sections.length} 个章节，${tableCount} 个表格；当前阶段保证章节、静态文字和表格结构正确`,
    generationWarnings,
  };
}

export async function runNextJob(
  workerId = `worker-${process.pid || "local"}`
): Promise<{ processed: boolean; jobId?: string; status?: string }> {
  await recoverStaleRunningJobs(getStaleJobTimeoutMs());
  await maybeCleanupExpiredStoredFiles();
  await maybeCleanupProviderQuotaLeases();
  await maybeCleanupAuthSessions();
  const job = await claimNextJob(workerId, SUPPORTED_JOB_TYPES);
  if (!job) return { processed: false };

  try {
    let result: unknown;

    switch (job.type) {
      case "crawler_discover_companies":
        result = await runCrawlerDiscoverCompanies(job);
        break;
      case "crawler_search_extract":
        result = await runCrawlerSearchExtract(job);
        break;
      case "crawler_ingest":
        result = await runCrawlerIngest(job);
        break;
      case "deep_research":
        result = await runDeepResearch(job);
        break;
      case "document_generate_quotation":
        result = await runQuotationDocument(job);
        break;
      case "document_generate_contract":
        result = await runContractDocument(job);
        break;
      case "document_generate_bid":
        result = await runBidDocument(job);
        break;
      case "batch_extract_url":
        result = await runBatchExtractUrl(job);
        break;
      case "document_generate_meeting":
        result = await runMeetingDocument(job);
        break;
      case "document_convert":
        result = await runDocumentConvert(job);
        break;
      case "document_speech_recognize":
        result = await runDocumentSpeechRecognize(job);
        break;
      case "document_analyze_bid":
        result = await runDocumentAnalyzeBid(job);
        break;
      case "ai_discover_accounts":
        result = await runAiDiscoverAccounts(job);
        break;
      case "ai_match_accounts":
        result = await runAiMatchAccounts(job);
        break;
      case "ai_enrich_account":
        result = await runAiEnrichAccount(job);
        break;
      default:
        throw new Error(`Unsupported job type: ${job.type}`);
    }

    const completed = await completeJob(job.id, result);
    if (!completed) {
      return { processed: true, jobId: job.id, status: "not_updated" };
    }
    return { processed: true, jobId: job.id, status: "succeeded" };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error(`Job ${job.id} (${job.type}) failed: ${errorMessage}`);
    const failed = error instanceof ProviderQuotaExceededError && error.reason === "quota"
      ? await failJob(job.id, errorMessage, { retryable: false })
      : await failJob(job.id, errorMessage);
    if (!failed) {
      return { processed: true, jobId: job.id, status: "not_updated" };
    }
    return { processed: true, jobId: job.id, status: "failed" };
  }
}
