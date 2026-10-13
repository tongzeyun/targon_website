import { isNonEmptyString, isRecord, type ValidationResult } from "./types";

export interface MatchResultSchema {
  accountId: string;
  companyName: string;
  matchScore: number;
  reasoning: string;
  recommendedApproach?: string;
  keyMilestones?: unknown[];
  competitorAnalysis?: string;
  talkingPoints?: unknown[];
  riskWarnings?: unknown[];
}

export function validateMatchResults<T extends MatchResultSchema = MatchResultSchema>(
  value: unknown
): ValidationResult<T[]> {
  const errors: string[] = [];
  if (!Array.isArray(value)) {
    return { success: false, errors: ["result must be a JSON array"] };
  }

  value.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`items[${index}] must be an object`);
      return;
    }
    if (!isNonEmptyString(item.accountId)) errors.push(`items[${index}].accountId is required`);
    if (!isNonEmptyString(item.companyName)) errors.push(`items[${index}].companyName is required`);
    if (typeof item.matchScore !== "number") errors.push(`items[${index}].matchScore must be a number`);
    if (!isNonEmptyString(item.reasoning)) errors.push(`items[${index}].reasoning is required`);
    if (item.keyMilestones !== undefined && !Array.isArray(item.keyMilestones)) {
      errors.push(`items[${index}].keyMilestones must be an array`);
    }
    if (item.talkingPoints !== undefined && !Array.isArray(item.talkingPoints)) {
      errors.push(`items[${index}].talkingPoints must be an array`);
    }
    if (item.riskWarnings !== undefined && !Array.isArray(item.riskWarnings)) {
      errors.push(`items[${index}].riskWarnings must be an array`);
    }
  });

  return {
    success: errors.length === 0,
    data: errors.length === 0 ? value as T[] : undefined,
    errors,
  };
}
