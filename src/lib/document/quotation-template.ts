/**
 * 报价单固定模板 — 数据结构 + 文档生成
 */

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, AlignmentType,
  convertInchesToTwip,
} from "docx";
import { addDaysToDateValue, todayDateValue } from "@/lib/date-values";
// ============================================================
// 报价单数据结构
// ============================================================

export interface QuotationData {
  // 卖方信息
  sellerCompany: string;
  sellerAddress: string;
  sellerContact: string;
  sellerPhone: string;
  sellerEmail: string;
  // 买方信息
  buyerCompany: string;
  buyerAddress: string;
  buyerContact: string;
  buyerPhone: string;
  buyerEmail: string;
  // 报价信息
  quoteNo: string;
  quoteDate: string;
  validUntil: string;
  // 产品表格
  items: QuotationItem[];
  // 条款
  subtotal: string;
  taxRate: string;
  taxAmount: string;
  totalAmount: string;
  totalAmountCN: string; // 大写
  deliveryTime: string;
  deliveryPlace: string;
  paymentTerms: string;
  warranty: string;
  notes: string;
}

export interface QuotationItem {
  no: number;
  name: string;
  spec: string;
  unit: string;
  quantity: number;
  unitPrice: string;
  total: string;
}

function today(): string { return todayDateValue(); }
function todayPlus30(): string { return addDaysToDateValue(today(), 30) || today(); }
function genQuoteNo(): string {
  const d = new Date();
  return `Q-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-001`;
}

/** 服务端安全默认值（不含 Date/localStorage，避免 hydration 不匹配） */
export const DEFAULT_QUOTATION: QuotationData = {
  sellerCompany: "", sellerAddress: "", sellerContact: "", sellerPhone: "", sellerEmail: "",
  buyerCompany: "", buyerAddress: "", buyerContact: "", buyerPhone: "", buyerEmail: "",
  quoteNo: "", quoteDate: "", validUntil: "",
  items: [{ no: 1, name: "", spec: "", unit: "台", quantity: 1, unitPrice: "", total: "" }],
  subtotal: "", taxRate: "13%", taxAmount: "", totalAmount: "", totalAmountCN: "",
  deliveryTime: "合同签订后30天内", deliveryPlace: "客户国内指定地点",
  paymentTerms: "预付30%，发货前付70%", warranty: "12个月", notes: "",
};

/** 客户端初始化：加载 localStorage + 填充日期 */
export function initQuotationClient(): QuotationData {
  let saved: Partial<QuotationData> = {};
  try { saved = JSON.parse(localStorage.getItem("saleseye-seller-info") || "{}"); } catch {}
  return {
    ...DEFAULT_QUOTATION,
    sellerCompany: saved.sellerCompany || "", sellerAddress: saved.sellerAddress || "",
    sellerContact: saved.sellerContact || "", sellerPhone: saved.sellerPhone || "",
    sellerEmail: saved.sellerEmail || "",
    notes: saved.notes || "",
    quoteNo: genQuoteNo(), quoteDate: today(), validUntil: todayPlus30(),
  };
}

// ============================================================
// 生成 docx
// ============================================================

export async function buildQuotationDocx(data: QuotationData): Promise<Buffer> {
  const S = (s: string) => s || "";
  const bold = (text: string) => new TextRun({ text, bold: true, size: 21, font: "SimSun" });
  const normal = (text: string) => new TextRun({ text, size: 21, font: "SimSun" });
  const title = (text: string) => new Paragraph({ text, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 300 } });
  const heading = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } });
  const line = (label: string, value: string) => new Paragraph({ children: [bold(label + "："), normal(value)], spacing: { after: 80 } });
  const sep = () => new Paragraph({ text: "", spacing: { after: 100 } });

  // 公司信息区
  const infoTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({ children: [bold("报价方（卖方）")], spacing: { after: 60 } }),
              line("公司名称", S(data.sellerCompany)),
              line("地址", S(data.sellerAddress)),
              line("联系人", S(data.sellerContact)),
              line("电话", S(data.sellerPhone)),
              line("邮箱", S(data.sellerEmail)),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({ children: [bold("客户（买方）")], spacing: { after: 60 } }),
              line("公司名称", S(data.buyerCompany)),
              line("地址", S(data.buyerAddress)),
              line("联系人", S(data.buyerContact)),
              line("电话", S(data.buyerPhone)),
              line("邮箱", S(data.buyerEmail)),
            ],
          }),
        ],
      }),
    ],
  });

  // 报价单头
  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          cell("报价单号", S(data.quoteNo), 25),
          cell("报价日期", S(data.quoteDate), 25),
          cell("有效期至", S(data.validUntil), 25),
        ],
      }),
    ],
  });

  // 产品表格
  const productRows = [
    new TableRow({
      children: [
        headerCell("序号", 8), headerCell("产品名称", 22), headerCell("规格型号", 18),
        headerCell("单位", 8), headerCell("数量", 10), headerCell("单价（元）", 17), headerCell("总价（元）", 17),
      ],
    }),
    ...data.items.map((item) =>
      new TableRow({
        children: [
          textCell(String(item.no), 8), textCell(S(item.name), 22), textCell(S(item.spec), 18),
          textCell(S(item.unit), 8), textCell(String(item.quantity), 10),
          textCell(S(item.unitPrice), 17), textCell(S(item.total), 17),
        ],
      })
    ),
  ];

  const productTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: productRows,
  });

  // 合计区
  const totalSection = [
    line("小计", S(data.subtotal)),
    line(`税额（${S(data.taxRate)}）`, S(data.taxAmount)),
    new Paragraph({
      children: [bold("合计总价："), new TextRun({ text: S(data.totalAmount), bold: true, size: 24, font: "SimSun" })],
      spacing: { before: 200, after: 60 },
    }),
    line("大写", S(data.totalAmountCN)),
  ];

  // 条款
  const termsSection = [
    heading("条款与条件"),
    line("交货时间", S(data.deliveryTime)),
    line("交货地点", S(data.deliveryPlace)),
    line("付款方式", S(data.paymentTerms)),
    line("质保期", S(data.warranty)),
    ...(data.notes ? [new Paragraph({
      children: [bold("备注："), normal(data.notes)],
      spacing: { before: 120, after: 60 },
    })] : []),
  ];

  // 签章
  const signatureSection = [
    sep(),
    new Paragraph({ children: [normal("以上报价真实有效，如有疑问请联系我们。")], spacing: { after: 200 } }),
    new Paragraph({ children: [bold("卖方（盖章）："), normal(S(data.sellerCompany))], spacing: { after: 100 } }),
    new Paragraph({ children: [normal("日期：________________")], spacing: { after: 100 } }),
  ];

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(0.8),
            right: convertInchesToTwip(0.8),
            bottom: convertInchesToTwip(0.8),
            left: convertInchesToTwip(0.8),
          },
        },
      },
      children: [
        title("报 价 单"),
        infoTable,
        sep(),
        headerTable,
        sep(),
        heading("产品明细"),
        productTable,
        ...totalSection,
        ...termsSection,
        ...signatureSection,
      ],
    }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

// ============================================================
// 辅助
// ============================================================

function cell(label: string, value: string, pct: number) {
  return new TableCell({
    width: { size: pct, type: WidthType.PERCENTAGE },
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: label + "：", bold: true, size: 20, font: "SimSun" }),
          new TextRun({ text: value, size: 20, font: "SimSun" }),
        ],
      }),
    ],
  });
}

function headerCell(text: string, pct: number) {
  return new TableCell({
    width: { size: pct, type: WidthType.PERCENTAGE },
    shading: { fill: "E5E7EB" },
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, size: 20, font: "SimSun" })],
        alignment: AlignmentType.CENTER,
      }),
    ],
  });
}

function textCell(text: string, pct: number) {
  return new TableCell({
    width: { size: pct, type: WidthType.PERCENTAGE },
    children: [
      new Paragraph({
        children: [new TextRun({ text, size: 20, font: "SimSun" })],
        alignment: AlignmentType.CENTER,
      }),
    ],
  });
}
