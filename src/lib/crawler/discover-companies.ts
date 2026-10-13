/**
 * 爬虫全网搜集真实客户 — 搜索招标/采购公告/行业新闻中的公司名
 *
 * 无需额外 API Key，基于 DuckDuckGo 搜索。
 */

import * as cheerio from "cheerio";
import { ensureClient, AI_MODEL, withRetry } from "@/lib/ai/client";
import { listAccountNames } from "@/lib/repositories/account-repository";
import { runAiTask } from "@/lib/ai/run-task";
import { validateDiscoveredCompanies, type DiscoveredCompany } from "@/lib/ai/schemas/company-discovery";
import {
  createEvidenceLink,
  createIntelligenceItem,
  createIntelligenceSource,
  findIntelligenceItemByTitle,
  normalizeTitle,
} from "@/lib/repositories/intelligence-repository";

interface DiscoverStats {
  keywords: string[];
  searched: number;
  found: number;
  newAccounts: number;
  candidateItems: number;
  companies: { name: string; industry: string; source: string }[];
}

/**
 * DuckDuckGo HTML 搜索
 */
async function searchDDG(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  const allResults: { title: string; url: string; snippet: string }[] = [];

  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  try {
    const html = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html",
        "Accept-Language": "zh-CN,zh;q=0.9",
      },
      signal: AbortSignal.timeout(10000),
    }).then((r) => r.text());

    const $ = cheerio.load(html);

    $(".result, .web-result, article").each((_, el) => {
      const titleEl = $(el).find(".result__title, .result__a, h2 a, a.result-link").first();
      const snippetEl = $(el).find(".result__snippet, .result__body, .snippet").first();
      const title = titleEl.text().trim();
      const link = titleEl.attr("href") || "";
      const snippet = snippetEl.text().trim();

      if (title && link && link.startsWith("http")) {
        allResults.push({ title, url: link, snippet });
      }
    });
  } catch {
    // search failed, return empty
  }

  return allResults.slice(0, 20);
}

/**
 * 从网页搜索结果中提取公司名（AI辅助）
 */
async function extractCompaniesFromText(
  organizationId: string,
  userId: string,
  texts: { title: string; url: string; snippet: string }[]
): Promise<{ companies: DiscoveredCompany[]; aiRunId: string | null }> {
  if (texts.length === 0) return { companies: [], aiRunId: null };

  const ai = await ensureClient();
  const input = texts.map((t, i) => `[${i}] 标题: ${t.title}\n    URL: ${t.url}\n    摘要: ${t.snippet.slice(0, 150)}`).join("\n\n");

  try {
    const model = AI_MODEL();
    const result = await runAiTask<DiscoveredCompany[]>({
      organizationId,
      userId,
      taskType: "crawler_company_discovery",
      promptVersion: "crawler-company-discovery:v1",
      schemaName: "discovered_companies",
      model,
      provider: "deepseek",
      input: { searchResults: texts },
      validate: validateDiscoveredCompanies,
      callModel: async () => {
        const resp = await withRetry(() => ai.chat.completions.create({
          model,
          max_tokens: 2000,
          temperature: 0,
          ...{ thinking: { type: "disabled" as const } },
          messages: [
            {
              role: "system",
              content: `从搜索结果中提取所有中国公司名称。要求：
- 只提取真实存在的公司全称（如"中芯国际集成电路制造有限公司"）
- 排除政府部门、招标代理机构、新闻网站
- 公司名必须来自原文，不要编造
- 每家公司附带来源说明
- sourceIndex 必须填写对应搜索结果的序号`,
            },
            {
              role: "user",
              content: `${input}\n\n返回JSON数组：[{"name":"公司全称","source":"来源说明","sourceIndex":0}]`,
            },
          ],
        }), "crawlerCompanyDiscovery");
        return { rawOutput: resp.choices[0]?.message?.content || "", tokenUsage: resp.usage };
      },
    });
    return { companies: result.data, aiRunId: result.aiRunId };
  } catch {
    return { companies: [], aiRunId: null };
  }
}

/**
 * 爬虫全网搜索真实客户
 *
 * @param productKeywords 产品关键词（如["真空泵", "涡轮分子泵", "半导体设备"]）
 * @param organizationId
 * @param industry 目标行业
 * @returns 发现统计
 */
export async function discoverCompaniesFromWeb(
  productKeywords: string[],
  organizationId: string,
  userId: string,
  industry = "半导体"
): Promise<DiscoverStats> {
  const stats: DiscoverStats = {
    keywords: productKeywords,
    searched: 0,
    found: 0,
    newAccounts: 0,
    candidateItems: 0,
    companies: [],
  };

  // 从已有客户构建排除集合
  const existing = await listAccountNames(organizationId);
  const existingNames = new Set(
    existing.map((account) => String(account.companyName || "").toLowerCase())
  );

  // 搜索词模板：产品关键词 + 行业 + 采购/供应商
  const queries: string[] = [];
  for (const kw of productKeywords.slice(0, 3)) {
    queries.push(`${kw} ${industry} 采购`);
    queries.push(`${kw} 供应商 公司`);
    queries.push(`${industry} ${kw} 招标`);
    queries.push(`${industry} 设备 采购商`);
  }

  console.log(`🔍 爬虫搜索真实客户: ${productKeywords.join(", ")} (${industry})\n`);

  const allTexts: { title: string; url: string; snippet: string }[] = [];
  const seenUrls = new Set<string>();

  for (const q of queries.slice(0, 8)) {
    console.log(`  搜索: ${q}`);
    const results = await searchDDG(q);
    stats.searched += results.length;

    for (const r of results) {
      if (!seenUrls.has(r.url)) {
        seenUrls.add(r.url);
        allTexts.push({ title: r.title, url: r.url, snippet: r.snippet });
      }
    }
    console.log(`  → ${results.length} 条`);
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log(`\n📋 去重后: ${allTexts.length} 条，提取公司名...\n`);

  // AI 从搜索结果中提取公司名
  const { companies, aiRunId } = await extractCompaniesFromText(organizationId, userId, allTexts);
  stats.found = companies.length;

  console.log(`🏢 发现 ${companies.length} 家公司\n`);

  // 去重 + 保存到候选情报区。crawler 不直接写正式 target_accounts。
  for (const c of companies) {
    const nameLower = (c.name || "").toLowerCase().trim();
    if (!nameLower || nameLower.length < 4 || existingNames.has(nameLower)) continue;
    if (nameLower.includes("招标") || nameLower.includes("代理") || nameLower.includes("公共资源")) continue;

    existingNames.add(nameLower);

    try {
      const normalized = normalizeTitle(c.name);
      const existingCandidate = await findIntelligenceItemByTitle(organizationId, "candidate_account", normalized);
      if (existingCandidate) continue;

      const sourceResult = typeof c.sourceIndex === "number" ? allTexts[c.sourceIndex] : null;
      const sourceId = await createIntelligenceSource({
        organizationId,
        sourceUrl: sourceResult?.url || null,
        sourceName: sourceResult?.title || c.source || "网络搜索",
        sourceType: "web_search_result",
        rawContent: sourceResult?.snippet || c.source || null,
        metadata: { industry, keywords: productKeywords },
      });

      const itemId = await createIntelligenceItem({
        organizationId,
        sourceId,
        itemType: "candidate_account",
        title: c.name.trim(),
        normalizedTitle: normalized,
        extractedJson: {
          companyName: c.name.trim(),
          industry,
          source: c.source || "",
          sourceUrl: sourceResult?.url || null,
        },
        confidenceScore: 0.7,
        status: "candidate",
        aiRunId,
      });

      await createEvidenceLink({
        itemId,
        fieldName: "companyName",
        evidenceText: sourceResult?.snippet || c.source || "",
        sourceUrl: sourceResult?.url || null,
        confidenceScore: 0.7,
      });

      stats.candidateItems++;
      stats.newAccounts = stats.candidateItems;
      stats.companies.push({ name: c.name.trim(), industry, source: c.source || "" });
      console.log(`  ✅ 候选客户: ${c.name} (${c.source || "未知来源"})`);
    } catch (e) {
      console.error(`  ❌ 保存失败: ${c.name}`, (e as Error).message);
    }
  }

  console.log(`\n✅ 爬虫发现完成: ${stats.found}家公司 → ${stats.candidateItems}条候选情报`);
  return stats;
}
