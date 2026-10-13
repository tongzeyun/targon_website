import type { NextRequest, NextResponse } from "next/server";
import { ACCESS_TOKEN_TTL_SECONDS } from "@/lib/api/auth-config";

export const ACCESS_TOKEN_COOKIE_NAME = "saleseye-access-token";
export const REFRESH_TOKEN_COOKIE_NAME = "saleseye-refresh-token";
/** Access Cookie Max-Age — same source as Access JWT TTL. */
export const ACCESS_COOKIE_MAX_AGE_SECONDS = ACCESS_TOKEN_TTL_SECONDS;

const ACCESS_COOKIE_PATH = "/api";
const REFRESH_COOKIE_PATH = "/api/auth";
const EXPIRED_COOKIE_DATE = new Date(0);

function cookieSecurityOptions(path: string) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path,
  };
}

export function setAccessTokenCookie<T>(
  response: NextResponse<T>,
  accessToken: string
): NextResponse<T> {
  response.cookies.set(ACCESS_TOKEN_COOKIE_NAME, accessToken, {
    ...cookieSecurityOptions(ACCESS_COOKIE_PATH),
    maxAge: ACCESS_COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}

export function setRefreshTokenCookie<T>(
  response: NextResponse<T>,
  refreshToken: string,
  expiresAt: Date
): NextResponse<T> {
  if (!(expiresAt instanceof Date) || !Number.isFinite(expiresAt.getTime())) {
    throw new Error("Invalid refresh session expiration");
  }

  response.cookies.set(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
    ...cookieSecurityOptions(REFRESH_COOKIE_PATH),
    expires: expiresAt,
  });
  return response;
}

export function clearAuthCookies<T>(response: NextResponse<T>): NextResponse<T> {
  response.cookies.set(ACCESS_TOKEN_COOKIE_NAME, "", {
    ...cookieSecurityOptions(ACCESS_COOKIE_PATH),
    maxAge: 0,
    expires: EXPIRED_COOKIE_DATE,
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE_NAME, "", {
    ...cookieSecurityOptions(REFRESH_COOKIE_PATH),
    maxAge: 0,
    expires: EXPIRED_COOKIE_DATE,
  });
  return response;
}

export function readAccessTokenCookie(request: NextRequest): string | null {
  return request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)?.value || null;
}

export function readRefreshTokenCookie(request: NextRequest): string | null {
  return request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)?.value || null;
}
