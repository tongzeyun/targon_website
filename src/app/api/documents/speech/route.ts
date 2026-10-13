/**
 * 语音识别 API
 * POST /api/documents/speech
 * FormData: audio(File) → 创建 document_speech_recognize job (202)
 *
 * Upload bytes go to stored_files; recognition runs in worker via speechToText.
 */

import { NextRequest } from "next/server";
import { getAuthOrg, jsonResponse, errorResponse } from "@/lib/api/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { createJob } from "@/lib/repositories/job-repository";
import { createStoredFile } from "@/lib/repositories/stored-file-repository";
import { checkJobCreationProviderQuota } from "@/lib/api/job-provider-quota";
import {
  guessAudioMimeType,
  isSupportedAudioFileName,
  MAX_AUDIO_UPLOAD_BYTES,
  SUPPORTED_AUDIO_FORMATS,
  uploadExceedsLimit,
} from "@/lib/api/upload-limits";

export async function POST(req: NextRequest) {
  const auth = await getAuthOrg(req);
  const rateLimit = checkRateLimit(auth.userId, RATE_LIMITS.document);
  if (rateLimit) return rateLimit;

  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    const transcriptMode = formData.get("transcriptMode") === "analysis" ? "analysis" : "minutes";

    if (!audioFile) return errorResponse("请上传音频文件");
    if (uploadExceedsLimit(audioFile, MAX_AUDIO_UPLOAD_BYTES)) {
      return errorResponse("音频文件不能超过 20 MB", 413);
    }
    if (!isSupportedAudioFileName(audioFile.name)) {
      return errorResponse(`不支持的音频格式，请上传 ${SUPPORTED_AUDIO_FORMATS}`);
    }
    const quota = await checkJobCreationProviderQuota(auth.userId, "document_speech_recognize");
    if (quota) return quota;

    const mimeType = guessAudioMimeType(audioFile.name, audioFile.type);
    const fileBuffer = Buffer.from(await audioFile.arrayBuffer());

    const stored = await createStoredFile(auth, {
      purpose: "speech_input",
      originalName: audioFile.name,
      mimeType,
      fileBuffer,
      storagePrefix: "audio",
      metadata: { transcriptMode },
      maxBytes: MAX_AUDIO_UPLOAD_BYTES,
    });

    const job = await createJob({
      organizationId: auth.organizationId,
      userId: auth.userId,
      type: "document_speech_recognize",
      payload: {
        storedFileId: stored.id,
        originalName: audioFile.name,
        mimeType: stored.mimeType,
        transcriptMode,
      },
      priority: 0,
    });

    return jsonResponse({ jobId: job.id, job, queued: true }, 202);
  } catch (error) {
    console.error("语音识别任务创建失败:", error);
    return errorResponse("语音识别失败: " + (error as Error).message, 500);
  }
}
