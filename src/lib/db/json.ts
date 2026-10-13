export function serializeJson(value: unknown, fallback: unknown = null): string {
  return JSON.stringify(value ?? fallback);
}

export function parseJsonObject<T extends Record<string, unknown>>(value: unknown, fallback = {} as T): T {
  if (!value) return fallback;
  if (typeof value === "object" && !Array.isArray(value)) return value as T;
  if (typeof value !== "string") return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as T : fallback;
  } catch {
    return fallback;
  }
}

export function parseJsonArray<T = unknown>(value: unknown, fallback: T[] = []): T[] {
  if (!value) return fallback;
  if (Array.isArray(value)) return value as T[];
  if (typeof value !== "string") return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as T[] : fallback;
  } catch {
    return fallback;
  }
}
