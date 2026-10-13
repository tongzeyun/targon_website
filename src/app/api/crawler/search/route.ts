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
    const { keywords, sites } = await req.json();

    const trimmedKeywords = Array.isArray(keywords)
      ? keywords
          .filter((keyword): keyword is string => typeof keyword === "string" && keyword.trim().length > 0)
          .map((keyword) => keyword.trim())
      : [];
    if (trimmedKeywords.length === 0) return errorResponse("keywords is required");
    const quota = await checkJobCreationProviderQuota(auth.userId, "crawler_search_extract");
    if (quota) return quota;

    const payload: { keywords: string[]; sites?: string[] } = { keywords: trimmedKeywords };
    if (sites !== undefined) {
      if (!Array.isArray(sites)) return errorResponse("sites must be an array");
      const trimmedSites = sites
        .filter((site): site is string => typeof site === "string" && site.trim().length > 0)
        .map((site) => site.trim());
      if (trimmedSites.length > 0) payload.sites = trimmedSites;
    }

    const job = await createJob({
      organizationId: auth.organizationId,
      userId: auth.userId,
      type: "crawler_search_extract",
      payload,
      priority: 0,
    });

    return jsonResponse({ jobId: job.id, job, queued: true }, 202);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse("创建招标搜索任务失败: " + (error as Error).message, 500);
  }
}
