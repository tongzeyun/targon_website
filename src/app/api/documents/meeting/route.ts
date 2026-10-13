/**
 * 会议纪要/沟通分析 API
 * POST /api/documents/meeting
 *
 * JSON body（纯文本）:
 *   { textContent, analysisMode } → 创建 document_generate_meeting job，返回 202
 *   mode === "sync" → 410（同步分析已废弃）
 *
 * FormData（文件上传 / 文本）:
 *   text(string), textFile(File), mode("minutes"|"analysis")
 *   → 创建 document_generate_meeting job，返回 202
 *   音频文件返回 400，需走语音识别或手动转写
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthOrg, errorResponse, type AuthContext } from "@/lib/api/auth";
import type { AnalysisMode } from "@/lib/ai/meeting-analysis";
import { createJob } from "@/lib/repositories/job-repository";
import { createStoredFile } from "@/lib/repositories/stored-file-repository";
import { checkRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { checkJobCreationProviderQuota } from "@/lib/api/job-provider-quota";
import {
  isSupportedAudioFileName,
  MAX_DOCUMENT_UPLOAD_BYTES,
  uploadExceedsLimit,
} from "@/lib/api/upload-limits";

const SYNC_MEETING_REMOVED =
  "Synchronous meeting analysis is no longer supported. Create a document job instead.";

function getDocumentJobTraceFields(body: Record<string, unknown>) {
  const pick = (key: string) =>
    typeof body[key] === "string" && body[key].trim() ? body[key].trim() : null;
  return { templateId: pick("templateId"), aiRunId: pick("aiRunId") };
}

function guessMeetingMimeType(name: string, type: string): string {
  if (type) return type;
  const lower = name.toLowerCase();
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".txt")) return "text/plain; charset=utf-8";
  if (lower.endsWith(".md")) return "text/markdown";
  return "application/octet-stream";
}

function isAudioFile(name: string, mimeType: string): boolean {
  return isSupportedAudioFileName(name) || mimeType.startsWith("audio/");
}

export async function POST(req: NextRequest) {
  const auth = await getAuthOrg(req);
  const rateLimit = checkRateLimit(auth.userId, RATE_LIMITS.document);
  if (rateLimit) return rateLimit;
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return handleJsonRequest(req, auth);
  }

  return handleFormDataRequest(req, auth);
}

async function handleJsonRequest(req: NextRequest, auth: AuthContext) {
  try {
    const body = await req.json();
    const mode = typeof body.mode === "string" ? body.mode : "generate-job";
    const analysisMode: AnalysisMode = body.analysisMode === "analysis" ? "analysis" : "minutes";
    const textContent = typeof body.textContent === "string" ? body.textContent.trim() : "";

    if (mode === "sync") {
      return errorResponse(SYNC_MEETING_REMOVED, 410);
    }

    if (textContent.length < 10) {
      return errorResponse("请输入沟通内容（至少10个字符）", 400);
    }
    const quota = await checkJobCreationProviderQuota(auth.userId, "document_generate_meeting");
    if (quota) return quota;

    const trace = getDocumentJobTraceFields(body as Record<string, unknown>);
    const job = await createJob({
      organizationId: auth.organizationId,
      userId: auth.userId,
      type: "document_generate_meeting",
      payload: { textContent, analysisMode, ...trace },
      priority: 0,
    });

    return NextResponse.json({ jobId: job.id, job, queued: true }, { status: 202 });
  } catch (error) {
    console.error("会议分析 job 创建失败:", error);
    return errorResponse("分析失败: " + (error as Error).message, 500);
  }
}

async function handleFormDataRequest(req: NextRequest, auth: AuthContext) {
  try {
    const formData = await req.formData();
    const textInput = (formData.get("text") as string) || "";
    const textFile = formData.get("textFile") as File | null;
    const modeRaw = (formData.get("mode") as string) || "minutes";
    const analysisMode: AnalysisMode = modeRaw === "analysis" ? "analysis" : "minutes";

    if (textFile) {
      if (uploadExceedsLimit(textFile, MAX_DOCUMENT_UPLOAD_BYTES)) {
        return errorResponse("会议文件不能超过 50 MB", 413);
      }
      if (isAudioFile(textFile.name, textFile.type)) {
        return errorResponse(
          "音频文件无法直接转文字。请使用语音识别功能转写，或在手动输入框中粘贴文字内容。",
          400
        );
      }
      const quota = await checkJobCreationProviderQuota(auth.userId, "document_generate_meeting");
      if (quota) return quota;

      const mimeType = guessMeetingMimeType(textFile.name, textFile.type);
      const fileBuffer = Buffer.from(await textFile.arrayBuffer());

      const stored = await createStoredFile(auth, {
        purpose: "meeting_input",
        originalName: textFile.name,
        mimeType,
        fileBuffer,
        metadata: { analysisMode },
      });

      const job = await createJob({
        organizationId: auth.organizationId,
        userId: auth.userId,
        type: "document_generate_meeting",
        payload: {
          storedFileId: stored.id,
          analysisMode,
          originalName: textFile.name,
          mimeType: stored.mimeType,
          templateId: null,
          aiRunId: null,
        },
        priority: 0,
      });

      return NextResponse.json({ jobId: job.id, job, queued: true }, { status: 202 });
    }

    const textContent = textInput.trim();
    if (textContent.length < 10) {
      return errorResponse("请输入沟通内容（至少10个字符），或上传文本文件", 400);
    }
    const quota = await checkJobCreationProviderQuota(auth.userId, "document_generate_meeting");
    if (quota) return quota;

    const trace = getDocumentJobTraceFields({ textContent, analysisMode });
    const job = await createJob({
      organizationId: auth.organizationId,
      userId: auth.userId,
      type: "document_generate_meeting",
      payload: { textContent, analysisMode, ...trace },
      priority: 0,
    });

    return NextResponse.json({ jobId: job.id, job, queued: true }, { status: 202 });
  } catch (error) {
    console.error("会议分析 job 创建失败:", error);
    return errorResponse("分析失败: " + (error as Error).message, 500);
  }
}
