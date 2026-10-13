import { isRecord, type ValidationResult } from "./types";

export interface EnrichedStrategyCardSchema {
  recommendedApproach: string;
  keyMilestones: unknown[];
  competitorAnalysis: string;
  talkingPoints: unknown[];
  riskWarnings: unknown[];
}

export interface EnrichedAccountSchema {
  companyInfo: Record<string, unknown>;
  decisionChain?: unknown[];
  contacts?: Array<{
    role?: string;
    department?: string;
    influence?: number;
    typicalBackground?: string;
    howToFind?: string;
    approachTips?: string;
    linkedinSearchHint?: string;
  }>;
  strategyCard?: EnrichedStrategyCardSchema;
  [key: string]: unknown;
}

export function validateEnrichedAccount<T extends EnrichedAccountSchema = EnrichedAccountSchema>(
  value: unknown,
  options: { requireStrategyCard?: boolean } = {}
): ValidationResult<T> {
  if (!isRecord(value)) {
    return { success: false, errors: ["result must be a JSON object"] };
  }

  const errors: string[] = [];
  if (!isRecord(value.companyInfo)) errors.push("companyInfo must be an object");
  if (value.decisionChain !== undefined && !Array.isArray(value.decisionChain)) {
    errors.push("decisionChain must be an array");
  }
  if (value.contacts !== undefined && !Array.isArray(value.contacts)) {
    errors.push("contacts must be an array");
  }
  if (Array.isArray(value.contacts)) {
    value.contacts.forEach((contact, index) => {
      if (!isRecord(contact)) {
        errors.push(`contacts[${index}] must be an object`);
        return;
      }
      if (contact.influence !== undefined && typeof contact.influence !== "number") {
        errors.push(`contacts[${index}].influence must be a number`);
      }
    });
  }
  if (options.requireStrategyCard && !isRecord(value.strategyCard)) {
    errors.push("strategyCard must be an object when an account product is available");
  }
  if (isRecord(value.strategyCard)) {
    if (typeof value.strategyCard.recommendedApproach !== "string") {
      errors.push("strategyCard.recommendedApproach must be a string");
    }
    if (!Array.isArray(value.strategyCard.keyMilestones)) {
      errors.push("strategyCard.keyMilestones must be an array");
    }
    if (typeof value.strategyCard.competitorAnalysis !== "string") {
      errors.push("strategyCard.competitorAnalysis must be a string");
    }
    if (!Array.isArray(value.strategyCard.talkingPoints)) {
      errors.push("strategyCard.talkingPoints must be an array");
    }
    if (!Array.isArray(value.strategyCard.riskWarnings)) {
      errors.push("strategyCard.riskWarnings must be an array");
    }
  }

  return {
    success: errors.length === 0,
    data: errors.length === 0 ? value as T : undefined,
    errors,
  };
}
