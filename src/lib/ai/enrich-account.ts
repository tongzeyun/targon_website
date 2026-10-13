"use server";

import { ensureClient, AI_REASONER_MODEL, withRetry } from "./client";
import { runAiTask } from "./run-task";
import { validateEnrichedAccount } from "./schemas/enrichment";
import type { AuthContext } from "@/lib/api/auth";
import { getAccount, updateAccountFromEnrichment } from "@/lib/repositories/account-repository";
import { replaceDecisionChainForAccount } from "@/lib/repositories/decision-chain-repository";
import { insertEnrichedContactsForAccount } from "@/lib/repositories/contact-repository";
import { getLatestProductIdForAccount } from "@/lib/repositories/pipeline-repository";
import { getProduct } from "@/lib/repositories/product-repository";
import { createStrategyCard } from "@/lib/repositories/strategy-card-repository";

interface EnrichedContact {
  role?: string;
  department?: string;
  influence?: number;
  typicalBackground?: string;
  howToFind?: string;
  approachTips?: string;
  linkedinSearchHint?: string;
}

interface EnrichedAccount {
  companyInfo: Record<string, unknown>;
  decisionChain?: unknown[];
  contacts?: EnrichedContact[];
  strategyCard?: {
    recommendedApproach: string;
    keyMilestones: unknown[];
    competitorAnalysis: string;
    talkingPoints: unknown[];
    riskWarnings: unknown[];
  };
}

const orgCtx = (organizationId: string): AuthContext => ({
  userId: "ai-worker",
  organizationId,
  role: "system",
});

export async function enrichAccount(accountId: string, organizationId: string, userId: string) {
  const ai = await ensureClient();

  const account = await getAccount(accountId, organizationId);
  if (!account) throw new Error("客户不存在");

  const productId = await getLatestProductIdForAccount(accountId, organizationId);
  const product = productId ? await getProduct(productId, organizationId) : null;

  const companyName = account.companyName as string;

  const systemPrompt = `你是企业信息研究专家。你精通企业背景调查、组织架构分析和关键人物识别。

规则：
1. 只提供你高度确信的信息（置信度>80%）
2. 不确定的信息标注为"待核实"
3. 不要编造具体人名——如果不知道确切姓名，可以写该职位的典型人物特征
4. 公司基本信息（行业、规模、地点、官网）必须真实
5. 根据该公司的实际行业进行分析，不要预设行业
6. 如果提供了关联产品，销售策略必须针对该产品和目标公司的实际业务场景`;

  const userPrompt = `## 目标公司
${companyName}

## 当前信息
行业: ${account.industry || "未知"}
子行业: ${account.subIndustry || ""}
规模: ${account.size || "未知"}
所在地: ${account.locations || ""}
官网: ${account.website || "未知"}

## 关联产品
${product ? JSON.stringify({
  name: product.name,
  category: product.category,
  model: product.model,
  specs: product.specs,
  applications: product.applications,
  competitorProducts: product.competitorProducts,
  description: product.description,
}) : "暂无关联产品；仅完善客户资料，不要返回 strategyCard"}

## 任务
请尽可能完善这家公司的信息。返回JSON：

{
  "companyInfo": {
    "industry": "准确的行业分类",
    "subIndustry": "子行业",
    "size": "员工规模（如10000+人）",
    "revenue": "年营收（如约300亿人民币）",
    "website": "官网URL",
    "founded": "成立年份",
    "headquarters": "总部城市",
    "locations": [{"city": "城市", "province": "省份", "type": "HQ/Fab/R&D"}],
    "techStack": {"工艺": "28nm/14nm", "晶圆尺寸": "12寸", "月产能": "5万片"},
    "description": "100字公司简介"
  },
  "decisionChain": [
    {"step": "技术评估", "typicalRole": "具体职位（如刻蚀工艺部部长）", "influence": 5, "notes": "该职位的决策要点"},
    {"step": "设备选型", "typicalRole": "设备工程部总监", "influence": 5, "notes": "决策要点"},
    {"step": "采购执行", "typicalRole": "采购部高级经理", "influence": 3, "notes": "决策要点"},
    {"step": "最终审批", "typicalRole": "厂长/VP", "influence": 5, "notes": "决策要点"}
  ],
  "contacts": [
    {
      "role": "具体职位（如刻蚀工艺部部长）",
      "department": "工艺部",
      "influence": 5,
      "typicalBackground": "该职位典型背景描述（如'一般是博士学历，有15年+半导体工艺经验'）",
      "howToFind": "如何找到该职位的人（如'SEMICON China设备论坛、中国半导体行业协会工艺专题会'）",
      "approachTips": "触达建议",
      "linkedinSearchHint": "脉脉搜索关键词建议"
    }
  ],
  "purchaseHistory": "该公司真空设备的采购历史和偏好（如有）",
  "competitorRelationship": "该公司与主要竞品(Edwards/Pfeiffer/VAT等)的关系"${product ? `,
  "strategyCard": {
    "recommendedApproach": "针对关联产品的推荐销售切入策略",
    "keyMilestones": [
      {"stage": "技术交流", "action": "具体行动", "expectedDate": "YYYY-MM-DD", "riskLevel": "low/medium/high", "tips": "执行提示"}
    ],
    "competitorAnalysis": "该产品在目标公司的竞品及竞争态势",
    "talkingPoints": ["面向目标客户的沟通要点"],
    "riskWarnings": ["销售推进风险"]
  }` : ""}
}`;

  const model = AI_REASONER_MODEL();
  const aiResult = await runAiTask<EnrichedAccount>({
    organizationId,
    userId,
    taskType: "enrich_account",
    promptVersion: "enrich-account:v1",
    schemaName: "enriched_account",
    model,
    provider: "deepseek",
    input: {
      accountId,
      companyName,
      productId,
      productName: product?.name || null,
      systemPrompt,
      userPrompt,
    },
    validate: (value) => validateEnrichedAccount(value, { requireStrategyCard: !!product }),
    callModel: async () => {
      const response = await withRetry(() => ai.chat.completions.create({
        model, max_tokens: 32000, temperature: 0.2,
        ...{ thinking: { type: "enabled" as const } },
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      }), "enrichAccount");
      return {
        rawOutput: response.choices[0]?.message?.content || "",
        tokenUsage: response.usage,
        finishReason: response.choices[0]?.finish_reason,
      };
    },
  });
  const enriched = aiResult.data;

  const ci = enriched.companyInfo || {};
  const locations = Array.isArray(ci.locations) ? ci.locations : [];
  const techStack = ci.techStack && typeof ci.techStack === "object" ? ci.techStack : {};
  await updateAccountFromEnrichment(
    organizationId,
    accountId,
    {
      industry: String(ci.industry || account.industry || ""),
      subIndustry: String(ci.subIndustry || account.subIndustry || ""),
      size: String(ci.size || account.size || ""),
      revenue: String(ci.revenue || account.revenue || ""),
      website: String(ci.website || account.website || ""),
      locations,
      techStack,
    },
    aiResult.aiRunId
  );

  const ctx = orgCtx(organizationId);
  const decisionChain = Array.isArray(enriched.decisionChain) ? enriched.decisionChain : [];
  if (decisionChain.length > 0) {
    await replaceDecisionChainForAccount(ctx, accountId, {
      steps: decisionChain,
      aiRunId: aiResult.aiRunId,
    });
  }

  const contacts = Array.isArray(enriched.contacts) ? enriched.contacts : [];
  if (contacts.length > 0) {
    await insertEnrichedContactsForAccount(ctx, accountId, contacts, aiResult.aiRunId);
  }

  if (productId && product && enriched.strategyCard) {
    await createStrategyCard(ctx, {
      accountId,
      productId,
      recommendedApproach: enriched.strategyCard.recommendedApproach,
      keyMilestones: enriched.strategyCard.keyMilestones,
      competitorAnalysis: enriched.strategyCard.competitorAnalysis,
      talkingPoints: enriched.strategyCard.talkingPoints,
      riskWarnings: enriched.strategyCard.riskWarnings,
      generatedBy: model,
      aiRunId: aiResult.aiRunId,
    });
  }

  return enriched;
}
