export function normalizeTitle(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}
