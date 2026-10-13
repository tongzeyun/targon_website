/**
 * Web search pipeline based on DuckDuckGo HTML search.
 *
 * The crawler may persist raw signals and candidate intelligence only.
 * Formal projects require explicit promotion.
 */

import * as cheerio from "cheerio";
import { ensureClient, AI_MODEL, withRetry } from "@/lib/ai/client";
import { runAiTask } from "@/lib/ai/run-task";
import { validateBatchExtractResult, type BatchExtractResult } from "@/lib/ai/schemas/batch-extract";
import { validateNumberArray } from "@/lib/ai/schemas/generic";
import { fetchPageText } from "./fetch-page";
import {
  createEvidenceLink,
  createIntelligenceItem,
  createIntelligenceSource,
  findIntelligenceItemByTitle,
  normalizeTitle,
} from "@/lib/repositories/intelligence-repository";
import { createSignalForOrg, listSignalSourceUrls } from "@/lib/repositories/signal-repository";
import { v4 as uuid } from "uuid";

const now = () => new Date().toISOString();

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface SearchStats {
  keywords: string[];
  totalResults: number;
  fetched: number;
  extracted: number;
  saved: number;
  projects: number;
  candidateItems: number;
  results: { title: string; url: string; companyName: string; budgetAmount: string }[];
  errors: string[];
}

type ExtractedBid = BatchExtractResult;

async function searchDuckDuckGo(query: string, maxPages = 2): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  for (let page = 0; page < maxPages; page++) {
    const start = page * 30;
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&s=${start}`;

    try {
      const html = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html",
          "Accept-Language": "zh-CN,zh;q=0.9",
        },
        signal: AbortSignal.timeout(10000),
      }).then((response) => response.text());

      const $ = cheerio.load(html);
      $(".result, .web-result, article").each((_, element) => {
        const titleEl = $(element).find(".result__title, .result__a, h2 a, a.result-link").first();
        const snippetEl = $(element).find(".result__snippet, .result__body, .snippet").first();
        const title = titleEl.text().trim();
        const link = titleEl.attr("href") || "";
        const snippet = snippetEl.text().trim();

        if (title && link && link.startsWith("http")) {
          results.push({ title, url: link, snippet });
        }
      });

      if (results.length === 0) break;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch {
      break;
    }
  }

  return results;
}

async function filterRelevant(
  results: SearchResult[],
  keywords: string[],
  organizationId: string,
  userId: string
): Promise<SearchResult[]> {
  if (results.length === 0) return [];

  const ai = await ensureClient();
  const relevant: SearchResult[] = [];

  for (let i = 0; i < results.length; i += 15) {
    const batch = results.slice(i, i + 15);
    const items = batch.map((result, index) => `[${index}] ${result.title}\n${result.snippet.slice(0, 100)}`).join("\n\n");

    try {
      const model = AI_MODEL();
      const systemPrompt = `Judge whether each search result is relevant to keywords: ${keywords.join(", ")}. Only select real tender or procurement notices. Return a JSON array of indexes.`;
      const userPrompt = `${items}\n\nReturn relevant indexes, for example: [0, 3, 7]`;
      const result = await runAiTask<number[]>({
        organizationId,
        userId,
        taskType: "crawler_filter_relevant_results",
        promptVersion: "crawler-filter-relevant-results:v1",
        schemaName: "number_array",
        model,
        provider: "deepseek",
        input: { keywords, batch, systemPrompt, userPrompt },
        validate: validateNumberArray,
        callModel: async () => {
          const response = await withRetry(() => ai.chat.completions.create({
            model,
            max_tokens: 300,
            temperature: 0,
            ...{ thinking: { type: "disabled" as const } },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          }), "crawlerFilterRelevant");
          return { rawOutput: response.choices[0]?.message?.content || "", tokenUsage: response.usage };
        },
      });

      for (const index of result.data) {
        if (index >= 0 && index < batch.length) relevant.push(batch[index]);
      }
    } catch (error) {
      console.warn("[Crawler] filterRelevant AI fail:", error instanceof Error ? error.message : String(error));
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return relevant;
}

export async function searchAndExtract(
  keywords: string[],
  organizationId: string,
  userId: string,
  sites: string[] = ["ccgp.gov.cn", "cebpubservice.com"]
): Promise<SearchStats> {
  const stats: SearchStats = {
    keywords,
    totalResults: 0,
    fetched: 0,
    extracted: 0,
    saved: 0,
    projects: 0,
    candidateItems: 0,
    results: [],
    errors: [],
  };

  const existingUrls = new Set(await listSignalSourceUrls(organizationId));

  const queries: string[] = [];
  for (const keyword of keywords) {
    for (const site of sites.slice(0, 2)) {
      queries.push(`${keyword} site:${site}`);
    }
  }

  const allResults: SearchResult[] = [];
  for (const query of queries.slice(0, 6)) {
    const results = await searchDuckDuckGo(query, 1);
    allResults.push(...results);

    if (results.length === 0 && sites.length > 0) {
      const broadResults = await searchDuckDuckGo(keywords.join(" "), 1);
      allResults.push(...broadResults);
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  const seen = new Set<string>();
  const unique = allResults.filter((result) => {
    if (seen.has(result.url) || existingUrls.has(result.url)) return false;
    seen.add(result.url);
    return true;
  });

  stats.totalResults = unique.length;

  const relevant = await filterRelevant(unique, keywords, organizationId, userId);
  const ai = await ensureClient();

  for (const item of relevant.slice(0, 20)) {
    stats.fetched++;

    let html = "";
    try {
      html = await fetchPageText(item.url);
    } catch {
      stats.errors.push(`Fetch failed: ${item.url.slice(0, 80)}`);
      continue;
    }

    const $ = cheerio.load(html);
    const text = ($("article, .content, .detail, .main, body").text() || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 10000);

    if (text.length < 200) continue;

    try {
      const model = AI_MODEL();
      const systemPrompt = "Extract tender/procurement information from the provided page text. Only use facts explicitly present in the text. Return JSON only.";
      const userPrompt = `Source: ${item.url}

Page text:
${text.slice(0, 8000)}

Return JSON:
{
  "title": "original title",
  "companyName": "buyer/procuring organization",
  "projectName": "project name",
  "budgetAmount": "budget amount",
  "deadline": "deadline",
  "location": "location",
  "contactPerson": "contact person if present",
  "contactPhone": "contact phone if present",
  "requirements": "procurement requirements",
  "description": "short description",
  "matchScore": 80
}`;

      const aiResult = await runAiTask<ExtractedBid>({
        organizationId,
        userId,
        taskType: "crawler_extract_bid_page",
        promptVersion: "crawler-extract-bid-page:v1",
        schemaName: "crawler_extracted_bid",
        model,
        provider: "deepseek",
        input: { url: item.url, systemPrompt, userPrompt },
        validate: validateBatchExtractResult,
        callModel: async () => {
          const response = await withRetry(() => ai.chat.completions.create({
            model,
            max_tokens: 1500,
            temperature: 0,
            ...{ thinking: { type: "disabled" as const } },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          }), "crawlerExtractBidPage");
          return { rawOutput: response.choices[0]?.message?.content || "", tokenUsage: response.usage };
        },
      });

      const extracted = aiResult.data;
      const companyName = String(extracted.companyName || "").trim();
      if (companyName && companyName.length > 3 && !text.includes(companyName.slice(0, 4))) continue;
      if ((extracted.matchScore || 0) < 50) continue;

      stats.extracted++;

      const signalId = uuid();
      await createSignalForOrg(organizationId, {
        id: signalId,
        signalType: "bid",
        sourceUrl: item.url,
        sourceName: new URL(item.url).hostname,
        title: extracted.title || item.title,
        publishDate: now(),
        extractedData: extracted,
        relevanceScore: extracted.matchScore || 80,
        isProcessed: true,
        processedAt: now(),
        aiRunId: aiResult.aiRunId,
      });

      stats.saved++;
      stats.results.push({
        title: extracted.title || item.title,
        url: item.url,
        companyName,
        budgetAmount: extracted.budgetAmount || "",
      });

      if (companyName.length > 2) {
        const candidateTitle = extracted.projectName || extracted.title || item.title;
        const normalized = normalizeTitle(candidateTitle);
        const existingCandidate = await findIntelligenceItemByTitle(organizationId, "candidate_project", normalized);

        if (!existingCandidate) {
          const sourceId = await createIntelligenceSource({
            organizationId,
            sourceUrl: item.url,
            sourceName: new URL(item.url).hostname,
            sourceType: "crawler_search",
            rawContent: text,
            metadata: { signalId, keywords, aiRunId: aiResult.aiRunId },
          });

          const candidateItemId = await createIntelligenceItem({
            organizationId,
            sourceId,
            itemType: "candidate_project",
            title: candidateTitle,
            normalizedTitle: normalized,
            extractedJson: {
              ...extracted,
              signalId,
              sourceUrl: item.url,
              sourceTitle: item.title,
            },
            confidenceScore: extracted.matchScore || 80,
            status: "candidate",
            aiRunId: aiResult.aiRunId,
          });

          await createEvidenceLink({
            itemId: candidateItemId,
            fieldName: "project",
            evidenceText: extracted.description || extracted.requirements || extracted.title || item.snippet,
            sourceUrl: item.url,
            confidenceScore: extracted.matchScore || 80,
          });

          stats.candidateItems++;
        }
      }
    } catch (error) {
      console.warn("[Crawler] AI extract fail:", error instanceof Error ? error.message : String(error));
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return stats;
}
