/**
 * 通用文档文本解析器。
 *
 * DOCX → Mammoth，PDF → pdf-parse，XLSX → xlsx。
 * 这里只提取文本供非标书模板和格式转换功能使用；标书 DOCX 结构统一由
 * bid-ooxml-parser.ts 解析。
 */

export interface ParsedTemplateResult {
  text: string;
  structure: string;
  placeholders: string[];
}

export async function parseDocxTemplate(buffer: ArrayBuffer): Promise<ParsedTemplateResult> {
  const mammoth = await import("mammoth");
  const htmlResult = await mammoth.convertToHtml(
    { buffer: Buffer.from(buffer) },
    {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Heading 4'] => h4:fresh",
        "r[style-name='Strong'] => strong",
        "r[style-name='Bold'] => strong",
      ],
    }
  );
  return analyzeResult(htmlToStructuredText(htmlResult.value));
}

export async function parsePdfTemplate(buffer: ArrayBuffer): Promise<ParsedTemplateResult> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: Buffer.from(buffer) });
  const result = await parser.getText();
  const text = result?.text || "";
  if (!text.trim()) throw new Error("PDF 无法提取文字，可能是扫描件");
  return analyzeResult(text);
}

export async function parseXlsxTemplate(buffer: ArrayBuffer): Promise<ParsedTemplateResult> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const allText: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csvText = XLSX.utils.sheet_to_csv(sheet, { strip: true, blankrows: false });
    allText.push(`=== 工作表: ${sheetName} ===\n${csvText}`);
  }

  const text = allText.join("\n\n");
  return {
    text: text.slice(0, 30_000),
    structure: text.slice(0, 5_000),
    placeholders: extractPlaceholders(text),
  };
}

export async function parseTemplate(
  file: File | Blob,
  fileName?: string
): Promise<ParsedTemplateResult> {
  const name = fileName || (file as File).name || "";
  const buffer = await file.arrayBuffer();

  if (name.endsWith(".pdf")) return parsePdfTemplate(buffer);
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) return parseXlsxTemplate(buffer);
  return parseDocxTemplate(buffer);
}

function htmlToStructuredText(html: string): string {
  let text = html;
  text = text.replace(/<table[^>]*>/gi, "\n[表格开始]\n");
  text = text.replace(/<\/table>/gi, "\n[表格结束]\n");
  text = text.replace(/<tr[^>]*>/gi, "| ");
  text = text.replace(/<\/tr>/gi, " |\n");
  text = text.replace(/<t[hd][^>]*>/gi, "| ");
  text = text.replace(/<\/t[hd]>/gi, " ");
  text = text.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "\n## $1\n");
  text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "\n### $1\n");
  text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "\n#### $1\n");
  text = text.replace(/<h4[^>]*>(.*?)<\/h4>/gi, "\n##### $1\n");
  text = text.replace(/<p[^>]*>/gi, "\n");
  text = text.replace(/<\/p>/gi, "");
  text = text.replace(/<strong>(.*?)<\/strong>/gi, "**$1**");
  text = text.replace(/<b>(.*?)<\/b>/gi, "**$1**");
  text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<[^>]+>/g, " ");
  return text.replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

function analyzeResult(text: string): ParsedTemplateResult {
  const normalized = text.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n");
  return {
    text: normalized,
    structure: analyzeStructure(normalized),
    placeholders: extractPlaceholders(normalized),
  };
}

function analyzeStructure(text: string): string {
  const sections: string[] = [];
  for (const line of text.split("\n").filter((item) => item.trim())) {
    const trimmed = line.trim();
    if (trimmed.length < 3) continue;
    if (
      trimmed.length < 30
      || /^(第[一二三四五六七八九十\d]+[章节条款]|[一二三四五六七八九十\d]+[、.．]|[A-Z][\w\s]+$)/.test(trimmed)
    ) {
      sections.push(`[标题] ${trimmed}`);
    } else if (trimmed.includes("：") || trimmed.includes(":")) {
      sections.push(`[字段] ${trimmed}`);
    } else {
      sections.push(`[正文] ${trimmed.slice(0, 100)}${trimmed.length > 100 ? "..." : ""}`);
    }
  }
  return sections.join("\n");
}

function extractPlaceholders(text: string): string[] {
  const regex = /\{\{([^}]+)\}\}|\$\{([^}]+)\}|【([^】]+)】|_{3,}/g;
  const placeholders: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const placeholder = (match[1] || match[2] || match[3] || "填空").trim();
    if (!placeholders.includes(placeholder)) placeholders.push(placeholder);
  }
  return placeholders;
}

export function parseTextFile(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(buffer));
  } catch {
    try {
      return new TextDecoder("gbk").decode(new Uint8Array(buffer));
    } catch {
      return new TextDecoder("utf-8").decode(new Uint8Array(buffer));
    }
  }
}
