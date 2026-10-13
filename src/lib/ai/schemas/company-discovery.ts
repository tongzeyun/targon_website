import { isNonEmptyString, isRecord, type ValidationResult } from "./types";

export interface DiscoveredCompany {
  name: string;
  source?: string;
  sourceIndex?: number;
}

export function validateDiscoveredCompanies(value: unknown): ValidationResult<DiscoveredCompany[]> {
  const errors: string[] = [];
  if (!Array.isArray(value)) {
    return { success: false, errors: ["结果必须是 JSON 数组"] };
  }

  value.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`companies[${index}] 必须是对象`);
      return;
    }
    if (!isNonEmptyString(item.name)) errors.push(`companies[${index}].name 不能为空`);
    if (item.sourceIndex !== undefined && typeof item.sourceIndex !== "number") {
      errors.push(`companies[${index}].sourceIndex 必须是数字`);
    }
  });

  return {
    success: errors.length === 0,
    data: errors.length === 0 ? value as unknown as DiscoveredCompany[] : undefined,
    errors,
  };
}
