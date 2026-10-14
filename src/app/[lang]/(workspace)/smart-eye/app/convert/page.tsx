"use client";

import { useUiText } from "@/app/[lang]/(workspace)/smart-eye/_hooks/use-ui-text";
import pageStyles from "@/app/[lang]/(workspace)/smart-eye/_styles/pages.module.css";

import { useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { JobStatus } from "@/app/[lang]/(workspace)/smart-eye/_components/jobs/job-status";
import { createApiResponseError } from "@/lib/api/api-error";
import { authenticatedFetch } from "@/lib/api/authenticated-fetch";
import { downloadDocumentFromJob } from "@/lib/document/document-job-client";

type TargetFormat = "txt" | "docx" | "html";

const formats: { value: TargetFormat; label: string; suffix: string; desc: string }[] = [
  { value: "docx", label: "Word", suffix: "(.docx)", desc: "转为可编辑的word文档" },
  { value: "txt", label: "纯文本", suffix: "(.txt)", desc: "提取文字内容" },
  { value: "html", label: "网页", suffix: "(.html)", desc: "转为HTML格式" },
];

export default function ConvertPage() {
  const uiText = useUiText();
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
      if (!res.ok) throw await createApiResponseError(res, uiText("转换任务创建失败"));
      const data = (await res.json().catch(() => ({}))) as { jobId?: unknown };
      if (typeof data.jobId !== "string" || !data.jobId) throw new Error(uiText("转换任务未创建"));
      setConvertJobId(data.jobId);
      toast.info(uiText("转换任务已创建（需 worker 执行）"));
    } catch (error) {
      setJobPending(false);
      toast.error(error instanceof Error ? error.message : uiText("转换失败"));
    }
  };

  const handleJobDone = async (job: unknown) => {
    setJobPending(false);
    const done = job as { status?: string; errorMessage?: string | null };
    if (done.status === "failed") {
      toast.error(done.errorMessage || uiText("转换失败"));
      setConvertJobId(null);
      return;
    }
    try {
      await downloadDocumentFromJob(job);
      toast.success(uiText("下载完成"));
      setConvertJobId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : uiText("下载失败"));
    }
  };

  return (
    <div className={`${pageStyles.page} ${pageStyles.convert}`}>
      <div className="mb-8">
        <h1>{uiText("格式转换")}</h1>
        <p className="mt-3 text-base leading-7 text-[#52637a] sm:text-[20px] sm:leading-8">{uiText("PDF/DOCX转其他格式")}</p>
      </div>

      <div className="max-w-[960px] space-y-6">
        {convertJobId && (
          <section className="rounded-[14px] border border-border bg-card p-4">
            <JobStatus jobId={convertJobId} onDone={handleJobDone} />
          </section>
        )}

        <section className="min-w-0 rounded-[14px] border border-border bg-card px-6 py-[22px]">
          <h2 className="mb-1 font-semibold text-foreground">{uiText("1.上传文件")}</h2>
          <p className="mb-6 text-[13px] leading-5 text-[#52637a]">{uiText("支持PDF、DOCX、TXT")}</p>
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
            className="flex h-[240px] w-full flex-col items-center justify-center rounded-[8px] bg-input text-center transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            <img className="mx-auto" src="/img/smart-eye/upload.svg" alt="" />
            <span className="mt-7 text-[22px] text-foreground">{file ? file.name : uiText("上传文档")}</span>
            <span className="mt-3 text-[17px] leading-7 text-muted-foreground">PDF/DOCX/TXT</span>
            <span className="text-[17px] leading-7 text-muted-foreground">{uiText("最大20MB · 点击选择文件")}</span>
          </button>
          {file && (
            <button type="button" onClick={clearFile} className="mt-3 text-sm text-muted-foreground transition hover:text-foreground">
              {uiText("清除文件")}</button>
          )}
        </section>

        <section className="min-w-0 rounded-[14px] border border-border bg-card px-6 py-[22px]">
          <h2 className="mb-6 font-semibold text-foreground">{uiText("2.选择目标格式")}</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {formats.map((format) => (
              <FormatCard
                key={format.value}
                active={target === format.value}
                onClick={() => setTarget(format.value)}
                label={uiText(format.label)}
                suffix={format.suffix}
                desc={uiText(format.desc)}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={handleConvert}
            disabled={!file || jobPending}
            className="btn-bg mt-6 h-10 w-full rounded-[9px] text-[18px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {jobPending ? uiText("任务执行中...") : uiText("开始转换")}
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
        "h-[88px] rounded-[5px] border px-4 text-center transition",
        active ? "border-[#3f72b2] bg-[#5b9bff]/15 text-[#5b9bff]" : "border-transparent bg-input text-[#52637a] hover:border-border",
      ].join(" ")}
    >
      <p className="text-[20px] font-semibold">
        {label} <span>{suffix}</span>
      </p>
      <p className="mt-1 text-[16px] text-muted-foreground">{desc}</p>
    </button>
  );
}
