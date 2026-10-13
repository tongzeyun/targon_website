import type {
  BidTableHeaderRow,
  BidTemplateSource,
  BidTextAlignment,
} from "./bid-document-model";

export type { BidTemplateSource } from "./bid-document-model";

export const BID_FIELD_VALUE_TYPES = ["string", "number", "date", "long_text"] as const;

export type BidFieldValueType = (typeof BID_FIELD_VALUE_TYPES)[number];

export const BID_FIELD_SOURCE_POLICIES = [
  "tender",
  "company",
  "tender_or_company",
  "company_or_manual",
  "generated",
  "manual",
  "calculated",
  "template",
] as const;

export type BidFieldSourcePolicy = (typeof BID_FIELD_SOURCE_POLICIES)[number];

const NON_AI_FILLABLE_SOURCE_POLICIES = new Set<BidFieldSourcePolicy>([
  "manual",
  "calculated",
  "template",
]);

export function isBidAiFillableSourcePolicy(policy: BidFieldSourcePolicy): boolean {
  return !NON_AI_FILLABLE_SOURCE_POLICIES.has(policy);
}

export interface RawBidParagraphNode {
  nodeId: string;
  type: "paragraph";
  order: number;
  text: string;
  styleName?: string;
  outlineLevel?: number;
  numberingLevel?: number;
  pageBreakBefore?: boolean;
}

export interface RawBidTableCell {
  cellId: string;
  text: string;
  columnSpan: number;
  rowSpan: number;
}

export interface RawBidTableRow {
  rowId: string;
  cells: RawBidTableCell[];
  isHeader?: boolean;
}

export interface RawBidTableColumn {
  columnId: string;
  index: number;
  headerText: string;
  width?: number;
}

export interface RawBidTableNode {
  nodeId: string;
  type: "table";
  order: number;
  columns: RawBidTableColumn[];
  rows: RawBidTableRow[];
}

export interface RawBidPageBreakNode {
  nodeId: string;
  type: "page_break";
  order: number;
}

export type RawBidTemplateNode =
  | RawBidParagraphNode
  | RawBidTableNode
  | RawBidPageBreakNode;

export interface RawBidTemplateDocument {
  source: BidTemplateSource;
  nodes: RawBidTemplateNode[];
}

export interface BidTemplateRegion {
  startNodeId: string;
  endNodeId: string;
}

export const BID_TEMPLATE_SEMANTIC_ROLES = [
  "section_heading",
  "static_text",
  "field",
  "generated_paragraph",
  "table",
  "instruction",
] as const;

export type BidTemplateSemanticRole = (typeof BID_TEMPLATE_SEMANTIC_ROLES)[number];

export interface BidColumnSemantic {
  label?: string;
  description?: string;
  valueType?: BidFieldValueType;
  sourcePolicy?: BidFieldSourcePolicy;
  required?: boolean;
}

export interface BidNodeSemantic {
  role: BidTemplateSemanticRole;
  title?: string;
  label?: string;
  description?: string;
  valueType?: BidFieldValueType;
  sourcePolicy?: BidFieldSourcePolicy;
  required?: boolean;
  columns?: Record<string, BidColumnSemantic>;
}

export interface BidTemplateSemanticMap {
  templateRegions: BidTemplateRegion[];
  nodeSemantics: Record<string, BidNodeSemantic>;
}

export interface BidTemplateStaticNode {
  nodeId: string;
  type: "static";
  text: string;
}

export interface BidTemplateFieldNode {
  nodeId: string;
  type: "field";
  fieldId: string;
  label: string;
  description: string;
  originalText: string;
  valueType: BidFieldValueType;
  sourcePolicy: BidFieldSourcePolicy;
  required: boolean;
  renderAs: "inline" | "paragraph";
}

export interface BidTemplateTableColumn {
  columnId: string;
  key: string;
  title: string;
  description: string;
  valueType: BidFieldValueType;
  sourcePolicy: BidFieldSourcePolicy;
  required: boolean;
  width?: number;
  alignment?: BidTextAlignment;
  readOnly?: boolean;
}

export interface BidTemplateTableNode {
  nodeId: string;
  type: "table";
  tableId: string;
  title?: string;
  columns: BidTemplateTableColumn[];
  headerRows?: BidTableHeaderRow[];
  minRows: number;
  allowAddRows: boolean;
  repeatHeader: boolean;
}

export interface BidTemplatePageBreakNode {
  nodeId: string;
  type: "page_break";
}

export type BidTemplateNode =
  | BidTemplateStaticNode
  | BidTemplateFieldNode
  | BidTemplateTableNode
  | BidTemplatePageBreakNode;

export interface BidTemplateSectionDefinition {
  sectionId: string;
  title: string;
  nodes: BidTemplateNode[];
}

export interface BidTemplateDefinition {
  templateId: string;
  source: BidTemplateSource;
  sections: BidTemplateSectionDefinition[];
  warnings: string[];
}

export interface BidFillFieldContract {
  description: string;
  valueType: BidFieldValueType;
  sourcePolicy: BidFieldSourcePolicy;
  required: boolean;
}

export interface BidFillTableContract {
  description: string;
  columns: Record<string, BidFillFieldContract>;
}

export interface BidFillContract {
  values: Record<string, BidFillFieldContract>;
  tables: Record<string, BidFillTableContract>;
}

export type BidFillScalar = string | number | null;

export interface BidFillResult {
  values: Record<string, BidFillScalar>;
  tables: Record<string, Array<Record<string, BidFillScalar>>>;
}
