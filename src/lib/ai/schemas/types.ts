export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors: string[];
}

export type Validator<T> = (value: unknown) => ValidationResult<T>;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
