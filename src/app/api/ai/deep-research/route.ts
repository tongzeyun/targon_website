import { NextRequest } from "next/server";
import { AuthError, errorResponse, getAuthOrg, jsonResponse } from "@/lib/api/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { checkJobCreationProviderQuota } from "@/lib/api/job-provider-quota";
import { getLatestReport } from "@/lib/ai/deep-research";
import { isChinaMainlandProvince } from "@/lib/ai/deep-research-filters";
import { createDeepResearchAccounts } from "@/lib/repositories/account-repository";
import { createJob, getJob } from "@/lib/repositories/job-repository";
import { getResearchReport } from "@/lib/repositories/research-report-repository";

interface ResearchReportRow {
  id?: string | null;
  productId?: string | null;
  reportJson?: unknown;
  aiRunId?: string | null;
  createdAt?: string | null;
}

interface ResearchCandidateAccount extends Record<string, unknown> {
  companyName?: string;
  matchScore?: number;
  whyTarget?: string;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthOrg(req);
    const rateLimit = checkRateLimit(auth.userId, RATE_LIMITS.ai);
    if (rateLimit) return rateLimit;
    const { productId, industry: rawIndustry, province: rawProvince } = await req.json();
    if (!productId || typeof productId !== "string" || !productId.trim()) {
      return errorResponse("productId is required");
    }
    if (rawIndustry != null && typeof rawIndustry !== "string") {
      return errorResponse("industry must be a string");
    }
    if (rawProvince != null && typeof rawProvince !== "string") {
      return errorResponse("province must be a string");
    }

    const industry = typeof rawIndustry === "string" ? rawIndustry.trim() : "";
    const province = typeof rawProvince === "string" ? rawProvince.trim() : "";
    if (industry.length > 100) return errorResponse("industry is too long");
    if (province && !isChinaMainlandProvince(province)) {
      return errorResponse("province is not supported");
    }
    const quota = await checkJobCreationProviderQuota(auth.userId, "deep_research");
    if (quota) return quota;

    const job = await createJob({
      organizationId: auth.organizationId,
      userId: auth.userId,
      type: "deep_research",
      payload: {
        productId: productId.trim(),
        preview: true,
        industry: industry || undefined,
        province: province || undefined,
      },
      priority: 0,
    });

    return jsonResponse({ jobId: job.id, job, queued: true }, 202);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse("Failed to create deep research job: " + (error as Error).message, 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await getAuthOrg(req);
    const { jobId, reportId, selectedIndexes } = await req.json();
    if (!Array.isArray(selectedIndexes) || selectedIndexes.length === 0) {
      return errorResponse("selectedIndexes required");
    }
    if (selectedIndexes.length > 15) return errorResponse("too many selectedIndexes");
    if (!selectedIndexes.every((index) => Number.isInteger(index) && index >= 0)) {
      return errorResponse("selectedIndexes must contain non-negative integers");
    }

    let reportRow: ResearchReportRow | null = null;
    let sourceJobId: string | null = null;
    if (typeof jobId === "string" && jobId.trim()) {
      sourceJobId = jobId.trim();
      const job = await getJob(auth, sourceJobId);
      if (!job || job.type !== "deep_research" || job.status !== "succeeded") {
        return errorResponse("research job not found", 404);
      }
      const result = job.resultJson && typeof job.resultJson === "object" && !Array.isArray(job.resultJson)
        ? job.resultJson as Record<string, unknown>
        : {};
      const payload = job.payloadJson && typeof job.payloadJson === "object" && !Array.isArray(job.payloadJson)
        ? job.payloadJson as Record<string, unknown>
        : {};
      reportRow = {
        productId: typeof payload.productId === "string" ? payload.productId : null,
        reportJson: result.report,
        aiRunId: typeof result.aiRunId === "string" ? result.aiRunId : null,
        createdAt: job.finishedAt,
      };
    } else if (typeof reportId === "string" && reportId.trim()) {
      reportRow = await getResearchReport(auth.organizationId, reportId.trim()) as ResearchReportRow | null;
    } else {
      return errorResponse("jobId or reportId is required");
    }
    if (!reportRow) return errorResponse("research report not found", 404);

    const reportData = reportRow.reportJson;
    const report = (typeof reportData === "object" && reportData !== null
      ? reportData
      : JSON.parse(String(reportData || "{}"))) as { targetAccounts?: ResearchCandidateAccount[] };
    const reportAccounts = Array.isArray(report.targetAccounts) ? report.targetAccounts : [];
    const uniqueIndexes = [...new Set<number>(selectedIndexes)];
    if (uniqueIndexes.some((index) => index >= reportAccounts.length)) {
      return errorResponse("selectedIndexes contains an out-of-range index");
    }
    const accounts = uniqueIndexes.map((index) => reportAccounts[index]);

    if (accounts.length === 0) return errorResponse("no selected accounts found in saved report");
    if (accounts.some((account) => typeof account.companyName !== "string" || !account.companyName.trim())) {
      return errorResponse("selected account is missing companyName");
    }

    const reportProductId = typeof reportRow.productId === "string" ? reportRow.productId : null;
    const reportAiRunId = typeof reportRow.aiRunId === "string" ? reportRow.aiRunId : null;
    const saved = await createDeepResearchAccounts(auth, {
      accounts: accounts as Array<ResearchCandidateAccount & { companyName: string }>,
      productId: reportProductId,
      aiRunId: reportAiRunId,
      reportId: reportRow.id || (typeof reportId === "string" ? reportId.trim() : null),
      jobId: sourceJobId,
    });

    return jsonResponse(saved);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse("Failed to add target accounts: " + (error as Error).message, 500);
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthOrg(req);
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId") || undefined;
    const report = await getLatestReport(auth.organizationId, productId);
    if (!report) return jsonResponse({ report: null });
    const row = report as ResearchReportRow;
    const parsed = typeof row.reportJson === "object" && row.reportJson !== null
      ? row.reportJson
      : JSON.parse(String(row.reportJson || "{}"));
    return jsonResponse({
      report: parsed,
      reportId: row.id || null,
      productId: row.productId || null,
      aiRunId: row.aiRunId || null,
      createdAt: row.createdAt,
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse("Failed to load deep research report: " + (error as Error).message, 500);
  }
}
