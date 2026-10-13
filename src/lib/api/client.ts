/**
 * 前端 API 客户端 — 类型安全的 fetch 封装
 *
 * Cookie session（credentials: include）+ 401 时自动 Refresh 并重试一次。
 * 与 saleseye-mobile/src/api/client.ts 保持端点同步。
 */

import { createApiResponseError } from "@/lib/api/api-error";
import { authenticatedFetch } from "@/lib/api/authenticated-fetch";
import type { Account, Contact, Product, Project, StrategyCard, Pipeline } from "@/lib/utils";

// ============================================================
// 基础请求工具
// ============================================================

const BASE = "";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await authenticatedFetch(`${BASE}${url}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    throw await createApiResponseError(res, `HTTP ${res.status}`);
  }

  return res.json();
}

function get<T>(url: string): Promise<T>      { return request<T>(url); }
function post<T>(url: string, body?: unknown): Promise<T> { return request<T>(url, { method: "POST", body: body ? JSON.stringify(body) : undefined }); }
function patch<T>(url: string, body?: unknown): Promise<T> { return request<T>(url, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }); }
function put<T>(url: string, body?: unknown): Promise<T>   { return request<T>(url, { method: "PUT", body: body ? JSON.stringify(body) : undefined }); }
function del<T>(url: string): Promise<T>     { return request<T>(url, { method: "DELETE" }); }

// ============================================================
// 通用类型
// ============================================================

/** 输入数据 — 使用 Record 替代 any，保持灵活性同时避免 any 扩散 */
export type ApiData = Record<string, unknown>;

/** AI 操作通用返回 */
export interface AiResult {
  success: boolean;
  [key: string]: unknown;
}

// ============================================================
// Products
// ============================================================
export const productsApi = {
  list:   ()                          => get<Product[]>("/api/products"),
  get:    (id: string)                => get<Product>(`/api/products/${id}`),
  create: (data: ApiData)             => post<Product>("/api/products", data),
  update: (id: string, data: ApiData) => patch<Product>(`/api/products/${id}`, data),
  delete: (id: string)                => del<{ success: boolean }>(`/api/products/${id}`),
};

// ============================================================
// Accounts
// ============================================================
export const accountsApi = {
  list:   ()                          => get<Account[]>("/api/accounts"),
  get:    (id: string)                => get<Account>(`/api/accounts/${id}`),
  create: (data: ApiData)             => post<Account>("/api/accounts", data),
  update: (id: string, data: ApiData) => patch<Account>(`/api/accounts/${id}`, data),
};

// ============================================================
// Projects
// ============================================================
export const projectsApi = {
  list:    ()                          => get<Project[]>("/api/projects"),
  get:     (id: string)                => get<Project>(`/api/projects/${id}`),
  create:  (data: ApiData)             => post<Project>("/api/projects", data),
  update:  (id: string, data: ApiData) => patch<Project>(`/api/projects/${id}`, data),
  delete:  (id: string)                => del<{ success: boolean }>(`/api/projects/${id}`),
  cleanup: (mode = "clean")            => post<{ purgedCount: number }>("/api/projects/cleanup", { mode }),
};

// ============================================================
// Pipeline
// ============================================================
export const pipelineApi = {
  list:   ()                          => get<Pipeline[]>("/api/pipeline"),
  create: (data: ApiData)             => post<Pipeline>("/api/pipeline", data),
  update: (id: string, data: ApiData) => patch<Pipeline>(`/api/pipeline/${id}`, data),
};

// ============================================================
// Contacts
// ============================================================
export const contactsApi = {
  create: (data: ApiData)             => post<Contact>("/api/contacts", data),
  update: (id: string, data: ApiData) => patch<Contact>(`/api/contacts/${id}`, data),
  delete: (id: string)                => del<{ success: boolean }>(`/api/contacts/${id}`),
};

// ============================================================
// Strategy Cards
// ============================================================
export const strategyCardsApi = {
  list:   ()                          => get<StrategyCard[]>("/api/strategy-cards"),
  update: (id: string, data: ApiData) => patch<StrategyCard>(`/api/strategy-cards/${id}`, data),
};

// ============================================================
// Decision Chains
// ============================================================
export const decisionChainsApi = {
  update: (id: string, data: ApiData) => patch<Record<string, unknown>>(`/api/decision-chains/${id}`, data),
};

// ============================================================
// Jobs
// ============================================================
export interface JobRecord {
  id: string;
  status: string;
  progress?: number;
  currentStep?: string | null;
  errorMessage?: string | null;
  resultJson?: unknown;
  type?: string;
}

export interface JobCreateResponse {
  jobId: string;
  job: JobRecord;
  queued?: boolean;
}

export const jobsApi = {
  create: (type: string, payload: unknown, priority?: number) =>
    post<JobCreateResponse>("/api/jobs", { type, payload, priority }),

  get: (id: string) =>
    get<{ job: JobRecord; done: boolean; ok: boolean }>(`/api/jobs/${id}`),
};

// ============================================================
// AI
// ============================================================
export const aiApi = {
  discover: (productId: string, count = 5) =>
    post<JobCreateResponse>("/api/ai/discover", { productId, count }),

  match: (productId: string) =>
    post<JobCreateResponse>("/api/ai/match", { productId }),

  deepResearch: (productId: string) =>
    post<AiResult>("/api/ai/deep-research", { productId }),

  getLatestReport: (productId?: string) =>
    get<AiResult>(`/api/ai/deep-research${productId ? `?productId=${productId}` : ""}`),

  saveResearchAccounts: (selection: { jobId?: string; reportId?: string; selectedIndexes: number[] }) =>
    put<AiResult>("/api/ai/deep-research", selection),

  enrichAccount: (accountId: string) =>
    post<JobCreateResponse>("/api/ai/enrich-account", { accountId }),

  /** Enqueues batch_extract_url job (async). Poll with jobsApi.get(jobId). */
  batchExtract: (url: string) =>
    post<JobCreateResponse>("/api/ai/batch-extract", { url }),
};

// ============================================================
// Crawler
// ============================================================
export const crawlerApi = {
  search: (keywords: string[], sites?: string[]) =>
    post<AiResult>("/api/crawler/search", { keywords, sites }),
};

// ============================================================
// Alerts
// ============================================================
export const alertsApi = {
  list: () => get<{ count: number; alerts: ApiData[] }>("/api/alerts"),
};

// ============================================================
// Settings（注意：settings API 路由已被移除，以下方法将返回 404）
// @deprecated 使用 next.config 或环境变量配置
// ============================================================
export const settingsApi = {
  getApiKeyStatus: () =>
    get<{ configured: boolean }>("/api/settings/api-key"),
  saveApiKey: (apiKey: string) =>
    post<{ success: boolean }>("/api/settings/api-key", { apiKey }),
  testConnection: (apiKey: string) =>
    post<{ success: boolean; latency: number; modelCount: number }>(
      "/api/settings/test-connection",
      { apiKey }
    ),
};
