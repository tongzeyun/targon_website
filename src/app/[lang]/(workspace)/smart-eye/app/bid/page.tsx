"use client";

import { useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import { Textarea } from "@/components/ui/textarea";
import { DateTimePicker } from "@/components/ui/date-picker";
import { toast } from "sonner";
import { JobStatus } from "@/app/[lang]/(workspace)/smart-eye/_components/jobs/job-status";
import { createApiResponseError } from "@/lib/api/api-error";
import { authenticatedFetch } from "@/lib/api/authenticated-fetch";
import { createDocumentJob, downloadDocumentFromJob } from "@/lib/document/document-job-client";
import { MAX_BID_UPLOAD_BYTES, uploadExceedsLimit } from "@/lib/api/upload-limits";
import {
  countMissingBidFields,
  isBidPlaceholder,
  type BidBlock,
  type BidSection,
  type BidTemplateSource,
} from "@/lib/document/bid-document-model";
import Image from "next/image";

const BID_FILE_EXTENSIONS = [".docx", ".pdf", ".txt"];
const TEMPLATE_FILE_EXTENSIONS = [".docx"];
const MAX_BID_UPLOAD_MB = MAX_BID_UPLOAD_BYTES / (1024 * 1024);
const RECOMMENDED_BID_UPLOAD_MB = 20;
const RECOMMENDED_TEMPLATE_UPLOAD_MB = 10;

function isSupportedBidFile(file: File): boolean {
  const fileName = file.name.toLowerCase();
  return BID_FILE_EXTENSIONS.some((extension) => fileName.endsWith(extension));
}

interface BidResult {
  projectName: string;
  bidDeadline: string;
  bidUnit?: string;
  formatRequirements?: string;
  sections: BidSection[];
  aiRunId?: string;
  templateId?: string;
  templateSource?: BidTemplateSource;
  templateStoredFileId?: string | null;
  generationWarnings?: string[];
}

export default function BidPage() {
  const [bidFile, setBidFile] = useState<File | null>(null);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [companyInfo, setCompanyInfo] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeJobId, setAnalyzeJobId] = useState<string | null>(null);
  const [result, setResult] = useState<BidResult | null>(null);
  const [documentJobId, setDocumentJobId] = useState<string | null>(null);
  const [documentJobPending, setDocumentJobPending] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [templateDragOver, setTemplateDragOver] = useState(false);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const templateFileInputRef = useRef<HTMLInputElement | null>(null);

  const updateBlock = (sectionIndex: number, blockIndex: number, block: BidBlock) => {
    if (!result) return;
    const sections = [...result.sections];
    const blocks = [...sections[sectionIndex].blocks];
    blocks[blockIndex] = block;
    sections[sectionIndex] = { ...sections[sectionIndex], blocks };
    setResult({ ...result, sections });
  };

  const updateTableCell = (
    sectionIndex: number,
    blockIndex: number,
    rowIndex: number,
    columnKey: string,
    value: string
  ) => {
    if (!result) return;
    const block = result.sections[sectionIndex].blocks[blockIndex];
    if (block.type !== "table") return;
    const rows = [...block.rows];
    rows[rowIndex] = {
      ...rows[rowIndex],
      cells: {
        ...rows[rowIndex].cells,
        [columnKey]: {
          ...rows[rowIndex].cells[columnKey],
          value,
          missingInfo: value.trim() ? undefined : rows[rowIndex].cells[columnKey]?.missingInfo,
        },
      },
    };
    updateBlock(sectionIndex, blockIndex, { ...block, rows });
  };

  const addTableRow = (sectionIndex: number, blockIndex: number) => {
    if (!result) return;
    const block = result.sections[sectionIndex].blocks[blockIndex];
    if (block.type !== "table") return;
    let rowNumber = block.rows.length + 1;
    while (block.rows.some((row) => row.id === `${block.id}-row-${rowNumber}`)) rowNumber += 1;
    updateBlock(sectionIndex, blockIndex, {
      ...block,
      rows: [
        ...block.rows,
        {
          id: `${block.id}-row-${rowNumber}`,
          cells: Object.fromEntries(block.columns.map((column) => [
            column.key,
            column.required
              ? { value: "", missingInfo: column.title }
              : { value: "" },
          ])),
        },
      ],
    });
  };

  const removeTableRow = (sectionIndex: number, blockIndex: number, rowIndex: number) => {
    if (!result) return;
    const block = result.sections[sectionIndex].blocks[blockIndex];
    if (block.type !== "table" || block.rows.length <= 1) return;
    updateBlock(sectionIndex, blockIndex, {
      ...block,
      rows: block.rows.filter((_, index) => index !== rowIndex),
    });
  };

  const selectBidFile = (file: File | null): boolean => {
    if (file && !isSupportedBidFile(file)) {
      toast.error("仅支持 DOCX、PDF、TXT 格式");
      return false;
    }
    if (file && uploadExceedsLimit(file, MAX_BID_UPLOAD_BYTES)) {
      toast.error(`招标文件不能超过 ${MAX_BID_UPLOAD_MB} MB`);
      return false;
    }

    setBidFile(file);
    setResult(null);
    setAnalyzeJobId(null);
    return true;
  };

  const selectTemplateFile = (file: File | null): boolean => {
    if (file && !TEMPLATE_FILE_EXTENSIONS.some((extension) => file.name.toLowerCase().endsWith(extension))) {
      toast.error("投标模板仅支持 DOCX 格式");
      return false;
    }
    if (file && uploadExceedsLimit(file, MAX_BID_UPLOAD_BYTES)) {
      toast.error(`投标模板不能超过 ${MAX_BID_UPLOAD_MB} MB`);
      return false;
    }

    setTemplateFile(file);
    setResult(null);
    setAnalyzeJobId(null);
    return true;
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!selectBidFile(file)) {
      event.target.value = "";
    }
  };

  const handleFileDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragOver(false);
    if (analyzing) return;

    const file = event.dataTransfer.files?.[0];
    if (file) selectBidFile(file);
  };

  const handleTemplateFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!selectTemplateFile(file)) event.target.value = "";
  };

  const handleTemplateFileDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setTemplateDragOver(false);
    if (analyzing) return;
    const file = event.dataTransfer.files?.[0];
    if (file) selectTemplateFile(file);
  };

  const handleAnalyze = async () => {
    if (!bidFile) return;
    setAnalyzing(true);
    setAnalyzeJobId(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("bidFile", bidFile);
      if (templateFile) fd.append("templateFile", templateFile);
      fd.append("companyInfo", companyInfo);
      const res = await authenticatedFetch("/api/documents/bid", { method: "POST", body: fd });
      if (!res.ok) throw await createApiResponseError(res, "分析失败");
      const data = (await res.json().catch(() => ({}))) as { jobId?: unknown };
      if (!data.jobId || typeof data.jobId !== "string") throw new Error("分析任务未创建");
      setAnalyzeJobId(data.jobId);
      toast.success("分析任务已创建");
    } catch (e) {
      setAnalyzing(false);
      toast.error((e as Error).message);
    }
  };

  const handleAnalyzeJobDone = (job: unknown) => {
    setAnalyzing(false);
    const done = job as {
      status?: string;
      errorMessage?: string | null;
      resultJson?: BidResult | null;
    };
    if (done.status === "failed") {
      toast.error(done.errorMessage || "分析失败");
      setAnalyzeJobId(null);
      return;
    }
    if (done.resultJson) {
      setResult(done.resultJson);
      setActiveChapterIndex(0);
      toast.success("标书已生成，请在右侧编辑补充");
    }
    setAnalyzeJobId(null);
  };

  const handleDownload = async () => {
    if (!result) return;
    setDocumentJobPending(true);
    try {
      const jobId = await createDocumentJob("/api/documents/bid", {
        sections: result.sections,
        projectName: result.projectName,
        bidUnit: result.bidUnit,
        bidDeadline: result.bidDeadline,
        aiRunId: result.aiRunId ?? null,
        templateId: result.templateId ?? null,
        templateSource: result.templateSource ?? "system_default",
        templateStoredFileId: result.templateStoredFileId ?? null,
      });
      setDocumentJobId(jobId);
      toast.success("Word 生成任务已创建");
    } catch (e) {
      setDocumentJobPending(false);
      toast.error((e as Error).message);
    }
  };

  const handleDocumentJobDone = async (job: unknown) => {
    setDocumentJobPending(false);
    try {
      await downloadDocumentFromJob(job);
      toast.success("Word 下载完成");
      setDocumentJobId(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const missingCount = result ? countMissingBidFields(result.sections) : 0;

  return (
    <div className="flex min-h-[calc(100dvh-64px)] w-full min-w-0 max-w-full flex-col overflow-x-clip px-4 pb-24 pt-24 text-[#E8EDF7] sm:px-6 lg:px-8 lg:pb-10 lg:pt-[112px] xl:h-[calc(100dvh-64px)] xl:overflow-hidden">
      <div className="mb-6 flex shrink-0 flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-between lg:mb-9">
        <div>
          <h1 className="text-[28px] font-bold leading-tight text-white sm:text-[36px]">标书制作</h1>
          {result?.formatRequirements && <p className="mt-2 text-sm text-[#687286]">格式：{result.formatRequirements}</p>}
          {result?.generationWarnings?.map((warning) => (
            <p key={warning} className="mt-1 text-sm text-[#F6BE5B]">提示：{warning}</p>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          {result && missingCount > 0 && <span className="text-sm text-[#F6BE5B]">{missingCount}项待填写</span>}
          {result && (
            <button
              type="button"
              onClick={handleDownload}
              disabled={documentJobPending}
              className="btn-bg h-[34px] whitespace-nowrap rounded-[10px] px-5 text-sm font-semibold text-[#0A0613] disabled:cursor-not-allowed disabled:opacity-60"
            >
              下载 Word
            </button>
          )}
        </div>
      </div>

      {analyzeJobId && (
        <div className="mb-4 shrink-0 rounded-[12px] border border-[#202837] bg-[#141922] p-4">
          <JobStatus jobId={analyzeJobId} onDone={handleAnalyzeJobDone} />
        </div>
      )}

      {documentJobId && (
        <div className="mb-4 shrink-0 rounded-[12px] border border-[#202837] bg-[#141922] p-4">
          <JobStatus jobId={documentJobId} onDone={handleDocumentJobDone} />
        </div>
      )}

      <div className="grid min-w-0 grid-cols-1 gap-6 xl:min-h-0 xl:flex-1 xl:grid-cols-[clamp(420px,34vw,614px)_minmax(0,1fr)] xl:overflow-hidden">
        <div className="min-w-0 xl:min-h-0 xl:overflow-x-hidden xl:overflow-y-auto xl:pr-4">
          <div className="space-y-7 pb-8">
            <Section title="1.上传招标文件">
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.pdf,.txt"
                className="hidden"
                onChange={handleFileChange}
                disabled={analyzing}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={(event) => {
                  event.preventDefault();
                  if (!analyzing) setDragOver(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                  if (!analyzing) setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                disabled={analyzing}
                className={`flex h-[254px] w-full flex-col items-center justify-center rounded-[8px] text-center transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  dragOver
                    ? "bg-[#0A1424] ring-1 ring-[#6FB1FF]"
                    : "bg-[#070B14] hover:bg-[#0A101C]"
                }`}
              >
                <Image src="/img/upload.png" alt="upload" width={48} height={48} />
                <span className="mt-7 text-[22px] text-[#D8DEEA]">{bidFile ? bidFile.name : "上传招标文件"}</span>
                <span className="mt-3 text-[17px] leading-7 text-[#687286]">AI将按招标文件格式生成标书</span>
                <span className="text-[17px] leading-7 text-[#687286]">
                  建议不超过{RECOMMENDED_BID_UPLOAD_MB}MB · 最大{MAX_BID_UPLOAD_MB}MB
                </span>
                <span className="text-[14px] leading-6 text-[#566176]">文件越大，AI分析和生成耗时越长</span>
              </button>
              {bidFile && (
                <button
                  type="button"
                  onClick={() => {
                    selectBidFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="mt-3 text-sm text-[#687286] transition hover:text-white"
                >
                  清除文件
                </button>
              )}
            </Section>

            <Section title="2.上传投标模板（可选）">
              <input
                ref={templateFileInputRef}
                type="file"
                accept=".docx"
                className="hidden"
                onChange={handleTemplateFileChange}
                disabled={analyzing}
              />
              <button
                type="button"
                onClick={() => templateFileInputRef.current?.click()}
                onDragEnter={(event) => {
                  event.preventDefault();
                  if (!analyzing) setTemplateDragOver(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                  if (!analyzing) setTemplateDragOver(true);
                }}
                onDragLeave={() => setTemplateDragOver(false)}
                onDrop={handleTemplateFileDrop}
                disabled={analyzing}
                className={`flex min-h-[176px] w-full flex-col items-center justify-center rounded-[8px] px-5 text-center transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  templateDragOver
                    ? "bg-[#0A1424] ring-1 ring-[#6FB1FF]"
                    : "bg-[#070B14] hover:bg-[#0A101C]"
                }`}
              >
                <Image src="/img/upload.png" alt="upload template" width={40} height={40} />
                <span className="mt-4 max-w-full truncate text-[19px] text-[#D8DEEA]">
                  {templateFile ? templateFile.name : "上传投标模板（DOCX）"}
                </span>
                <span className="mt-2 text-[15px] leading-6 text-[#687286]">
                  招标 DOCX 已包含模板时无需上传；未包含且未上传时使用系统默认模板
                </span>
                <span className="text-[14px] leading-6 text-[#566176]">
                  建议不超过{RECOMMENDED_TEMPLATE_UPLOAD_MB}MB · 最大{MAX_BID_UPLOAD_MB}MB
                </span>
              </button>
              {templateFile && (
                <button
                  type="button"
                  onClick={() => {
                    selectTemplateFile(null);
                    if (templateFileInputRef.current) templateFileInputRef.current.value = "";
                  }}
                  className="mt-3 text-sm text-[#687286] transition hover:text-white"
                >
                  清除模板
                </button>
              )}
            </Section>

            <Section title="3.我方信息">
              <Textarea
                value={companyInfo}
                onChange={(event) => setCompanyInfo(event.target.value)}
                placeholder="粘贴合同要点，AI自动填充……"
                rows={3}
                className="min-h-[90px] resize-y rounded-[8px] border-0 bg-[#070B14] px-4 py-4 text-[18px] leading-7 text-slate-100 placeholder:text-[#8D96A7] focus-visible:ring-[#6FB1FF]/40"
                disabled={analyzing}
              />
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={!bidFile || analyzing}
                className="btn-bg mt-4 h-[45px] w-full rounded-[9px] text-[18px] font-semibold text-[#0A0613] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {analyzing ? "AI 分析招标文件..." : "AI分析并制成标书"}
              </button>
            </Section>

            {result && (
              <Section title="4.编辑补充">
                <div className="space-y-4">
                  <Field label="项目名称" value={result.projectName} onChange={(value) => setResult({ ...result, projectName: value })} />
                  <Field label="投标截止日期" value={result.bidDeadline} onChange={(value) => setResult({ ...result, bidDeadline: value })} dateTime />
                  {result.sections.map((section, index) => (
                    <div key={section.id} className="block">
                      <span className="mb-2 block text-[16px] font-medium text-[#A4ADBD]">{section.title}</span>
                      {section.missingInfo && <p className="mb-2 text-sm text-[#F6BE5B]">待填写：{section.missingInfo}</p>}
                      <div className="space-y-3">
                        {section.blocks.map((block, blockIndex) => (
                          <BidBlockEditor
                            key={block.id}
                            block={block}
                            onParagraphChange={(text) => {
                              if (block.type === "paragraph") updateBlock(index, blockIndex, { ...block, text });
                            }}
                            onCellChange={(rowIndex, columnKey, value) => updateTableCell(index, blockIndex, rowIndex, columnKey, value)}
                            onAddRow={() => addTableRow(index, blockIndex)}
                            onRemoveRow={(rowIndex) => removeTableRow(index, blockIndex, rowIndex)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>
        </div>

        <div className="min-w-0 xl:min-h-0 xl:pl-2">
          <div className="grid min-w-0 grid-cols-1 gap-4 xl:h-full xl:min-h-0 xl:grid-cols-[clamp(168px,14vw,220px)_minmax(0,1fr)]">
            <aside className="min-w-0 rounded-[14px] border border-[#202837] bg-[#141922] p-4 xl:min-h-0 xl:overflow-x-hidden xl:overflow-y-auto">
              <h2 className="mb-4 text-[17px] font-semibold text-white">完整章节</h2>
              {!result ? (
                <p className="text-sm leading-6 text-[#687286]">分析完成后展示模板的全部章节。</p>
              ) : (
                <nav className="space-y-1" aria-label="投标文件章节">
                  {result.sections.map((section, index) => {
                    const needsInput = sectionNeedsInput(section);
                    return (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => {
                          setActiveChapterIndex(index);
                          document.getElementById(`bid-chapter-${index}`)?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                        }}
                        className={`flex w-full items-start gap-2 rounded-[8px] px-2.5 py-2 text-left text-sm leading-5 transition ${
                          activeChapterIndex === index
                            ? "bg-[#243044] text-white"
                            : "text-[#A4ADBD] hover:bg-[#1A2230] hover:text-white"
                        }`}
                      >
                        <span className="w-5 shrink-0 text-[#687286]">{index + 1}.</span>
                        <span className="min-w-0 flex-1 break-words">{section.title}</span>
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${needsInput ? "bg-[#F6BE5B]" : "bg-[#52C98A]"}`}
                          title={needsInput ? "待补充" : "已生成"}
                        />
                      </button>
                    );
                  })}
                </nav>
              )}
            </aside>

            <div className="min-w-0 rounded-[14px] border border-[#202837] bg-[#141922] p-4 sm:p-6 xl:min-h-0 xl:overflow-x-hidden xl:overflow-y-auto">
            {!result ? (
              <div className="flex h-full min-h-[520px] items-center justify-center text-center text-[#A4ADBD]">
                <div>
                  <Image className="mx-auto" src="/img/file.png" alt="file" width={48} height={48} />
                  <p className="mt-5 text-[22px]">上传招标文件</p>
                  <p className="mt-3 text-[20px] leading-8">AI将按照招标文件中的格式要求</p>
                  <p className="text-[20px] leading-8">自动生成投标响应文件</p>
                </div>
              </div>
            ) : (
              <div className="bid-preview text-[16px] leading-8 text-[#A4ADBD]">
                <h2 className="mb-2 text-center text-[30px] font-bold text-white">投 标 文 件</h2>
                {result.bidUnit && <p className="text-center">致：{result.bidUnit}</p>}
                <p className="text-center">项目：{result.projectName || "—"}</p>
                <p className="mb-8 text-center text-[#687286]">截止日期：{result.bidDeadline || "—"}</p>
                {result.sections.map((section, index) => (
                  <section id={`bid-chapter-${index}`} key={section.id} className="mb-6 scroll-mt-6">
                    <h3 className="mb-2 text-[20px] font-bold text-white">{section.title}</h3>
                    {section.missingInfo && <p className="mb-2 rounded-[6px] bg-[#3B2E14] px-3 py-1 text-sm text-[#F6BE5B]">待填写：{section.missingInfo}</p>}
                    <div className="space-y-3">
                      {section.blocks.map((block) => <BidBlockPreview key={block.id} block={block} />)}
                    </div>
                  </section>
                ))}
                <div className="mt-10 border-t border-[#687286] pt-5 text-[16px]">
                  <p>投标人（盖章）：________________</p>
                  <p className="mt-1 text-[#687286]">授权代表签字：________________　　日期：________________</p>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-[14px] border border-[#202837] bg-[#141922] p-4 sm:p-7">
      <h2 className="mb-5 text-[18px] font-semibold text-white sm:mb-8 sm:text-[20px]">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value, onChange, dateTime = false }: { label: string; value: string; onChange: (value: string) => void; dateTime?: boolean }) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-[16px] text-[#687286]">{label}</span>
      {dateTime ? (
        <DateTimePicker
          value={value ?? ""}
          onChange={onChange}
          className="h-[42px] border-transparent bg-[#070B14] px-4 text-[17px] focus-visible:border-[#6FB1FF]"
        />
      ) : (
        <input
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          className="h-[42px] w-full min-w-0 rounded-[8px] border border-transparent bg-[#070B14] px-4 text-[17px] text-slate-100 outline-none focus:border-[#6FB1FF]"
        />
      )}
    </label>
  );
}

function sectionNeedsInput(section: BidSection): boolean {
  if (section.missingInfo) return true;
  return section.blocks.some((block) => {
    if (block.type === "paragraph") return Boolean(block.missingInfo || isBidPlaceholder(block.text));
    if (block.type === "page_break") return false;
    return block.rows.some((row) => block.columns.some((column) => {
      const cell = row.cells[column.key];
      return (Boolean(column.required) && (!cell || !cell.value.trim()))
        || Boolean(cell?.missingInfo)
        || Boolean(cell && isBidPlaceholder(cell.value));
    }));
  });
}

function BidBlockEditor({
  block,
  onParagraphChange,
  onCellChange,
  onAddRow,
  onRemoveRow,
}: {
  block: BidBlock;
  onParagraphChange: (text: string) => void;
  onCellChange: (rowIndex: number, columnKey: string, value: string) => void;
  onAddRow: () => void;
  onRemoveRow: (rowIndex: number) => void;
}) {
  if (block.type === "paragraph") {
    return (
      <Textarea
        value={block.text}
        onChange={(event) => onParagraphChange(event.target.value)}
        rows={4}
        className="resize-y rounded-[8px] border border-transparent bg-[#070B14] px-4 py-3 text-[16px] leading-7 text-slate-100 focus-visible:ring-[#6FB1FF]/40"
      />
    );
  }
  if (block.type === "page_break") {
    return (
      <div className="flex items-center gap-3 py-1 text-xs text-[#687286]" aria-label="分页符">
        <span className="h-px flex-1 bg-[#293244]" />
        分页
        <span className="h-px flex-1 bg-[#293244]" />
      </div>
    );
  }

  const canModifyRows = block.allowAddRows !== false;

  return (
    <div className="min-w-0 rounded-[8px] border border-[#293244] bg-[#090E18] p-3">
      {block.title && <p className="mb-3 text-sm font-medium text-white">{block.title}</p>}
      <div className="max-w-full overflow-x-auto overscroll-x-contain">
        <table
          className="border-collapse text-left text-sm"
          style={{ minWidth: Math.max(720, block.columns.length * 150) }}
        >
          <thead>
            <tr>
              {block.columns.map((column) => (
                <th key={column.key} className="border border-[#354055] bg-[#1D2635] px-2 py-2 font-medium text-[#DCE3EF]">
                  {column.title}
                  {column.readOnly && <span className="ml-1 text-[11px] font-normal text-[#8290A6]">原文</span>}
                </th>
              ))}
              {canModifyRows && (
                <th className="w-16 border border-[#354055] bg-[#1D2635] px-2 py-2 text-center font-medium text-[#DCE3EF]">操作</th>
              )}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={row.id}>
                {block.columns.map((column) => {
                  const cell = row.cells[column.key];
                  return (
                    <td key={column.key} className="border border-[#354055] p-1 align-top">
                      <textarea
                        value={cell?.value || ""}
                        onChange={(event) => onCellChange(rowIndex, column.key, event.target.value)}
                        readOnly={column.readOnly}
                        placeholder={cell?.missingInfo
                          ? `待填写：${cell.missingInfo}`
                          : column.required ? `待填写：${column.title}` : "可选"}
                        aria-label={`${block.title || "表格"}-${column.title}-第${rowIndex + 1}行`}
                        className={`min-h-20 w-full resize-y rounded px-2 py-2 leading-5 outline-none ${
                          column.readOnly
                            ? "cursor-default bg-[#111926] text-[#AEB9CA]"
                            : "bg-[#070B14] text-slate-100 focus:ring-1 focus:ring-[#6FB1FF]"
                        } placeholder:text-[#B54D59]`}
                      />
                    </td>
                  );
                })}
                {canModifyRows && (
                  <td className="border border-[#354055] px-2 text-center align-middle">
                    <button
                      type="button"
                      onClick={() => onRemoveRow(rowIndex)}
                      disabled={block.rows.length <= 1}
                      className="text-xs text-[#E77A87] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      删除
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canModifyRows && (
        <button
          type="button"
          onClick={onAddRow}
          className="mt-3 rounded-[6px] border border-[#354055] px-3 py-1.5 text-xs text-[#AFCBEE] transition hover:border-[#6FB1FF] hover:text-white"
        >
          + 添加一行
        </button>
      )}
    </div>
  );
}

function HighlightedBidText({ text }: { text: string }) {
  return text.split(/(【待填写[^】]*】)/g).map((part, index) =>
    part.startsWith("【待填写")
      ? <span key={index} className="rounded bg-[#3C1720] px-1 text-[#FF6B6B]">{part}</span>
      : <span key={index}>{part}</span>
  );
}

function BidBlockPreview({ block }: { block: BidBlock }) {
  if (block.type === "paragraph") {
    return <p className="whitespace-pre-wrap"><HighlightedBidText text={block.text} /></p>;
  }
  if (block.type === "page_break") {
    return <div className="my-4 border-t border-dashed border-[#465167]" aria-label="分页符" />;
  }

  return (
    <div className="max-w-full overflow-x-auto overscroll-x-contain">
      {block.title && <p className="mb-2 font-medium text-[#DCE3EF]">{block.title}</p>}
      <table
        className="border-collapse text-left text-sm leading-5"
        style={{ minWidth: Math.max(640, block.columns.length * 130) }}
      >
        <thead>
          {block.headerRows?.length ? block.headerRows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.cells.map((cell, cellIndex) => (
                <th
                  key={`${rowIndex}-${cellIndex}`}
                  colSpan={cell.columnSpan}
                  rowSpan={cell.rowSpan}
                  className="border border-[#465167] bg-[#1D2635] px-3 py-2 text-center font-semibold text-white"
                >
                  {cell.text}
                </th>
              ))}
            </tr>
          )) : (
            <tr>
              {block.columns.map((column) => (
                <th key={column.key} className="border border-[#465167] bg-[#1D2635] px-3 py-2 text-center font-semibold text-white">
                  {column.title}
                </th>
              ))}
            </tr>
          )}
        </thead>
        <tbody>
          {block.rows.map((row) => (
            <tr key={row.id}>
              {block.columns.map((column) => {
                const cell = row.cells[column.key];
                const value = cell?.value
                  || (column.required ? `【待填写：${cell?.missingInfo || column.title}】` : "");
                return (
                  <td
                    key={column.key}
                    colSpan={cell?.columnSpan}
                    rowSpan={cell?.rowSpan}
                    className="border border-[#465167] px-3 py-2 align-top text-[#C0C8D6]"
                  >
                    <HighlightedBidText text={value} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
