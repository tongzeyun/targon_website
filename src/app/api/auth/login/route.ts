import { NextRequest } from "next/server";
import {
  authErrorResponse,
  jsonResponse,
  getUserByEmail,
  verifyPassword,
  signToken,
  resolveRequestId,
  logAuthInternalError,
} from "@/lib/api/auth";
import { validateLoginBody } from "@/lib/api/auth-validation";
import { checkLoginRateLimit } from "@/lib/api/auth-rate-limit";
import { isStrictSameOrigin } from "@/lib/api/auth-origin";
import { createRefreshSession } from "@/lib/api/auth-session";
import {
  setAccessTokenCookie,
  setRefreshTokenCookie,
} from "@/lib/api/auth-cookies";

const INVALID_CREDENTIALS = {
  code: "AUTH_INVALID_CREDENTIALS" as const,
  message: "邮箱或密码错误",
  status: 401,
};

export async function POST(req: NextRequest) {
  const requestId = resolveRequestId(req);

  if (!isStrictSameOrigin(req)) {
    return authErrorResponse(req, {
      code: "AUTH_ORIGIN_FORBIDDEN",
      message: "请求来源不被允许",
      status: 403,
      requestId,
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return authErrorResponse(req, {
      code: "AUTH_INVALID_REQUEST",
      message: "请求格式不正确",
      status: 400,
      requestId,
    });
  }

  const validation = validateLoginBody(body);
  if (!validation.ok) {
    return authErrorResponse(req, {
      code: "AUTH_VALIDATION_FAILED",
      message: "输入信息不正确",
      status: 422,
      fields: validation.fields,
      requestId,
    });
  }

  const { email, password } = validation.value;
  const rateLimit = checkLoginRateLimit(req, email);
  if (rateLimit) return rateLimit;

  try {
    const user = await getUserByEmail(email);
    if (!user || !user.password_hash) {
      return authErrorResponse(req, { ...INVALID_CREDENTIALS, requestId });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return authErrorResponse(req, { ...INVALID_CREDENTIALS, requestId });
    }

    const token = await signToken({
      userId: user.id,
      email: user.email,
      fullName: user.full_name,
      organizationId: user.organization_id,
      role: user.role,
    });

    const refreshSession = await createRefreshSession(user.id);

    const response = jsonResponse({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        organizationId: user.organization_id,
        role: user.role,
      },
    });

    setAccessTokenCookie(response, token);
    setRefreshTokenCookie(
      response,
      refreshSession.refreshToken,
      refreshSession.expiresAt
    );

    return response;
  } catch (error) {
    logAuthInternalError(requestId, "Login failed", error);
    return authErrorResponse(req, {
      code: "AUTH_INTERNAL_ERROR",
      message: "服务暂时不可用，请稍后重试",
      status: 500,
      requestId,
    });
  }
}
