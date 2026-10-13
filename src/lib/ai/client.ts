import OpenAI from "openai";
import { DEFAULT_PROVIDER, getProvider } from "./providers";

// AI 客户端单例
let client: OpenAI | null = null;
let _currentProvider: string | null = null;

/** AI API 超时时间（毫秒） */
const AI_TIMEOUT = 90_000;
/** 最大重试次数 */
const AI_MAX_RETRIES = 3;
/** 重试基础延迟（毫秒） */
const AI_RETRY_BASE_DELAY = 1_000;

function buildClient(apiKey: string, baseURL: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL,
    timeout: AI_TIMEOUT,
    maxRetries: 0, // 我们自己控制重试逻辑
  });
}

/**
 * 带指数退避的 AI API 调用重试包装器
 * 仅对 5xx 服务端错误和网络超时进行重试
 */
export async function withRetry<T>(fn: () => Promise<T>, label?: string): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= AI_MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const retryError = error as {
        status?: number;
        statusCode?: number;
        response?: { status?: number };
        code?: string;
        message?: string;
        type?: string;
      };
      lastError = error instanceof Error ? error : new Error(String(error));
      // 仅对可重试的错误进行重试：5xx、网络错误、超时
      const status = retryError.status || retryError.statusCode || retryError.response?.status;
      const isRetryable =
        (status && status >= 500 && status < 600) ||
        retryError.code === "ECONNRESET" ||
        retryError.code === "ETIMEDOUT" ||
        retryError.code === "ECONNREFUSED" ||
        retryError.message?.includes("timeout") ||
        retryError.message?.includes("rate_limit") ||
        retryError.type === "request_timeout";

      if (!isRetryable || attempt === AI_MAX_RETRIES) break;

      const delay = AI_RETRY_BASE_DELAY * Math.pow(2, attempt - 1);
      console.warn(`⚠ AI 调用${label ? ` [${label}]` : ""} 失败 (尝试 ${attempt}/${AI_MAX_RETRIES})，${delay}ms 后重试: ${retryError.message || String(error)}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

/** 获取当前使用的模型名称（根据提供商动态选择） */
function getModelName(type: "fast" | "reasoning"): string {
  const configuredModel = process.env.AI_MODEL?.trim();
  if (configuredModel) return configuredModel;

  const provider = getProvider(_currentProvider || DEFAULT_PROVIDER);
  return type === "fast" ? provider.models.fast : provider.models.reasoning;
}

/** 异步初始化 AI 客户端（仅使用环境变量，支持 DEEPSEEK_BASE_URL 覆盖） */
export async function ensureClient(): Promise<OpenAI> {
  if (client) return client;

  const envKey = process.env.DEEPSEEK_API_KEY;
  if (envKey) {
    _currentProvider = "deepseek";
    const baseURL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1";
    client = buildClient(envKey, baseURL);
    return client;
  }

  throw new ApiKeyNotConfiguredError();
}

/** API Key 未配置错误 */
export class ApiKeyNotConfiguredError extends Error {
  constructor() {
    super("请先配置 API Key");
    this.name = "ApiKeyNotConfiguredError";
  }
}

// 动态模型名称（每次调用根据当前提供商解析）
export function AI_MODEL(): string { return getModelName("fast"); }
export function AI_REASONER_MODEL(): string { return getModelName("reasoning"); }
