/**
 * In-process fixed-window admission limiter for authenticated application APIs.
 * Authentication security policies live in auth-rate-limit.ts. Authoritative
 * provider quotas live at the provider boundary, outside this module.
 */

import { NextResponse } from "next/server";

interface WindowEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, WindowEntry>();

// 每 5 分钟清理一次过期条目
let lastCleanup = Date.now();
function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 300_000) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) store.delete(key);
  }
}

export interface RateLimitConfig {
  /** 时间窗口内最大请求数 */
  maxRequests: number;
  /** 时间窗口（秒） */
  windowSeconds: number;
  /** 限流键前缀，用于区分不同路由 */
  keyPrefix?: string;
}

const DEFAULT_CONFIG: RateLimitConfig = { maxRequests: 30, windowSeconds: 60 };

/** 各路由类型的预设配置 */
export const RATE_LIMITS = {
  /** AI 路由 — 每用户每分钟 5 次 */
  ai: { maxRequests: 5, windowSeconds: 60, keyPrefix: "ai" } as RateLimitConfig,
  /** 通用 API — 每用户每分钟 60 次 */
  api: { maxRequests: 60, windowSeconds: 60, keyPrefix: "api" } as RateLimitConfig,
  /** 爬虫搜索 — 每用户每分钟 3 次 */
  crawler: { maxRequests: 3, windowSeconds: 60, keyPrefix: "crawler" } as RateLimitConfig,
  /** 文档生成 — 每用户每分钟 5 次 */
  document: { maxRequests: 5, windowSeconds: 60, keyPrefix: "doc" } as RateLimitConfig,
};

/**
 * 已认证用户的本进程快速限流。userId 必须来自已验证的 AuthContext。
 * 该检查只用于快速准入；Provider 边界的 PostgreSQL 配额才是权威限制。
 *
 * @example
 *   const auth = await getAuthOrg(req);
 *   const limit = checkRateLimit(auth.userId, RATE_LIMITS.ai);
 *   if (limit) return limit;  // 429
 *   // ... 正常处理
 */
export function checkRateLimit(
  userId: string,
  config: RateLimitConfig = DEFAULT_CONFIG,
): NextResponse | null {
  if (!userId.trim()) {
    return NextResponse.json({ error: "缺少已认证的用户身份" }, { status: 401 });
  }

  const keyPrefix = config.keyPrefix ?? "default";
  const result = consumeRateLimit(`${keyPrefix}:user:${userId}`, config);
  if (result) {
    return NextResponse.json(
      { error: `请求过于频繁，请 ${result.retryAfterSeconds} 秒后重试` },
      {
        status: 429,
        headers: { "Retry-After": String(result.retryAfterSeconds) },
      },
    );
  }

  return null;
}

export interface RateLimitResult {
  retryAfterSeconds: number;
}

/** Fixed-window counter shared by route-specific policies. */
export function consumeRateLimit(
  key: string,
  config: RateLimitConfig = DEFAULT_CONFIG,
): RateLimitResult | null {
  cleanup();

  const { maxRequests, windowSeconds } = config;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  const existing = store.get(key);

  if (!existing || now >= existing.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  existing.count++;

  if (existing.count > maxRequests) {
    return {
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  return null;
}

/**
 * 手动重置限流（用于测试或管理操作）
 */
export function resetRateLimit(key: string) {
  store.delete(key);
}
