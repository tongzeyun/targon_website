import { NextRequest } from "next/server";
import { errorResponse, getAuthOrg, jsonResponse } from "@/lib/api/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import {
  isBidSectionArray,
  parseBidTemplateSource,
} from "@/lib/document/bid-document-model";
import { createJob } from "@/lib/repositories/job-repository";
import { createStoredFile } from "@/lib/repositories/stored-file-repository";
import { checkJobCreationProviderQuota } from "@/lib/api/job-provider-quota";
import { MAX_BID_UPLOAD_BYTES, uploadExceedsLimit } from "@/lib/api/upload-limits";

function getBidPayload(body: Record<string, unknown>) {
  const sections = isBidSectionArray(body.sections) ? body.sections : [];
  const projectName = typeof body.projectName === "string" && body.projectName.trim()
    ? body.projectName.trim()
    : "投标文件";
  const bidUnit = typeof body.bidUnit === "string" ? body.bidUnit : "";
  const bidDeadline = typeof body.bidDeadline === "string" ? body.bidDeadline : "";

  return { sections, projectName, bidUnit, bidDeadline };
}

function getDocumentJobTraceFields(body: Record<string, unknown>) {
  const pick = (key: string) =>
    typeof body[key] === "string" && body[key].trim() ? body[key].trim() : null;
  return {
    templateId: pick("templateId"),
    aiRunId: pick("aiRunId"),
    templateStoredFileId: pick("templateStoredFileId"),
    templateSource: parseBidTemplateSource(body.templateSource),
  };
}

function isSupportedBidFile(file: File): boolean {
  return /\.(docx|pdf|txt)$/i.test(file.name);
}

function isSupportedTemplateFile(file: File): boolean {
  return /\.docx$/i.test(file.name);
}

function guessBidMimeType(name: string, type: string): string {
  if (type) return type;
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".txt")) return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

export async function POST(req: NextRequest) {
  const auth = await getAuthOrg(req);
  const rateLimit = checkRateLimit(auth.userId, RATE_LIMITS.document);
  if (rateLimit) return rateLimit;

  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const fd = await req.formData();
      const bidFileValue = fd.get("bidFile");
      const templateFileValue = fd.get("templateFile");
      const bidFile = bidFileValue instanceof File ? bidFileValue : null;
      const templateFile = templateFileValue instanceof File ? templateFileValue : null;
      const companyInfo = (fd.get("companyInfo") as string) || "";
      if (!bidFile) return errorResponse("请上传招标文件");
      if (!isSupportedBidFile(bidFile)) {
        return errorResponse("招标文件仅支持 DOCX、PDF、TXT 格式", 415);
      }
      if (bidFile.size === 0) return errorResponse("招标文件不能为空");
      if (uploadExceedsLimit(bidFile, MAX_BID_UPLOAD_BYTES)) {
        return errorResponse("招标文件不能超过 100 MB", 413);
      }
      if (templateFile && !isSupportedTemplateFile(templateFile)) {
        return errorResponse("投标模板仅支持 DOCX 格式", 415);
      }
      if (templateFile?.size === 0) return errorResponse("投标模板不能为空");
      if (templateFile && uploadExceedsLimit(templateFile, MAX_BID_UPLOAD_BYTES)) {
        return errorResponse("投标模板不能超过 100 MB", 413);
      }
      const quota = await checkJobCreationProviderQuota(auth.userId, "document_analyze_bid");
      if (quota) return quota;

      const mimeType = guessBidMimeType(bidFile.name, bidFile.type);
      const fileBuffer = Buffer.from(await bidFile.arrayBuffer());

      const stored = await createStoredFile(auth, {
        purpose: "bid_analysis_input",
        originalName: bidFile.name,
        mimeType,
        fileBuffer,
        metadata: { companyInfoLength: companyInfo.length },
        maxBytes: MAX_BID_UPLOAD_BYTES,
      });

      const templateStored = templateFile
        ? await createStoredFile(auth, {
            purpose: "bid_template_input",
            originalName: templateFile.name,
            mimeType: guessBidMimeType(templateFile.name, templateFile.type),
            fileBuffer: Buffer.from(await templateFile.arrayBuffer()),
            metadata: { bidStoredFileId: stored.id },
            maxBytes: MAX_BID_UPLOAD_BYTES,
          })
        : null;

      const job = await createJob({
        organizationId: auth.organizationId,
        userId: auth.userId,
        type: "document_analyze_bid",
        payload: {
          storedFileId: stored.id,
          companyInfo,
          originalName: bidFile.name,
          mimeType: stored.mimeType,
          templateStoredFileId: templateStored?.id ?? null,
          templateOriginalName: templateFile?.name ?? null,
          templateMimeType: templateStored?.mimeType ?? null,
        },
        priority: 0,
      });

      return jsonResponse({ jobId: job.id, job, queued: true }, 202);
    }

    const body = await req.json() as Record<string, unknown>;
    const { sections, projectName, bidUnit, bidDeadline } = getBidPayload(body);
    if (!sections.length) return errorResponse("无内容");

    if (body.mode === "generate-job") {
      const trace = getDocumentJobTraceFields(body);
      const job = await createJob({
        organizationId: auth.organizationId,
        userId: auth.userId,
        type: "document_generate_bid",
        payload: {
          sections,
          projectName,
          bidUnit,
          bidDeadline,
          format: "docx",
          ...trace,
        },
        priority: 0,
      });
      return jsonResponse({ jobId: job.id, job, queued: true }, 202);
    }

    return errorResponse("未知模式");
  } catch (error) {
    console.error("Bid document processing failed:", error);
    return errorResponse("处理失败: " + (error as Error).message, 500);
  }
}
