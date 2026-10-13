/**
 * Word 文档构建器 — 基于 docx 包生成 .docx 文件
 *
 * 将 AI 生成的结构化内容转换为可下载的 Word 文档。
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  convertInchesToTwip,
} from "docx";

/** 文档内容段落类型 */
export interface DocParagraph {
  type: "heading" | "paragraph" | "field" | "table" | "signature" | "empty";
  text?: string;
  label?: string;
  value?: string;
  level?: 1 | 2 | 3;
  bold?: boolean;
  rows?: string[][];
  headers?: string[];
}

/**
 * 根据结构化内容构建 .docx 文档
 * @returns Buffer 可用于下载
 */
export async function buildDocx(
  title: string,
  content: DocParagraph[]
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  // 文档标题
  children.push(
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  // 正文内容
  for (const item of content) {
    switch (item.type) {
      case "heading":
        children.push(
          new Paragraph({
            text: item.text || "",
            heading:
              item.level === 1
                ? HeadingLevel.HEADING_1
                : item.level === 2
                  ? HeadingLevel.HEADING_2
                  : HeadingLevel.HEADING_3,
            spacing: { before: 300, after: 150 },
          })
        );
        break;

      case "paragraph":
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: item.text || "",
                size: 21, // 10.5pt = 五号
                font: "SimSun",
              }),
            ],
            spacing: { after: 120 },
          })
        );
        break;

      case "field":
        // 标签：值 格式
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${item.label || ""}：`,
                bold: true,
                size: 21,
                font: "SimSun",
              }),
              new TextRun({
                text: item.value || "",
                size: 21,
                font: "SimSun",
              }),
            ],
            spacing: { after: 100 },
          })
        );
        break;

      case "signature":
        // 签章区域
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: item.label || "",
                size: 21,
                font: "SimSun",
              }),
            ],
            spacing: { before: 400, after: 100 },
          })
        );
        if (item.text) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: item.text,
                  size: 21,
                  font: "SimSun",
                }),
              ],
              spacing: { after: 100 },
            })
          );
        }
        break;

      case "empty":
        children.push(
          new Paragraph({
            text: "",
            spacing: { after: 100 },
          })
        );
        break;

      case "table":
        if (item.rows && item.rows.length > 0) {
          const headers = item.headers || [];
          const colCount = Math.max(
            headers.length,
            ...item.rows.map((r) => r.length)
          );
          const colWidth = 100 / (colCount || 1);

          const tableRows: TableRow[] = [];

          // 表头行
          if (headers.length > 0) {
            tableRows.push(
              new TableRow({
                children: headers.map(
                  (h) =>
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: [new TextRun({ text: h, bold: true, size: 20 })],
                          alignment: AlignmentType.CENTER,
                        }),
                      ],
                      width: { size: colWidth, type: WidthType.PERCENTAGE },
                    })
                ),
              })
            );
          }

          // 数据行
          for (const row of item.rows) {
            tableRows.push(
              new TableRow({
                children: row.map(
                  (cell) =>
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: [new TextRun({ text: cell, size: 20 })],
                        }),
                      ],
                      width: { size: colWidth, type: WidthType.PERCENTAGE },
                    })
                ),
              })
            );
          }

          children.push(
            new Table({
              rows: tableRows,
              width: { size: 100, type: WidthType.PERCENTAGE },
            })
          );
        }
        break;
    }
  }

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

  return Buffer.from(await Packer.toBuffer(doc));
}

/**
 * 简化版：直接从纯文本构建 .docx（用于文本类输出）
 */
export async function buildDocxFromText(
  title: string,
  textContent: string
): Promise<Buffer> {
  const paragraphs = textContent.split("\n").filter((l) => l.trim()).map((line) => {
    const trimmed = line.trim();
    // 判断是否为标题
    if (trimmed.length < 40 && /^(#[#\s]+)?[一二三四五六七八九十\d]+[、.．)\s]/.test(trimmed)) {
      return { type: "heading" as const, text: trimmed, level: 2 as const };
    }
    if (trimmed.includes("：") && trimmed.length < 80) {
      const [label, ...rest] = trimmed.split("：");
      return { type: "field" as const, label, value: rest.join("：") };
    }
    return { type: "paragraph" as const, text: trimmed };
  });

  return buildDocx(title, paragraphs);
}
