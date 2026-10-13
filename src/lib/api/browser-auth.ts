/**
 * Browser logout and safe, locale-aware login return paths.
 */

import { createApiResponseError } from "@/lib/api/api-error";
import { getSmartEyeLocale } from "@/lib/smart-eye-paths";
import type { Locale } from "@/lib/locales";

export const DEFAULT_SMARTEYE_APP_PATH = "/smart-eye/app/dashboard";
export const SMARTEYE_LOGIN_PATH = "/smart-eye/login";

export interface LogoutBrowserSessionOptions {
  fetchImpl?: typeof fetch;
}

/**
 * POST /api/auth/logout with credentials include.
 * Does not send Authorization, Origin, or retry/refresh.
 */
export async function logoutBrowserSession(
  options: LogoutBrowserSessionOptions = {}
): Promise<void> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) {
    throw await createApiResponseError(response, "退出失败，请稍后重试");
  }
}

export interface PerformBrowserLogoutOptions {
  fetchImpl?: typeof fetch;
  replace?: (url: string) => void;
  lang?: Locale;
}

/**
 * Full logout orchestration: request → hard navigate to login.
 * On request failure, does not navigate; error propagates to caller.
 */
export async function performBrowserLogout(
  options: PerformBrowserLogoutOptions = {}
): Promise<void> {
  const replace =
    options.replace ??
    ((url: string) => {
      window.location.replace(url);
    });

  await logoutBrowserSession({ fetchImpl: options.fetchImpl });
  const lang = options.lang ?? getSmartEyeLocale(window.location.pathname);
  replace(`/${lang}${SMARTEYE_LOGIN_PATH}`);
}

/**
 * Only allow in-app SmartEye paths under a supported locale or the legacy prefix.
 * Rejects protocol-relative URLs, absolute URLs, and other paths.
 */
export function resolveSafeSmartEyeNextPath(
  raw: string | null | undefined,
  lang: Locale
): string {
  const fallback = `/${lang}${DEFAULT_SMARTEYE_APP_PATH}`;
  if (typeof raw !== "string" || raw.length === 0) {
    return fallback;
  }

  if (raw.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    return fallback;
  }

  if (!raw.startsWith("/")) {
    return fallback;
  }

  try {
    const url = new URL(raw, "http://local.invalid");
    if (url.origin !== "http://local.invalid" || /[\\\u0000-\u001f]/.test(raw)) return fallback;
    const { pathname, search } = url;
    const businessPath = pathname.replace(/^\/(zh|en)(?=\/)/, "");
    const isAppPath =
      businessPath === "/smart-eye/app" || businessPath.startsWith("/smart-eye/app/");
    if (!isAppPath) {
      return fallback;
    }
    return `/${lang}${businessPath}${search}`;
  } catch {
    return fallback;
  }
}
