import { isNonEmptyString, isRecord, type ValidationResult } from "./types";

export interface DeepResearchReport {
  marketAnalysis: {
    targetIndustries?: string[];
    industryBreakdown?: { industry: string; demandDrivers: string; estimatedMarket: string }[];
    companySizeRange?: string;
    geographicHotspots?: string[];
    buyingCycle?: string;
    budgetRange?: string;
  };
  buyerProfile?: {
    companyTypes?: string[];
    typicalScale?: string;
    typicalProcesses?: string[];
    urgencyLevel?: string;
  };
  targetAccounts: {
    companyName: string;
    industry?: string;
    province?: string;
    location?: string;
    whyTarget?: string;
    matchScore?: number;
    orgStructure?: {
      relevantDepts?: string[];
      decisionChain?: { step: string; typicalRole: string; influence: number; notes: string }[];
    };
    decisionChain?: { step: string; typicalRole: string; influence: number; notes: string }[];
    keyContacts?: {
      role: string;
      department?: string;
      influence?: number;
      howToFind?: string;
      approachTips?: string;
    }[];
  }[];
  outreachStrategy?: {
    primaryChannel?: string;
    channels?: { channel: string; effectiveness: string; tips: string }[];
    keyConferences?: string[];
    keyPlatforms?: string[];
    competitorIntel?: string;
  };
  actionPlan?: {
    week1?: string[];
    week2_4?: string[];
    month2_3?: string[];
    kpis?: string[];
  };
}

export function validateDeepResearchReport(value: unknown): ValidationResult<DeepResearchReport> {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { success: false, errors: ["结果必须是 JSON 对象"] };
  }

  if (!isRecord(value.marketAnalysis)) errors.push("缺少 marketAnalysis 对象");
  if (!Array.isArray(value.targetAccounts)) {
    errors.push("缺少 targetAccounts 数组");
  } else {
    value.targetAccounts.forEach((account, index) => {
      if (!isRecord(account)) {
        errors.push(`targetAccounts[${index}] 必须是对象`);
        return;
      }
      if (!isNonEmptyString(account.companyName)) errors.push(`targetAccounts[${index}].companyName 不能为空`);
      if (account.matchScore !== undefined && typeof account.matchScore !== "number") {
        errors.push(`targetAccounts[${index}].matchScore 必须是数字`);
      }
      if (account.province !== undefined && typeof account.province !== "string") {
        errors.push(`targetAccounts[${index}].province 必须是字符串`);
      }
      if (account.keyContacts !== undefined && !Array.isArray(account.keyContacts)) {
        errors.push(`targetAccounts[${index}].keyContacts 必须是数组`);
      }
    });
  }

  return {
    success: errors.length === 0,
    data: errors.length === 0 ? value as unknown as DeepResearchReport : undefined,
    errors,
  };
}
