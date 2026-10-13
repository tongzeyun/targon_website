/**
 * 文档格式转换 API
 * POST /api/documents/convert
 * FormData: file(File), target("txt"|"docx"|"html")
 *
 * Enqueues document_convert job (202). Upload is stored in stored_files;
 * conversion runs in worker via convertDocumentViaIflytek.
 */

import { NextRequest } from "next/server";
import { getAuthOrg, jsonResponse, errorResponse } from "@/lib/api/auth";
import type { TargetFormat } from "@/lib/document/format-convert";
import { checkRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { createJob } from "@/lib/repositories/job-repository";
import { createStoredFile } from "@/lib/repositories/stored-file-repository";
import { checkJobCreationProviderQuota } from "@/lib/api/job-provider-quota";
import { MAX_DOCUMENT_UPLOAD_BYTES, uploadExceedsLimit } from "@/lib/api/upload-limits";

const VALID_TARGETS: TargetFormat[] = ["txt", "docx", "html"];

function guessMimeType(name: string, type: string): string {
  if (type) return type;
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".txt")) return "text/plain; charset=utf-8";
  if (lower.endsWith(".md")) return "text/markdown";
  return "application/octet-stream";
}

function isSupportedUploadName(name: string): boolean {
  return /\.(pdf|docx|txt|md)$/i.test(name);
}

function storagePrefixForUpload(name: string): string | undefined {
  return name.toLowerCase().endsWith(".pdf") ? "pdf" : undefined;
}

export async function POST(req: NextRequest) {
  const auth = await getAuthOrg(req);
  const rateLimit = checkRateLimit(auth.userId, RATE_LIMITS.document);
  if (rateLimit) return rateLimit;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const target = (formData.get("target") as string) || "docx";

    if (!file) return errorResponse("请上传文件");
    if (uploadExceedsLimit(file, MAX_DOCUMENT_UPLOAD_BYTES)) {
      return errorResponse("文件不能超过 50 MB", 413);
    }
    if (!VALID_TARGETS.includes(target as TargetFormat)) return errorResponse("不支持的目标格式");
    if (!isSupportedUploadName(file.name)) {
      return errorResponse("不支持的文件格式，请上传 PDF/DOCX/TXT");
    }
    const quota = await checkJobCreationProviderQuota(auth.userId, "document_convert");
    if (quota) return quota;

    const mimeType = guessMimeType(file.name, file.type);
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const stored = await createStoredFile(auth, {
      purpose: "convert_input",
      originalName: file.name,
      mimeType,
      fileBuffer,
      metadata: { target },
      storagePrefix: storagePrefixForUpload(file.name),
    });

    const job = await createJob({
      organizationId: auth.organizationId,
      userId: auth.userId,
      type: "document_convert",
      payload: {
        storedFileId: stored.id,
        target,
        originalName: file.name,
        mimeType: stored.mimeType,
      },
      priority: 0,
    });

    return jsonResponse({ jobId: job.id, job, queued: true }, 202);
  } catch (error) {
    console.error("文档转换任务创建失败:", error);
    return errorResponse("转换失败: " + (error as Error).message, 500);
  }
}
