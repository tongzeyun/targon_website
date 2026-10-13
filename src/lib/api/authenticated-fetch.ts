/**
 * Browser authenticated fetch — Cookie credentials + single-flight 401 refresh.
 * Only auto-refreshes same-origin business APIs (not /api/auth/*, crawler ingest, or worker).
 * Does not read localStorage or add Authorization headers.
 */

import { getSmartEyeLocale } from "@/lib/smart-eye-paths";

export const AUTH_REFRESH_PATH = "/api/auth/refresh";
const AUTH_REFRESH_CONCURRENT_STATUS = 409;
const AUTH_REFRESH_RETRY_DELAY_MS = 75;
const SMARTEYE_LOGIN_PATH = "/smart-eye/login";
const SMARTEYE_APP_PATH_PREFIX = "/smart-eye/app";

export class AuthRefreshUnavailableError extends Error {
  constructor() {
    super("Authentication refresh temporarily unavailable");
    this.name = "AuthRefreshUnavailableError";
  }
}

export type AuthenticatedFetch = (
  input: string | URL,
  init?: RequestInit
) => Promise<Response>;

type RefreshOutcome = "ok" | "expired" | "unavailable";

function throwIfAborted(signal?: AbortSignal | null): void {
  if (signal?.aborted) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }
}

function isReadableStreamBody(body: BodyInit | null | undefined): boolean {
  return typeof ReadableStream !== "undefined" && body instanceof ReadableStream;
}

/**
 * Bodies that cannot be safely replayed after the first request.
 * ReadableStream can only be consumed once.
 */
export function isReplayableBody(
  _input: string | URL,
  init?: RequestInit
): boolean {
  if (init?.body != null && isReadableStreamBody(init.body)) {
    return false;
  }
  return true;
}

function resolveRequestUrl(input: string | URL): string {
  return typeof input === "string" ? input : input.toString();
}

/**
 * Auto-refresh only for same-origin root `/api/*` business APIs using Cookie session.
 * Excludes `/api/auth/*`, non-session endpoints, and cross-origin requests.
 */
const NON_SESSION_API_PATHS = new Set([
  "/api/crawler/ingest",
  "/api/jobs/run-next",
]);

function stripTrailingSlash(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

/** True only for the `/api/auth` subtree — not `/api/authentic` etc. */
function isAuthApiPath(pathname: string): boolean {
  const normalized = stripTrailingSlash(pathname);
  return normalized === "/api/auth" || normalized.startsWith("/api/auth/");
}

function isNonSessionApiPath(pathname: string): boolean {
  return NON_SESSION_API_PATHS.has(stripTrailingSlash(pathname));
}

function isBusinessApiPathname(pathname: string): boolean {
  return (
    pathname.startsWith("/api/") &&
    !isAuthApiPath(pathname) &&
    !isNonSessionApiPath(pathname)
  );
}

function isAbsoluteUrl(url: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("//");
}

/**
 * Relative inputs must be root-absolute API paths (`/api/...`).
 * Rejects `/`, page paths, `api/products`, `./api/products`, etc.
 */
function isRootAbsoluteApiPath(url: string): boolean {
  const pathOnly = url.split(/[?#]/, 2)[0] ?? "";
  return pathOnly.startsWith("/api/");
}

export function shouldAttemptRefresh(url: string): boolean {
  const absolute = isAbsoluteUrl(url);

  if (!absolute && !isRootAbsoluteApiPath(url)) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(url, "http://local.invalid");
  } catch {
    return false;
  }

  if (!isBusinessApiPathname(parsed.pathname)) {
    return false;
  }

  if (absolute) {
    if (typeof window === "undefined" || !window.location?.origin) {
      return false;
    }
    if (parsed.origin !== window.location.origin) {
      return false;
    }
  }

  return true;
}

function buildInit(init: RequestInit | undefined): RequestInit {
  const mergedHeaders = new Headers(init?.headers);

  return {
    ...init,
    headers: mergedHeaders,
    credentials: "include",
    signal: init?.signal,
  };
}

/**
 * Redirect only after a protected business API confirms that the browser
 * session has expired. Page navigation itself remains public.
 */
function redirectExpiredBrowserSession(): void {
  if (typeof window === "undefined") return;
  const lang = getSmartEyeLocale(window.location.pathname);
  const loginPath = `/${lang}${SMARTEYE_LOGIN_PATH}`;
  const appPath = `/${lang}${SMARTEYE_APP_PATH_PREFIX}`;
  if (window.location.pathname === loginPath) return;

  const currentPath = `${window.location.pathname}${window.location.search}`;
  const isSmartEyeAppPath =
    window.location.pathname === appPath ||
    window.location.pathname.startsWith(`${appPath}/`);
  const destination = isSmartEyeAppPath
    ? `${loginPath}?next=${encodeURIComponent(currentPath)}`
    : loginPath;

  window.location.replace(destination);
}

export function createAuthenticatedFetch(
  fetchImpl: typeof fetch
): AuthenticatedFetch {
  let generation = 0;
  let inFlightRefresh: Promise<RefreshOutcome> | null = null;

  async function runRefresh(): Promise<RefreshOutcome> {
    try {
      const requestRefresh = () => fetchImpl(AUTH_REFRESH_PATH, {
        method: "POST",
        credentials: "include",
      });
      let response = await requestRefresh();
      if (response.status === AUTH_REFRESH_CONCURRENT_STATUS) {
        await new Promise((resolve) =>
          setTimeout(resolve, AUTH_REFRESH_RETRY_DELAY_MS)
        );
        response = await requestRefresh();
      }

      if (response.status === 401) return "expired";
      if (!response.ok) return "unavailable";
      // Only successful refresh advances the auth generation.
      generation += 1;
      return "ok";
    } catch {
      // All Refresh fetch rejections map to unavailable (no sensitive details).
      return "unavailable";
    }
  }

  function refreshOnce(): Promise<RefreshOutcome> {
    if (!inFlightRefresh) {
      inFlightRefresh = runRefresh().finally(() => {
        inFlightRefresh = null;
      });
    }
    return inFlightRefresh;
  }

  async function authenticatedFetch(
    input: string | URL,
    init?: RequestInit
  ): Promise<Response> {
    const requestInit = buildInit(init);
    const url = resolveRequestUrl(input);
    const generationAtStart = generation;

    const firstResponse = await fetchImpl(url, requestInit);

    if (firstResponse.status !== 401) {
      return firstResponse;
    }

    if (!isReplayableBody(input, init)) {
      return firstResponse;
    }

    if (!shouldAttemptRefresh(url)) {
      return firstResponse;
    }

    throwIfAborted(requestInit.signal);

    // Late 401 after a peer already refreshed: retry without a second Refresh.
    const outcome: RefreshOutcome =
      generation !== generationAtStart ? "ok" : await refreshOnce();

    throwIfAborted(requestInit.signal);

    if (outcome === "expired") {
      redirectExpiredBrowserSession();
      return firstResponse;
    }
    if (outcome === "unavailable") {
      throw new AuthRefreshUnavailableError();
    }

    // Success: retry the original business request exactly once (no second Refresh).
    const retryInit = buildInit(init);
    throwIfAborted(retryInit.signal);
    const retryResponse = await fetchImpl(url, retryInit);
    if (retryResponse.status === 401) {
      redirectExpiredBrowserSession();
    }
    return retryResponse;
  }

  return authenticatedFetch;
}

const defaultFetch: typeof fetch =
  typeof globalThis.fetch === "function"
    ? globalThis.fetch.bind(globalThis)
    : ((() => {
        throw new Error("fetch is not available");
      }) as unknown as typeof fetch);

export const authenticatedFetch = createAuthenticatedFetch(defaultFetch);
