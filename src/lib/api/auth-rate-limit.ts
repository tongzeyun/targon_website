import { createHash } from "node:crypto";
import { type NextRequest, type NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/api/auth";
import {
  consumeRateLimit,
  type RateLimitConfig,
  type RateLimitResult,
} from "@/lib/api/rate-limit";

export const AUTH_RATE_LIMITS = {
  loginIp: {
    maxRequests: 30,
    windowSeconds: 60,
    keyPrefix: "auth:login:ip",
  } as RateLimitConfig,
  loginAccount: {
    maxRequests: 10,
    windowSeconds: 5 * 60,
    keyPrefix: "auth:login:account",
  } as RateLimitConfig,
  registerIp: {
    maxRequests: 5,
    windowSeconds: 10 * 60,
    keyPrefix: "auth:register:ip",
  } as RateLimitConfig,
};

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return (
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function accountKey(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

function rateLimitedResponse(
  request: NextRequest,
  result: RateLimitResult,
): NextResponse {
  return authErrorResponse(request, {
    code: "AUTH_RATE_LIMITED",
    message: "请求过于频繁，请稍后重试",
    status: 429,
    headers: { "Retry-After": String(result.retryAfterSeconds) },
  });
}

export function checkLoginRateLimit(
  request: NextRequest,
  normalizedEmail: string,
): NextResponse | null {
  const ip = getClientIp(request);
  const ipResult = consumeRateLimit(
    `${AUTH_RATE_LIMITS.loginIp.keyPrefix}:${ip}`,
    AUTH_RATE_LIMITS.loginIp,
  );
  if (ipResult) return rateLimitedResponse(request, ipResult);

  const accountResult = consumeRateLimit(
    `${AUTH_RATE_LIMITS.loginAccount.keyPrefix}:${accountKey(normalizedEmail)}`,
    AUTH_RATE_LIMITS.loginAccount,
  );
  return accountResult ? rateLimitedResponse(request, accountResult) : null;
}

export function checkRegisterRateLimit(request: NextRequest): NextResponse | null {
  const ip = getClientIp(request);
  const result = consumeRateLimit(
    `${AUTH_RATE_LIMITS.registerIp.keyPrefix}:${ip}`,
    AUTH_RATE_LIMITS.registerIp,
  );
  return result ? rateLimitedResponse(request, result) : null;
}
