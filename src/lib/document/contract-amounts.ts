export interface ContractAmountInput {
  quantity: number;
  unitPrice: string;
  taxRate: string;
}

export interface ContractAmountResult {
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function parseContractAmount(value: string): number {
  const normalized = String(value || "").replace(/,/g, "");
  const amount = Number.parseFloat(normalized.replace(/[^0-9.]/g, "")) || 0;
  return normalized.includes("万") ? amount * 10_000 : amount;
}

export function parseContractTaxRate(value: string): number | null {
  const match = String(value || "").match(/^\s*(\d+(?:\.\d+)?)\s*%?\s*$/);
  if (!match) return null;
  const rate = Number.parseFloat(match[1]);
  return Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : null;
}

export function calculateContractAmounts(input: ContractAmountInput): ContractAmountResult {
  const quantity = Number.isFinite(input.quantity) ? Math.max(0, input.quantity) : 0;
  const unitPrice = parseContractAmount(input.unitPrice);
  const taxRate = parseContractTaxRate(input.taxRate) ?? 0;
  const subtotal = roundMoney(quantity * unitPrice);
  const taxAmount = roundMoney(subtotal * taxRate / 100);

  return {
    subtotal,
    taxAmount,
    totalAmount: roundMoney(subtotal + taxAmount),
  };
}

export function formatContractCurrency(value: number): string {
  return `¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
