export const BID_TEMPLATE_SOURCES = [
  "separate_upload",
  "embedded",
  "system_default",
] as const;

export type BidTemplateSource = (typeof BID_TEMPLATE_SOURCES)[number];

export function parseBidTemplateSource(value: unknown): BidTemplateSource {
  return typeof value === "string" && BID_TEMPLATE_SOURCES.some((source) => source === value)
    ? value as BidTemplateSource
    : "system_default";
}

export type BidTextAlignment = "left" | "center" | "right";

export interface BidTableColumn {
  key: string;
  title: string;
  width?: number;
  alignment?: BidTextAlignment;
  required?: boolean;
  readOnly?: boolean;
}

export interface BidTableHeaderCell {
  text: string;
  columnSpan?: number;
  rowSpan?: number;
}

export interface BidTableHeaderRow {
  cells: BidTableHeaderCell[];
}

export interface BidParagraphBlock {
  id: string;
  type: "paragraph";
  text: string;
  missingInfo?: string;
}

export interface BidPageBreakBlock {
  id: string;
  type: "page_break";
}

export interface BidTableCell {
  value: string;
  missingInfo?: string;
  columnSpan?: number;
  rowSpan?: number;
}

export interface BidTableRow {
  id: string;
  cells: Record<string, BidTableCell>;
}

export interface BidTableBlock {
  id: string;
  type: "table";
  title?: string;
  columns: BidTableColumn[];
  headerRows?: BidTableHeaderRow[];
  rows: BidTableRow[];
  allowAddRows?: boolean;
  repeatHeader?: boolean;
}

export type BidBlock = BidParagraphBlock | BidTableBlock | BidPageBreakBlock;

export interface BidSection {
  id: string;
  title: string;
  blocks: BidBlock[];
  missingInfo?: string;
}

export interface GeneratedBid {
  projectName: string;
  bidDeadline: string;
  bidUnit: string;
  sections: BidSection[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isBidBlock(value: unknown): value is BidBlock {
  if (!isRecord(value) || typeof value.id !== "string") return false;
  if (value.type === "page_break") return true;
  if (value.type === "paragraph") return typeof value.text === "string";
  if (
    value.type !== "table"
    || !Array.isArray(value.columns)
    || value.columns.length === 0
    || !Array.isArray(value.rows)
  ) {
    return false;
  }
  const columnsValid = value.columns.every((column) =>
    isRecord(column) && typeof column.key === "string" && typeof column.title === "string"
  );
  const rowsValid = value.rows.every((row) => {
    if (!isRecord(row) || typeof row.id !== "string" || !isRecord(row.cells)) return false;
    return Object.values(row.cells).every((cell) =>
      isRecord(cell) && typeof cell.value === "string"
    );
  });
  const headerRowsValid = value.headerRows === undefined || (
    Array.isArray(value.headerRows)
    && value.headerRows.every((row) =>
      isRecord(row)
      && Array.isArray(row.cells)
      && row.cells.every((cell) => isRecord(cell) && typeof cell.text === "string")
    )
  );
  return columnsValid && rowsValid && headerRowsValid;
}

export function isBidSectionArray(value: unknown): value is BidSection[] {
  return Array.isArray(value)
    && value.length > 0
    && value.every((section) =>
      isRecord(section)
      && typeof section.id === "string"
      && typeof section.title === "string"
      && Array.isArray(section.blocks)
      && section.blocks.every(isBidBlock)
    );
}

export function bidCellText(cell: BidTableCell, columnTitle: string, required = true): string {
  if (cell.value.trim()) return cell.value;
  if (!required && !cell.missingInfo) return "";
  return `【待填写：${cell.missingInfo || columnTitle}】`;
}

export function isBidPlaceholder(value: string): boolean {
  return /【待填写(?:[:：][^】]+)?】/.test(value);
}

export function countMissingBidFields(sections: BidSection[]): number {
  let count = 0;
  for (const section of sections) {
    if (section.missingInfo) count += 1;
    for (const block of section.blocks) {
      if (block.type === "paragraph") {
        if (block.missingInfo || isBidPlaceholder(block.text)) count += 1;
        continue;
      }
      if (block.type === "page_break") continue;
      for (const row of block.rows) {
        for (const column of block.columns) {
          const cell = row.cells[column.key];
          if (
            (column.required && (!cell || !cell.value.trim()))
            || Boolean(cell?.missingInfo)
            || Boolean(cell && isBidPlaceholder(cell.value))
          ) {
            count += 1;
          }
        }
      }
    }
  }
  return count;
}
