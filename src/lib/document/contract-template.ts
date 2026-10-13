/**
 * 销售合同固定模板 — 数据结构 + 文档生成
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, convertInchesToTwip } from "docx";
import { todayDateValue } from "@/lib/date-values";

export interface ContractData {
  contractNo: string;
  signDate: string;
  signPlace: string;
  partyA: string; partyAAddress: string; partyAContact: string; partyAPhone: string;
  partyB: string; partyBAddress: string; partyBContact: string; partyBPhone: string;
  productName: string; productSpec: string; quantity: number; unitPrice: string;
  subtotal: string; taxRate: string; taxAmount: string; totalAmount: string; totalAmountCN: string;
  deliveryTime: string; deliveryPlace: string; paymentTerms: string; warranty: string;
  penaltyClause: string; disputeResolution: string;
  clauses: string;   // 常规合同条款
  remarks: string;
}

type AlignmentValue = (typeof AlignmentType)[keyof typeof AlignmentType];

function loadSaved(): Partial<ContractData> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem("saleseye-contract-info") || "{}"); } catch { return {}; }
}

/** 默认条款文本 */
const DEFAULT_CLAUSES = "1. 本合同一式两份，甲乙双方各执一份，具有同等法律效力。\n2. 本合同自双方签字盖章之日起生效。\n3. 未尽事宜，双方协商签订补充协议。";

/**
 * 获取默认合同数据 — 使用函数确保运行时读取最新 localStorage 值，
 * 同时安全兼容 SSR（服务端返回空默认值）。
 */
export function getDefaultContract(): ContractData {
  const saved = loadSaved();
  return {
    contractNo: "", signDate: "", signPlace: "",
    partyA: "", partyAAddress: "", partyAContact: "", partyAPhone: "",
    partyB: saved.partyB || "", partyBAddress: saved.partyBAddress || "",
    partyBContact: saved.partyBContact || "", partyBPhone: saved.partyBPhone || "",
    productName: "", productSpec: "", quantity: 1, unitPrice: "",
    subtotal: "", taxRate: "13%", taxAmount: "", totalAmount: "", totalAmountCN: "",
    deliveryTime: "8-10周", deliveryPlace: "国内客户指定地点",
    paymentTerms: "30%预付，70%发货前付清", warranty: "12个月",
    penaltyClause: "逾期交货每日按合同总额的0.5‰支付违约金",
    disputeResolution: "双方协商解决；协商不成的，向乙方所在地人民法院提起诉讼",
    clauses: saved.clauses || DEFAULT_CLAUSES,
    remarks: "",
  };
}

/** @deprecated 使用 getDefaultContract() 代替 */
export const DEFAULT_CONTRACT: ContractData = getDefaultContract();

export async function buildContractDocx(data: ContractData): Promise<Buffer> {
  const S = (s: string) => s || "";
  const bold = (t: string) => new TextRun({ text: t, bold: true, size: 22, font: "SimSun" });
  const normal = (t: string) => new TextRun({ text: t, size: 22, font: "SimSun" });
  const small = (t: string) => new TextRun({ text: t, size: 20, font: "SimSun" });
  const sep = () => new Paragraph({ spacing: { after: 120 } });
  const L = (l: string, v: string) => new Paragraph({ children: [bold(l + "："), normal(v || "—")], spacing: { after: 80 }, indent: { left: convertInchesToTwip(0.2) } });
  const P = (t: string) => new Paragraph({ children: [normal(t)], spacing: { after: 120 }, indent: { firstLine: convertInchesToTwip(0.4) } });
  const article = (n: string, title: string) => new Paragraph({
    children: [bold(`第${n}条  ${title}`)], spacing: { before: 240, after: 120 },
  });
  const signLine = (label: string) => new Paragraph({
    children: [bold(label), normal("（盖章）")], spacing: { before: 400, after: 80 },
  });

  const hdr = new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 60 },
    children: [small(`合同编号：${S(data.contractNo)}　　　签订日期：${S(data.signDate)}　　　签订地点：${S(data.signPlace)}`)],
  });

  const productTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [
        hCell("产品名称", 30), hCell("规格型号", 25), hCell("数量", 12), hCell("未税单价（元）", 18), hCell("含税总价（元）", 15),
      ]}),
      new TableRow({ children: [
        tCell(S(data.productName), 30), tCell(S(data.productSpec), 25),
        tCell(String(data.quantity), 12, AlignmentType.CENTER), tCell(S(data.unitPrice), 18, AlignmentType.RIGHT), tCell(S(data.totalAmount), 15, AlignmentType.RIGHT),
      ]}),
    ],
  });

  const clauseLines = data.clauses.split("\n").filter(l => l.trim());
  const clauseItems = clauseLines.map((c, i) =>
    new Paragraph({ children: [normal(`${i + 1}. ${c}`)], spacing: { after: 80 }, indent: { left: convertInchesToTwip(0.3) } })
  );

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: convertInchesToTwip(1.0), right: convertInchesToTwip(1.0), bottom: convertInchesToTwip(1.0), left: convertInchesToTwip(1.2) },
        },
      },
      children: [
        new Paragraph({ text: "销 售 合 同", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 160 } }),
        hdr,
        sep(),
        P("根据《中华人民共和国民法典》及相关法律法规，甲乙双方经友好协商，就产品购销事宜达成如下协议，以资共同信守。"),

        article("一", "合同双方"),
        L("甲方（买方）", S(data.partyA)),
        L("地址", S(data.partyAAddress)),
        L("联系人", S(data.partyAContact)),
        L("电话", S(data.partyAPhone)),
        sep(),
        L("乙方（卖方）", S(data.partyB)),
        L("地址", S(data.partyBAddress)),
        L("联系人", S(data.partyBContact)),
        L("电话", S(data.partyBPhone)),

        article("二", "产品信息"),
        productTable,
        sep(),
        L("未税金额", S(data.subtotal)),
        L("税率", S(data.taxRate)),
        L("税额", S(data.taxAmount)),
        new Paragraph({ children: [bold("合同含税总金额："), normal(`${S(data.totalAmount)}（大写：${S(data.totalAmountCN)}）`)], spacing: { after: 120 } }),

        article("三", "交货条款"),
        L("交货时间", S(data.deliveryTime)),
        L("交货地点", S(data.deliveryPlace)),

        article("四", "付款方式"),
        P(S(data.paymentTerms)),

        article("五", "质量保证"),
        P(`质保期：${S(data.warranty)}，质保期内因产品本身质量问题导致的故障，由乙方免费维修或更换。`),

        article("六", "违约责任"),
        P(S(data.penaltyClause)),

        article("七", "争议解决"),
        P(S(data.disputeResolution)),

        article("八", "其他条款"),
        ...clauseItems,
        data.remarks ? new Paragraph({ children: [small(`备注：${data.remarks}`)], spacing: { before: 160 }, indent: { left: convertInchesToTwip(0.2) } }) : new Paragraph({}),

        sep(), sep(),
        signLine("甲方"),
        P("授权代表签字：________________　　日期：________________"),
        sep(),
        signLine("乙方"),
        P("授权代表签字：________________　　日期：________________"),
      ],
    }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

function hCell(text: string, pct: number) {
  return new TableCell({
    width: { size: pct, type: WidthType.PERCENTAGE },
    shading: { fill: "E5E7EB" },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 20, font: "SimSun" })], alignment: AlignmentType.CENTER, spacing: { before: 40, after: 40 } })],
  });
}
function tCell(text: string, pct: number, align: AlignmentValue = AlignmentType.LEFT) {
  return new TableCell({
    width: { size: pct, type: WidthType.PERCENTAGE },
    children: [new Paragraph({ children: [new TextRun({ text, size: 20, font: "SimSun" })], alignment: align, spacing: { before: 40, after: 40 } })],
  });
}

/** 客户端初始化 */
export function initContractClient(): ContractData {
  const saved = typeof window !== "undefined"
    ? JSON.parse(localStorage.getItem("saleseye-contract-info") || "{}")
    : {};
  return {
    ...DEFAULT_CONTRACT,
    signDate: todayDateValue(),
    paymentTerms: saved.paymentTerms || DEFAULT_CONTRACT.paymentTerms,
    deliveryTime: saved.deliveryTime || DEFAULT_CONTRACT.deliveryTime,
    deliveryPlace: saved.deliveryPlace || DEFAULT_CONTRACT.deliveryPlace,
    warranty: saved.warranty || DEFAULT_CONTRACT.warranty,
    penaltyClause: saved.penaltyClause || DEFAULT_CONTRACT.penaltyClause,
    disputeResolution: saved.disputeResolution || DEFAULT_CONTRACT.disputeResolution,
    clauses: saved.clauses || DEFAULT_CONTRACT.clauses,
  };
}

