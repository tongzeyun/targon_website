export const CONTACT_INFLUENCE_MIN = 1;
export const CONTACT_INFLUENCE_MAX = 5;
export const DEFAULT_CONTACT_INFLUENCE = 3;

export function isContactInfluenceLevel(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= CONTACT_INFLUENCE_MIN &&
    value <= CONTACT_INFLUENCE_MAX
  );
}

export function normalizeContactInfluenceLevel(
  value: unknown,
  fallback = DEFAULT_CONTACT_INFLUENCE,
): number {
  const normalizedFallback = isContactInfluenceLevel(fallback)
    ? fallback
    : DEFAULT_CONTACT_INFLUENCE;

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return normalizedFallback;
  }

  return Math.max(
    CONTACT_INFLUENCE_MIN,
    Math.min(CONTACT_INFLUENCE_MAX, Math.round(value)),
  );
}
