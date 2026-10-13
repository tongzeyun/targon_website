"use server";

import { ensureClient, AI_REASONER_MODEL, withRetry } from "./client";
import { runAiTask } from "./run-task";
import { validateMatchResults } from "./schemas/matching";
import type { AuthContext } from "@/lib/api/auth";
import { getProduct } from "@/lib/repositories/product-repository";
import { listAccountsForMatching, updateAccountMatchResult } from "@/lib/repositories/account-repository";
import { createStrategyCard } from "@/lib/repositories/strategy-card-repository";

interface MatchResult {
  accountId: string;
  companyName: string;
  matchScore: number;
  reasoning: string;
  recommendedApproach: string;
  keyMilestones: { stage: string; action: string; expectedDate?: string; riskLevel: string; tips: string }[];
  competitorAnalysis: string;
  talkingPoints: string[];
  riskWarnings: string[];
}

const orgCtx = (organizationId: string): AuthContext => ({
  userId: "ai-worker",
  organizationId,
  role: "system",
});

export async function matchProductToAccounts(
  productId: string,
  organizationId: string,
  userId: string
): Promise<MatchResult[]> {
  const ai = await ensureClient();

  const product = await getProduct(productId, organizationId);
  if (!product) throw new Error("未找到产品");

  const accounts = await listAccountsForMatching(organizationId);

  const systemPrompt = `你是B2B销售策略专家。分析产品对每个客户的匹配度，为高匹配客户生成销售策略。根据产品特征自动判断客户行业。`;

  const userPrompt = `## 产品
${JSON.stringify({ name: product.name, category: product.category, model: product.model, specs: product.specs, targetIndustries: product.targetIndustries, applications: product.applications, competitorProducts: product.competitorProducts })}

## 客户列表 (${accounts.length}家)
${JSON.stringify(accounts.map((a) => ({ id: a.id, name: a.companyName, industry: a.industry, subIndustry: a.subIndustry, size: a.size, locations: a.locations, techStack: a.techStack })))}

## 任务
分析每个客户匹配度(0-100分)。对>=60分的客户生成策略。里程碑 expectedDate 必须使用 YYYY-MM-DD；无法确定具体日期时省略该字段。返回纯JSON数组：
[{"accountId":"...","companyName":"...","matchScore":85,"reasoning":"...","recommendedApproach":"技术切入","keyMilestones":[{"stage":"技术交流","action":"...","expectedDate":"2026-09-30","riskLevel":"low","tips":"..."}],"competitorAnalysis":"...","talkingPoints":["..."],"riskWarnings":["..."]}]`;

  const model = AI_REASONER_MODEL();
  const aiResult = await runAiTask<MatchResult[]>({
    organizationId,
    userId,
    taskType: "match_product_to_accounts",
    promptVersion: "match-product-to-accounts:v1",
    schemaName: "match_results",
    model,
    provider: "deepseek",
    input: { productId, systemPrompt, userPrompt },
    validate: validateMatchResults,
    callModel: async () => {
      const response = await withRetry(() => ai.chat.completions.create({
        model, max_tokens: 8000, temperature: 0.3,
        ...{ thinking: { type: "enabled" as const } },
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      }), "matchProduct");
      return { rawOutput: response.choices[0]?.message?.content || "", tokenUsage: response.usage };
    },
  });
  const results = aiResult.data;

  const ctx = orgCtx(organizationId);
  for (const r of results) {
    if (r.matchScore >= 60) {
      await createStrategyCard(ctx, {
        accountId: r.accountId,
        productId,
        recommendedApproach: r.recommendedApproach,
        keyMilestones: r.keyMilestones,
        competitorAnalysis: r.competitorAnalysis,
        talkingPoints: r.talkingPoints,
        riskWarnings: r.riskWarnings,
        generatedBy: model,
        aiRunId: aiResult.aiRunId,
      });
      await updateAccountMatchResult(organizationId, r.accountId, {
        matchScore: r.matchScore,
        matchReasoning: r.reasoning,
        aiRunId: aiResult.aiRunId,
      });
    }
  }

  return results;
}
