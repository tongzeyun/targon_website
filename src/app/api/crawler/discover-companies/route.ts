import { NextRequest } from "next/server";
import { getAuthOrg, AuthError, jsonResponse, errorResponse } from "@/lib/api/auth";
import { createJob } from "@/lib/repositories/job-repository";
import { checkRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { checkJobCreationProviderQuota } from "@/lib/api/job-provider-quota";

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthOrg(req);
    const rateLimit = checkRateLimit(auth.userId, RATE_LIMITS.crawler);
    if (rateLimit) return rateLimit;
    const { keywords, industry } = await req.json();
    if (!Array.isArray(keywords) || keywords.length === 0) return errorResponse("keywords is required");
    const quota = await checkJobCreationProviderQuota(auth.userId, "crawler_discover_companies");
    if (quota) return quota;

    const job = await createJob({
      organizationId: auth.organizationId,
      userId: auth.userId,
      type: "crawler_discover_companies",
      payload: { keywords, industry },
      priority: 0,
    });

    return jsonResponse({ jobId: job.id, job, queued: true }, 202);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse("创建搜索发现任务失败: " + (error as Error).message, 500);
  }
}
