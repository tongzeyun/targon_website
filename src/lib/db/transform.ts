/**
 * Convert database rows from snake_case column names to frontend camelCase.
 */
export function camelize<T = Record<string, unknown>>(row: Record<string, unknown> | null): T | null {
  if (!row) return null;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === "rowid") continue;
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    // Parse JSON strings
    if (value instanceof Date) {
      result[camelKey] = value.toISOString();
    } else if (typeof value === "string" && (value.startsWith("{") || value.startsWith("["))) {
      try { result[camelKey] = JSON.parse(value); } catch { result[camelKey] = value; }
    } else {
      result[camelKey] = value;
    }
  }
  return result as T;
}

export function camelizeAll<T = Record<string, unknown>>(rows: Record<string, unknown>[]): T[] {
  return rows.map((r) => camelize<T>(r)!).filter(Boolean);
}
