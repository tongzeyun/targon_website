import type {
  BidFillResult,
  BidNodeSemantic,
  BidTemplateSemanticMap,
} from "@/lib/document/bid-template-model";
import {
  BID_FIELD_SOURCE_POLICIES,
  BID_FIELD_VALUE_TYPES,
  BID_TEMPLATE_SEMANTIC_ROLES,
} from "@/lib/document/bid-template-model";
import { isRecord, type ValidationResult } from "./types";

const SEMANTIC_ROLES = new Set<string>(BID_TEMPLATE_SEMANTIC_ROLES);
const VALUE_TYPES = new Set<string>(BID_FIELD_VALUE_TYPES);
const SOURCE_POLICIES = new Set<string>(BID_FIELD_SOURCE_POLICIES);
const SEMANTIC_KEYS = new Set([
  "role",
  "title",
  "label",
  "description",
  "valueType",
  "sourcePolicy",
  "required",
  "columns",
]);
const COLUMN_SEMANTIC_KEYS = new Set([
  "label",
  "description",
  "valueType",
  "sourcePolicy",
  "required",
]);

function validateSemantic(
  value: unknown,
  path: string,
  errors: string[]
): value is BidNodeSemantic {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!SEMANTIC_KEYS.has(key)) errors.push(`${path}.${key} is not allowed`);
  }
  if (typeof value.role !== "string" || !SEMANTIC_ROLES.has(value.role)) {
    errors.push(`${path}.role is invalid`);
  }
  for (const field of ["title", "label", "description"] as const) {
    if (value[field] !== undefined && typeof value[field] !== "string") {
      errors.push(`${path}.${field} must be a string`);
    }
  }
  if (value.valueType !== undefined && (typeof value.valueType !== "string" || !VALUE_TYPES.has(value.valueType))) {
    errors.push(`${path}.valueType is invalid`);
  }
  if (
    value.sourcePolicy !== undefined
    && (typeof value.sourcePolicy !== "string" || !SOURCE_POLICIES.has(value.sourcePolicy))
  ) {
    errors.push(`${path}.sourcePolicy is invalid`);
  }
  if (value.required !== undefined && typeof value.required !== "boolean") {
    errors.push(`${path}.required must be a boolean`);
  }
  if (value.columns !== undefined) {
    if (!isRecord(value.columns)) {
      errors.push(`${path}.columns must be an object`);
    } else {
      for (const [columnId, column] of Object.entries(value.columns)) {
        if (!isRecord(column)) {
          errors.push(`${path}.columns.${columnId} must be an object`);
          continue;
        }
        for (const key of Object.keys(column)) {
          if (!COLUMN_SEMANTIC_KEYS.has(key)) {
            errors.push(`${path}.columns.${columnId}.${key} is not allowed`);
          }
        }
        for (const field of ["label", "description"] as const) {
          if (column[field] !== undefined && typeof column[field] !== "string") {
            errors.push(`${path}.columns.${columnId}.${field} must be a string`);
          }
        }
        if (
          column.valueType !== undefined
          && (typeof column.valueType !== "string" || !VALUE_TYPES.has(column.valueType))
        ) {
          errors.push(`${path}.columns.${columnId}.valueType is invalid`);
        }
        if (
          column.sourcePolicy !== undefined
          && (typeof column.sourcePolicy !== "string" || !SOURCE_POLICIES.has(column.sourcePolicy))
        ) {
          errors.push(`${path}.columns.${columnId}.sourcePolicy is invalid`);
        }
        if (column.required !== undefined && typeof column.required !== "boolean") {
          errors.push(`${path}.columns.${columnId}.required must be a boolean`);
        }
      }
    }
  }
  return true;
}

export function validateBidTemplateSemanticMap(
  value: unknown
): ValidationResult<BidTemplateSemanticMap> {
  if (!isRecord(value)) return { success: false, errors: ["result must be a JSON object"] };
  const errors: string[] = [];
  for (const key of Object.keys(value)) {
    if (key !== "templateRegions" && key !== "nodeSemantics") {
      errors.push(`${key} is not allowed`);
    }
  }
  if (!Array.isArray(value.templateRegions)) {
    errors.push("templateRegions must be an array");
  } else {
    value.templateRegions.forEach((region, index) => {
      if (
        !isRecord(region)
        || typeof region.startNodeId !== "string"
        || typeof region.endNodeId !== "string"
      ) {
        errors.push(`templateRegions[${index}] must contain startNodeId and endNodeId`);
      }
    });
  }
  if (!isRecord(value.nodeSemantics)) {
    errors.push("nodeSemantics must be an object");
  } else {
    for (const [nodeId, semantic] of Object.entries(value.nodeSemantics)) {
      validateSemantic(semantic, `nodeSemantics.${nodeId}`, errors);
    }
  }
  return {
    success: errors.length === 0,
    data: errors.length === 0 ? value as unknown as BidTemplateSemanticMap : undefined,
    errors,
  };
}

function validScalar(value: unknown): boolean {
  return value === null || typeof value === "string" || typeof value === "number";
}

export function validateBidFillResult(value: unknown): ValidationResult<BidFillResult> {
  if (!isRecord(value)) return { success: false, errors: ["result must be a JSON object"] };
  const errors: string[] = [];
  for (const key of Object.keys(value)) {
    if (key !== "values" && key !== "tables") errors.push(`${key} is not allowed`);
  }
  if (!isRecord(value.values)) {
    errors.push("values must be an object");
  } else {
    for (const [key, fieldValue] of Object.entries(value.values)) {
      if (!validScalar(fieldValue)) errors.push(`values.${key} must be string, number, or null`);
    }
  }
  if (!isRecord(value.tables)) {
    errors.push("tables must be an object");
  } else {
    for (const [tableId, rows] of Object.entries(value.tables)) {
      if (!Array.isArray(rows)) {
        errors.push(`tables.${tableId} must be an array`);
        continue;
      }
      rows.forEach((row, rowIndex) => {
        if (!isRecord(row)) {
          errors.push(`tables.${tableId}[${rowIndex}] must be an object`);
          return;
        }
        for (const [columnId, cellValue] of Object.entries(row)) {
          if (!validScalar(cellValue)) {
            errors.push(`tables.${tableId}[${rowIndex}].${columnId} must be string, number, or null`);
          }
        }
      });
    }
  }
  return {
    success: errors.length === 0,
    data: errors.length === 0 ? value as unknown as BidFillResult : undefined,
    errors,
  };
}
