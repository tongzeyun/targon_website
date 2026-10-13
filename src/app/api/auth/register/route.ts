import { NextRequest } from "next/server";
import {
  authErrorResponse,
  jsonResponse,
  getUserByEmail,
  hashPassword,
  signToken,
  resolveRequestId,
  logAuthInternalError,
} from "@/lib/api/auth";
import { isUsersEmailUniqueViolation, validateRegisterBody } from "@/lib/api/auth-validation";
import { v4 as uuid } from "uuid";
import { checkRegisterRateLimit } from "@/lib/api/auth-rate-limit";
import { isStrictSameOrigin } from "@/lib/api/auth-origin";
import { createRefreshSession } from "@/lib/api/auth-session";
import {
  setAccessTokenCookie,
  setRefreshTokenCookie,
} from "@/lib/api/auth-cookies";
import { db } from "@/lib/db";
import { createOrganization } from "@/lib/repositories/organization-repository";
import { createUser } from "@/lib/repositories/user-repository";

const EMAIL_ALREADY_REGISTERED = {
  code: "AUTH_EMAIL_ALREADY_REGISTERED" as const,
  message: "该邮箱已被注册",
  status: 409,
};

function emailAlreadyRegisteredResponse(req: NextRequest, requestId: string) {
  return authErrorResponse(req, { ...EMAIL_ALREADY_REGISTERED, requestId });
}

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

  const validation = validateRegisterBody(body);
  if (!validation.ok) {
    return authErrorResponse(req, {
      code: "AUTH_VALIDATION_FAILED",
      message: "输入信息不正确",
      status: 422,
      fields: validation.fields,
      requestId,
    });
  }

  const { email: normalizedEmail, password, fullName } = validation.value;
  const displayName = fullName || normalizedEmail.split("@")[0];
  const rateLimit = checkRegisterRateLimit(req);
  if (rateLimit) return rateLimit;

  try {
    const existing = await getUserByEmail(normalizedEmail);
    if (existing) return emailAlreadyRegisteredResponse(req, requestId);

    const userId = uuid();
    const orgId = uuid();
    const hashed = await hashPassword(password);
    const token = await signToken({
      userId,
      email: normalizedEmail,
      fullName: displayName,
      organizationId: orgId,
      role: "owner",
    });

    const refreshSession = await db.transaction(async () => {
      await createOrganization({
        id: orgId,
        name: displayName,
        slug: normalizedEmail.split("@")[0] + "-" + userId.slice(0, 6),
      });

      await createUser({
        id: userId,
        email: normalizedEmail,
        fullName: displayName,
        organizationId: orgId,
        role: "owner",
        passwordHash: hashed,
      });

      return createRefreshSession(userId);
    });

    const response = jsonResponse({
      user: {
        id: userId,
        email: normalizedEmail,
        fullName: displayName,
        organizationId: orgId,
        role: "owner",
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
    if (isUsersEmailUniqueViolation(error)) {
      return emailAlreadyRegisteredResponse(req, requestId);
    }

    logAuthInternalError(requestId, "Registration failed", error);
    return authErrorResponse(req, {
      code: "AUTH_INTERNAL_ERROR",
      message: "服务暂时不可用，请稍后重试",
      status: 500,
      requestId,
    });
  }
}
