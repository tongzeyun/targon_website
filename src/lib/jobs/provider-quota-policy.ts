import type { ProviderQuotaResource } from "@/lib/ai/provider-quota";
import type { JobType } from "@/lib/repositories/job-repository";

const JOB_PROVIDER_RESOURCES: Partial<Record<JobType, ProviderQuotaResource>> = {
  crawler_discover_companies: "deepseek",
  crawler_search_extract: "deepseek",
  batch_extract_url: "deepseek",
  deep_research: "deepseek",
  document_generate_meeting: "deepseek",
  document_convert: "iflytek_document",
  document_speech_recognize: "iflytek_speech",
  document_analyze_bid: "deepseek",
  ai_discover_accounts: "deepseek",
  ai_match_accounts: "deepseek",
  ai_enrich_account: "deepseek",
};

export function getJobProviderResource(type: JobType): ProviderQuotaResource | null {
  return JOB_PROVIDER_RESOURCES[type] ?? null;
}

export function defaultJobMaxAttempts(type: JobType): number {
  return getJobProviderResource(type) === "deepseek" ? 1 : 3;
}
