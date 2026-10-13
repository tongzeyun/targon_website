import { NextRequest, type NextResponse } from "next/server";
import {
  authErrorResponse,
  jsonResponse,
  logAuthInternalError,
  resolveRequestId,
} from "@/lib/api/auth";
import {
  clearAuthCookies,
  readRefreshTokenCookie,
} from "@/lib/api/auth-cookies";
import { isStrictSameOrigin } from "@/lib/api/auth-origin";
import { revokeRefreshSession } from "@/lib/api/auth-session";

const NO_STORE = "no-store";

function noStore<T extends NextResponse>(response: T): T {
  response.headers.set("Cache-Control", NO_STORE);
  return response;
}

export async function POST(request: NextRequest) {
  if (!isStrictSameOrigin(request)) {
    return noStore(
      authErrorResponse(request, {
        code: "AUTH_ORIGIN_FORBIDDEN",
        message: "请求来源不被允许",
        status: 403,
      })
    );
  }

  const requestId = resolveRequestId(request);
  const refreshToken = readRefreshTokenCookie(request);

  try {
    if (refreshToken) {
      await revokeRefreshSession(refreshToken);
    }

    const response = jsonResponse({ success: true });
    clearAuthCookies(response);
    return noStore(response);
  } catch (error) {
    logAuthInternalError(requestId, "Logout failed", error);
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
