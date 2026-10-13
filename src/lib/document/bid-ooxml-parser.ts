import { load } from "cheerio";
import PizZip from "pizzip";
import type {
  BidTemplateSource,
  RawBidTableCell,
  RawBidTableNode,
  RawBidTemplateDocument,
  RawBidTemplateNode,
} from "./bid-template-model";

const P = "w\\:p";
const TBL = "w\\:tbl";
const TR = "w\\:tr";
const TC = "w\\:tc";

function attr(element: { attr(name: string): string | undefined }, name: string): string | undefined {
  return element.attr(`w:${name}`) || element.attr(name);
}

function normalizedText(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
}

function nodeText($: ReturnType<typeof load>, element: unknown): string {
  const parts: string[] = [];
  $(element as never).find("w\\:t,w\\:tab,w\\:br").each((_, child) => {
    const name = child.name?.toLowerCase();
    if (name?.endsWith(":tab")) parts.push("\t");
    else if (name?.endsWith(":br")) parts.push("\n");
    else parts.push($(child).text());
  });
  return normalizedText(parts.join(""));
}

function positiveInt(value: string | undefined, fallback = 1): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseTable(
  $: ReturnType<typeof load>,
  element: unknown,
  tableNumber: number,
  order: number
): RawBidTableNode {
  const nodeId = `t-${String(tableNumber).padStart(4, "0")}`;
  const activeVerticalMerges = new Map<number, { rowIndex: number; cellIndex: number }>();
  const rows: RawBidTableNode["rows"] = [];
  $(element as never)
    .children(TR)
    .toArray()
    .forEach((rowElement, rowIndex) => {
      let logicalColumn = 0;
      const cells: RawBidTableCell[] = [];
      $(rowElement).children(TC).each((cellIndex, cellElement) => {
        const $cell = $(cellElement);
        const columnSpan = positiveInt(attr($cell.find("w\\:gridSpan").first(), "val"), 1);
        const mergeElement = $cell.find("w\\:vMerge").first();
        const mergeValue = attr(mergeElement, "val");
        const isMergeContinuation = mergeElement.length > 0 && mergeValue !== "restart";
        if (isMergeContinuation) {
          const origin = activeVerticalMerges.get(logicalColumn);
          if (origin) {
            const originCell = rows[origin.rowIndex]?.cells[origin.cellIndex];
            if (originCell) originCell.rowSpan += 1;
          }
          logicalColumn += columnSpan;
          return;
        }

        const cell: RawBidTableCell = {
          cellId: `${nodeId}:r-${String(rowIndex + 1).padStart(3, "0")}:c-${String(logicalColumn + 1).padStart(2, "0")}`,
          text: nodeText($, cellElement),
          columnSpan,
          rowSpan: 1,
        };
        cells.push(cell);
        if (mergeElement.length > 0 && mergeValue === "restart") {
          activeVerticalMerges.set(logicalColumn, { rowIndex, cellIndex: cells.length - 1 });
        } else {
          for (let offset = 0; offset < columnSpan; offset += 1) {
            activeVerticalMerges.delete(logicalColumn + offset);
          }
        }
        logicalColumn += columnSpan;
      });
      rows.push({
        rowId: `${nodeId}:r-${String(rowIndex + 1).padStart(3, "0")}`,
        cells,
        ...($(rowElement).find("w\\:trPr > w\\:tblHeader").length > 0 ? { isHeader: true } : {}),
      });
    });

  const gridWidths = $(element as never)
    .find("w\\:tblGrid")
    .first()
    .children("w\\:gridCol")
    .toArray()
    .map((grid) => positiveInt(attr($(grid), "w"), 0));
  const firstRow = rows[0];
  const columnCount = Math.max(
    gridWidths.length,
    firstRow?.cells.reduce((total, cell) => total + cell.columnSpan, 0) || 0
  );
  const totalWidth = gridWidths.reduce((sum, width) => sum + width, 0);
  const headerTextAt = (columnIndex: number): string => {
    let logicalColumn = 0;
    for (const cell of firstRow?.cells || []) {
      if (columnIndex >= logicalColumn && columnIndex < logicalColumn + cell.columnSpan) {
        return cell.text;
      }
      logicalColumn += cell.columnSpan;
    }
    return "";
  };
  const columns = Array.from({ length: columnCount }, (_, index) => ({
    columnId: `${nodeId}:c-${String(index + 1).padStart(2, "0")}`,
    index,
    headerText: headerTextAt(index) || `第${index + 1}列`,
    ...(totalWidth > 0 && gridWidths[index]
      ? { width: Math.max(1, Math.round((gridWidths[index] / totalWidth) * 100)) }
      : {}),
  }));

  return { nodeId, type: "table", order, columns, rows };
}

export function parseBidDocxOoxml(
  buffer: ArrayBuffer,
  source: BidTemplateSource
): RawBidTemplateDocument {
  const zip = new PizZip(Buffer.from(buffer));
  const xml = zip.file("word/document.xml")?.asText();
  if (!xml) throw new Error("DOCX 缺少 word/document.xml");
  const $ = load(xml, { xmlMode: true });
  const nodes: RawBidTemplateNode[] = [];
  let paragraphNumber = 0;
  let tableNumber = 0;
  let order = 0;

  $("w\\:body").first().children(`${P},${TBL}`).each((_, element) => {
    order += 1;
    if (element.name?.toLowerCase().endsWith(":tbl")) {
      tableNumber += 1;
      nodes.push(parseTable($, element, tableNumber, order));
      return;
    }

    paragraphNumber += 1;
    const $paragraph = $(element);
    const text = nodeText($, element);
    const styleName = attr($paragraph.find("w\\:pPr > w\\:pStyle").first(), "val");
    const outlineRaw = attr($paragraph.find("w\\:pPr > w\\:outlineLvl").first(), "val");
    const numberingRaw = attr($paragraph.find("w\\:pPr > w\\:numPr > w\\:ilvl").first(), "val");
    const pageBreakBefore = $paragraph.find('w\\:br[w\\:type="page"],w\\:pageBreakBefore').length > 0;
    if (pageBreakBefore && nodes.length > 0) {
      nodes.push({
        nodeId: `break-${String(paragraphNumber).padStart(4, "0")}`,
        type: "page_break",
        order: order - 0.1,
      });
    }
    if (!text && !styleName && !pageBreakBefore) return;
    nodes.push({
      nodeId: `p-${String(paragraphNumber).padStart(4, "0")}`,
      type: "paragraph",
      order,
      text,
      ...(styleName ? { styleName } : {}),
      ...(outlineRaw !== undefined ? { outlineLevel: Number(outlineRaw) } : {}),
      ...(numberingRaw !== undefined ? { numberingLevel: Number(numberingRaw) } : {}),
      ...(pageBreakBefore ? { pageBreakBefore: true } : {}),
    });
  });

  if (!nodes.length) throw new Error("DOCX 未解析到有效段落或表格");
  return { source, nodes };
}

export function rawBidDocumentText(
  document: RawBidTemplateDocument,
  excludedRegions: Array<{ startNodeId: string; endNodeId: string }> = []
): string {
  const indexById = new Map(document.nodes.map((node, index) => [node.nodeId, index]));
  const excluded = new Set<number>();
  for (const region of excludedRegions) {
    const start = indexById.get(region.startNodeId);
    const end = indexById.get(region.endNodeId);
    if (start === undefined || end === undefined || start > end) continue;
    for (let index = start; index <= end; index += 1) excluded.add(index);
  }
  return document.nodes
    .filter((_, index) => !excluded.has(index))
    .map((node) => {
      if (node.type === "paragraph") return `[${node.nodeId}] ${node.text}`;
      if (node.type === "page_break") return "\n--- 分页 ---\n";
      const rows = node.rows.map((row) => row.cells.map((cell) => cell.text).join(" | ")).join("\n");
      return `[${node.nodeId}]\n${rows}`;
    })
    .filter(Boolean)
    .join("\n");
}
