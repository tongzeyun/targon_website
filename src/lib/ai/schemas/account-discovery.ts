import { isNonEmptyString, isRecord, type ValidationResult } from "./types";

export interface DiscoveredAccountSchema {
  companyName: string;
  industry?: string;
  subIndustry?: string;
  size?: string;
  location?: string;
  website?: string;
  techStack?: Record<string, unknown>;
  matchScore?: number;
  matchReasoning?: string;
  contacts?: unknown[];
  decisionChain?: unknown[];
  recommendedApproach?: string;
  keyMilestones?: unknown[];
  competitorAnalysis?: string;
  talkingPoints?: unknown[];
  riskWarnings?: unknown[];
  [key: string]: unknown;
}

export function validateDiscoveredAccounts<T extends DiscoveredAccountSchema = DiscoveredAccountSchema>(
  value: unknown
): ValidationResult<T[]> {
  const errors: string[] = [];
  if (!Array.isArray(value)) {
    return { success: false, errors: ["result must be a JSON array"] };
  }

  value.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`accounts[${index}] must be an object`);
      return;
    }
    if (!isNonEmptyString(item.companyName)) errors.push(`accounts[${index}].companyName is required`);
    if (item.matchScore !== undefined && typeof item.matchScore !== "number") {
      errors.push(`accounts[${index}].matchScore must be a number`);
    }
    if (item.techStack !== undefined && !isRecord(item.techStack)) {
      errors.push(`accounts[${index}].techStack must be an object`);
    }
    if (item.contacts !== undefined && !Array.isArray(item.contacts)) {
      errors.push(`accounts[${index}].contacts must be an array`);
    }
    if (item.decisionChain !== undefined && !Array.isArray(item.decisionChain)) {
      errors.push(`accounts[${index}].decisionChain must be an array`);
    }
    if (item.keyMilestones !== undefined && !Array.isArray(item.keyMilestones)) {
      errors.push(`accounts[${index}].keyMilestones must be an array`);
    }
    if (item.talkingPoints !== undefined && !Array.isArray(item.talkingPoints)) {
      errors.push(`accounts[${index}].talkingPoints must be an array`);
    }
    if (item.riskWarnings !== undefined && !Array.isArray(item.riskWarnings)) {
      errors.push(`accounts[${index}].riskWarnings must be an array`);
    }
  });

  return {
    success: errors.length === 0,
    data: errors.length === 0 ? value as T[] : undefined,
    errors,
  };
}
