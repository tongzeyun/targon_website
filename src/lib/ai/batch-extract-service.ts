"use server";

import * as cheerio from "cheerio";
import { v4 as uuid } from "uuid";
import { ensureClient, AI_MODEL, withRetry } from "@/lib/ai/client";
import { runAiTask } from "@/lib/ai/run-task";
import { validateBatchExtractResult, type BatchExtractResult } from "@/lib/ai/schemas/batch-extract";
import { fetchPageText } from "@/lib/crawler/fetch-page";
import {
  createEvidenceLink,
  createIntelligenceItem,
  createIntelligenceSource,
  normalizeTitle,
} from "@/lib/repositories/intelligence-repository";
import { createSignalForOrg } from "@/lib/repositories/signal-repository";

const now = () => new Date().toISOString();

export interface BatchExtractUrlResult {
  ok: boolean;
  title: string | null;
  companyName: string;
  budgetAmount: string;
  matchScore: number;
  projectCreated: boolean;
  candidateCreated: boolean;
  candidateItemId: string;
  signalId: string;
  sourceUrl: string;
}

export async function batchExtractUrl(
  organizationId: string,
  userId: string,
  url: string
): Promise<BatchExtractUrlResult> {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    throw new Error("batch_extract_url payload.url is required");
  }

  console.log("Fetching:", trimmedUrl.slice(0, 80));
  const html = await fetchPageText(trimmedUrl);
  const text = cheerio.load(html)("body").text().replace(/\s+/g, " ").trim().slice(0, 12000);

  if (text.length < 100) {
    throw new Error("网页内容过短，可能是动态渲染页面");
  }

  const ai = await ensureClient();
  const model = AI_MODEL();
  const systemPrompt = "只提取网页原文中明确出现的信息。没有的字段填null，禁止编造。禁止写'某公司'等占位词。";
  const userPrompt = `来源: ${new URL(trimmedUrl).hostname}\n\n正文:\n${text.slice(0, 8000)}\n\n逐字段提取，没有则填null:\n{\n  "title": "标题（原文复制）",\n  "companyName": "采购单位（原文复制）",\n  "projectName": "项目名称",\n  "budgetAmount": "预算金额",\n  "deadline": "截止日期",\n  "location": "所在地",\n  "description": "100字描述",\n  "contactPerson": "联系人（原文标注才填）",\n  "contactPhone": "电话（原文标注才填）",\n  "requirements": "采购需求",\n  "matchScore": 0-100\n}`;

  const aiResult = await runAiTask<BatchExtractResult>({
    organizationId,
    userId,
    taskType: "batch_extract_url",
    promptVersion: "batch-extract-url:v1",
    schemaName: "batch_extracted_signal",
    model,
    provider: "deepseek",
    input: { url: trimmedUrl, systemPrompt, userPrompt },
    validate: validateBatchExtractResult,
    callModel: async () => {
      const extractResp = await withRetry(() => ai.chat.completions.create({
        model,
        max_tokens: 1500,
        temperature: 0,
        ...{ thinking: { type: "disabled" as const } },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }), "batchExtractUrl");
      return { rawOutput: extractResp.choices[0]?.message?.content || "", tokenUsage: extractResp.usage };
    },
  });
  const extracted = aiResult.data;

  const cn = (extracted.companyName || "").trim();
  if (cn && cn.length > 3 && !cn.includes("某") && !text.includes(cn.slice(0, 4))) {
    throw new Error(`验证失败: 提取的采购单位"${cn}"未在网页中找到`);
  }

  if ((extracted.matchScore || 0) < 50) {
    throw new Error("该网页不包含真空设备/半导体设备相关采购信息");
  }

  const signalId = uuid();
  const companyName = extracted.companyName || "";
  const budgetStr = extracted.budgetAmount || "";
  const hostname = new URL(trimmedUrl).hostname;
  const confidenceScore = extracted.matchScore || 70;

  await createSignalForOrg(organizationId, {
    id: signalId,
    signalType: "bid",
    sourceUrl: trimmedUrl,
    sourceName: hostname,
    title: extracted.title || "未知",
    publishDate: new Date().toISOString(),
    extractedData: extracted,
    relevanceScore: confidenceScore,
    isProcessed: true,
    processedAt: now(),
    aiRunId: aiResult.aiRunId,
  });

  const sourceId = await createIntelligenceSource({
    organizationId,
    sourceUrl: trimmedUrl,
    sourceName: hostname,
    sourceType: "batch_extract_url",
    rawContent: text.slice(0, 12000),
    metadata: { signalId, aiRunId: aiResult.aiRunId },
  });

  const candidateTitle = extracted.projectName || extracted.title || "未命名项目";
  const candidateItemId = await createIntelligenceItem({
    organizationId,
    sourceId,
    itemType: "candidate_project",
    title: candidateTitle,
    normalizedTitle: normalizeTitle(candidateTitle),
    extractedJson: { ...extracted, signalId },
    confidenceScore,
    status: "candidate",
    aiRunId: aiResult.aiRunId,
  });

  await createEvidenceLink({
    itemId: candidateItemId,
    fieldName: "project",
    evidenceText: extracted.description || extracted.title || "",
    sourceUrl: trimmedUrl,
    confidenceScore,
  });

  return {
    ok: true,
    title: extracted.title ?? null,
    companyName,
    budgetAmount: budgetStr,
    matchScore: extracted.matchScore || confidenceScore,
    projectCreated: false,
    candidateCreated: true,
    candidateItemId,
    signalId,
    sourceUrl: trimmedUrl,
  };
}
