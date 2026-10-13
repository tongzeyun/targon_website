import {
  bidCellText,
  type BidSection,
  type BidTableBlock,
  type BidTableColumn,
  type BidTemplateSource,
} from "@/lib/document/bid-document-model";
import {
  analyzeMeeting,
  type AnalysisMode,
  type CommunicationAnalysis,
  type MeetingMinutes,
} from "@/lib/ai/meeting-analysis";
import { buildContractDocx, type ContractData } from "@/lib/document/contract-template";
import { buildDocx } from "@/lib/document/docx-builder";
import { buildQuotationDocx, type QuotationData } from "@/lib/document/quotation-template";
import {
  createGeneratedDocument,
  type GeneratedDocumentRecord,
} from "@/lib/repositories/generated-document-repository";
import {
  AlignmentType,
  BorderStyle,
  convertInchesToTwip,
  Document,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType,
} from "docx";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

interface StoreDocumentBaseInput {
  organizationId: string;
  userId?: string | null;
  jobId?: string | null;
  templateId?: string | null;
  aiRunId?: string | null;
  sourceType: string;
}

export interface StoredDocumentResult {
  document: GeneratedDocumentRecord;
  fileBuffer: Buffer;
  fileName: string;
  contentType: string;
}

function safeFilePart(value: unknown, fallback: string): string {
  const raw = typeof value === "string" && value.trim() ? value.trim() : fallback;
  return raw.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
}

function downloadUrl(documentId: string): string {
  return `/api/generated-documents/${documentId}/download`;
}

export function toJobDocumentResult(document: GeneratedDocumentRecord) {
  return {
    documentId: document.id,
    downloadUrl: downloadUrl(document.id),
    fileName: document.fileName,
    documentType: document.documentType,
  };
}

export async function generateQuotationDocument(
  input: StoreDocumentBaseInput & { data: QuotationData }
): Promise<StoredDocumentResult> {
  const fileBuffer = await buildQuotationDocx(input.data);
  const quoteNo = safeFilePart(input.data.quoteNo, "download");
  const fileName = `quotation_${quoteNo}.docx`;
  const document = await createGeneratedDocument({
    organizationId: input.organizationId,
    userId: input.userId,
    jobId: input.jobId,
    templateId: input.templateId ?? null,
    aiRunId: input.aiRunId ?? null,
    documentType: "quotation",
    sourceType: input.sourceType,
    title: input.data.quoteNo ? `Quotation ${input.data.quoteNo}` : "Quotation",
    fileName,
    fileMimeType: DOCX_MIME,
    fileBuffer,
    metadata: {
      format: "docx",
      quoteNo: input.data.quoteNo || null,
      buyerCompany: input.data.buyerCompany || null,
      sellerCompany: input.data.sellerCompany || null,
    },
  });

  return { document, fileBuffer, fileName, contentType: DOCX_MIME };
}

export async function generateContractDocument(
  input: StoreDocumentBaseInput & { data: ContractData }
): Promise<StoredDocumentResult> {
  const fileBuffer = await buildContractDocx(input.data);
  const contractNo = safeFilePart(input.data.contractNo, "download");
  const fileName = `contract_${contractNo}.docx`;
  const document = await createGeneratedDocument({
    organizationId: input.organizationId,
    userId: input.userId,
    jobId: input.jobId,
    templateId: input.templateId ?? null,
    aiRunId: input.aiRunId ?? null,
    documentType: "contract",
    sourceType: input.sourceType,
    title: input.data.contractNo ? `Contract ${input.data.contractNo}` : "Contract",
    fileName,
    fileMimeType: DOCX_MIME,
    fileBuffer,
    metadata: {
      format: "docx",
      contractNo: input.data.contractNo || null,
      partyA: input.data.partyA || null,
      partyB: input.data.partyB || null,
      taxRate: input.data.taxRate || null,
      totalAmount: input.data.totalAmount || null,
    },
  });

  return { document, fileBuffer, fileName, contentType: DOCX_MIME };
}

const BID_TABLE_WIDTH_DXA = 9000;
const BID_TABLE_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 6, color: "333333" },
  bottom: { style: BorderStyle.SINGLE, size: 6, color: "333333" },
  left: { style: BorderStyle.SINGLE, size: 6, color: "333333" },
  right: { style: BorderStyle.SINGLE, size: 6, color: "333333" },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "666666" },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "666666" },
};

function comparableBidTitle(value: string): string {
  return value.replace(/[\s、，,：:（）()]/g, "");
}

function bidAlignment(column: BidTableColumn): (typeof AlignmentType)[keyof typeof AlignmentType] {
  if (column.alignment === "center") return AlignmentType.CENTER;
  if (column.alignment === "right") return AlignmentType.RIGHT;
  return AlignmentType.LEFT;
}

function bidColumnWidths(columns: BidTableColumn[]): number[] {
  const totalWeight = columns.reduce((sum, column) => sum + Math.max(1, column.width || 1), 0);
  let allocated = 0;
  return columns.map((column, index) => {
    if (index === columns.length - 1) return BID_TABLE_WIDTH_DXA - allocated;
    const width = Math.max(1, Math.floor(BID_TABLE_WIDTH_DXA * Math.max(1, column.width || 1) / totalWeight));
    allocated += width;
    return width;
  });
}

function bidTextRuns(text: string, missing = false, bold = false): TextRun[] {
  const parts = text.split(/(【待填写[^】]*】)/g).filter(Boolean);
  return parts.map((part) => new TextRun({
    text: part,
    size: 18,
    font: "SimSun",
    bold,
    color: missing || part.startsWith("【待填写") ? "FF0000" : "000000",
  }));
}

function bidTableParagraph(
  text: string,
  column: BidTableColumn,
  options: { bold?: boolean; missing?: boolean } = {}
): Paragraph {
  return new Paragraph({
    children: bidTextRuns(text, options.missing, options.bold),
    alignment: bidAlignment(column),
    spacing: { before: 30, after: 30 },
  });
}

function createBidTable(block: BidTableBlock): Table {
  const widths = bidColumnWidths(block.columns);
  const headerRows = block.headerRows?.length
    ? block.headerRows.map((headerRow) => {
        let columnIndex = 0;
        const cells = headerRow.cells.map((headerCell) => {
          const span = Math.min(headerCell.columnSpan || 1, block.columns.length - columnIndex);
          const width = widths.slice(columnIndex, columnIndex + span).reduce((sum, value) => sum + value, 0);
          columnIndex += span;
          return new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: headerCell.text, bold: true, size: 18, font: "SimSun" })],
              alignment: AlignmentType.CENTER,
              spacing: { before: 30, after: 30 },
            })],
            columnSpan: span > 1 ? span : undefined,
            rowSpan: headerCell.rowSpan && headerCell.rowSpan > 1 ? headerCell.rowSpan : undefined,
            width: { size: width, type: WidthType.DXA },
            verticalAlign: VerticalAlignTable.CENTER,
            shading: { fill: "D9EAF7" },
            margins: { top: 80, bottom: 80, left: 80, right: 80 },
          });
        });
        return new TableRow({ children: cells, tableHeader: block.repeatHeader !== false, cantSplit: true });
      })
    : [new TableRow({
        children: block.columns.map((column, index) => new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: column.title, bold: true, size: 18, font: "SimSun" })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 30, after: 30 },
          })],
          width: { size: widths[index], type: WidthType.DXA },
          verticalAlign: VerticalAlignTable.CENTER,
          shading: { fill: "D9EAF7" },
          margins: { top: 80, bottom: 80, left: 80, right: 80 },
        })),
        tableHeader: block.repeatHeader !== false,
        cantSplit: true,
      })];

  const dataRows = block.rows.map((row) => {
    const cells: TableCell[] = [];
    for (let index = 0; index < block.columns.length;) {
      const column = block.columns[index];
      const cell = row.cells[column.key] || {
        value: "",
        ...(column.required ? { missingInfo: column.title } : {}),
      };
      const span = Math.min(cell.columnSpan || 1, block.columns.length - index);
      const width = widths.slice(index, index + span).reduce((sum, value) => sum + value, 0);
      const text = bidCellText(cell, column.title, Boolean(column.required));
      cells.push(new TableCell({
        children: [bidTableParagraph(text, column, { missing: Boolean(cell.missingInfo || !cell.value.trim()) })],
        columnSpan: span > 1 ? span : undefined,
        rowSpan: cell.rowSpan && cell.rowSpan > 1 ? cell.rowSpan : undefined,
        width: { size: width, type: WidthType.DXA },
        verticalAlign: VerticalAlignTable.CENTER,
        margins: { top: 80, bottom: 80, left: 80, right: 80 },
      }));
      index += span;
    }
    return new TableRow({ children: cells, cantSplit: true });
  });

  return new Table({
    rows: [...headerRows, ...dataRows],
    width: { size: BID_TABLE_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: BID_TABLE_BORDERS,
  });
}

export async function generateBidDocument(
  input: StoreDocumentBaseInput & {
    sections: BidSection[];
    projectName: string;
    bidUnit?: string;
    bidDeadline?: string;
    templateSource?: BidTemplateSource;
    templateStoredFileId?: string | null;
  }
): Promise<StoredDocumentResult> {
  if (!input.sections.length) throw new Error("Bid document sections are required");

  const normalRun = (text: string) => new TextRun({ text, size: 22, font: "SimSun" });
  const boldRun = (text: string) => new TextRun({ text, bold: true, size: 22, font: "SimSun" });
  const missingRun = (text: string) => new TextRun({ text, size: 22, font: "SimSun", color: "FF0000" });

  const children: Array<Paragraph | Table> = [
    new Paragraph({
      text: "投标文件",
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    input.bidUnit
      ? new Paragraph({
          children: [normalRun("致："), boldRun(input.bidUnit)],
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
        })
      : new Paragraph({}),
    new Paragraph({
      children: [normalRun("项目名称："), boldRun(input.projectName)],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }),
    input.bidDeadline
      ? new Paragraph({
          children: [normalRun("投标截止日期："), boldRun(input.bidDeadline)],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        })
      : new Paragraph({ spacing: { after: 400 } }),
  ];

  for (const section of input.sections) {
    children.push(new Paragraph({
      children: [boldRun(section.title)],
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 120 },
    }));

    for (const block of section.blocks) {
      if (block.type === "page_break") {
        children.push(new Paragraph({ children: [new PageBreak()] }));
        continue;
      }
      if (block.type === "table") {
        if (block.title && comparableBidTitle(block.title) !== comparableBidTitle(section.title)) {
          children.push(new Paragraph({
            children: [boldRun(block.title)],
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 160, after: 80 },
          }));
        }
        children.push(createBidTable(block));
        children.push(new Paragraph({ spacing: { after: 100 } }));
        continue;
      }

      const lines = block.text.split(/\r?\n/);
      for (const line of lines) {
        const parts = line.split(/(【待填写[^】]*】)/g).filter(Boolean);
        const runs = parts.length
          ? parts.map((part) => part.startsWith("【待填写") ? missingRun(part) : normalRun(part))
          : [normalRun("")];
        children.push(new Paragraph({
          children: runs,
          spacing: { after: 100 },
          indent: { firstLine: convertInchesToTwip(0.4) },
        }));
      }
      if (block.missingInfo && !block.text.includes(block.missingInfo)) {
        children.push(new Paragraph({
          children: [missingRun(`【待填写：${block.missingInfo}】`)],
          spacing: { after: 100 },
        }));
      }
    }
    if (section.missingInfo) {
      children.push(new Paragraph({
        children: [missingRun(`【待填写：${section.missingInfo}】`)],
        spacing: { after: 100 },
      }));
    }
  }

  children.push(new Paragraph({ spacing: { before: 400 } }));
  children.push(new Paragraph({ children: [boldRun("投标人（盖章）：")], spacing: { after: 80 } }));
  children.push(new Paragraph({ children: [normalRun("授权代表签字：_______________    日期：_______________")] }));

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        children,
      },
    ],
  });

  const fileBuffer = Buffer.from(await Packer.toBuffer(doc));
  const projectName = safeFilePart(input.projectName, "download");
  const fileName = `bid_${projectName}.docx`;
  const document = await createGeneratedDocument({
    organizationId: input.organizationId,
    userId: input.userId,
    jobId: input.jobId,
    templateId: input.templateId ?? null,
    aiRunId: input.aiRunId ?? null,
    documentType: "bid",
    sourceType: input.sourceType,
    title: input.projectName,
    fileName,
    fileMimeType: DOCX_MIME,
    fileBuffer,
    metadata: {
      projectName: input.projectName,
      bidUnit: input.bidUnit || null,
      bidDeadline: input.bidDeadline || null,
      sectionCount: input.sections.length,
      templateSource: input.templateSource || "system_default",
      templateStoredFileId: input.templateStoredFileId || null,
    },
  });

  return { document, fileBuffer, fileName, contentType: DOCX_MIME };
}

/** 将 AI 分析结果转为可读文本 */
export function formatMeetingContent(
  content: MeetingMinutes | CommunicationAnalysis,
  mode: AnalysisMode
): string {
  const lines: string[] = [];

  if (mode === "minutes") {
    const m = content as MeetingMinutes;
    lines.push(m.title, "");
    lines.push(`日期：${m.date || "未指定"}`);
    lines.push(`参会人员：${(m.attendees || []).join("、") || "未指定"}`);
    lines.push("");

    if (m.topics) {
      for (const t of m.topics) {
        lines.push(`## ${t.topic}`);
        lines.push(`讨论：${t.discussion}`);
        if (t.decisions?.length) {
          lines.push(`决议：${t.decisions.map((d, i) => `${i + 1}. ${d}`).join("；")}`);
        }
        if (t.actions?.length) {
          lines.push("待办事项：");
          for (const a of t.actions) {
            lines.push(`  - ${a.task}（负责人：${a.owner}，截止：${a.deadline}）`);
          }
        }
        lines.push("");
      }
    }
    if (m.nextMeeting) lines.push(`下次会议：${m.nextMeeting}`);
    if (m.summary) lines.push(`\n总结：${m.summary}`);
  } else {
    const a = content as CommunicationAnalysis;
    lines.push(a.title, "");
    lines.push(`客户：${a.customerName || "未指定"}`);
    lines.push(`对接人：${a.contactPerson || "未指定"}`);
    lines.push("");

    if (a.keyTopics?.length) lines.push(`## 关键话题\n${a.keyTopics.map((t) => `- ${t}`).join("\n")}`);
    if (a.customerNeeds?.length) lines.push(`\n## 客户需求\n${a.customerNeeds.map((n) => `- ${n}`).join("\n")}`);
    if (a.competitiveInfo) lines.push(`\n## 竞品情报\n${a.competitiveInfo}`);
    if (a.opportunities?.length) {
      lines.push("\n## 商机识别");
      for (const o of a.opportunities) {
        const prio = o.priority === "high" ? "高" : o.priority === "medium" ? "中" : "低";
        lines.push(`- [${prio}] ${o.description}`);
      }
    }
    if (a.risks?.length) {
      lines.push("\n## 风险与对策");
      for (const r of a.risks) lines.push(`- 风险：${r.description} → 对策：${r.mitigation}`);
    }
    if (a.recommendedActions?.length) {
      lines.push("\n## 建议行动");
      for (const r of a.recommendedActions) {
        lines.push(`- ${r.action}（时机：${r.timing}，预期：${r.expectedOutcome}）`);
      }
    }
    if (a.summary) lines.push(`\n## 总体分析\n${a.summary}`);
  }

  return lines.join("\n");
}

export async function generateMeetingDocument(
  input: StoreDocumentBaseInput & {
    textContent: string;
    analysisMode: AnalysisMode;
  }
): Promise<StoredDocumentResult> {
  const trimmed = input.textContent.trim();
  if (trimmed.length < 10) {
    throw new Error("document_generate_meeting payload.textContent is required");
  }
  if (!input.userId) {
    throw new Error("document_generate_meeting requires an authenticated userId");
  }

  const analysis = await analyzeMeeting(
    trimmed,
    input.analysisMode,
    input.organizationId,
    input.userId
  );
  const title =
    input.analysisMode === "minutes"
      ? (analysis.content as MeetingMinutes).title || "沟通纪要"
      : (analysis.content as CommunicationAnalysis).title || "沟通分析报告";

  const docContent = formatMeetingContent(analysis.content, input.analysisMode);
  const fileBuffer = await buildDocx(
    title,
    docContent
      .split("\n")
      .filter((l) => l.trim())
      .map((line) => {
        if (line.startsWith("## ")) return { type: "heading" as const, text: line.slice(3), level: 1 as const };
        if (line.startsWith("### ")) return { type: "heading" as const, text: line.slice(4), level: 2 as const };
        if (line.includes("：") && line.length < 80) {
          const [label, ...rest] = line.split("：");
          return { type: "field" as const, label, value: rest.join("：") };
        }
        return { type: "paragraph" as const, text: line };
      })
  );

  const datePart = new Date().toISOString().slice(0, 10);
  const prefix = input.analysisMode === "minutes" ? "meeting_minutes" : "meeting_analysis";
  const fileName = `${prefix}_${datePart}.docx`;
  const document = await createGeneratedDocument({
    organizationId: input.organizationId,
    userId: input.userId,
    jobId: input.jobId,
    templateId: input.templateId ?? null,
    aiRunId: analysis.aiRunId ?? input.aiRunId ?? null,
    documentType: "meeting",
    sourceType: input.sourceType,
    title,
    fileName,
    fileMimeType: DOCX_MIME,
    fileBuffer,
    metadata: {
      format: "docx",
      analysisMode: input.analysisMode,
    },
  });

  return { document, fileBuffer, fileName, contentType: DOCX_MIME };
}
