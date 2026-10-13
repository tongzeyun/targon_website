import type { NextRequest } from "next/server";

const HTTP_PROTOCOLS = new Set(["http:", "https:"]);

export function parseHttpOrigin(value: string): string | null {
  const candidate = value.trim();
  if (!candidate || candidate !== value) return null;

  try {
    const url = new URL(candidate);
    if (
      !HTTP_PROTOCOLS.has(url.protocol) ||
      url.username ||
      url.password ||
      candidate !== url.origin
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Resolve expected browser Origin(s) for same-origin CSRF checks.
 *
 * AUTH_TRUSTED_ORIGIN when set may be a single Origin or a comma-separated
 * list of exact HTTP/HTTPS Origins (e.g. localhost + LAN IP for local dev).
 * Any invalid non-empty entry fails closed (returns []) and never falls back.
 * When unset, fall back to request.nextUrl.origin for direct local access.
 * Never trust client-controlled forwarded headers.
 */
export function resolveExpectedOrigins(request: NextRequest): string[] {
  const configured = process.env.AUTH_TRUSTED_ORIGIN;
  if (configured !== undefined) {
    const origins: string[] = [];
    for (const part of configured.split(",")) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const parsed = parseHttpOrigin(trimmed);
      if (!parsed) return [];
      if (!origins.includes(parsed)) origins.push(parsed);
    }
    return origins;
  }

  const fallback = parseHttpOrigin(request.nextUrl.origin);
  return fallback ? [fallback] : [];
}

/** Returns the first expected Origin; prefer resolveExpectedOrigins for lists. */
export function resolveExpectedOrigin(request: NextRequest): string | null {
  return resolveExpectedOrigins(request)[0] ?? null;
}

export function isStrictSameOrigin(request: NextRequest): boolean {
  const requestOrigin = request.headers.get("origin");
  if (!requestOrigin) return false;

  const parsedRequestOrigin = parseHttpOrigin(requestOrigin);
  if (!parsedRequestOrigin) return false;

  return resolveExpectedOrigins(request).includes(parsedRequestOrigin);
}
