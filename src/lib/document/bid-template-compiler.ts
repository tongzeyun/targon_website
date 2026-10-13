import { createHash } from "node:crypto";
import bidTemplateConfig from "@/config/bid-template.json";
import type {
  BidFieldSourcePolicy,
  BidNodeSemantic,
  BidTemplateDefinition,
  BidTemplateFieldNode,
  BidTemplateNode,
  BidTemplateRegion,
  BidTemplateSemanticMap,
  BidTemplateTableColumn,
  RawBidParagraphNode,
  RawBidTableNode,
  RawBidTemplateDocument,
  RawBidTemplateNode,
} from "./bid-template-model";

const EMBEDDED_TEMPLATE_MARKER = /(投标文件格式|投标文件组成|投标文件的组成|投标函格式|响应文件格式)/;
const NUMBERED_HEADING = /^(?:第[一二三四五六七八九十百\d]+章|[一二三四五六七八九十百]{1,4}、|\d+(?:\.\d+)*[、.．]\s*)/;
const FIELD_PLACEHOLDER = /_{3,}|＿{3,}|【[^】]*(?:填写|签字|盖章)[^】]*】/;
const PROTECTED_SOURCE_POLICY_RULES: ReadonlyArray<{
  pattern: RegExp;
  policy: BidFieldSourcePolicy;
}> = [
  { pattern: /(签字|签名|盖章|公章|印章)/, policy: "manual" },
  { pattern: /(单价|总价|报价|金额|保证金)/, policy: "manual" },
  { pattern: /(资质|业绩|人员姓名|身份证|银行账户)/, policy: "company" },
];

function templateHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 24);
}

function normalizedLabel(value: string): string {
  return value.replace(/[_＿【】\s:：()（）]/g, "").trim();
}

function looksLikeHeading(node: RawBidTemplateNode, semantic?: BidNodeSemantic): boolean {
  if (semantic?.role === "section_heading") return true;
  if (semantic) return false;
  if (node.type !== "paragraph" || !node.text.trim()) return false;
  return Boolean(
    node.outlineLevel !== undefined
      || /heading|标题/i.test(node.styleName || "")
      || (NUMBERED_HEADING.test(node.text.trim()) && node.text.trim().length <= 50)
  );
}

export function findEmbeddedBidTemplateRegion(
  document: RawBidTemplateDocument
): BidTemplateRegion | null {
  const start = document.nodes.findIndex(
    (node) => node.type === "paragraph" && EMBEDDED_TEMPLATE_MARKER.test(node.text)
  );
  if (start < 0) return null;
  const meaningfulNodes = document.nodes.slice(start).filter((node) =>
    node.type === "table" || (node.type === "paragraph" && node.text.trim())
  );
  if (meaningfulNodes.length < 3) return null;
  return {
    startNodeId: document.nodes[start].nodeId,
    endNodeId: document.nodes[document.nodes.length - 1].nodeId,
  };
}

function validRegion(
  document: RawBidTemplateDocument,
  region: BidTemplateRegion
): { start: number; end: number } | null {
  const start = document.nodes.findIndex((node) => node.nodeId === region.startNodeId);
  const end = document.nodes.findIndex((node) => node.nodeId === region.endNodeId);
  return start >= 0 && end >= start ? { start, end } : null;
}

export function validateTemplateSemanticMap(
  document: RawBidTemplateDocument,
  semanticMap: BidTemplateSemanticMap,
  fallbackRegion?: BidTemplateRegion | null
): BidTemplateSemanticMap {
  const nodeIds = new Set(document.nodes.map((node) => node.nodeId));
  const fallbackRange = fallbackRegion ? validRegion(document, fallbackRegion) : null;
  const allowedNodeIds = fallbackRange
    ? new Set(document.nodes
        .slice(fallbackRange.start, fallbackRange.end + 1)
        .map((node) => node.nodeId))
    : nodeIds;
  const tableColumnIds = new Map(
    document.nodes
      .filter((node): node is RawBidTableNode => node.type === "table")
      .map((table) => [table.nodeId, new Set(table.columns.map((column) => column.columnId))])
  );
  const regions = semanticMap.templateRegions
    .filter((region) => {
      const range = validRegion(document, region);
      if (!range) return false;
      return !fallbackRange
        || (range.start >= fallbackRange.start && range.end <= fallbackRange.end);
    });
  if (!regions.length && fallbackRegion && validRegion(document, fallbackRegion)) {
    regions.push(fallbackRegion);
  }

  const nodeSemantics: Record<string, BidNodeSemantic> = {};
  for (const [nodeId, semantic] of Object.entries(semanticMap.nodeSemantics || {})) {
    if (!allowedNodeIds.has(nodeId)) continue;
    const allowedColumns = tableColumnIds.get(nodeId);
    const columns = allowedColumns && semantic.columns
      ? Object.fromEntries(Object.entries(semantic.columns).filter(([columnId]) => allowedColumns.has(columnId)))
      : undefined;
    nodeSemantics[nodeId] = { ...semantic, ...(columns ? { columns } : {}) };
  }
  return { templateRegions: regions, nodeSemantics };
}

function regionNodes(
  document: RawBidTemplateDocument,
  regions: BidTemplateRegion[]
): RawBidTemplateNode[] {
  if (!regions.length) return document.source === "separate_upload" ? document.nodes : [];
  const selected = new Set<number>();
  for (const region of regions) {
    const range = validRegion(document, region);
    if (!range) continue;
    for (let index = range.start; index <= range.end; index += 1) selected.add(index);
  }
  return document.nodes.filter((_, index) => selected.has(index));
}

function safeSourcePolicy(
  label: string,
  suggested: BidFieldSourcePolicy | undefined,
  role: BidNodeSemantic["role"]
): BidFieldSourcePolicy {
  const protectedPolicy = PROTECTED_SOURCE_POLICY_RULES.find((rule) => rule.pattern.test(label));
  if (protectedPolicy) return protectedPolicy.policy;
  if (role === "generated_paragraph") return "generated";
  return suggested || "tender_or_company";
}

function fieldNode(
  node: RawBidParagraphNode,
  semantic: BidNodeSemantic | undefined
): BidTemplateFieldNode {
  const label = semantic?.label
    || node.text.split(/[:：]|_{3,}|＿{3,}/)[0]?.trim()
    || "待填写字段";
  const role = semantic?.role === "generated_paragraph" ? "generated_paragraph" : "field";
  return {
    nodeId: node.nodeId,
    type: "field",
    fieldId: `field:${node.nodeId}`,
    label,
    description: semantic?.description || `模板字段：${normalizedLabel(label) || node.text}`,
    originalText: node.text,
    valueType: semantic?.valueType || (role === "generated_paragraph" ? "long_text" : "string"),
    sourcePolicy: safeSourcePolicy(label, semantic?.sourcePolicy, role),
    required: semantic?.required ?? true,
    renderAs: role === "generated_paragraph" ? "paragraph" : "inline",
  };
}

function tableColumn(
  table: RawBidTableNode,
  columnIndex: number,
  semantic: BidNodeSemantic | undefined
): BidTemplateTableColumn {
  const raw = table.columns[columnIndex];
  const columnSemantic = semantic?.columns?.[raw.columnId];
  const title = columnSemantic?.label || raw.headerText || `第${columnIndex + 1}列`;
  const policy = safeSourcePolicy(title, columnSemantic?.sourcePolicy, "table");
  return {
    columnId: raw.columnId,
    key: raw.columnId,
    title,
    description: columnSemantic?.description || `表格列：${title}`,
    valueType: columnSemantic?.valueType || "string",
    sourcePolicy: policy,
    required: columnSemantic?.required ?? true,
    ...(raw.width ? { width: raw.width } : {}),
    ...(policy === "tender" ? { readOnly: true } : {}),
  };
}

export function compileBidTemplateDefinition(
  document: RawBidTemplateDocument,
  semanticMap: BidTemplateSemanticMap
): BidTemplateDefinition {
  const nodes = regionNodes(document, semanticMap.templateRegions);
  const warnings: string[] = [];
  if (!nodes.length) warnings.push("未找到有效模板区域");
  const sections: BidTemplateDefinition["sections"] = [];
  let current: BidTemplateDefinition["sections"][number] | null = null;

  const ensureSection = (title = "投标文件"): BidTemplateDefinition["sections"][number] => {
    if (current) return current;
    current = { sectionId: `section:${sections.length + 1}`, title, nodes: [] };
    sections.push(current);
    return current;
  };

  for (const node of nodes) {
    const semantic = semanticMap.nodeSemantics[node.nodeId];
    if (looksLikeHeading(node, semantic) && node.type === "paragraph") {
      const title = semantic?.title || node.text.trim() || `章节${sections.length + 1}`;
      const nextSection = { sectionId: `section:${node.nodeId}`, title, nodes: [] as BidTemplateNode[] };
      if (current && current.nodes.length === 0 && sections[sections.length - 1] === current) {
        sections[sections.length - 1] = nextSection;
      } else {
        sections.push(nextSection);
      }
      current = nextSection;
      continue;
    }

    const section = ensureSection();
    let compiled: BidTemplateNode | null = null;
    if (node.type === "page_break") {
      compiled = { nodeId: node.nodeId, type: "page_break" };
    } else if (node.type === "table") {
      const explicitHeaderRows = node.rows.filter((row) => row.isHeader);
      const headerSourceRows = explicitHeaderRows.length
        ? explicitHeaderRows
        : node.rows.slice(0, 1);
      compiled = {
        nodeId: node.nodeId,
        type: "table",
        tableId: `table:${node.nodeId}`,
        title: semantic?.title,
        columns: node.columns.map((_, index) => tableColumn(node, index, semantic)),
        ...(headerSourceRows.length ? {
          headerRows: headerSourceRows.map((row) => ({
            cells: row.cells.map((cell) => ({
              text: cell.text,
              ...(cell.columnSpan > 1 ? { columnSpan: cell.columnSpan } : {}),
              ...(cell.rowSpan > 1 ? { rowSpan: cell.rowSpan } : {}),
            })),
          })),
        } : {}),
        minRows: Math.max(1, node.rows.length - headerSourceRows.length),
        allowAddRows: true,
        repeatHeader: true,
      };
    } else if (
      semantic?.role === "field"
      || semantic?.role === "generated_paragraph"
      || (!semantic && FIELD_PLACEHOLDER.test(node.text))
    ) {
      compiled = fieldNode(node, semantic);
    } else if (node.text.trim()) {
      compiled = { nodeId: node.nodeId, type: "static", text: node.text };
    }
    if (compiled) section.nodes.push(compiled);
  }

  if (!sections.length) {
    sections.push({
      sectionId: "section:unparsed",
      title: "投标文件",
      nodes: [{ nodeId: "unparsed", type: "static", text: "模板结构未识别" }],
    });
  }
  return {
    templateId: `runtime:${templateHash({ source: document.source, nodes })}`,
    source: document.source,
    sections,
    warnings,
  };
}

export function createSystemDefaultBidTemplate(): BidTemplateDefinition {
  const template = structuredClone(
    bidTemplateConfig as unknown as BidTemplateDefinition
  );
  if (
    template.source !== "system_default"
    || !template.templateId
    || !Array.isArray(template.sections)
    || template.sections.length === 0
  ) {
    throw new Error("系统默认投标模板配置无效");
  }
  return template;
}
