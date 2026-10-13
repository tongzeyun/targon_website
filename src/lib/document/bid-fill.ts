import type {
  BidBlock,
  BidSection,
  BidTableBlock,
  BidTableCell,
  GeneratedBid,
} from "./bid-document-model";
import type {
  BidFillContract,
  BidFillResult,
  BidFillScalar,
  BidTemplateDefinition,
  BidTemplateFieldNode,
  BidTemplateTableNode,
} from "./bid-template-model";
import { isBidAiFillableSourcePolicy } from "./bid-template-model";

const META_FIELDS = {
  "meta.projectName": {
    description: "招标项目名称",
    valueType: "string" as const,
    sourcePolicy: "tender" as const,
    required: true,
  },
  "meta.bidDeadline": {
    description: "投标截止日期和时间",
    valueType: "string" as const,
    sourcePolicy: "tender" as const,
    required: false,
  },
  "meta.bidUnit": {
    description: "招标人或采购单位名称",
    valueType: "string" as const,
    sourcePolicy: "tender" as const,
    required: false,
  },
};

export function createBidFillContract(template: BidTemplateDefinition): BidFillContract {
  const values: BidFillContract["values"] = { ...META_FIELDS };
  const tables: BidFillContract["tables"] = {};
  for (const section of template.sections) {
    for (const node of section.nodes) {
      if (node.type === "field") {
        values[node.fieldId] = {
          description: node.description,
          valueType: node.valueType,
          sourcePolicy: node.sourcePolicy,
          required: node.required,
        };
      } else if (node.type === "table") {
        tables[node.tableId] = {
          description: node.title || section.title,
          columns: Object.fromEntries(node.columns.map((column) => [
            column.key,
            {
              description: column.description,
              valueType: column.valueType,
              sourcePolicy: column.sourcePolicy,
              required: column.required,
            },
          ])),
        };
      }
    }
  }
  return { values, tables };
}

function scalarText(value: BidFillScalar | undefined): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function renderField(node: BidTemplateFieldNode, value: BidFillScalar | undefined): string {
  const accepted = isBidAiFillableSourcePolicy(node.sourcePolicy) ? scalarText(value) : "";
  const placeholder = `【待填写：${node.label}】`;
  if (node.renderAs === "paragraph") return accepted || placeholder;
  if (/_{3,}|＿{3,}/.test(node.originalText)) {
    return node.originalText.replace(/_{3,}|＿{3,}/g, accepted || placeholder);
  }
  if (!node.originalText.trim()) return accepted || placeholder;
  return accepted ? `${node.originalText}${accepted}` : `${node.originalText}${placeholder}`;
}

function tableRows(
  node: BidTemplateTableNode,
  fill: BidFillResult,
  sectionTitles: string[]
): BidTableBlock["rows"] {
  if (node.tableId === "table:document-index") {
    const [indexColumn, contentColumn, pageColumn] = node.columns;
    if (!indexColumn || !contentColumn || !pageColumn) return [];
    return sectionTitles.map((title, index) => ({
      id: `${node.tableId}:row-${index + 1}`,
      cells: {
        [indexColumn.key]: { value: String(index + 1) },
        [contentColumn.key]: { value: title },
        [pageColumn.key]: { value: "", missingInfo: "所在页码" },
      },
    }));
  }

  const rows = fill.tables[node.tableId] || [];
  const rowCount = Math.max(node.minRows, rows.length);
  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const sourceRow = rows[rowIndex] || {};
    const cells: Record<string, BidTableCell> = {};
    for (const column of node.columns) {
      const value = isBidAiFillableSourcePolicy(column.sourcePolicy)
        ? scalarText(sourceRow[column.key])
        : "";
      cells[column.key] = {
        value,
        ...(!value && column.required ? { missingInfo: column.title } : {}),
      };
    }
    return { id: `${node.tableId}:row-${rowIndex + 1}`, cells };
  });
}

export function assembleFilledBid(
  template: BidTemplateDefinition,
  fill: BidFillResult
): GeneratedBid {
  const sectionTitles = template.sections.map((section) => section.title);
  const sections: BidSection[] = template.sections.map((section) => {
    const blocks: BidBlock[] = [];
    for (const node of section.nodes) {
      if (node.type === "static") {
        blocks.push({ id: node.nodeId, type: "paragraph", text: node.text });
      } else if (node.type === "field") {
        const text = renderField(node, fill.values[node.fieldId]);
        blocks.push({
          id: node.nodeId,
          type: "paragraph",
          text,
          ...(text.includes("【待填写") ? { missingInfo: node.label } : {}),
        });
      } else if (node.type === "table") {
        blocks.push({
          id: node.tableId.replace(/^table:/, ""),
          type: "table",
          title: node.title,
          columns: node.columns.map((column) => ({
            key: column.key,
            title: column.title,
            width: column.width,
            alignment: column.alignment,
            required: column.required,
            readOnly: column.readOnly,
          })),
          headerRows: node.headerRows,
          rows: tableRows(node, fill, sectionTitles),
          allowAddRows: node.allowAddRows,
          repeatHeader: node.repeatHeader,
        });
      } else if (node.type === "page_break") {
        blocks.push({ id: node.nodeId, type: "page_break" });
      }
    }
    if (!blocks.length) {
      blocks.push({
        id: `${section.sectionId}:missing`,
        type: "paragraph",
        text: `【待填写：${section.title}】`,
        missingInfo: section.title,
      });
    }
    return { id: section.sectionId, title: section.title, blocks };
  });

  return {
    projectName: scalarText(fill.values["meta.projectName"]) || "待填写项目名称",
    bidDeadline: scalarText(fill.values["meta.bidDeadline"]),
    bidUnit: scalarText(fill.values["meta.bidUnit"]),
    sections,
  };
}

export function emptyBidFillResult(): BidFillResult {
  return { values: {}, tables: {} };
}

function sanitizeScalar(
  value: BidFillScalar | undefined,
  valueType: BidFillContract["values"][string]["valueType"]
): BidFillScalar {
  if (value === null || value === undefined) return null;
  if (valueType === "number") {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const normalized = value.trim().replace(/,/g, "");
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return String(value).trim() || null;
}

/**
 * Enforces the backend-owned dynamic contract after the AI syntax validator.
 * Unknown keys and values that violate source policies never reach the assembler.
 */
export function sanitizeBidFillResult(
  contract: BidFillContract,
  fill: BidFillResult
): { data: BidFillResult; warnings: string[] } {
  const values: BidFillResult["values"] = {};
  const tables: BidFillResult["tables"] = {};
  const warnings: string[] = [];

  for (const [fieldId, field] of Object.entries(contract.values)) {
    const supplied = fill.values[fieldId];
    if (!isBidAiFillableSourcePolicy(field.sourcePolicy)) {
      values[fieldId] = null;
      if (supplied !== null && supplied !== undefined && supplied !== "") {
        warnings.push(`字段 ${fieldId} 不允许由 AI 填写，已忽略`);
      }
      continue;
    }
    const sanitized = sanitizeScalar(supplied, field.valueType);
    values[fieldId] = sanitized;
    if (supplied !== null && supplied !== undefined && sanitized === null) {
      warnings.push(`字段 ${fieldId} 的值类型不符合契约，已置空`);
    }
  }

  for (const unknownKey of Object.keys(fill.values)) {
    if (!(unknownKey in contract.values)) warnings.push(`未知字段 ${unknownKey} 已忽略`);
  }

  for (const [tableId, table] of Object.entries(contract.tables)) {
    const suppliedRows = fill.tables[tableId] || [];
    tables[tableId] = suppliedRows.map((row, rowIndex) => {
      const sanitizedRow: Record<string, BidFillScalar> = {};
      for (const [columnId, column] of Object.entries(table.columns)) {
        const supplied = row[columnId];
        if (!isBidAiFillableSourcePolicy(column.sourcePolicy)) {
          sanitizedRow[columnId] = null;
          if (supplied !== null && supplied !== undefined && supplied !== "") {
            warnings.push(`表格 ${tableId} 第 ${rowIndex + 1} 行字段 ${columnId} 不允许由 AI 填写，已忽略`);
          }
          continue;
        }
        const sanitized = sanitizeScalar(supplied, column.valueType);
        sanitizedRow[columnId] = sanitized;
        if (supplied !== null && supplied !== undefined && sanitized === null) {
          warnings.push(`表格 ${tableId} 第 ${rowIndex + 1} 行字段 ${columnId} 的值类型不符合契约，已置空`);
        }
      }
      for (const unknownKey of Object.keys(row)) {
        if (!(unknownKey in table.columns)) {
          warnings.push(`表格 ${tableId} 第 ${rowIndex + 1} 行未知字段 ${unknownKey} 已忽略`);
        }
      }
      return sanitizedRow;
    });
  }

  for (const unknownTableId of Object.keys(fill.tables)) {
    if (!(unknownTableId in contract.tables)) warnings.push(`未知表格 ${unknownTableId} 已忽略`);
  }

  return { data: { values, tables }, warnings };
}
