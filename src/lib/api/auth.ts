/**
 * 认证模块 — JWT 签发、验证、密码哈希
 *
 * MVP 阶段使用简单的 email + password 认证。
 * 所有 API 路由通过 JWT token 鉴权。
 */

import { NextResponse, NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { readAccessTokenCookie } from "@/lib/api/auth-cookies";
import {
  type AuthUser,
  signToken,
  verifyToken,
} from "@/lib/api/auth-token";
import { findUserByEmail, findUserById } from "@/lib/repositories/user-repository";

export type { AuthUser };
export { signToken, verifyToken };

export interface AuthContext {
  userId: string;
  organizationId: string;
  role: string;
}

// ============================================================
// 密码
// ============================================================

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ============================================================
// 用户查询
// ============================================================

export async function getUserByEmail(email: string): Promise<{
  id: string;
  email: string;
  full_name: string;
  organization_id: string;
  role: string;
  password_hash: string;
} | null> {
  return findUserByEmail(email);
}

export async function getUserById(id: string): Promise<AuthUser | null> {
  const row = await findUserById(id);
  if (!row) return null;
  return {
    userId: row.id,
    email: row.email,
    fullName: row.full_name,
    organizationId: row.organization_id,
    role: row.role,
  };
}

// ============================================================
// 请求认证
// ============================================================

/**
 * Extract and verify the Access Cookie JWT.
 * Authorization header is ignored for identity — Cookie is the only credential.
 */
export async function authenticateRequest(req: NextRequest): Promise<AuthUser | null> {
  const cookieToken = readAccessTokenCookie(req);
  if (!cookieToken) return null;
  return verifyToken(cookieToken);
}

/** API 路由中获取认证用户（验证失败返回 401 响应） */
export async function getAuthUser(req: NextRequest): Promise<AuthUser> {
  const user = await authenticateRequest(req);
  if (!user) throw new AuthError("未登录或登录已过期", 401);
  return user;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

// ============================================================
// API 路由认证辅助（从请求中提取组织信息）
// ============================================================

/**
 * 从请求中提取认证信息。
 * req 参数为必传 — 所有环境都必须通过 JWT 认证。
 */
export async function getAuthOrg(req: NextRequest): Promise<AuthContext> {
  const user = await authenticateRequest(req);
  if (user) {
    return { userId: user.userId, organizationId: user.organizationId, role: user.role };
  }
  throw new AuthError("未登录或登录已过期", 401);
}

// ============================================================
// 响应助手
// ============================================================

export type AuthErrorCode =
  | "AUTH_INVALID_REQUEST"
  | "AUTH_VALIDATION_FAILED"
  | "AUTH_INVALID_CREDENTIALS"
  | "AUTH_REQUIRED"
  | "AUTH_EMAIL_ALREADY_REGISTERED"
  | "AUTH_RATE_LIMITED"
  | "AUTH_ORIGIN_FORBIDDEN"
  | "AUTH_SESSION_EXPIRED"
  | "AUTH_REFRESH_CONCURRENT"
  | "AUTH_INTERNAL_ERROR";

export interface AuthErrorOptions {
  code: AuthErrorCode;
  message: string;
  status: number;
  fields?: Record<string, string>;
  headers?: HeadersInit;
  /** 已解析的 requestId；传入时不再重新生成，保证日志与响应一致 */
  requestId?: string;
}

/** 优先复用 x-request-id，否则生成 UUID */
export function resolveRequestId(req: NextRequest): string {
  const fromHeader = req.headers.get("x-request-id")?.trim();
  if (fromHeader) return fromHeader;
  return crypto.randomUUID();
}

/** 认证接口专用错误响应 — 不影响通用 errorResponse */
export function authErrorResponse(req: NextRequest, options: AuthErrorOptions): NextResponse {
  const requestId = options.requestId ?? resolveRequestId(req);
  const errorBody: { code: AuthErrorCode; message: string; fields?: Record<string, string> } = {
    code: options.code,
    message: options.message,
  };
  if (options.fields && Object.keys(options.fields).length > 0) {
    errorBody.fields = options.fields;
  }
  return NextResponse.json(
    { error: errorBody, requestId },
    { status: options.status, headers: options.headers },
  );
}

/** 记录认证接口未知异常（含 requestId，不返回客户端） */
export function logAuthInternalError(requestId: string, context: string, error: unknown): void {
  console.error(`${context}:`, { requestId, error });
}

export function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
