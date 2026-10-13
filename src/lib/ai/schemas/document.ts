import { isRecord, type ValidationResult } from "./types";

export interface QuotationFormSchema extends Record<string, unknown> {
  items?: unknown[];
}

export interface ContractFormSchema extends Record<string, unknown> {
  quantity?: number;
  subtotal?: string;
  taxRate?: string;
  taxAmount?: string;
  totalAmount?: string;
}

export function validateQuotationForm<T extends QuotationFormSchema = QuotationFormSchema>(
  value: unknown
): ValidationResult<T> {
  if (!isRecord(value)) return { success: false, errors: ["result must be a JSON object"] };

  const errors: string[] = [];
  if (value.items !== undefined) {
    if (!Array.isArray(value.items)) {
      errors.push("items must be an array");
    } else {
      value.items.forEach((item, index) => {
        if (!isRecord(item)) {
          errors.push(`items[${index}] must be an object`);
          return;
        }
        if (item.quantity !== undefined && typeof item.quantity !== "number") {
          errors.push(`items[${index}].quantity must be a number`);
        }
      });
    }
  }

  return {
    success: errors.length === 0,
    data: errors.length === 0 ? value as T : undefined,
    errors,
  };
}

export function validateContractForm<T extends ContractFormSchema = ContractFormSchema>(
  value: unknown
): ValidationResult<T> {
  if (!isRecord(value)) return { success: false, errors: ["result must be a JSON object"] };

  const errors: string[] = [];
  if (value.quantity !== undefined && typeof value.quantity !== "number") {
    errors.push("quantity must be a number");
  }
  for (const field of ["subtotal", "taxRate", "taxAmount", "totalAmount"] as const) {
    if (value[field] !== undefined && typeof value[field] !== "string") {
      errors.push(`${field} must be a string`);
    }
  }

  return {
    success: errors.length === 0,
    data: errors.length === 0 ? value as T : undefined,
    errors,
  };
}
