"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { JobStatus } from "@/app/[lang]/(workspace)/smart-eye/_components/jobs/job-status";
import { createApiResponseError } from "@/lib/api/api-error";
import { authenticatedFetch } from "@/lib/api/authenticated-fetch";
import { downloadDocumentFromJob } from "@/lib/document/document-job-client";
import Image from "next/image";

type TargetFormat = "txt" | "docx" | "html";

const formats: { value: TargetFormat; label: string; suffix: string; desc: string }[] = [
  { value: "docx", label: "Word", suffix: "(.docx)", desc: "转为可编辑的word文档" },
  { value: "txt", label: "纯文本", suffix: "(.txt)", desc: "提取文字内容" },
  { value: "html", label: "网页", suffix: "(.html)", desc: "转为HTML格式" },
];

export default function ConvertPage() {
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState<TargetFormat>("docx");
  const [convertJobId, setConvertJobId] = useState<string | null>(null);
  const [jobPending, setJobPending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    if (selected) setTarget(selected.name.endsWith(".pdf") ? "docx" : "txt");
    setConvertJobId(null);
    setJobPending(false);
  };

  const clearFile = () => {
    setFile(null);
    setConvertJobId(null);
    setJobPending(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleConvert = async () => {
    if (!file) return;
    setJobPending(true);
    setConvertJobId(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("target", target);
      const res = await authenticatedFetch("/api/documents/convert", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw await createApiResponseError(res, "转换任务创建失败");
      const data = (await res.json().catch(() => ({}))) as { jobId?: unknown };
      if (typeof data.jobId !== "string" || !data.jobId) throw new Error("转换任务未创建");
      setConvertJobId(data.jobId);
      toast.info("转换任务已创建（需 worker 执行）");
    } catch (error) {
      setJobPending(false);
      toast.error(error instanceof Error ? error.message : "转换失败");
    }
  };

  const handleJobDone = async (job: unknown) => {
    setJobPending(false);
    const done = job as { status?: string; errorMessage?: string | null };
    if (done.status === "failed") {
      toast.error(done.errorMessage || "转换失败");
      setConvertJobId(null);
      return;
    }
    try {
      await downloadDocumentFromJob(job);
      toast.success("下载完成");
      setConvertJobId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "下载失败");
    }
  };

  return (
    <div className="w-full min-w-0 max-w-full px-4 pb-24 pt-24 text-[#E8EDF7] sm:px-6 lg:px-8 lg:pb-10 lg:pt-[112px]">
      <div className="mb-8">
        <h1 className="text-[28px] font-bold leading-tight text-white sm:text-[32px]">格式转换</h1>
        <p className="mt-3 text-base leading-7 text-[#A4ADBD] sm:text-[20px] sm:leading-8">PDF/DOCX转其他格式</p>
      </div>

      <div className="max-w-[960px] space-y-6">
        {convertJobId && (
          <section className="rounded-[14px] border border-[#202837] bg-[#141922] p-4">
            <JobStatus jobId={convertJobId} onDone={handleJobDone} />
          </section>
        )}

        <section className="min-w-0 rounded-[14px] border border-[#202837] bg-[#141922] p-5 sm:p-7">
          <h2 className="mb-3 text-[20px] font-semibold text-white">1.上传文件</h2>
          <p className="mb-7 text-[16px] text-[#A4ADBD]">支持PDF、DOCX、TXT</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md"
            className="hidden"
            onChange={handleFileChange}
            disabled={jobPending}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={jobPending}
            className="flex h-[254px] w-full flex-col items-center justify-center rounded-[8px] bg-[#070B14] text-center transition hover:bg-[#0A101C] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Image className="mx-auto" src="/img/upload.png" alt="upload" width={48} height={48} />
            <span className="mt-7 text-[22px] text-[#D8DEEA]">{file ? file.name : "上传文档"}</span>
            <span className="mt-3 text-[17px] leading-7 text-[#687286]">PDF/DOCX/TXT</span>
            <span className="text-[17px] leading-7 text-[#687286]">最大20MB · 点击选择或拖拽</span>
          </button>
          {file && (
            <button type="button" onClick={clearFile} className="mt-3 text-sm text-[#687286] transition hover:text-white">
              清除文件
            </button>
          )}
        </section>

        <section className="min-w-0 rounded-[14px] border border-[#202837] bg-[#141922] p-5 sm:p-7">
          <h2 className="mb-7 text-[20px] font-semibold text-white">2.选择目标格式</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {formats.map((format) => (
              <FormatCard
                key={format.value}
                active={target === format.value}
                onClick={() => setTarget(format.value)}
                label={format.label}
                suffix={format.suffix}
                desc={format.desc}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={handleConvert}
            disabled={!file || jobPending}
            className="btn-bg mt-6 h-[45px] w-full rounded-[9px] text-[18px] font-semibold text-[#0A0613] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {jobPending ? "任务执行中..." : "开始转换"}
          </button>
        </section>
      </div>
    </div>
  );
}

function FormatCard({
  active,
  onClick,
  label,
  suffix,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  suffix: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "h-[94px] rounded-[5px] border px-4 text-center transition",
        active ? "border-[#3F72B2] bg-[#203454] text-[#8AB8FF]" : "border-[#0A0F18] bg-[#070B14] text-[#A4ADBD] hover:border-[#253048]",
      ].join(" ")}
    >
      <p className="text-[20px] font-semibold">
        {label} <span>{suffix}</span>
      </p>
      <p className="mt-1 text-[16px] text-[#687286]">{desc}</p>
    </button>
  );
}
