"use server";

import { ensureClient, AI_REASONER_MODEL, withRetry } from "./client";
import { runAiTask } from "./run-task";
import { validateDiscoveredAccounts } from "./schemas/account-discovery";
import { getProduct } from "@/lib/repositories/product-repository";
import { listAccountNames } from "@/lib/repositories/account-repository";
import {
  createEvidenceLink,
  createIntelligenceItem,
  createIntelligenceSource,
  findIntelligenceItemByTitle,
  normalizeTitle,
} from "@/lib/repositories/intelligence-repository";

interface DiscoverAccountsResult {
  created: number;
  updated: number;
  totalAccounts: number;
  candidateItems: number;
}

interface DiscoveredAccount extends Record<string, unknown> {
  companyName?: string;
  matchScore?: number;
  matchReasoning?: string;
  recommendedApproach?: string;
}

export async function discoverAccountsForProduct(
  productId: string,
  organizationId: string,
  userId: string,
  targetCount = 5
): Promise<DiscoverAccountsResult> {
  const ai = await ensureClient();

  const product = await getProduct(productId, organizationId);
  if (!product) throw new Error("Product not found");

  const existingAccounts = await listAccountNames(organizationId);
  const existingNames = new Set(
    existingAccounts.map((account) => String(account.companyName || "").toLowerCase())
  );

  const systemPrompt = [
    "You are a B2B sales intelligence analyst.",
    "Find real companies that may buy the product.",
    "Return only JSON. Do not invent contact details.",
    "AI output is candidate intelligence and must be verified before becoming formal business data.",
  ].join("\n");

  const userPrompt = `Product:
Name: ${product.name}
Category: ${product.category}
Model: ${product.model || "N/A"}
Specs: ${product.specs || ""}
Applications: ${product.applications || ""}
Competitors: ${product.competitorProducts || ""}
Price: ${product.priceRange || ""}

Existing accounts to exclude:
${[...existingNames].join(", ") || "none"}

Find at least ${targetCount} real companies in China that may buy this product.

Return JSON array only:
[{
  "companyName": "full legal company name",
  "industry": "industry",
  "subIndustry": "sub industry",
  "size": "company size if known",
  "location": "city",
  "website": "website if known",
  "techStack": {"process": "...", "productionLine": "..."},
  "matchScore": 85,
  "matchReasoning": "why this company may match",
  "contacts": [{"name": null, "title": "role/title", "department": "department", "roleInDecision": "decision role", "influenceLevel": 3}],
  "decisionChain": [{"step": "evaluation step", "title": "role/title", "influence": 3, "notes": "notes"}],
  "recommendedApproach": "recommended approach",
  "keyMilestones": [],
  "competitorAnalysis": "",
  "talkingPoints": [],
  "riskWarnings": []
}]`;

  const model = AI_REASONER_MODEL();
  const aiResult = await runAiTask<DiscoveredAccount[]>({
    organizationId,
    userId,
    taskType: "discover_accounts_for_product",
    promptVersion: "discover-accounts-for-product:v1",
    schemaName: "discovered_accounts",
    model,
    provider: "deepseek",
    input: { productId, targetCount, systemPrompt, userPrompt },
    validate: validateDiscoveredAccounts,
    callModel: async () => {
      const response = await withRetry(() => ai.chat.completions.create({
        model,
        max_tokens: 65536,
        temperature: 0.4,
        ...{ thinking: { type: "enabled" as const } },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }), "discoverAccounts");
      const text = response.choices[0]?.message?.content || "";
      console.log("AI Discover raw response length:", text.length);
      console.log("First 200 chars:", text.slice(0, 200));
      return { rawOutput: text, tokenUsage: response.usage };
    },
  });

  let created = 0;
  let updated = 0;

  for (const account of aiResult.data) {
    const companyName = String(account.companyName || "").trim();
    if (!companyName) continue;

    const nameLower = companyName.toLowerCase();
    const existingAccount = existingAccounts.find((existing) => {
      const existingName = String(existing.companyName || "").toLowerCase();
      return existingName === nameLower || existingName.includes(nameLower) || nameLower.includes(existingName);
    });

    if (existingAccount) {
      updated++;
      continue;
    }

    const normalized = normalizeTitle(companyName);
    const existingCandidate = await findIntelligenceItemByTitle(organizationId, "candidate_account", normalized);
    if (existingCandidate) continue;

    const sourceId = await createIntelligenceSource({
      organizationId,
      sourceName: "AI account discovery",
      sourceType: "ai_discover_accounts",
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
        source: "ai_discover_accounts",
      },
      confidenceScore: account.matchScore || null,
      status: "candidate",
      aiRunId: aiResult.aiRunId,
    });

    await createEvidenceLink({
      itemId: candidateItemId,
      fieldName: "companyName",
      evidenceText: account.matchReasoning || account.recommendedApproach || companyName,
      confidenceScore: account.matchScore || null,
    });

    created++;
  }

  console.log(`AI Discover: ${aiResult.data.length} found, ${created} candidates, ${updated} existing accounts skipped`);
  return {
    created,
    updated,
    totalAccounts: existingAccounts.length,
    candidateItems: created,
  };
}
