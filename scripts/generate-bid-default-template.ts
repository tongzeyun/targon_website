import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { compileBidTemplateDefinition } from "../src/lib/document/bid-template-compiler";
import { parseBidDocxOoxml } from "../src/lib/document/bid-ooxml-parser";
import type {
  BidColumnSemantic,
  BidNodeSemantic,
  BidTemplateDefinition,
} from "../src/lib/document/bid-template-model";

const inputPath = process.argv[2];
const outputPath = process.argv[3]
  || path.resolve(process.cwd(), "src/config/bid-template.json");

if (!inputPath) {
  throw new Error(
    "Usage: npx tsx scripts/generate-bid-default-template.ts <template.docx> [output.json]"
  );
}

const FIELD_PLACEHOLDER = /_{3,}|＿{3,}|【[^】]*(?:填写|签字|盖章)[^】]*】/;
const TOP_LEVEL_NUMBERED_HEADING = /^[一二三四五六七八九十百]+、/;
const COLUMN_POLICY_RULES: ReadonlyArray<{
  pattern: RegExp;
  policy: BidColumnSemantic["sourcePolicy"];
}> = [
  { pattern: /(单价|总价|报价|金额|保证金|合计)/, policy: "manual" },
  { pattern: /(招标文件|技术要求|商务条款|条目编号|要求内容)/, policy: "tender" },
  { pattern: /(应答|响应|偏离|服务方案|技术方案|配置方案|承诺|说明)/, policy: "generated" },
  { pattern: /(制造商|投标人|供应商|证书|资质|人员|业绩)/, policy: "company" },
];

function columnPolicy(title: string): BidColumnSemantic["sourcePolicy"] {
  return COLUMN_POLICY_RULES.find((rule) => rule.pattern.test(title))?.policy
    ?? "tender_or_company";
}

async function main(): Promise<void> {
  const fileBuffer = await readFile(path.resolve(inputPath));
  const arrayBuffer = fileBuffer.buffer.slice(
    fileBuffer.byteOffset,
    fileBuffer.byteOffset + fileBuffer.byteLength
  ) as ArrayBuffer;
  const document = parseBidDocxOoxml(arrayBuffer, "system_default");
  const firstNode = document.nodes[0];
  const lastNode = document.nodes[document.nodes.length - 1];
  if (!firstNode || !lastNode) throw new Error("权威 DOCX 未解析到模板节点");

  const nodeSemantics: Record<string, BidNodeSemantic> = {};
  for (const node of document.nodes) {
    if (node.type === "table") {
      nodeSemantics[node.nodeId] = {
        role: "table",
        columns: Object.fromEntries(node.columns.map((column) => [
          column.columnId,
          {
            label: column.headerText,
            description: `表格列：${column.headerText}`,
            valueType: "string",
            sourcePolicy: columnPolicy(column.headerText),
            required: true,
          },
        ])),
      };
      continue;
    }
    if (node.type !== "paragraph") continue;
    const isTopLevelHeading = Boolean(node.text.trim()) && (
      /^Heading1$/i.test(node.styleName || "")
      || (/^Heading2$/i.test(node.styleName || "") && TOP_LEVEL_NUMBERED_HEADING.test(node.text))
    );
    nodeSemantics[node.nodeId] = isTopLevelHeading
      ? { role: "section_heading", title: node.text.trim() }
      : FIELD_PLACEHOLDER.test(node.text)
        ? { role: "field" }
        : { role: "static_text" };
  }

  const compiled = compileBidTemplateDefinition(document, {
    templateRegions: [{ startNodeId: firstNode.nodeId, endNodeId: lastNode.nodeId }],
    nodeSemantics,
  });
  const digest = createHash("sha256").update(fileBuffer).digest("hex").slice(0, 16);
  const template: BidTemplateDefinition = {
    ...compiled,
    templateId: `system:authority-docx:${digest}`,
    source: "system_default",
    warnings: [],
  };

  for (const section of template.sections) {
    for (const node of section.nodes) {
      if (
        node.type === "table"
        && node.columns.some((column) => /投标文件构成内容/.test(column.title))
      ) {
        node.tableId = "table:document-index";
      }
    }
  }

  await writeFile(outputPath, `${JSON.stringify(template, null, 2)}\n`, "utf8");
  console.log(
    `Generated ${outputPath}: ${template.sections.length} sections, ${template.sections.flatMap((section) => section.nodes).length} nodes`
  );
}

void main();
