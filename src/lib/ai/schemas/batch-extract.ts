import { isNonEmptyString, isRecord, type ValidationResult } from "./types";

export interface BatchExtractResult {
  title?: string | null;
  companyName?: string | null;
  projectName?: string | null;
  budgetAmount?: string | null;
  deadline?: string | null;
  location?: string | null;
  description?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  requirements?: string | null;
  matchScore?: number | null;
  [key: string]: unknown;
}

export function validateBatchExtractResult(value: unknown): ValidationResult<BatchExtractResult> {
  if (!isRecord(value)) return { success: false, errors: ["结果必须是 JSON 对象"] };

  const errors: string[] = [];
  if (!isNonEmptyString(value.title) && !isNonEmptyString(value.projectName)) {
    errors.push("title 或 projectName 至少一个不能为空");
  }
  if (value.matchScore != null && typeof value.matchScore !== "number") {
    errors.push("matchScore 必须是数字");
  }
  if (value.companyName != null && typeof value.companyName !== "string") {
    errors.push("companyName 必须是字符串");
  }

  return {
    success: errors.length === 0,
    data: errors.length === 0 ? (value as BatchExtractResult) : undefined,
    errors,
  };
}
