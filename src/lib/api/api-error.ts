/**
 * Parse API error responses into a typed Error without stringifying objects.
 * Supports flat `{ error }`, structured `{ error: { code, message } }`, and `{ message }`.
 */

export class ApiResponseError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiResponseError";
    this.status = status;
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Build an ApiResponseError from a failed Response body.
 * Never converts nested objects to `[object Object]`.
 */
export async function createApiResponseError(
  response: Response,
  fallback: string
): Promise<ApiResponseError> {
  const status = response.status;
  let body: unknown;

  try {
    const text = await response.text();
    if (!text.trim()) {
      return new ApiResponseError(fallback, status);
    }
    body = JSON.parse(text) as unknown;
  } catch {
    return new ApiResponseError(fallback, status);
  }

  if (!isRecord(body)) {
    return new ApiResponseError(fallback, status);
  }

  const errorField = body.error;

  if (typeof errorField === "string" && errorField.length > 0) {
    return new ApiResponseError(errorField, status);
  }

  if (isRecord(errorField)) {
    const message = pickString(errorField.message) ?? fallback;
    const code = pickString(errorField.code);
    return new ApiResponseError(message, status, code);
  }

  const topMessage = pickString(body.message);
  if (topMessage) {
    return new ApiResponseError(topMessage, status);
  }

  return new ApiResponseError(fallback, status);
}
