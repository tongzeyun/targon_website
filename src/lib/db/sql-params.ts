export function buildPgPlaceholders(count: number, startIndex = 1): string {
  return Array.from({ length: count }, (_, i) => `$${startIndex + i}`).join(", ");
}
