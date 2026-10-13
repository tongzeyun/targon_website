/**
 * Batch URL extract — enqueues batch_extract_url job (async).
 * Poll GET /api/jobs/:id for resultJson when status is succeeded.
 */
import { NextRequest } from "next/server";
import { getAuthOrg, jsonResponse, errorResponse } from "@/lib/api/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { createJob } from "@/lib/repositories/job-repository";
import { checkJobCreationProviderQuota } from "@/lib/api/job-provider-quota";

export async function POST(req: NextRequest) {
  const auth = await getAuthOrg(req);
  const rateLimit = checkRateLimit(auth.userId, RATE_LIMITS.ai);
  if (rateLimit) return rateLimit;
  const body = await req.json();
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) return errorResponse("url is required");
  const quota = await checkJobCreationProviderQuota(auth.userId, "batch_extract_url");
  if (quota) return quota;

  try {
    const job = await createJob({
      organizationId: auth.organizationId,
      userId: auth.userId,
      type: "batch_extract_url",
      payload: { url },
      priority: 0,
    });
    return jsonResponse({ jobId: job.id, job, queued: true }, 202);
  } catch (error) {
    console.error("Batch extract job creation failed:", error);
    return errorResponse("Failed to create job: " + (error as Error).message, 500);
  }
}
