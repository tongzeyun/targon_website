import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_TOKEN_COOKIE_NAME } from "@/lib/api/auth-cookies";
import { isStrictSameOrigin } from "@/lib/api/auth-origin";
import { verifyToken } from "@/lib/api/auth-token";
import { getDefaultLocale } from "@/lib/smart-eye-paths";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const HTTP_PROTOCOLS = new Set(["http:", "https:"]);
const EXPO_DYNAMIC_ORIGIN_RE = /^exp:\/\/(127\.0\.0\.1|localhost):(\d+)$/;

function getAllowedOrigins(): string[] {
  const custom = process.env.CORS_ORIGINS;
  if (custom) return custom.split(",").map((s) => s.trim()).filter(Boolean);

  return [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8081",
    "http://localhost:8082",
    "http://localhost:8083",
    "http://localhost:8084",
    "http://localhost:8085",
    "http://localhost:8086",
    "http://localhost:8090",
    "http://localhost:8091",
    "http://192.168.0.103:8081",
    "http://192.168.0.103:3000",
    "http://192.168.0.103:3001",
    "http://localhost:3876",
    "http://127.0.0.1:3876",
    "http://192.168.0.103:3876",
    "exp://127.0.0.1:",
    "exp://localhost:",
  ];
}

/**
 * Parse a pure HTTP/HTTPS Origin to its canonical form (url.origin).
 * Rejects path, query, hash, userinfo, and non-http(s) schemes.
 * Accepts an explicit default port (:80 / :443) and normalizes it away.
 */
function parseHttpOrigin(value: string): string | null {
  const candidate = value.trim();
  if (!candidate || candidate !== value) return null;

  try {
    const url = new URL(candidate);
    if (!HTTP_PROTOCOLS.has(url.protocol)) return null;
    if (url.username || url.password) return null;
    if (url.pathname !== "/") return null;
    if (url.search || url.hash) return null;

    const defaultPort = url.protocol === "https:" ? "443" : "80";
    const withExplicitDefaultPort = `${url.protocol}//${url.hostname}:${defaultPort}`;
    if (candidate !== url.origin && candidate !== withExplicitDefaultPort) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function isExpoDynamicPortPrefix(entry: string): boolean {
  return entry === "exp://127.0.0.1:" || entry === "exp://localhost:";
}

/**
 * Exact CORS Origin allow-list check. No string prefix matching.
 * Empty origin is not "allowed" for ACAO purposes (caller skips writing headers).
 */
function isExactCorsOriginAllowed(
  origin: string,
  allowedList: string[]
): boolean {
  if (!origin) return false;

  const normalizedRequest = parseHttpOrigin(origin);
  if (normalizedRequest) {
    return allowedList.some(
      (entry) => parseHttpOrigin(entry) === normalizedRequest
    );
  }

  const expoMatch = EXPO_DYNAMIC_ORIGIN_RE.exec(origin);
  if (!expoMatch) return false;
  const prefix = `exp://${expoMatch[1]}:`;
  return allowedList.some(
    (entry) => isExpoDynamicPortPrefix(entry) && entry === prefix
  );
}

function hasAccessCookie(request: NextRequest): boolean {
  const value = request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)?.value;
  return typeof value === "string" && value.length > 0;
}

function requiresCookieCsrfCheck(request: NextRequest): boolean {
  if (!request.nextUrl.pathname.startsWith("/api/")) return false;
  if (SAFE_METHODS.has(request.method.toUpperCase())) return false;
  if (!hasAccessCookie(request)) return false;
  return true;
}

function normalizeApiPathname(pathname: string): string {
  return pathname.replace(/\/+$/, "") || "/";
}

function isJwtProtectedApi(pathname: string): boolean {
  const path = normalizeApiPathname(pathname);
  if (!path.startsWith("/api/")) return false;
  if (path === "/api/auth" || path.startsWith("/api/auth/")) return false;
  if (path === "/api/health" || path.startsWith("/api/health/")) return false;
  if (path === "/api/crawler/ingest") return false;
  if (path === "/api/jobs/run-next") return false;
  return true;
}

/** Access Cookie only — Authorization never participates in Proxy JWT checks. */
function resolveAccessTokenCandidate(request: NextRequest): string | null {
  const cookieToken = request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)?.value;
  return cookieToken || null;
}

function resolveRequestId(request: NextRequest): string {
  const fromHeader = request.headers.get("x-request-id")?.trim();
  if (fromHeader) return fromHeader;
  return crypto.randomUUID();
}

function applyCorsHeaders(
  response: NextResponse,
  origin: string,
  corsOriginAllowed: boolean
): void {
  if (origin && corsOriginAllowed) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }
}

function originForbiddenResponse(request: NextRequest): NextResponse {
  const requestId = resolveRequestId(request);
  return NextResponse.json(
    {
      error: {
        code: "AUTH_ORIGIN_FORBIDDEN",
        message: "请求来源不被允许",
      },
      requestId,
    },
    {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

function authRequiredResponse(
  request: NextRequest,
  origin: string,
  corsOriginAllowed: boolean
): NextResponse {
  const requestId = resolveRequestId(request);
  const response = NextResponse.json(
    {
      error: {
        code: "AUTH_REQUIRED",
        message: "未登录或登录已过期",
      },
      requestId,
    },
    {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    }
  );
  applyCorsHeaders(response, origin, corsOriginAllowed);
  return response;
}

export async function proxy(request: NextRequest) {
  const legacyPath = /^\/(dashboard|accounts|projects|deep-research|intelligence|pipeline|quotation|contract|bid|meeting|convert|settings)(\/.*)?$/.exec(request.nextUrl.pathname);
  if (legacyPath) {
    const url = request.nextUrl.clone();
    url.pathname = `/${getDefaultLocale()}/smart-eye/app${request.nextUrl.pathname}`;
    const response = NextResponse.redirect(url);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  const origin = request.headers.get("origin") || "";
  const allowedOrigins = getAllowedOrigins();
  const corsOriginAllowed = isExactCorsOriginAllowed(origin, allowedOrigins);

  if (request.nextUrl.pathname.startsWith("/api/")) {
    if (request.method === "OPTIONS") {
      const headers: Record<string, string> = {
        "Access-Control-Allow-Methods":
          "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, x-api-key",
        "Access-Control-Max-Age": "86400",
      };
      if (corsOriginAllowed) {
        headers["Access-Control-Allow-Origin"] = origin;
        headers["Access-Control-Allow-Credentials"] = "true";
      }
      return new NextResponse(null, { status: 204, headers });
    }

    if (requiresCookieCsrfCheck(request) && !isStrictSameOrigin(request)) {
      return originForbiddenResponse(request);
    }

    if (isJwtProtectedApi(request.nextUrl.pathname)) {
      const token = resolveAccessTokenCandidate(request);
      const user = token ? await verifyToken(token) : null;
      if (!user) {
        return authRequiredResponse(request, origin, corsOriginAllowed);
      }
    }

    const response = NextResponse.next();
    applyCorsHeaders(response, origin, corsOriginAllowed);
    return response;
  }

  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set(
    "Referrer-Policy",
    "strict-origin-when-cross-origin"
  );
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }
  return response;
}

export const config = {
  matcher: ["/api/:path*", "/((?!_next/static|_next/image|favicon.ico).*)"],
};
