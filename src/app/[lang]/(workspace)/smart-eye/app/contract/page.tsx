"use client";

import { useState, type ReactNode } from "react";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "sonner";
import { initContractClient, ContractData } from "@/lib/document/contract-template";
import { JobStatus } from "@/app/[lang]/(workspace)/smart-eye/_components/jobs/job-status";
import { createApiResponseError } from "@/lib/api/api-error";
import { authenticatedFetch } from "@/lib/api/authenticated-fetch";
import { createDocumentJob, downloadDocumentFromJob } from "@/lib/document/document-job-client";
import { calculateContractAmounts, formatContractCurrency, parseContractTaxRate } from "@/lib/document/contract-amounts";
import Image from "next/image";

export default function ContractPage() {
  const [data, setData] = useState<ContractData>(() => initContractClient());
  const [reqText, setReqText] = useState("");
  const [lastAiRunId, setLastAiRunId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [documentJobId, setDocumentJobId] = useState<string | null>(null);
  const [documentJobPending, setDocumentJobPending] = useState(false);

  const update = (key: keyof ContractData, val: ContractData[keyof ContractData]) => {
    setData(prev => {
      const next = { ...prev, [key]: val };
      if (key === "quantity" || key === "unitPrice" || key === "taxRate") {
        return recalculateContractAmounts(next);
      }
      if (["partyB", "partyBAddress", "partyBContact", "partyBPhone", "paymentTerms", "deliveryTime", "deliveryPlace", "warranty", "penaltyClause", "disputeResolution", "clauses"].includes(key as string)) {
        localStorage.setItem("saleseye-contract-info", JSON.stringify({
          partyB: next.partyB,
          partyBAddress: next.partyBAddress,
          partyBContact: next.partyBContact,
          partyBPhone: next.partyBPhone,
          paymentTerms: next.paymentTerms,
          deliveryTime: next.deliveryTime,
          deliveryPlace: next.deliveryPlace,
          warranty: next.warranty,
          penaltyClause: next.penaltyClause,
          disputeResolution: next.disputeResolution,
          clauses: next.clauses,
        }));
      }
      return next;
    });
  };

  const handleAIFill = async () => {
    if (!reqText.trim()) return;
    setGenerating(true);
    try {
      const res = await authenticatedFetch("/api/documents/contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "fill-form", requirements: reqText }),
      });
      if (!res.ok) throw await createApiResponseError(res, "失败");
      const filled = (await res.json()) as Partial<ContractData> & { aiRunId?: string };
      const { aiRunId, ...formFields } = filled;
      if (typeof aiRunId === "string" && aiRunId.trim()) setLastAiRunId(aiRunId.trim());
      setData(prev => recalculateContractAmounts({
        ...prev,
        ...formFields,
        signDate: prev.signDate,
        taxRate: typeof formFields.taxRate === "string" && formFields.taxRate.trim()
          ? formFields.taxRate
          : prev.taxRate,
      }));
      toast.success("AI 已填充合同");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (format: "docx" | "pdf") => {
    if (parseContractTaxRate(data.taxRate) === null) {
      toast.error("请输入 0% 到 100% 之间的有效税率");
      return;
    }
    if (format === "pdf") {
      const el = document.querySelector(".contract-preview") as HTMLElement;
      if (!el) return;
      const w = window.open("", "_blank");
      if (!w) {
        toast.error("请允许弹出窗口");
        return;
      }
      w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>销售合同</title>
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
      const jobId = await createDocumentJob("/api/documents/contract", {
        data,
        aiRunId: lastAiRunId,
      });
      setDocumentJobId(jobId);
      toast.success("Word 生成任务已创建");
    } catch (e) {
      setDocumentJobPending(false);
      toast.error((e as Error).message);
    }
  };

  const handleDocumentJobDone = async (job: unknown) => {
    setDocumentJobPending(false);
    try {
      await downloadDocumentFromJob(job);
      toast.success("Word 下载完成");
      setDocumentJobId(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="flex min-h-[calc(100dvh-64px)] w-full min-w-0 max-w-full flex-col overflow-x-clip px-4 pb-24 pt-24 text-[#E8EDF7] sm:px-6 lg:px-8 lg:pb-10 lg:pt-[112px] xl:h-[calc(100dvh-64px)] xl:overflow-hidden">
      <div className="mb-6 flex shrink-0 flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between lg:mb-9">
        <h1 className="text-[28px] font-bold leading-tight text-white sm:text-[36px]">合同制作</h1>
        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => handleDownload("pdf")}
            className="h-[34px] whitespace-nowrap rounded-[10px] border border-[#202837] bg-[#141922] px-5 text-sm text-[#D8DEEA] transition hover:border-[#35547D]"
          >
            下载PDF
          </button>
          <button
            type="button"
            onClick={() => handleDownload("docx")}
            disabled={documentJobPending}
            className="btn-bg h-[34px] whitespace-nowrap rounded-[10px] px-5 text-sm font-semibold text-[#0A0613] disabled:cursor-not-allowed disabled:opacity-60"
          >
            下载 Word
          </button>
        </div>
      </div>

      {documentJobId && (
        <div className="mb-4 shrink-0 rounded-[12px] border border-[#202837] bg-[#141922] p-4">
          <JobStatus jobId={documentJobId} onDone={handleDocumentJobDone} />
        </div>
      )}

      <div className="grid min-w-0 grid-cols-1 gap-6 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,614px)_minmax(0,1fr)] xl:gap-9 xl:overflow-hidden">
        <div className="min-w-0 xl:min-h-0 xl:overflow-x-hidden xl:overflow-y-auto xl:pr-4">
          <div className="space-y-4 pb-8">
            <Section title="AI辅助填充" icon="/img/star.png">
              <Textarea
                value={reqText}
                onChange={(event) => setReqText(event.target.value)}
                placeholder="粘贴合同要点，AI自动填充……"
                rows={3}
                className="min-h-[92px] resize-none rounded-[8px] border-0 bg-[#070B14] px-4 py-4 text-[18px] leading-7 text-slate-100 placeholder:text-[#8D96A7] focus-visible:ring-[#6FB1FF]/40"
                disabled={generating}
              />
              <button
                type="button"
                onClick={handleAIFill}
                disabled={!reqText.trim() || generating}
                className="mx-auto mt-5 flex h-10 items-center gap-2 rounded-[8px] px-5 text-[16px] text-[#A4ADBD] transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Image src="/img/star_g.png" alt="ai" width={20} height={20} />
                {generating ? "AI 分析中..." : "AI 自动填充表单"}
              </button>
            </Section>

            <Section title="合同双方">
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                <Field className="sm:col-span-2" label="甲方（买方）" value={data.partyA} onChange={(v) => update("partyA", v)} placeholder="客户公司全称" />
                <Field label="甲方联系人" value={data.partyAContact} onChange={(v) => update("partyAContact", v)} />
                <Field label="甲方电话" value={data.partyAPhone} onChange={(v) => update("partyAPhone", v)} />
                <Field className="sm:col-span-2" label="甲方地址" value={data.partyAAddress} onChange={(v) => update("partyAAddress", v)} />
                <div className="sm:col-span-2 border-t border-[#687286]" />
                <Field className="sm:col-span-2" label="乙方公司" value={data.partyB} onChange={(v) => update("partyB", v)} placeholder="你的公司全称" />
                <Field label="乙方联系人" value={data.partyBContact} onChange={(v) => update("partyBContact", v)} />
                <Field label="乙方电话" value={data.partyBPhone} onChange={(v) => update("partyBPhone", v)} />
                <Field className="sm:col-span-2" label="乙方地址" value={data.partyBAddress} onChange={(v) => update("partyBAddress", v)} />
              </div>
            </Section>

            <Section title="合同信息">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="合同编号" value={data.contractNo} onChange={(v) => update("contractNo", v)} placeholder="HT-2026-001" />
                <Field label="签订日期" value={data.signDate} onChange={(v) => update("signDate", v)} type="date" />
                <Field label="签订地点" value={data.signPlace} onChange={(v) => update("signPlace", v)} />
              </div>
            </Section>

            <Section title="产品与金额">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field className="sm:col-span-2" label="产品名称" value={data.productName} onChange={(v) => update("productName", v)} />
                <Field label="规格型号" value={data.productSpec} onChange={(v) => update("productSpec", v)} />
                <Field label="数量" value={data.quantity} onChange={(v) => update("quantity", Number(v))} type="number" />
                <Field label="未税单价" value={data.unitPrice} onChange={(v) => update("unitPrice", v)} placeholder="¥285,000/台" />
                <Field label="税率" value={data.taxRate} onChange={(v) => update("taxRate", v)} placeholder="13%" />
                <Field label="未税金额" value={data.subtotal} onChange={() => {}} readOnly placeholder="自动计算" />
                <Field label="税额" value={data.taxAmount} onChange={() => {}} readOnly placeholder="自动计算" />
                <Field className="sm:col-span-2" label="含税总金额" value={data.totalAmount} onChange={() => {}} readOnly placeholder="自动计算" />
                <Field className="sm:col-span-2" label="金额大写" value={data.totalAmountCN} onChange={() => {}} readOnly placeholder="自动生成" />
              </div>
            </Section>

            <Section title="合同条款">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="交货时间" value={data.deliveryTime} onChange={(v) => update("deliveryTime", v)} />
                <Field label="交货地点" value={data.deliveryPlace} onChange={(v) => update("deliveryPlace", v)} />
                <Field className="sm:col-span-2" label="付款方式" value={data.paymentTerms} onChange={(v) => update("paymentTerms", v)} />
                <Field label="质保期" value={data.warranty} onChange={(v) => update("warranty", v)} />
                <Field className="sm:col-span-2" label="违约责任" value={data.penaltyClause} onChange={(v) => update("penaltyClause", v)} />
                <Field className="sm:col-span-2" label="争议解决" value={data.disputeResolution} onChange={(v) => update("disputeResolution", v)} />
              </div>
            </Section>

            <Section title="常规条款">
              <Textarea
                value={data.clauses}
                onChange={(event) => update("clauses", event.target.value)}
                rows={5}
                className="resize-y rounded-[8px] border border-transparent bg-[#070B14] px-4 py-3 text-[16px] leading-7 text-slate-100 focus-visible:ring-[#6FB1FF]/40"
              />
            </Section>

            <Section title="备注">
              <Field label="" value={data.remarks} onChange={(v) => update("remarks", v)} placeholder="补充说明" />
            </Section>
          </div>
        </div>

        <div className="min-w-0 xl:min-h-0 xl:overflow-x-hidden xl:overflow-y-auto xl:pl-8">
          <div className="contract-preview rounded-[14px] border border-[#202837] bg-[#141922] px-6 py-8 text-[#A4ADBD]">
            <h2 className="mb-7 text-center text-[30px] font-bold text-white">销售合同</h2>
            <p className="mb-6 text-[16px] text-[#687286]">
              编号：{data.contractNo || "—"} | 日期：{data.signDate || "—"} | 地点：{data.signPlace || "—"}
            </p>

            <div className="space-y-5 text-[16px] leading-7">
              <ArticleTitle>一、合同双方</ArticleTitle>
              <div>
                <p>甲方（买方）：{data.partyA || "—"}</p>
                <p>地址：{data.partyAAddress || "—"} | 联系人：{data.partyAContact || "—"} | 电话：{data.partyAPhone || "—"}</p>
                <p className="mt-1">乙方（卖方）：{data.partyB || "—"}</p>
                <p>地址：{data.partyBAddress || "—"} | 联系人：{data.partyBContact || "—"} | 电话：{data.partyBPhone || "—"}</p>
              </div>

              <ArticleTitle>二、产品信息</ArticleTitle>
              <div className="max-w-full overflow-x-auto rounded-[10px] overscroll-x-contain">
              <table className="w-full min-w-[620px] border-collapse text-[16px]">
                <thead>
                  <tr>
                    <th className="border border-[#687286] p-3 text-center text-white">#</th>
                    <th className="border border-[#687286] p-3 text-center text-white">产品名称</th>
                    <th className="border border-[#687286] p-3 text-center text-white">规格型号</th>
                    <th className="border border-[#687286] p-3 text-center text-white">数量</th>
                    <th className="border border-[#687286] p-3 text-center text-white">未税单价（元）</th>
                    <th className="border border-[#687286] p-3 text-center text-white">含税总价（元）</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-[#687286] p-3 text-center">1</td>
                    <td className="border border-[#687286] p-3 text-center">{data.productName || "—"}</td>
                    <td className="border border-[#687286] p-3 text-center">{data.productSpec || "—"}</td>
                    <td className="border border-[#687286] p-3 text-center">{data.quantity}</td>
                    <td className="border border-[#687286] p-3 text-center">{data.unitPrice || "—"}</td>
                    <td className="border border-[#687286] p-3 text-center">{data.totalAmount || "—"}</td>
                  </tr>
                </tbody>
              </table>
              </div>
              <div className="space-y-1 text-right">
                <p>未税金额：{data.subtotal || "—"}</p>
                <p>税率：{data.taxRate || "—"}　税额：{data.taxAmount || "—"}</p>
                <p className="text-[18px] font-bold text-white">合同含税总金额：{data.totalAmount || "—"}</p>
                <p>大写：{data.totalAmountCN || "—"}</p>
              </div>

              <ArticleTitle>三、交货条款</ArticleTitle>
              <p>交货时间：{data.deliveryTime || "—"} | 交货地点：{data.deliveryPlace || "—"}</p>

              <ArticleTitle>四、付款方式</ArticleTitle>
              <p>{data.paymentTerms || "—"}</p>

              <ArticleTitle>五、质量保证</ArticleTitle>
              <p>质保期：{data.warranty || "—"}</p>

              <ArticleTitle>六、违约责任</ArticleTitle>
              <p>{data.penaltyClause || "—"}</p>

              <ArticleTitle>七、争议解决</ArticleTitle>
              <p>{data.disputeResolution || "—"}</p>

              <ArticleTitle>八、其他条款</ArticleTitle>
              <div>
                {data.clauses.split("\n").filter((line) => line.trim()).map((clause, index) => (
                  <p key={`${clause}-${index}`}>{clause}</p>
                ))}
              </div>
              {data.remarks && <p className="text-[#687286]">备注：{data.remarks}</p>}

              <div className="mt-10 grid grid-cols-1 gap-6 border-t border-[#687286] pt-5 sm:grid-cols-2 sm:gap-8">
                <div><p>甲方（盖章）：________________</p><p className="mt-1 text-[#687286]">日期：________________</p></div>
                <div><p>乙方（盖章）：________________</p><p className="mt-1 text-[#687286]">日期：________________</p></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-[14px] border border-[#202837] bg-[#141922] p-4 sm:p-6">
      <h2 className="mb-5 flex items-center gap-2 text-[18px] font-semibold text-white sm:mb-7 sm:text-[20px]">
        {icon && <Image src={icon} alt="sparkle" width={20} height={20} />}
        {title}
      </h2>
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
  readOnly = false,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
  readOnly?: boolean;
}) {
  return (
    <label className={`min-w-0 ${className}`}>
      {label && <span className="mb-2 block text-[16px] text-[#687286]">{label}</span>}
      {type === "date" ? (
        <DatePicker
          value={String(value ?? "")}
          onChange={onChange}
          placeholder={placeholder}
          disabled={readOnly}
          className="h-[42px] border-transparent bg-[#070B14] px-4 text-[17px] focus-visible:border-[#6FB1FF]"
        />
      ) : (
        <input
          type={type}
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          className="h-[42px] w-full min-w-0 rounded-[8px] border border-transparent bg-[#070B14] px-4 text-[17px] text-slate-100 outline-none placeholder:text-[#687286] focus:border-[#6FB1FF] read-only:cursor-default read-only:text-[#A4ADBD]"
        />
      )}
    </label>
  );
}

function ArticleTitle({ children }: { children: ReactNode }) {
  return <p className="font-bold text-white">{children}</p>;
}

function numberToChinese(n: number): string {
  if (!n || n === 0) return "";
  const digits = "零壹贰叁肆伍陆柒捌玖";
  const units = ["", "拾", "佰", "仟", "万", "拾", "佰", "仟", "亿"];
  const intPart = Math.floor(n), decPart = Math.round((n - intPart) * 100);
  let result = "";
  const intStr = String(intPart);
  if (intStr === "0") result = "零";
  else {
    for (let i = 0; i < intStr.length; i++) {
      const d = parseInt(intStr[i]), u = units[intStr.length - 1 - i];
      if (d !== 0) result += digits[d] + u;
      else if (i < intStr.length - 1 && intStr[i + 1] !== "0") result += "零";
    }
    result = result.replace(/零$/, "").replace(/零万/, "万").replace(/零亿/, "亿");
  }
  result += "元";
  if (decPart > 0) {
    const j = Math.floor(decPart / 10), f = decPart % 10;
    if (j > 0) result += digits[j] + "角";
    if (f > 0) result += digits[f] + "分";
  } else {
    result += "整";
  }
  return result;
}

function recalculateContractAmounts(data: ContractData): ContractData {
  const amounts = calculateContractAmounts(data);
  return {
    ...data,
    subtotal: formatContractCurrency(amounts.subtotal),
    taxAmount: formatContractCurrency(amounts.taxAmount),
    totalAmount: formatContractCurrency(amounts.totalAmount),
    totalAmountCN: numberToChinese(amounts.totalAmount),
  };
}
