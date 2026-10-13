import { listActiveAlertRules, listRecentSignalsForAlerts } from "@/lib/repositories/alert-repository";

interface AlertMatch {
  ruleId: string;
  ruleName: string;
  signalId: string;
  signalTitle: string;
  matchedKeywords: string[];
  matchedIndustry: string;
  matchedRegion: string;
}

function parseJsonField(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function parseExtractedData(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function checkAlerts(organizationId: string): Promise<AlertMatch[]> {
  const rules = await listActiveAlertRules(organizationId);
  if (rules.length === 0) return [];

  const cutoffIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const signals = await listRecentSignalsForAlerts(organizationId, cutoffIso);
  const matches: AlertMatch[] = [];

  for (const rule of rules) {
    const keywords = parseJsonField(rule.keywords);
    const industries = parseJsonField(rule.industries);
    const regions = parseJsonField(rule.regions);

    if (keywords.length === 0 && industries.length === 0 && regions.length === 0) continue;

    for (const signal of signals) {
      const title = (signal.title || "").toLowerCase();
      const content = (signal.raw_content || signal.extracted_data || "").toString().toLowerCase();
      const searchText = `${title} ${content}`;
      const extractedData = parseExtractedData(signal.extracted_data);

      const matchedKeywords = keywords.filter((keyword) => searchText.includes(keyword.toLowerCase()));
      const industry = String(extractedData.industry || "");
      const matchedIndustry = industries.length === 0 ? "" : industries.find((item) => industry.includes(item)) || "";
      const location = String(extractedData.location || "");
      const matchedRegion = regions.length === 0 ? "" : regions.find((item) => location.includes(item)) || "";

      if (matchedKeywords.length > 0 || matchedIndustry || matchedRegion) {
        matches.push({
          ruleId: rule.id,
          ruleName: rule.name,
          signalId: signal.id,
          signalTitle: signal.title || "",
          matchedKeywords,
          matchedIndustry,
          matchedRegion,
        });
      }
    }
  }

  return matches;
}

export async function getAlertCount(organizationId: string): Promise<number> {
  try {
    const matches = await checkAlerts(organizationId);
    return matches.length;
  } catch {
    return 0;
  }
}
