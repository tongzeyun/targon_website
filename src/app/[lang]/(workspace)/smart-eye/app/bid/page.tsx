"use client";

import { useUiText } from "@/app/[lang]/(workspace)/smart-eye/_hooks/use-ui-text";
import pageStyles from "@/app/[lang]/(workspace)/smart-eye/_styles/pages.module.css";

import { useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import { Textarea } from "@/app/[lang]/(workspace)/smart-eye/_components/ui/textarea";
import { DateTimePicker } from "@/app/[lang]/(workspace)/smart-eye/_components/ui/date-picker";
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
  const uiText = useUiText();
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
      toast.error(uiText("仅支持 DOCX、PDF、TXT 格式"));
      return false;
    }
    if (file && uploadExceedsLimit(file, MAX_BID_UPLOAD_BYTES)) {
      toast.error(uiText("招标文件不能超过 {0} MB", { 0: MAX_BID_UPLOAD_MB }));
      return false;
    }

    setBidFile(file);
    setResult(null);
    setAnalyzeJobId(null);
    return true;
  };

  const selectTemplateFile = (file: File | null): boolean => {
    if (file && !TEMPLATE_FILE_EXTENSIONS.some((extension) => file.name.toLowerCase().endsWith(extension))) {
      toast.error(uiText("投标模板仅支持 DOCX 格式"));
      return false;
    }
    if (file && uploadExceedsLimit(file, MAX_BID_UPLOAD_BYTES)) {
      toast.error(uiText("投标模板不能超过 {0} MB", { 0: MAX_BID_UPLOAD_MB }));
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
      if (!res.ok) throw await createApiResponseError(res, uiText("分析失败"));
      const data = (await res.json().catch(() => ({}))) as { jobId?: unknown };
      if (!data.jobId || typeof data.jobId !== "string") throw new Error(uiText("分析任务未创建"));
      setAnalyzeJobId(data.jobId);
      toast.success(uiText("分析任务已创建"));
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
      toast.error(done.errorMessage || uiText("分析失败"));
      setAnalyzeJobId(null);
      return;
    }
    if (done.resultJson) {
      setResult(done.resultJson);
      setActiveChapterIndex(0);
      toast.success(uiText("标书已生成，请在右侧编辑补充"));
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
      toast.success(uiText("Word 生成任务已创建"));
    } catch (e) {
      setDocumentJobPending(false);
      toast.error((e as Error).message);
    }
  };

  const handleDocumentJobDone = async (job: unknown) => {
    setDocumentJobPending(false);
    try {
      await downloadDocumentFromJob(job);
      toast.success(uiText("Word 下载完成"));
      setDocumentJobId(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const missingCount = result ? countMissingBidFields(result.sections) : 0;

  return (
    <div className={`${pageStyles.page} ${pageStyles.document}`}>
      <div className="mb-6 flex shrink-0 flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-between lg:mb-8">
        <div>
          <h1>{uiText("标书制作")}</h1>
          {result?.formatRequirements && <p className="mt-2 text-sm text-muted-foreground">{uiText("格式：")}{result.formatRequirements}</p>}
          {result?.generationWarnings?.map((warning) => (
            <p key={warning} className="mt-1 text-sm text-[#f6be5b]">{uiText("提示：")}{warning}</p>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          {result && missingCount > 0 && <span className="text-sm text-[#f6be5b]">{missingCount}{uiText("项待填写")}</span>}
          {result && (
            <button
              type="button"
              onClick={handleDownload}
              disabled={documentJobPending}
              className="btn-bg h-[34px] whitespace-nowrap rounded-[10px] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uiText("下载 Word")}</button>
          )}
        </div>
      </div>

      {analyzeJobId && (
        <div className="mb-4 shrink-0 rounded-[12px] border border-border bg-card p-4">
          <JobStatus jobId={analyzeJobId} onDone={handleAnalyzeJobDone} />
        </div>
      )}

      {documentJobId && (
        <div className="mb-4 shrink-0 rounded-[12px] border border-border bg-card p-4">
          <JobStatus jobId={documentJobId} onDone={handleDocumentJobDone} />
        </div>
      )}

      <div className="grid min-w-0 grid-cols-1 gap-6 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,600px)_minmax(0,1fr)] xl:overflow-hidden">
        <div className="min-w-0 xl:min-h-0 xl:overflow-x-hidden xl:overflow-y-auto xl:pr-[26px]">
          <div className="space-y-7 pb-8">
            <Section title={uiText("1.上传招标文件")}>
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
                className={`flex h-[254px] w-full flex-col items-center justify-center rounded-[8px] text-center transition disabled:cursor-not-allowed disabled:opacity-60 ${dragOver
                    ? "bg-accent ring-1 ring-[#6FB1FF]"
                    : "bg-input hover:bg-accent"}`}
              >
                <img src="/img/smart-eye/upload.svg" alt="" />
                <span className="mt-7 text-[22px] text-foreground">{bidFile ? bidFile.name : uiText("上传招标文件")}</span>
                <span className="mt-3 text-[17px] leading-7 text-muted-foreground">{uiText("AI将按招标文件格式生成标书")}</span>
                <span className="text-[17px] leading-7 text-muted-foreground">
                  {uiText("建议不超过")}{RECOMMENDED_BID_UPLOAD_MB}{uiText("MB · 最大")}{MAX_BID_UPLOAD_MB}MB
                </span>
                <span className="text-[14px] leading-6 text-[#566176]">{uiText("文件越大，AI分析和生成耗时越长")}</span>
              </button>
              {bidFile && (
                <button
                  type="button"
                  onClick={() => {
                    selectBidFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="mt-3 text-sm text-muted-foreground transition hover:text-foreground"
                >
                  {uiText("清除文件")}</button>
              )}
            </Section>

            <Section title={uiText("2.上传投标模板（可选）")}>
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
                className={`flex min-h-[176px] w-full flex-col items-center justify-center rounded-[8px] px-5 text-center transition disabled:cursor-not-allowed disabled:opacity-60 ${templateDragOver
                    ? "bg-accent ring-1 ring-[#6FB1FF]"
                    : "bg-input hover:bg-accent"}`}
              >
                <img src="/img/smart-eye/upload.svg" alt="" />
                <span className="mt-4 max-w-full truncate text-[19px] text-foreground">
                  {templateFile ? templateFile.name : uiText("上传投标模板（DOCX）")}
                </span>
                <span className="mt-2 text-[15px] leading-6 text-muted-foreground">
                  {uiText("招标 DOCX 已包含模板时无需上传；未包含且未上传时使用系统默认模板")}</span>
                <span className="text-[14px] leading-6 text-[#566176]">
                  {uiText("建议不超过")}{RECOMMENDED_TEMPLATE_UPLOAD_MB}{uiText("MB · 最大")}{MAX_BID_UPLOAD_MB}MB
                </span>
              </button>
              {templateFile && (
                <button
                  type="button"
                  onClick={() => {
                    selectTemplateFile(null);
                    if (templateFileInputRef.current) templateFileInputRef.current.value = "";
                  }}
                  className="mt-3 text-sm text-muted-foreground transition hover:text-foreground"
                >
                  {uiText("清除模板")}</button>
              )}
            </Section>

            <Section title={uiText("3.我方信息")}>
              <Textarea
                value={companyInfo}
                onChange={(event) => setCompanyInfo(event.target.value)}
                placeholder={uiText("粘贴合同要点，AI自动填充……")}
                rows={3}
                className="min-h-[90px] resize-y rounded-[8px] border-0 bg-input px-4 py-4 text-[18px] leading-7 text-foreground placeholder:text-muted-foreground focus-visible:ring-[#6FB1FF]/40"
                disabled={analyzing}
              />
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={!bidFile || analyzing}
                className="btn-bg mt-4 h-[45px] w-full rounded-[9px] text-[18px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {analyzing ? uiText("AI 分析招标文件...") : uiText("AI分析并制成标书")}
              </button>
            </Section>

            {result && (
              <Section title={uiText("4.编辑补充")}>
                <div className="space-y-4">
                  <Field label={uiText("项目名称")} value={result.projectName} onChange={(value) => setResult({ ...result, projectName: value })} />
                  <Field label={uiText("投标截止日期")} value={result.bidDeadline} onChange={(value) => setResult({ ...result, bidDeadline: value })} dateTime />
                  {result.sections.map((section, index) => (
                    <div key={section.id} className="block">
                      <span className="mb-2 block text-[16px] font-medium text-[#52637a]">{section.title}</span>
                      {section.missingInfo && <p className="mb-2 text-sm text-[#f6be5b]">{uiText("待填写：")}{section.missingInfo}</p>}
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

        <div className="min-w-0 xl:min-h-0 xl:pr-[10px]">
          <div className={`grid min-w-0 grid-cols-1 gap-4 xl:h-full xl:min-h-0 ${result ? "xl:grid-cols-[clamp(168px,14vw,220px)_minmax(0,1fr)]" : ""}`}>
            {result && <aside className="min-w-0 rounded-[14px] border border-border bg-card p-4 xl:min-h-0 xl:overflow-x-hidden xl:overflow-y-auto">
              <h2 className="mb-4 text-[17px] font-semibold text-foreground">{uiText("完整章节")}</h2>
              <nav className="space-y-1" aria-label={uiText("投标文件章节")}>
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
                        className={`flex w-full items-start gap-2 rounded-[8px] px-2.5 py-2 text-left text-sm leading-5 transition ${activeChapterIndex === index
                            ? "bg-accent text-white"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                      >
                        <span className="w-5 shrink-0 text-muted-foreground">{index + 1}.</span>
                        <span className="min-w-0 flex-1 break-words">{section.title}</span>
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${needsInput ? "bg-[#F6BE5B]" : "bg-[#52C98A]"}`}
                          title={needsInput ? uiText("待补充") : uiText("已生成")}
                        />
                      </button>
                    );
                  })}
              </nav>
            </aside>}

            <div className="min-w-0 rounded-[14px] border border-border bg-card p-4 sm:p-6 xl:min-h-0 xl:overflow-x-hidden xl:overflow-y-auto">
            {!result ? (
              <div className="flex h-full min-h-[520px] items-center justify-center text-center text-[#52637a]">
                <div>
                  <img className="mx-auto" src="/img/smart-eye/file.svg" alt="" />
                  <p className="mt-5 text-[22px]">{uiText("上传招标文件")}</p>
                  <p className="mt-3 text-[20px] leading-8">{uiText("AI将按照招标文件中的格式要求")}</p>
                  <p className="text-[20px] leading-8">{uiText("自动生成投标响应文件")}</p>
                </div>
              </div>
            ) : (
              <div className="bid-preview text-[16px] leading-8 text-[#52637a]">
                <h2 className="mb-2 text-center text-[30px] font-bold text-foreground">投 标 文 件</h2>
                {result.bidUnit && <p className="text-center">致：{result.bidUnit}</p>}
                <p className="text-center">项目：{result.projectName || "—"}</p>
                <p className="mb-8 text-center text-muted-foreground">截止日期：{result.bidDeadline || "—"}</p>
                {result.sections.map((section, index) => (
                  <section id={`bid-chapter-${index}`} key={section.id} className="mb-6 scroll-mt-6">
                    <h3 className="mb-2 text-[20px] font-bold text-foreground">{section.title}</h3>
                    {section.missingInfo && <p className="mb-2 rounded-[6px] bg-[#f6be5b]/15 px-3 py-1 text-sm text-[#f6be5b]">待填写：{section.missingInfo}</p>}
                    <div className="space-y-3">
                      {section.blocks.map((block) => <BidBlockPreview key={block.id} block={block} />)}
                    </div>
                  </section>
                ))}
                <div className="mt-10 border-t border-[#687286] pt-5 text-[16px]">
                  <p>投标人（盖章）：________________</p>
                  <p className="mt-1 text-muted-foreground">授权代表签字：________________　　日期：________________</p>
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
    <section className="min-w-0 rounded-[14px] border border-border bg-card p-4 sm:p-7">
      <h2 className="mb-5 text-[18px] font-semibold text-foreground sm:mb-8 sm:text-[20px]">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value, onChange, dateTime = false }: { label: string; value: string; onChange: (value: string) => void; dateTime?: boolean }) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-[16px] text-muted-foreground">{label}</span>
      {dateTime ? (
        <DateTimePicker
          value={value ?? ""}
          onChange={onChange}
          className="h-[42px] border-transparent bg-input px-4 text-[17px] focus-visible:border-[#6fb1ff]"
        />
      ) : (
        <input
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          className="h-[42px] w-full min-w-0 rounded-[8px] border border-transparent bg-input px-4 text-[17px] text-foreground outline-none focus:border-[#6fb1ff]"
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
  const uiText = useUiText();
  if (block.type === "paragraph") {
    return (
      <Textarea
        value={block.text}
        onChange={(event) => onParagraphChange(event.target.value)}
        rows={4}
        className="resize-y rounded-[8px] border border-transparent bg-input px-4 py-3 text-[16px] leading-7 text-foreground focus-visible:ring-[#6FB1FF]/40"
      />
    );
  }
  if (block.type === "page_break") {
    return (
      <div className="flex items-center gap-3 py-1 text-xs text-muted-foreground" aria-label={uiText("分页符")}>
        <span className="h-px flex-1 bg-border" />
        {uiText("分页")}<span className="h-px flex-1 bg-border" />
      </div>
    );
  }

  const canModifyRows = block.allowAddRows !== false;

  return (
    <div className="min-w-0 rounded-[8px] border border-border bg-input p-3">
      {block.title && <p className="mb-3 text-sm font-medium text-foreground">{block.title}</p>}
      <div className="max-w-full overflow-x-auto overscroll-x-contain">
        <table
          className="border-collapse text-left text-sm"
          style={{ minWidth: Math.max(720, block.columns.length * 150) }}
        >
          <thead>
            <tr>
              {block.columns.map((column) => (
                <th key={column.key} className="border border-border bg-secondary px-2 py-2 font-medium text-foreground">
                  {column.title}
                  {column.readOnly && <span className="ml-1 text-[11px] font-normal text-muted-foreground">{uiText("原文")}</span>}
                </th>
              ))}
              {canModifyRows && (
                <th className="w-16 border border-border bg-secondary px-2 py-2 text-center font-medium text-foreground">{uiText("操作")}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={row.id}>
                {block.columns.map((column) => {
                  const cell = row.cells[column.key];
                  return (
                    <td key={column.key} className="border border-border p-1 align-top">
                      <textarea
                        value={cell?.value || ""}
                        onChange={(event) => onCellChange(rowIndex, column.key, event.target.value)}
                        readOnly={column.readOnly}
                        placeholder={cell?.missingInfo
                          ? uiText("待填写：{0}", { 0: cell.missingInfo })
                          : column.required ? uiText("待填写：{0}", { 0: column.title }) : uiText("可选")}
                        aria-label={uiText("{0}-{1}-第{2}行", { 0: block.title || "表格", 1: column.title, 2: rowIndex + 1 })}
                        className={`min-h-20 w-full resize-y rounded px-2 py-2 leading-5 outline-none ${column.readOnly
                            ? "cursor-default bg-secondary text-muted-foreground"
                            : "bg-input text-foreground focus:ring-1 focus:ring-[#6FB1FF]"} placeholder:text-[#b54d59]`}
                      />
                    </td>
                  );
                })}
                {canModifyRows && (
                  <td className="border border-border px-2 text-center align-middle">
                    <button
                      type="button"
                      onClick={() => onRemoveRow(rowIndex)}
                      disabled={block.rows.length <= 1}
                      className="text-xs text-[#e77a87] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      {uiText("删除")}</button>
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
          className="mt-3 rounded-[6px] border border-border px-3 py-1.5 text-xs text-foreground transition hover:border-[#6fb1ff] hover:text-foreground"
        >
          {uiText("+ 添加一行")}</button>
      )}
    </div>
  );
}

function HighlightedBidText({ text }: { text: string }) {
  return text.split(/(【待填写[^】]*】)/g).map((part, index) =>
    part.startsWith("【待填写")
      ? <span key={index} className="rounded bg-red-100 px-1 text-[#ff6b6b]">{part}</span>
      : <span key={index}>{part}</span>
  );
}

function BidBlockPreview({ block }: { block: BidBlock }) {
  if (block.type === "paragraph") {
    return <p className="whitespace-pre-wrap"><HighlightedBidText text={block.text} /></p>;
  }
  if (block.type === "page_break") {
    return <div className="my-4 border-t border-dashed border-border" aria-label="分页符" />;
  }

  return (
    <div className="max-w-full overflow-x-auto overscroll-x-contain">
      {block.title && <p className="mb-2 font-medium text-foreground">{block.title}</p>}
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
                  className="border border-border bg-secondary px-3 py-2 text-center font-semibold text-foreground"
                >
                  {cell.text}
                </th>
              ))}
            </tr>
          )) : (
            <tr>
              {block.columns.map((column) => (
                <th key={column.key} className="border border-border bg-secondary px-3 py-2 text-center font-semibold text-foreground">
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
                    className="border border-border px-3 py-2 align-top text-foreground"
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
