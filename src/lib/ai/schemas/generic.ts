import { isNonEmptyString, isRecord, type ValidationResult } from "./types";

export function validateJsonObject<T = Record<string, unknown>>(value: unknown): ValidationResult<T> {
  if (!isRecord(value)) return { success: false, errors: ["结果必须是 JSON 对象"] };
  return { success: true, data: value as unknown as T, errors: [] };
}

export function validateJsonArray<T = unknown>(value: unknown): ValidationResult<T[]> {
  if (!Array.isArray(value)) return { success: false, errors: ["结果必须是 JSON 数组"] };
  return { success: true, data: value as unknown as T[], errors: [] };
}

export function validateNumberArray(value: unknown): ValidationResult<number[]> {
  if (!Array.isArray(value)) return { success: false, errors: ["结果必须是 JSON 数组"] };
  const errors = value.flatMap((item, index) => typeof item === "number" ? [] : [`items[${index}] 必须是数字`]);
  return { success: errors.length === 0, data: errors.length === 0 ? value as number[] : undefined, errors };
}

export function validateObjectWithFields<T = Record<string, unknown>>(
  fields: string[]
): (value: unknown) => ValidationResult<T> {
  return (value: unknown) => {
    if (!isRecord(value)) return { success: false, errors: ["结果必须是 JSON 对象"] };
    const errors = fields
      .filter((field) => !isNonEmptyString(value[field]))
      .map((field) => `${field} 不能为空`);
    return { success: errors.length === 0, data: errors.length === 0 ? value as unknown as T : undefined, errors };
  };
}

export function validateArrayOfObjectsWithFields<T = Record<string, unknown>>(
  fields: string[]
): (value: unknown) => ValidationResult<T[]> {
  return (value: unknown) => {
    if (!Array.isArray(value)) return { success: false, errors: ["结果必须是 JSON 数组"] };
    const errors: string[] = [];
    value.forEach((item, index) => {
      if (!isRecord(item)) {
        errors.push(`items[${index}] 必须是对象`);
        return;
      }
      for (const field of fields) {
        if (!isNonEmptyString(item[field])) errors.push(`items[${index}].${field} 不能为空`);
      }
    });
    return { success: errors.length === 0, data: errors.length === 0 ? value as unknown as T[] : undefined, errors };
  };
}
