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
  const productId = typeof body.productId === "string" ? body.productId.trim() : "";
  if (!productId) return errorResponse("productId is required");
  const quota = await checkJobCreationProviderQuota(auth.userId, "ai_match_accounts");
  if (quota) return quota;

  try {
    const job = await createJob({
      organizationId: auth.organizationId,
      userId: auth.userId,
      type: "ai_match_accounts",
      payload: { productId },
      priority: 0,
    });
    return jsonResponse({ jobId: job.id, job, queued: true }, 202);
  } catch (error) {
    console.error("AI match job creation failed:", error);
    return errorResponse("Failed to create job: " + (error as Error).message, 500);
  }
}
