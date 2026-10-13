import { NextRequest, type NextResponse } from "next/server";
import {
  authErrorResponse,
  getUserById,
  jsonResponse,
  logAuthInternalError,
  resolveRequestId,
  signToken,
} from "@/lib/api/auth";
import {
  ACCESS_COOKIE_MAX_AGE_SECONDS,
  clearAuthCookies,
  readRefreshTokenCookie,
  setAccessTokenCookie,
  setRefreshTokenCookie,
} from "@/lib/api/auth-cookies";
import { isStrictSameOrigin } from "@/lib/api/auth-origin";
import {
  inspectRefreshSessionForRotation,
  rotateRefreshSession,
} from "@/lib/api/auth-session";

const NO_STORE = "no-store";

function noStore<T extends NextResponse>(response: T): T {
  response.headers.set("Cache-Control", NO_STORE);
  return response;
}

function sessionExpiredResponse(
  request: NextRequest,
  requestId: string
): NextResponse {
  const response = authErrorResponse(request, {
    code: "AUTH_SESSION_EXPIRED",
    message: "登录已过期，请重新登录",
    status: 401,
    requestId,
  });
  clearAuthCookies(response);
  return noStore(response);
}

export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request);

  if (!isStrictSameOrigin(request)) {
    return noStore(
      authErrorResponse(request, {
        code: "AUTH_ORIGIN_FORBIDDEN",
        message: "请求来源不被允许",
        status: 403,
        requestId,
      })
    );
  }

  const refreshToken = readRefreshTokenCookie(request);
  if (!refreshToken) {
    return sessionExpiredResponse(request, requestId);
  }

  try {
    const session = await inspectRefreshSessionForRotation(refreshToken);
    if (!session) {
      return sessionExpiredResponse(request, requestId);
    }

    const user = await getUserById(session.userId);
    if (!user) {
      return sessionExpiredResponse(request, requestId);
    }

    const accessToken = await signToken(user);
    const rotation = await rotateRefreshSession(refreshToken);
    if (rotation.status === "concurrent") {
      return noStore(
        authErrorResponse(request, {
          code: "AUTH_REFRESH_CONCURRENT",
          message: "登录状态正在刷新，请重试",
          status: 409,
          headers: { "Retry-After": "1" },
          requestId,
        })
      );
    }
    if (rotation.status !== "rotated") {
      return sessionExpiredResponse(request, requestId);
    }

    const response = jsonResponse({
      success: true,
      expiresIn: ACCESS_COOKIE_MAX_AGE_SECONDS,
    });
    setAccessTokenCookie(response, accessToken);
    setRefreshTokenCookie(
      response,
      rotation.refreshToken,
      rotation.expiresAt
    );
    return noStore(response);
  } catch (error) {
    logAuthInternalError(requestId, "Refresh failed", error);
    return noStore(
      authErrorResponse(request, {
        code: "AUTH_INTERNAL_ERROR",
        message: "服务暂时不可用，请稍后重试",
        status: 500,
        requestId,
      })
    );
  }
}
