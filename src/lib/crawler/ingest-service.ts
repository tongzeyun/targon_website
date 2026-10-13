import {
  createEvidenceLink,
  createIntelligenceItem,
  createIntelligenceSource,
  normalizeTitle,
} from "@/lib/repositories/intelligence-repository";
import { createSignalForOrg } from "@/lib/repositories/signal-repository";
import { v4 as uuid } from "uuid";

export interface CrawlerIngestSignal {
  id?: string;
  signalType?: string;
  sourceUrl?: string;
  sourceName?: string;
  title?: string;
  publishDate?: string;
  rawContent?: string;
  extractedData?: unknown;
  relevanceScore?: number;
}

export interface CrawlerIngestPayload {
  signals: CrawlerIngestSignal[];
}

export interface CrawlerIngestResult {
  signals: number;
  candidatesCreated: number;
}

function parseExtractedData(extractedData: unknown): Record<string, unknown> {
  if (typeof extractedData === "string") {
    try {
      return JSON.parse(extractedData || "{}") as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return (extractedData || {}) as Record<string, unknown>;
}

export async function ingestCrawlerSignals(
  organizationId: string,
  payload: CrawlerIngestPayload
): Promise<CrawlerIngestResult> {
  if (!Array.isArray(payload.signals)) {
    throw new Error("crawler_ingest payload.signals must be an array");
  }

  const result: CrawlerIngestResult = { signals: 0, candidatesCreated: 0 };
  const now = new Date().toISOString();
  const ingestedSignals: Array<CrawlerIngestSignal & { id: string }> = [];

  for (const s of payload.signals) {
    const sigId = s.id || uuid();
    await createSignalForOrg(organizationId, {
      id: sigId,
      signalType: s.signalType || "news",
      sourceUrl: s.sourceUrl || "",
      sourceName: s.sourceName || "爬虫自动采集",
      title: s.title || "未知",
      publishDate: s.publishDate || now,
      rawContent: s.rawContent || "",
      extractedData: s.extractedData || {},
      relevanceScore: s.relevanceScore || 50,
      isProcessed: true,
      processedAt: now,
    });
    ingestedSignals.push({ ...s, id: sigId });
    result.signals++;
  }

  if (ingestedSignals.length >= 2) {
    const groups = new Map<string, typeof ingestedSignals>();
    for (const s of ingestedSignals) {
      const data = parseExtractedData(s.extractedData);
      const companyName = (data.companyName || data.buyerName) as string | undefined;
      if (companyName) {
        if (!groups.has(companyName)) groups.set(companyName, []);
        groups.get(companyName)!.push(s);
      }
    }

    for (const [companyName, group] of groups) {
      if (group.length >= 2) {
        const best = group[0];
        const data = parseExtractedData(best.extractedData);
        const title =
          (data.projectName as string) ||
          `${companyName} - ${best.signalType === "bid" ? "招标项目" : "早期信号"}`;

        const sourceId = await createIntelligenceSource({
          organizationId,
          sourceUrl: best.sourceUrl || null,
          sourceName: best.sourceName || "crawler ingest",
          sourceType: "crawler_ingest",
          rawContent: best.rawContent || null,
          metadata: {
            signalIds: group.map((item) => item.id),
            sourceSignalType: best.signalType,
          },
        });

        const itemId = await createIntelligenceItem({
          organizationId,
          sourceId,
          itemType: "candidate_project",
          title,
          normalizedTitle: normalizeTitle(title),
          extractedJson: {
            ...data,
            companyName,
            signalIds: group.map((item) => item.id),
            sourceSignalType: best.signalType,
          },
          confidenceScore: (best.relevanceScore as number) || 60,
          status: "candidate",
        });

        await createEvidenceLink({
          itemId,
          fieldName: "projectName",
          evidenceText: best.rawContent || title,
          sourceUrl: best.sourceUrl || null,
          confidenceScore: (best.relevanceScore as number) || 60,
        });
        result.candidatesCreated++;
      }
    }
  }

  return result;
}
