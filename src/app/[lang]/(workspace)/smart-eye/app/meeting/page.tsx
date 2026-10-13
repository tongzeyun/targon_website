"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { JobStatus } from "@/app/[lang]/(workspace)/smart-eye/_components/jobs/job-status";
import { createApiResponseError } from "@/lib/api/api-error";
import { authenticatedFetch } from "@/lib/api/authenticated-fetch";
import {
  isSupportedAudioFileName,
  MAX_AUDIO_UPLOAD_BYTES,
  SUPPORTED_AUDIO_FORMATS,
  uploadExceedsLimit,
} from "@/lib/api/upload-limits";
import { createDocumentJob, downloadDocumentFromJob } from "@/lib/document/document-job-client";
import Image from "next/image";

const MAX_AUDIO_UPLOAD_MB = MAX_AUDIO_UPLOAD_BYTES / (1024 * 1024);

export default function MeetingPage() {
  const [mode, setMode] = useState<"minutes" | "analysis">("minutes");
  const [textInput, setTextInput] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [documentJobId, setDocumentJobId] = useState<string | null>(null);
  const [documentJobPending, setDocumentJobPending] = useState(false);
  const [speechJobId, setSpeechJobId] = useState<string | null>(null);
  const [speechJobPending, setSpeechJobPending] = useState(false);
  const [modeLocked, setModeLocked] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (file && !isSupportedAudioFileName(file.name)) {
      toast.error(`当前仅支持 ${SUPPORTED_AUDIO_FORMATS}`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file && uploadExceedsLimit(file, MAX_AUDIO_UPLOAD_BYTES)) {
      toast.error(`音频文件不能超过 ${MAX_AUDIO_UPLOAD_MB} MB`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setAudioFile(file);
    setDocumentJobId(null);
    setDocumentJobPending(false);
    setSpeechJobId(null);
    setSpeechJobPending(false);
  };

  const clearFile = () => {
    setAudioFile(null);
    setSpeechJobId(null);
    setSpeechJobPending(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleModeChange = (nextMode: "minutes" | "analysis") => {
    if (modeLocked || nextMode === mode) return;
    setMode(nextMode);
    setTextInput("");
  };

  const handleSpeechRecognize = async () => {
    if (!audioFile) return;
    setSpeechJobPending(true);
    setModeLocked(true);
    setSpeechJobId(null);
    try {
      const formData = new FormData();
      formData.append("audio", audioFile);
      formData.append("transcriptMode", mode);
      const res = await authenticatedFetch("/api/documents/speech", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw await createApiResponseError(res, "转写任务创建失败");
      const data = (await res.json().catch(() => ({}))) as { jobId?: unknown };
      if (!data.jobId || typeof data.jobId !== "string") throw new Error("转写任务未创建");
      setSpeechJobId(data.jobId);
      toast.success("转写任务已创建");
    } catch (error) {
      setSpeechJobPending(false);
      setModeLocked(false);
      toast.error(error instanceof Error ? error.message : "转写失败");
    }
  };

  const handleGenerate = async () => {
    if (audioFile) {
      await handleSpeechRecognize();
      return;
    }

    const textContent = textInput.trim();
    if (textContent.length < 10) return;

    const wasModeLocked = modeLocked;
    setDocumentJobPending(true);
    setModeLocked(true);
    setDocumentJobId(null);
    try {
      const jobId = await createDocumentJob("/api/documents/meeting", {
        textContent,
        analysisMode: mode,
      });
      setDocumentJobId(jobId);
      toast.success("生成任务已创建");
    } catch (error) {
      setDocumentJobPending(false);
      if (!wasModeLocked) setModeLocked(false);
      toast.error(error instanceof Error ? error.message : "生成失败");
    }
  };

  const handleSpeechJobDone = (job: unknown) => {
    setSpeechJobPending(false);
    const done = job as { status?: string; errorMessage?: string | null; resultJson?: { text?: string } | null };
    if (done.status === "failed") {
      toast.error(done.errorMessage || "转写失败");
      setSpeechJobId(null);
      setModeLocked(false);
      return;
    }
    const text = done.resultJson?.text?.trim();
    if (!text) {
      toast.error("转写完成，但未返回文字内容");
      setSpeechJobId(null);
      setModeLocked(false);
      return;
    }
    setTextInput(text);
    setAudioFile(null);
    setSpeechJobId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    toast.success(mode === "minutes" ? "转写完成，可编辑后生成会议纪要" : "转写完成，可编辑后生成内容分析");
  };

  const handleDocumentJobDone = async (job: unknown) => {
    setDocumentJobPending(false);
    setModeLocked(false);
    const done = job as { status?: string; errorMessage?: string | null };
    if (done.status === "failed") {
      toast.error(done.errorMessage || "生成失败");
      setDocumentJobId(null);
      return;
    }
    try {
      await downloadDocumentFromJob(job);
      toast.success("Word 下载完成");
      setDocumentJobId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "下载失败");
    }
  };

  const disabled = documentJobPending || speechJobPending || (!audioFile && textInput.trim().length < 10);
  const buttonLabel = speechJobPending
    ? "音频转写中..."
    : documentJobPending
      ? "任务执行中..."
      : audioFile
        ? "转写音频"
        : mode === "minutes"
          ? "生成会议纪要"
          : "生成内容分析";

  return (
    <div className="w-full min-w-0 max-w-full px-4 pb-24 pt-24 text-[#E8EDF7] sm:px-6 lg:px-8 lg:pb-10 lg:pt-[112px]">
      <div className="mb-8">
        <h1 className="text-[28px] font-bold leading-tight text-white sm:text-[32px]">沟通梳理</h1>
        <p className="mt-3 text-base leading-7 text-[#A4ADBD] sm:text-[20px] sm:leading-8">上传沟通记录，AI自动生成会议纪要或内容分析报告</p>
      </div>

      <div className="max-w-[900px] space-y-6">
        {documentJobId && (
          <section className="rounded-[14px] border border-[#202837] bg-[#141922] p-4">
            <JobStatus jobId={documentJobId} onDone={handleDocumentJobDone} />
          </section>
        )}
        {speechJobId && (
          <section className="rounded-[14px] border border-[#202837] bg-[#141922] p-4">
            <JobStatus jobId={speechJobId} onDone={handleSpeechJobDone} />
          </section>
        )}

        <section className="min-w-0 rounded-[14px] border border-[#202837] bg-[#141922] p-4 sm:p-6">
          <h2 className="mb-6 text-[18px] font-semibold text-white">输出模式</h2>
          <div className="grid rounded-[8px] bg-[#070B14] p-1">
            <div className="grid grid-cols-2 gap-1">
              <ModeButton active={mode === "minutes"} disabled={modeLocked} onClick={() => handleModeChange("minutes")}>会议纪要</ModeButton>
              <ModeButton active={mode === "analysis"} disabled={modeLocked} onClick={() => handleModeChange("analysis")}>内容分析</ModeButton>
            </div>
          </div>
        </section>

        <section className="min-w-0 rounded-[14px] border border-[#202837] bg-[#141922] p-4 sm:p-6">
          <h2 className="mb-7 text-[20px] font-semibold text-white">内容输入</h2>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-4">
            <div>
              <h3 className="mb-4 text-[16px] font-medium text-white">手动输入</h3>
              <Textarea
                value={textInput}
                onChange={(event) => setTextInput(event.target.value)}
                placeholder={"请粘贴沟通记录...例如：2026年6月23日，与中芯国际采购部王经理沟通，讨论了分子泵采购计划..."}
                rows={8}
                className="max-h-[360px] min-h-[198px] resize-none overflow-y-auto rounded-[8px] border-0 bg-[#070B14] px-4 py-4 text-[18px] leading-7 text-slate-100 placeholder:text-[#A4ADBD] focus-visible:ring-[#6FB1FF]/40"
                disabled={documentJobPending}
              />
            </div>

            <div>
              <h3 className="mb-4 text-[16px] font-medium text-white">录音上传</h3>
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.wav,.m4a,.flac,.ogg,.opus"
                className="hidden"
                onChange={handleFileChange}
                disabled={documentJobPending || speechJobPending}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={documentJobPending || speechJobPending}
                className="flex min-h-[250px] w-full flex-col items-center justify-center rounded-[8px] bg-[#070B14] text-center transition hover:bg-[#0A101C] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Image className="mx-auto" src="/img/upload.png" alt="upload" width={48} height={48} />
                <span className="mt-6 text-[18px] text-[#D8DEEA]">{audioFile ? audioFile.name : "上传录音"}</span>
                <span className="mt-3 text-[16px] leading-7 text-[#687286]">{SUPPORTED_AUDIO_FORMATS}</span>
                <span className="text-[16px] leading-7 text-[#687286]">上传后先转写为文字</span>
              </button>
              {audioFile && (
                <button type="button" onClick={clearFile} className="mt-3 text-sm text-[#687286] transition hover:text-white">
                  清除录音
                </button>
              )}
              {audioFile && (
                <p className="mt-3 rounded-[8px] bg-[#3B2E14] p-3 text-sm text-[#F6BE5B]">
                  录音会先转写到左侧文本框，确认内容后再生成会议纪要。
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={disabled}
            className="btn-bg mt-6 h-[45px] w-full rounded-[9px] text-[18px] font-semibold text-[#0A0613] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {buttonLabel}
          </button>
        </section>
      </div>
    </div>
  );
}

function ModeButton({ active, disabled, onClick, children }: { active: boolean; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "h-[42px] rounded-[8px] text-[16px] transition",
        active ? "bg-[#6FB1FF] text-white shadow-[0_0_18px_rgba(111,177,255,0.38)]" : "text-[#687286] hover:text-white",
        disabled ? "cursor-not-allowed opacity-60" : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
