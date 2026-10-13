import { NextRequest } from "next/server";
import { getAuthOrg, jsonResponse, errorResponse } from "@/lib/api/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import {
  createJob,
  listJobs,
  type ListJobsFilters,
  type JobStatus,
  type JobType,
} from "@/lib/repositories/job-repository";
import { checkJobCreationProviderQuota } from "@/lib/api/job-provider-quota";

const ALLOWED_JOB_TYPES: JobType[] = [
  "crawler_discover_companies",
  "crawler_ingest",
  "crawler_search_extract",
  "batch_extract_url",
  "deep_research",
  "document_generate_quotation",
  "document_generate_contract",
  "document_generate_bid",
  "document_generate_meeting",
  "document_convert",
  "document_speech_recognize",
  "document_analyze_bid",
  "ai_discover_accounts",
  "ai_match_accounts",
  "ai_enrich_account",
];
const CREATABLE_JOB_TYPES: JobType[] = [
  "crawler_discover_companies",
  "crawler_ingest",
  "crawler_search_extract",
  "batch_extract_url",
  "deep_research",
  "document_generate_quotation",
  "document_generate_contract",
  "document_generate_bid",
  "document_generate_meeting",
  "document_convert",
  "document_speech_recognize",
  "document_analyze_bid",
  "ai_discover_accounts",
  "ai_match_accounts",
  "ai_enrich_account",
];
const ALLOWED_JOB_STATUSES: JobStatus[] = ["queued", "running", "succeeded", "failed", "canceled"];

function isJobType(value: unknown): value is JobType {
  return typeof value === "string" && ALLOWED_JOB_TYPES.includes(value as JobType);
}

function isCreatableJobType(value: unknown): value is JobType {
  return typeof value === "string" && CREATABLE_JOB_TYPES.includes(value as JobType);
}

function isJobStatus(value: unknown): value is JobStatus {
  return typeof value === "string" && ALLOWED_JOB_STATUSES.includes(value as JobStatus);
}

export async function GET(req: NextRequest) {
  const auth = await getAuthOrg(req);
  const status = req.nextUrl.searchParams.get("status");
  const type = req.nextUrl.searchParams.get("type");

  const filters: ListJobsFilters = {};
  if (status) {
    if (!isJobStatus(status)) return errorResponse("Invalid job status", 400);
    filters.status = status;
  }
  if (type) {
    if (!isJobType(type)) return errorResponse("Invalid job type", 400);
    filters.type = type;
  }

  const jobs = await listJobs(auth, filters);

  return jsonResponse({ jobs });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthOrg(req);
  const rateLimit = checkRateLimit(auth.userId, RATE_LIMITS.ai);
  if (rateLimit) return rateLimit;
  const body = await req.json();
  const { type, payload, priority } = body;

  if (!isCreatableJobType(type)) return errorResponse("Invalid job type", 400);
  const quota = await checkJobCreationProviderQuota(auth.userId, type);
  if (quota) return quota;

  const job = await createJob({
    organizationId: auth.organizationId,
    userId: auth.userId,
    type,
    payload,
    priority: typeof priority === "number" ? priority : undefined,
  });

  return jsonResponse({ jobId: job.id, job }, 201);
}
