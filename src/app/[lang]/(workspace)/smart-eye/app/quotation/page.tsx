"use client";

import { useUiText } from "@/app/[lang]/(workspace)/smart-eye/_hooks/use-ui-text";
import pageStyles from "@/app/[lang]/(workspace)/smart-eye/_styles/pages.module.css";

import { useEffect, useState, type ReactNode } from "react";
import { Textarea } from "@/app/[lang]/(workspace)/smart-eye/_components/ui/textarea";
import { DatePicker } from "@/app/[lang]/(workspace)/smart-eye/_components/ui/date-picker";
import { toast } from "sonner";
import { DEFAULT_QUOTATION, initQuotationClient, QuotationData, QuotationItem } from "@/lib/document/quotation-template";
import { JobStatus } from "@/app/[lang]/(workspace)/smart-eye/_components/jobs/job-status";
import { createApiResponseError } from "@/lib/api/api-error";
import { authenticatedFetch } from "@/lib/api/authenticated-fetch";
import { createDocumentJob, downloadDocumentFromJob } from "@/lib/document/document-job-client";
import { addDaysToDateValue } from "@/lib/date-values";

function numberToChinese(n: number): string {
  if (!n || n === 0) return "";
  const digits = "零壹贰叁肆伍陆柒捌玖";
  const units = ["", "拾", "佰", "仟", "万", "拾", "佰", "仟", "亿"];
  const intPart = Math.floor(n);
  const decPart = Math.round((n - intPart) * 100);
  let result = "";
  const intStr = String(intPart);
  if (intStr === "0") {
    result = "零";
  } else {
    for (let i = 0; i < intStr.length; i++) {
      const d = parseInt(intStr[i]);
      const u = units[intStr.length - 1 - i];
      if (d !== 0) result += digits[d] + u;
      else if (i < intStr.length - 1 && intStr[i + 1] !== "0") result += "零";
    }
    result = result.replace(/零$/, "").replace(/零万/, "万").replace(/零亿/, "亿");
  }
  result += "元";
  if (decPart > 0) {
    const jiao = Math.floor(decPart / 10);
    const fen = decPart % 10;
    if (jiao > 0) result += digits[jiao] + "角";
    if (fen > 0) result += digits[fen] + "分";
  } else {
    result += "整";
  }
  return result;
}

export default function QuotationPage() {
  const uiText = useUiText();
  const [data, setData] = useState<QuotationData>(DEFAULT_QUOTATION);
  const [inited, setInited] = useState(false);

  useEffect(() => {
    if (!inited) {
      queueMicrotask(() => {
        setData(initQuotationClient());
        setInited(true);
      });
    }
  }, [inited]);

  const [reqText, setReqText] = useState("");
  const [lastAiRunId, setLastAiRunId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [documentJobId, setDocumentJobId] = useState<string | null>(null);
  const [documentJobPending, setDocumentJobPending] = useState(false);

  const update = (key: keyof QuotationData, val: QuotationData[keyof QuotationData]) => {
    setData(prev => {
      const next = { ...prev, [key]: val };
      if (key === "quoteDate" && typeof val === "string" && val) {
        next.validUntil = addDaysToDateValue(val, 30) || next.validUntil;
      }
      if (["sellerCompany", "sellerAddress", "sellerContact", "sellerPhone", "sellerEmail"].includes(key)) {
        localStorage.setItem("saleseye-seller-info", JSON.stringify({
          sellerCompany: next.sellerCompany,
          sellerAddress: next.sellerAddress,
          sellerContact: next.sellerContact,
          sellerPhone: next.sellerPhone,
          sellerEmail: next.sellerEmail,
          notes: next.notes,
        }));
      }
      if (key === "notes") {
        const saved = loadSaved();
        localStorage.setItem("saleseye-seller-info", JSON.stringify({ ...saved, notes: val }));
      }
      return next;
    });
  };

  function loadSaved() {
    try {
      return JSON.parse(localStorage.getItem("saleseye-seller-info") || "{}");
    } catch {
      return {};
    }
  }

  const updateItem = (idx: number, key: keyof QuotationItem, val: QuotationItem[keyof QuotationItem]) => {
    const items = [...data.items];
    items[idx] = { ...items[idx], [key]: val };
    if (key === "quantity" || key === "unitPrice") {
      const qty = Number(items[idx].quantity) || 0;
      const price = parseFloat(String(items[idx].unitPrice).replace(/[^0-9.]/g, "")) || 0;
      items[idx].total = `¥${(qty * price).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`;
    }
    let subtotal = 0;
    for (const item of items) subtotal += parseFloat(String(item.total).replace(/[^0-9.]/g, "")) || 0;
    const taxRateNum = parseFloat(data.taxRate) / 100;
    const taxAmount = subtotal * taxRateNum;
    const totalAmount = subtotal + taxAmount;
    setData(prev => ({
      ...prev,
      items,
      subtotal: `¥${subtotal.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`,
      taxAmount: `¥${taxAmount.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`,
      totalAmount: `¥${totalAmount.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`,
      totalAmountCN: numberToChinese(totalAmount),
    }));
  };

  const updateTaxRate = (rate: string) => {
    let subtotal = 0;
    for (const item of data.items) subtotal += parseFloat(String(item.total).replace(/[^0-9.]/g, "")) || 0;
    const taxRateNum = parseFloat(rate) / 100;
    const taxAmount = subtotal * taxRateNum;
    const totalAmount = subtotal + taxAmount;
    setData(prev => ({
      ...prev,
      taxRate: rate,
      taxAmount: `¥${taxAmount.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`,
      totalAmount: `¥${totalAmount.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`,
      totalAmountCN: numberToChinese(totalAmount),
    }));
  };

  const addItem = () => {
    const items = [...data.items, { no: data.items.length + 1, name: "", spec: "", unit: "台", quantity: 1, unitPrice: "", total: "" }];
    setData(prev => ({ ...prev, items }));
  };

  const removeItem = (idx: number) => {
    if (data.items.length <= 1) return;
    setData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx).map((it, i) => ({ ...it, no: i + 1 })),
    }));
  };

  const handleAIFill = async () => {
    if (!reqText.trim()) return;
    setGenerating(true);
    try {
      const res = await authenticatedFetch("/api/documents/quotation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "fill-form", requirements: reqText }),
      });
      if (!res.ok) throw await createApiResponseError(res, uiText("失败"));
      const filled = (await res.json()) as Partial<QuotationData> & { aiRunId?: string };
      const { aiRunId, ...formFields } = filled;
      if (typeof aiRunId === "string" && aiRunId.trim()) setLastAiRunId(aiRunId.trim());
      setData(prev => ({
        ...prev,
        ...formFields,
        items: formFields.items || prev.items,
        quoteNo: prev.quoteNo,
        quoteDate: prev.quoteDate,
      }));
      toast.success(uiText("AI 已填充报价单"));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (format: "docx" | "pdf") => {
    if (format === "pdf") {
      const el = document.querySelector(".quotation-preview") as HTMLElement;
      if (!el) return;
      const w = window.open("", "_blank");
      if (!w) {
        toast.error(uiText("请允许弹出窗口"));
        return;
      }
      w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>报价单</title>
        <style>body{font-family:'SimSun','宋体',serif;font-size:14px;line-height:1.8;padding:30px;max-width:800px;margin:0 auto;color:#000}
          table{border-collapse:collapse;width:100%;margin:8px 0} th,td{border:1px solid #333;padding:5px 8px;text-align:left;font-size:13px}
          th{background:#f0f0f0} h2{text-align:center;font-size:20px;margin-bottom:16px}
          @media print{@page{margin:12mm}body{padding:0}}</style></head><body>`);
      w.document.write(el.innerHTML);
      w.document.write("</body></html>");
      w.document.close();
      setTimeout(() => w.print(), 300);
      return;
    }
    setDocumentJobPending(true);
    try {
      const jobId = await createDocumentJob("/api/documents/quotation", {
        data,
        aiRunId: lastAiRunId,
      });
      setDocumentJobId(jobId);
      toast.success(uiText("Word 生成任务已创建"));
    } catch (e) {
      setDocumentJobPending(false);
      toast.error((e as Error).message);
    }
  };

  const handleDocumentJobDone = async (job: unknown) => {
    setDocumentJobPending(false);
    try {
      await downloadDocumentFromJob(job);
      toast.success(uiText("Word 下载完成"));
      setDocumentJobId(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className={`${pageStyles.page} ${pageStyles.document}`}>
      <div className="mb-6 flex shrink-0 flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between lg:mb-8">
        <h1>{uiText("报价单制作")}</h1>
        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => handleDownload("pdf")}
            className="h-[34px] whitespace-nowrap rounded-[10px] border border-border bg-card px-5 text-sm text-foreground transition hover:border-[#35547d]"
          >
            {uiText("下载 PDF")}</button>
          <button
            type="button"
            onClick={() => handleDownload("docx")}
            disabled={documentJobPending}
            className="btn-bg h-[34px] whitespace-nowrap rounded-[10px] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uiText("下载 Word")}</button>
        </div>
      </div>

      {documentJobId && (
        <div className="mb-4 shrink-0 rounded-[12px] border border-border bg-card p-4">
          <JobStatus jobId={documentJobId} onDone={handleDocumentJobDone} />
        </div>
      )}

      <div className="grid min-w-0 grid-cols-1 gap-6 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,600px)_minmax(0,1fr)] xl:gap-6 xl:overflow-hidden">
        <div className="min-w-0 xl:min-h-0 xl:overflow-x-hidden xl:overflow-y-auto xl:pr-[26px]">
          <div className="space-y-4 pb-8">
            <Section title={uiText("AI辅助填充")} icon="/img/smart-eye/form-star.svg">
              <Textarea
                value={reqText}
                onChange={(event) => setReqText(event.target.value)}
                placeholder={uiText("粘贴客户需求，AI自动填充下方表单……例如：客户中芯国际要买2台TMP-X1分子泵，单价28.5万，含税，30天交货")}
                rows={3}
                className="min-h-[86px] resize-none rounded-[8px] border-0 bg-input px-4 py-4 text-[17px] leading-7 text-foreground placeholder:text-[#52637a] focus-visible:ring-[#6FB1FF]/40"
                disabled={generating}
              />
              <button
                type="button"
                onClick={handleAIFill}
                disabled={!reqText.trim() || generating}
                className="mx-auto mt-5 flex h-10 items-center gap-2 rounded-[8px] px-5 text-[16px] text-[#52637a] transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <img src="/img/smart-eye/star_g.svg" alt="" />
                {generating ? uiText("AI 分析中...") : uiText("AI 自动填充表单")}
              </button>
            </Section>

            <Section title={uiText("买卖方信息")}>
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                <Field className="sm:col-span-2" label={uiText("卖方公司")} value={data.sellerCompany} onChange={(v) => update("sellerCompany", v)} placeholder={uiText("你的公司名称")} />
                <Field label={uiText("卖方联系人")} value={data.sellerContact} onChange={(v) => update("sellerContact", v)} />
                <Field label={uiText("卖方电话")} value={data.sellerPhone} onChange={(v) => update("sellerPhone", v)} />
                <Field className="sm:col-span-2" label={uiText("卖方地址")} value={data.sellerAddress} onChange={(v) => update("sellerAddress", v)} />
                <Field label={uiText("卖方邮箱")} value={data.sellerEmail} onChange={(v) => update("sellerEmail", v)} />
                <div className="sm:col-span-2 border-t border-[#687286]" />
                <Field className="sm:col-span-2" label={uiText("买方公司")} value={data.buyerCompany} onChange={(v) => update("buyerCompany", v)} placeholder={uiText("客户公司名称")} />
                <Field label={uiText("买方联系人")} value={data.buyerContact} onChange={(v) => update("buyerContact", v)} />
                <Field label={uiText("买方电话")} value={data.buyerPhone} onChange={(v) => update("buyerPhone", v)} />
                <Field label={uiText("买方邮箱")} value={data.buyerEmail} onChange={(v) => update("buyerEmail", v)} />
                <Field label={uiText("买方地址")} value={data.buyerAddress} onChange={(v) => update("buyerAddress", v)} />
              </div>
            </Section>

            <Section title={uiText("报价信息")}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label={uiText("报价单号")} value={data.quoteNo} onChange={(v) => update("quoteNo", v)} />
                <Field label={uiText("报价日期")} value={data.quoteDate} onChange={(v) => update("quoteDate", v)} type="date" />
                <Field label={uiText("有效期至")} value={data.validUntil} onChange={(v) => update("validUntil", v)} type="date" />
              </div>
            </Section>

            <Section
              title={uiText("产品明细")}
              action={(
                <button type="button" onClick={addItem} className="text-sm text-[#5b9bff] transition hover:text-foreground">
                  {uiText("添加")}</button>
              )}
            >
              <div className="space-y-3">
                {data.items.map((item, idx) => (
                  <div key={idx} className="rounded-[10px] border border-border bg-input p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">#{idx + 1}</span>
                      {data.items.length > 1 && (
                        <button type="button" className="text-sm text-[#ff6b6b]" onClick={() => removeItem(idx)}>
                          {uiText("删除")}</button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <Field className="sm:col-span-2" label={uiText("产品名称")} value={item.name} onChange={(v) => updateItem(idx, "name", v)} placeholder={uiText("产品名称")} />
                      <Field className="sm:col-span-2" label={uiText("规格型号")} value={item.spec} onChange={(v) => updateItem(idx, "spec", v)} placeholder={uiText("型号")} />
                      <Field label={uiText("单位")} value={item.unit} onChange={(v) => updateItem(idx, "unit", v)} />
                      <Field label={uiText("数量")} value={item.quantity} onChange={(v) => updateItem(idx, "quantity", Number(v))} type="number" />
                      <Field label={uiText("单价")} value={item.unitPrice} onChange={(v) => updateItem(idx, "unitPrice", v)} placeholder="¥0.00" />
                      <Field label={uiText("小计")} value={item.total} onChange={() => {}} placeholder={uiText("自动计算")} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm text-[#52637a]">
                <SummaryRow label={uiText("小计")} value={data.subtotal || "—"} />
                <div className="flex items-center justify-between">
                  <span>{uiText("税率")}</span>
                  <select
                    value={data.taxRate}
                    onChange={(event) => updateTaxRate(event.target.value)}
                    className="rounded-[6px] border border-border bg-input px-2 py-1 text-sm text-foreground outline-none"
                  >
                    <option className="bg-card" value="13%">13%</option>
                    <option className="bg-card" value="6%">6%</option>
                    <option className="bg-card" value="1%">1%</option>
                  </select>
                </div>
                <SummaryRow label={uiText("税额")} value={data.taxAmount || "—"} />
                <SummaryRow label={uiText("合计总价")} value={data.totalAmount || "—"} strong />
                {data.totalAmountCN && <p className="text-right text-xs text-muted-foreground">{uiText("大写：")}{data.totalAmountCN}</p>}
              </div>
            </Section>

            <Section title={uiText("条款与条件")}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={uiText("交货时间")} value={data.deliveryTime} onChange={(v) => update("deliveryTime", v)} placeholder={uiText("合同签订后30天")} />
                <Field label={uiText("交货地点")} value={data.deliveryPlace} onChange={(v) => update("deliveryPlace", v)} />
                <Field className="sm:col-span-2" label={uiText("付款方式")} value={data.paymentTerms} onChange={(v) => update("paymentTerms", v)} placeholder={uiText("预付30%，发货前付60%，验收后付10%")} />
                <Field label={uiText("质保期")} value={data.warranty} onChange={(v) => update("warranty", v)} />
                <Field className="sm:col-span-2" label={uiText("备注")} value={data.notes} onChange={(v) => update("notes", v)} />
              </div>
            </Section>
          </div>
        </div>

        <div className="min-w-0 xl:min-h-0 xl:overflow-x-hidden xl:overflow-y-auto xl:pr-[10px]">
          <div className="quotation-preview rounded-[14px] border border-border bg-card px-6 py-7 text-[#52637a]">
            <h2 className="mb-6 text-center text-[30px] font-bold text-foreground">报 价 单</h2>
            <div className="mb-6 grid grid-cols-1 gap-6 text-[16px] leading-7 sm:grid-cols-2 sm:gap-10">
              <div>
                <p className="mb-2 font-bold text-foreground">报价方（卖方）</p>
                <p>{data.sellerCompany || "—"}</p>
                <p>地址：{data.sellerAddress || "—"}</p>
                <p>联系人：{data.sellerContact || "—"}　　电话：{data.sellerPhone || "—"}</p>
                {data.sellerEmail && <p>邮箱：{data.sellerEmail}</p>}
              </div>
              <div>
                <p className="mb-2 font-bold text-foreground">客户（买方）</p>
                <p>{data.buyerCompany || "—"}</p>
                <p>地址：{data.buyerAddress || "—"}</p>
                <p>联系人：{data.buyerContact || "—"}　　电话：{data.buyerPhone || "—"}</p>
                {data.buyerEmail && <p>邮箱：{data.buyerEmail}</p>}
              </div>
            </div>
            <div className="mb-5 text-[16px] text-muted-foreground">
              报价单号：{data.quoteNo || "—"}　　日期：{data.quoteDate || "—"}　　有效期：{data.validUntil || "—"}
            </div>
            <div className="mb-5 max-w-full overflow-x-auto rounded-[10px] overscroll-x-contain">
            <table className="w-full min-w-[680px] border-collapse text-[16px]">
              <thead>
                <tr>
                  <th className="border border-[#687286] p-3 text-center text-foreground">#</th>
                  <th className="border border-[#687286] p-3 text-center text-foreground">产品名称</th>
                  <th className="border border-[#687286] p-3 text-center text-foreground">规格型号</th>
                  <th className="border border-[#687286] p-3 text-center text-foreground">单位</th>
                  <th className="border border-[#687286] p-3 text-center text-foreground">数量</th>
                  <th className="border border-[#687286] p-3 text-center text-foreground">单价（元）</th>
                  <th className="border border-[#687286] p-3 text-center text-foreground">总价（元）</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, index) => (
                  <tr key={index}>
                    <td className="border border-[#687286] p-3 text-center">{item.no}</td>
                    <td className="border border-[#687286] p-3 text-center">{item.name || "—"}</td>
                    <td className="border border-[#687286] p-3 text-center">{item.spec || "—"}</td>
                    <td className="border border-[#687286] p-3 text-center">{item.unit}</td>
                    <td className="border border-[#687286] p-3 text-center">{item.quantity}</td>
                    <td className="border border-[#687286] p-3 text-center">{item.unitPrice || "—"}</td>
                    <td className="border border-[#687286] p-3 text-center">{item.total || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <div className="mb-6 space-y-1 text-right text-[16px]">
              <p>小计：{data.subtotal || "—"}</p>
              <p>税率：{data.taxRate}　　税额：{data.taxAmount || "—"}</p>
              <p className="text-[18px] font-bold text-foreground">合计总价：{data.totalAmount || "—"}</p>
              {data.totalAmountCN && <p>大写：{data.totalAmountCN}</p>}
            </div>
            <div className="space-y-1 border-t border-[#687286] py-4 text-[16px]">
              <p>交货时间：{data.deliveryTime || "—"}</p>
              <p>交货地点：{data.deliveryPlace || "—"}</p>
              <p>付款方式：{data.paymentTerms || "—"}</p>
              <p>质保期：{data.warranty || "—"}</p>
            </div>
            {data.notes && (
              <div className="border-t border-[#687286] py-4 text-[16px]">
                <p className="mb-1 font-medium text-foreground">备注：</p>
                <p>{data.notes}</p>
              </div>
            )}
            <div className="mt-8 text-[16px] leading-8">
              <p>以上报价真实有效，如有疑问请联系我们。</p>
              <p className="mt-4">卖方（盖章）：{data.sellerCompany || "—"}</p>
              <p>日期：________________</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title,icon, action, children }: { title: string; icon?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-[14px] border border-border bg-card p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-4 sm:mb-6">
        <h2 className="flex items-center gap-2 text-[18px] font-semibold text-foreground">
          {icon && <img src={icon} alt="" />}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  className = "",
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <label className={`min-w-0 ${className}`}>
      <span className="mb-2 block text-[16px] text-muted-foreground">{label}</span>
      {type === "date" ? (
        <DatePicker
          value={String(value ?? "")}
          onChange={onChange}
          placeholder={placeholder}
          className="h-[38px] border-transparent bg-input px-4 text-[16px] focus-visible:border-[#6fb1ff]"
        />
      ) : (
        <input
          type={type}
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-[38px] w-full min-w-0 rounded-[8px] border border-transparent bg-input px-4 text-[16px] text-foreground outline-none placeholder:text-muted-foreground focus:border-[#6fb1ff]"
        />
      )}
    </label>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={["flex justify-between", strong ? "text-base font-bold text-foreground" : ""].join(" ")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
