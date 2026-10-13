"use server";

import { ensureClient, AI_MODEL, withRetry } from "./client";
import { runAiTask } from "./run-task";
import { validateDeepResearchReport, type DeepResearchReport } from "./schemas/deep-research";
import {
  filterDeepResearchAccounts,
  getProductTargetIndustries,
  isChinaMainlandProvince,
  type DeepResearchFilters,
} from "./deep-research-filters";
import { getProduct } from "@/lib/repositories/product-repository";
import { listAccountNames } from "@/lib/repositories/account-repository";
import {
  createResearchReport,
  getLatestResearchReport,
} from "@/lib/repositories/research-report-repository";
import {
  createEvidenceLink,
  createIntelligenceItem,
  createIntelligenceSource,
  findIntelligenceItemByTitle,
  normalizeTitle,
} from "@/lib/repositories/intelligence-repository";

export async function deepResearch(
  productId: string,
  organizationId: string,
  userId: string,
  preview = false,
  filters: DeepResearchFilters = {}
): Promise<{ report: DeepResearchReport; accountsCreated: number; aiRunId: string }> {
  const ai = await ensureClient();

  const product = await getProduct(productId, organizationId);
  if (!product) throw new Error("Product not found");

  const industry = filters.industry?.trim() || undefined;
  const province = filters.province?.trim() || undefined;
  const productIndustries = getProductTargetIndustries(product.targetIndustries);
  if (industry && !productIndustries.includes(industry)) {
    throw new Error("Selected industry is not configured for this product");
  }
  if (province && !isChinaMainlandProvince(province)) {
    throw new Error("Selected province is not supported");
  }

  const existing = await listAccountNames(organizationId);
  const existingNames = new Set(existing.map((account) => String(account.companyName || "")));

  const systemPrompt = [
    "You are a senior B2B sales intelligence analyst.",
    "Generate actionable but verifiable sales intelligence.",
    "Do not invent people, phone numbers, or emails.",
    "AI output is candidate evidence, not formal business fact.",
    "Return JSON only.",
  ].join("\n");

  const userPrompt = `Product:
Name: ${product.name}
Category: ${product.category}
Model: ${product.model || ""}
Specs: ${product.specs || ""}
Applications: ${product.applications || ""}
Target industries: ${product.targetIndustries || ""}
Competitors: ${product.competitorProducts || ""}
Price range: ${product.priceRange || ""}

Existing accounts to exclude:
${[...existingNames].join(", ") || "none"}

Optional target constraints:
- Industry: ${industry || "not restricted"}
- Province: ${province || "not restricted"}
- When a constraint is provided, every target account must satisfy it.
- Copy the selected industry and province values exactly into each matching account.

Create a sales intelligence report and identify 12 to 15 candidate target accounts.

Return JSON object only:
{
  "marketAnalysis": {
    "targetIndustries": ["industry"],
    "industryBreakdown": [{"industry": "industry", "demandDrivers": "driver", "estimatedMarket": "estimate"}],
    "companySizeRange": "range",
    "geographicHotspots": ["city"],
    "buyingCycle": "cycle",
    "budgetRange": "range"
  },
  "targetAccounts": [
    {
      "companyName": "full legal company name",
      "industry": "${industry || "industry"}",
      "province": "${province || "province"}",
      "location": "city",
      "whyTarget": "why this company is a fit",
      "matchScore": 85,
      "decisionChain": [
        {"step": "technical evaluation", "typicalRole": "process manager", "influence": 5, "notes": "notes"}
      ],
      "keyContacts": [
        {"role": "role/title", "department": "department", "influence": 3, "howToFind": "where to find this role", "approachTips": "approach"}
      ]
    }
  ],
  "outreachStrategy": {
    "channels": [{"channel": "channel", "effectiveness": "high", "tips": "tips"}],
    "keyConferences": [],
    "keyPlatforms": [],
    "competitorIntel": ""
  },
  "actionPlan": {
    "week1": [],
    "week2_4": [],
    "month2_3": [],
    "kpis": []
  }
}`;

  const model = AI_MODEL();
  const aiResult = await runAiTask<DeepResearchReport>({
    organizationId,
    userId,
    taskType: "deep_research",
    promptVersion: "deep-research:v1",
    schemaName: "deep_research_report",
    model,
    provider: "deepseek",
    input: { productId, preview, filters: { industry, province }, systemPrompt, userPrompt },
    validate: validateDeepResearchReport,
    callModel: async () => {
      const response = await withRetry(() => ai.chat.completions.create({
        model,
        max_tokens: 32768,
        temperature: 0.3,
        ...{ thinking: { type: "disabled" as const } },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }), "deepResearch");

      const text = response.choices[0]?.message?.content || "";
      console.log("AI deep research raw response length:", text.length);
      return { rawOutput: text, tokenUsage: response.usage };
    },
  });

  const report: DeepResearchReport = {
    ...aiResult.data,
    targetAccounts: filterDeepResearchAccounts(aiResult.data.targetAccounts || [], {
      industry,
      province,
    }),
  };

  let accountsCreated = 0;
  if (!preview) {
    for (const account of (report.targetAccounts || []).slice(0, 15)) {
      const companyName = String(account.companyName || "").trim();
      if (!companyName || existingNames.has(companyName)) continue;

      const normalized = normalizeTitle(companyName);
      const existingCandidate = await findIntelligenceItemByTitle(organizationId, "candidate_account", normalized);
      if (existingCandidate) continue;

      const sourceId = await createIntelligenceSource({
        organizationId,
        sourceName: "AI deep research",
        sourceType: "deep_research",
        metadata: { productId, aiRunId: aiResult.aiRunId },
      });

      const candidateItemId = await createIntelligenceItem({
        organizationId,
        sourceId,
        itemType: "candidate_account",
        title: companyName,
        normalizedTitle: normalized,
        extractedJson: {
          ...account,
          companyName,
          productId,
          source: "deep_research",
        },
        confidenceScore: account.matchScore || null,
        status: "candidate",
        aiRunId: aiResult.aiRunId,
      });

      await createEvidenceLink({
        itemId: candidateItemId,
        fieldName: "companyName",
        evidenceText: account.whyTarget || companyName,
        confidenceScore: account.matchScore || null,
      });

      accountsCreated++;
    }
  }

  await createResearchReport(organizationId, {
    productId,
    reportJson: report,
    accountsCreated,
    aiRunId: aiResult.aiRunId,
  });

  return { report, accountsCreated, aiRunId: aiResult.aiRunId };
}

export async function getLatestReport(organizationId: string, productId?: string) {
  return getLatestResearchReport(organizationId, productId);
}
