"use client";

import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useApi } from "@/lib/hooks/use-api";
import { createApiResponseError } from "@/lib/api/api-error";
import { authenticatedFetch } from "@/lib/api/authenticated-fetch";
import { productsApi } from "@/lib/api/client";
import {
  CHINA_MAINLAND_PROVINCES,
  getProductTargetIndustries,
} from "@/lib/ai/deep-research-filters";
import { JobStatus } from "@/app/[lang]/(workspace)/smart-eye/_components/jobs/job-status";
import Image from "next/image";
const gradient = "linear-gradient(135deg, #6FB1FF 14.64%, #8E8DFF 51.41%, #B07DFF 85.36%)";
const selectBackground = "linear-gradient(#141922, #141922) padding-box, linear-gradient(135deg, #6FB1FF 14.64%, #8E8DFF 51.41%, #B07DFF 85.36%) border-box";

interface ProductOption {
  id: string;
  name?: string;
  category?: string;
  priceRange?: string;
  targetIndustries?: unknown;
}

interface DecisionChainItem {
  step?: string;
  influence?: number;
  typicalRole?: string;
  notes?: string;
}

interface KeyContactItem {
  role?: string;
  department?: string;
  influence?: number;
  howToFind?: string;
  approachTips?: string;
}

interface TargetAccountItem {
  companyName?: string;
  industry?: string;
  province?: string;
  location?: string;
  matchScore?: number;
  whyTarget?: string;
  decisionChain?: DecisionChainItem[];
  keyContacts?: KeyContactItem[];
}

interface IndustryBreakdownItem {
  industry?: string;
  demandDrivers?: string;
  estimatedMarket?: string;
}

interface OutreachChannelItem {
  channel?: string;
  effectiveness?: string;
  tips?: string;
}

interface DeepResearchReport {
  targetAccounts?: TargetAccountItem[];
  marketAnalysis?: {
    industryBreakdown?: IndustryBreakdownItem[];
    companySizeRange?: string;
    buyingCycle?: string;
    budgetRange?: string;
    geographicHotspots?: string[];
  };
  outreachStrategy?: {
    channels?: OutreachChannelItem[];
    keyConferences?: string[];
    keyPlatforms?: string[];
    competitorIntel?: string;
  };
  actionPlan?: {
    week1?: string[];
    week2_4?: string[];
    month2_3?: string[];
    kpis?: string[];
  };
}

interface DeepResearchResponse {
  report?: DeepResearchReport | null;
  reportId?: string | null;
  productId?: string | null;
  jobId?: string;
  error?: string;
  accountsCreated?: number;
  duplicatesSkipped?: number;
  accountIds?: string[];
}

type TabKey = "accounts" | "market" | "outreach" | "plan";

const tabs: { key: TabKey; label: string }[] = [
  { key: "accounts", label: "目标客户" },
  { key: "market", label: "市场分析" },
  { key: "outreach", label: "触达策略" },
  { key: "plan", label: "执行计划" },
];

export default function DeepResearchPage() {
  const [productId, setProductId] = useState("");
  const [industry, setIndustry] = useState("");
  const [province, setProvince] = useState("");
  const [enqueueing, setEnqueueing] = useState(false);
  const [researchJobId, setResearchJobId] = useState<string | null>(null);
  const [researchReportId, setResearchReportId] = useState<string | null>(null);
  const [researchJobProductId, setResearchJobProductId] = useState<string | null>(null);
  const [researchPending, setResearchPending] = useState(false);
  const [report, setReport] = useState<DeepResearchReport | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("accounts");
  const { data: products } = useApi(() => productsApi.list());
  const productList = (Array.isArray(products) ? products : []) as ProductOption[];
  const selectedProduct = productList.find((product) => product.id === productId);
  const industryOptions = getProductTargetIndustries(selectedProduct?.targetIndustries);

  const loadLatestReport = async (pid?: string) => {
    const url = pid
      ? `/api/ai/deep-research?productId=${encodeURIComponent(pid)}`
      : "/api/ai/deep-research";
    const r = await authenticatedFetch(url);
    if (!r.ok) throw await createApiResponseError(r, `HTTP ${r.status}`);
    const d = (await r.json()) as DeepResearchResponse;
    if (d.report) {
      setReport(d.report);
      setResearchReportId(d.reportId || null);
    }
    return d;
  };

  useEffect(() => {
    queueMicrotask(() => {
      void loadLatestReport()
        .then((d) => {
          if (d.report?.targetAccounts?.[0]) setProductId("");
        })
        .catch(() => {});
    });
  }, []);

  const handleResearch = async () => {
    if (!productId) return;
    setEnqueueing(true);
    setReport(null);
    setSelected(new Set());
    setResearchJobId(null);
    setResearchReportId(null);
    setResearchJobProductId(productId);
    try {
      const res = await authenticatedFetch("/api/ai/deep-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          industry: industry || undefined,
          province: province || undefined,
        }),
      });
      if (!res.ok) throw await createApiResponseError(res, "提交失败");
      const data = (await res.json()) as DeepResearchResponse;
      if (!data.jobId) throw new Error("分析任务未创建");
      setResearchJobId(data.jobId);
      setResearchPending(true);
      toast.info("深度分析任务已提交，正在后台执行");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "提交失败");
    } finally {
      setEnqueueing(false);
    }
  };

  const handleResearchDone = async (job: unknown) => {
    const j = job as {
      status?: string;
      errorMessage?: string | null;
      resultJson?: { report?: DeepResearchReport } | null;
    };
    setResearchPending(false);
    if (j.status === "succeeded") {
      try {
        if (j.resultJson?.report) {
          setReport(j.resultJson.report);
        } else {
          await loadLatestReport(researchJobProductId || productId);
        }
        toast.success("分析完成！请选择要添加的客户");
      } catch {
        toast.error("报告加载失败");
      }
    } else if (j.status === "failed") {
      toast.error(j.errorMessage || "深度分析失败");
    }
  };

  const handleAddSelected = async () => {
    if (selected.size === 0) {
      toast.error("请选择至少一个客户");
      return;
    }
    setAdding(true);
    try {
      const res = await authenticatedFetch("/api/ai/deep-research", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: researchJobId || undefined,
          reportId: researchJobId ? undefined : researchReportId || undefined,
          selectedIndexes: Array.from(selected),
        }),
      });
      if (!res.ok) throw await createApiResponseError(res, "发送失败");
      const data = (await res.json()) as DeepResearchResponse;
      const created = data.accountsCreated ?? 0;
      const skipped = data.duplicatesSkipped ?? 0;
      toast.success(`已添加 ${created} 个目标客户${skipped > 0 ? `，跳过 ${skipped} 个重复客户` : ""}`);
      setSelected(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "发送失败");
    }
    setAdding(false);
  };

  const targetAccounts = report?.targetAccounts ?? [];
  const allSelected = targetAccounts.length > 0 && selected.size === targetAccounts.length;

  const toggleSelected = (index: number) => {
    const next = new Set(selected);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setSelected(next);
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(targetAccounts.map((_, index) => index)));
  };

  return (
    <div className="w-full min-w-0 max-w-[1665px] px-4 pb-24 pt-24 text-[#E8EDF7] sm:px-6 lg:px-8 lg:pb-10 lg:pt-[112px]">
      <div className="mb-9">
        <h1 className="text-[28px] font-bold leading-tight text-white sm:text-[32px]">深度销售情报</h1>
        <p className="mt-2 text-base leading-7 text-[#A4ADBD] sm:text-[20px] sm:leading-8">
          选择产品 ➡ AI分析市场、定位客户、还原决策链、给出触达路径
        </p>
      </div>

      <section className="mb-9 min-w-0 rounded-[14px] border border-[#202837] bg-[#141922] px-4 py-6 shadow-[0_0_0_1px_rgba(255,255,255,0.01)_inset] sm:px-8 sm:py-10 xl:px-[70px] xl:py-[56px]">
        <div className="flex flex-wrap items-end gap-6">
          <div className="w-full min-w-0 flex-[2_1_500px] sm:min-w-[320px] sm:max-w-[800px]">
            <label className="mb-3 block text-[18px] font-semibold text-white sm:text-[24px]">选择产品</label>
            <div
              className="relative  h-[60px] rounded-[9px] border border-transparent"
              style={{
                background: selectBackground,
              }}
            >
              <select
                className="h-full w-full min-w-0 appearance-none rounded-[9px] bg-transparent px-4 pr-12 text-base text-slate-100 outline-none disabled:cursor-not-allowed disabled:opacity-60 sm:px-5 sm:pr-14 sm:text-[22px]"
                value={productId}
                onChange={(event) => {
                  setProductId(event.target.value);
                  setIndustry("");
                }}
                disabled={enqueueing || researchPending}
              >
                <option className="bg-[#141922] text-[#8D96A7]" value="">选择一个产品...</option>
                {productList.filter((p) => p && p.id && p.name).map((p) => (
                  <option className="bg-[#141922] text-slate-100" key={String(p.id)} value={String(p.id)}>
                    {String(p.name)}{p.category ? ` (${String(p.category)})` : ""}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-5 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border-b-2 border-r-2 border-[#A4ADBD]" />
            </div>
          </div>

          <div className="w-full min-w-0 flex-1 sm:min-w-[200px] sm:max-w-[260px]">
            <label className="mb-3 block text-[18px] font-semibold text-white sm:text-[20px]">目标行业（可选）</label>
            <div
              className="relative h-[60px] rounded-[9px] border border-transparent"
              style={{ background: selectBackground }}
            >
              <select
                className="h-full w-full appearance-none rounded-[9px] bg-transparent px-5 pr-12 text-[18px] text-slate-100 outline-none disabled:cursor-not-allowed disabled:opacity-60"
                value={industry}
                onChange={(event) => setIndustry(event.target.value)}
                disabled={enqueueing || researchPending || !productId || industryOptions.length === 0}
              >
                <option className="bg-[#141922] text-[#8D96A7]" value="">
                  {productId && industryOptions.length === 0 ? "未配置目标行业" : "不限行业"}
                </option>
                {industryOptions.map((option) => (
                  <option className="bg-[#141922] text-slate-100" key={option} value={option}>{option}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-5 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border-b-2 border-r-2 border-[#A4ADBD]" />
            </div>
          </div>

          <div className="w-full min-w-0 flex-1 sm:min-w-[200px] sm:max-w-[260px]">
            <label className="mb-3 block text-[18px] font-semibold text-white sm:text-[20px]">目标省份（可选）</label>
            <div
              className="relative h-[60px] rounded-[9px] border border-transparent"
              style={{ background: selectBackground }}
            >
              <select
                className="h-full w-full appearance-none rounded-[9px] bg-transparent px-5 pr-12 text-[18px] text-slate-100 outline-none disabled:cursor-not-allowed disabled:opacity-60"
                value={province}
                onChange={(event) => setProvince(event.target.value)}
                disabled={enqueueing || researchPending}
              >
                <option className="bg-[#141922] text-[#8D96A7]" value="">不限省份</option>
                {CHINA_MAINLAND_PROVINCES.map((option) => (
                  <option className="bg-[#141922] text-slate-100" key={option} value={option}>{option}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-5 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border-b-2 border-r-2 border-[#A4ADBD]" />
            </div>
          </div>

          <button
            type="button"
            onClick={handleResearch}
            disabled={enqueueing || researchPending || !productId}
            className="btn-bg h-[52px] w-full min-w-0 rounded-[9px] px-4 text-lg font-semibold text-[#07111F] shadow-[0_0_26px_rgba(111,177,255,0.24)] transition disabled:cursor-not-allowed disabled:opacity-50 sm:h-[60px] sm:w-auto sm:min-w-[219px] sm:px-9 sm:text-[22px]"
          >
            {enqueueing || researchPending ? "分析中..." : "开始深度分析"}
          </button>

          <div className="ml-auto hidden min-w-[132px] justify-center lg:flex">
            <Image src="/img/deepstar.png" alt="start" width={72} height={72} />
          </div>
        </div>

        {(enqueueing || researchJobId) && (
          <div className="mt-6 rounded-[10px] border border-[#202837] bg-[#080D16] p-4 text-sm text-[#A4ADBD]">
            {enqueueing && !researchJobId ? (
              <span>提交任务中...</span>
            ) : researchJobId ? (
              <JobStatus jobId={researchJobId} onDone={handleResearchDone} />
            ) : null}
          </div>
        )}
      </section>

      {report && (
        <>
          <div className="mb-9 w-full max-w-[757px] rounded-[9px] border border-[#1D2533] bg-[#060A11] p-1">
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={[
                      "h-[42px] rounded-[8px] px-2 text-base font-semibold transition sm:text-[20px]",
                      isActive
                        ? "text-white shadow-[0_0_18px_rgba(111,177,255,0.46)]"
                        : "text-[#687286] hover:text-slate-200",
                    ].join(" ")}
                    style={isActive ? { background: gradient } : undefined}
                  >
                    {tab.label}{tab.key === "accounts" ? `（${targetAccounts.length}）` : ""}
                  </button>
                );
              })}
            </div>
          </div>

          {activeTab === "accounts" && (
            <section>
              {targetAccounts.length > 0 && (
                <div className="mb-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="h-9 rounded-[9px] border border-[#202837] bg-[#141922] px-5 text-base text-[#D8DEEA] transition hover:border-[#35547D]"
                  >
                    {allSelected ? "取消全选" : "全选"}
                  </button>
                  <button
                    type="button"
                    onClick={handleAddSelected}
                    disabled={adding || selected.size === 0}
                    className="btn-bg h-9 rounded-[9px] px-5 text-base font-semibold text-[#07111F] shadow-[0_0_18px_rgba(176,125,255,0.22)] transition disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {adding ? "添加中..." : `添加选中客户（${selected.size}）`}
                  </button>
                </div>
              )}

              {targetAccounts.length === 0 ? (
                <div className="rounded-[14px] border border-[#202837] bg-[#141922] px-8 py-14 text-center text-[18px] text-[#A4ADBD]">
                  未找到满足当前行业和省份条件的客户
                </div>
              ) : (
                <div className="space-y-5">
                  {targetAccounts.map((account, index) => (
                    <TargetAccountCard
                      key={`${account.companyName ?? "account"}-${index}`}
                      account={account}
                      selected={selected.has(index)}
                      onToggle={() => toggleSelected(index)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === "market" && <MarketPanel report={report} />}
          {activeTab === "outreach" && <OutreachPanel report={report} />}
          {activeTab === "plan" && <ActionPlanPanel report={report} />}
        </>
      )}
    </div>
  );
}

function TargetAccountCard({
  account,
  selected,
  onToggle,
}: {
  account: TargetAccountItem;
  selected: boolean;
  onToggle: () => void;
}) {
  const decisionChain = account.decisionChain ?? [];
  const matchScore = typeof account.matchScore === "number" ? account.matchScore : 0;
  const locationLabel = [account.province, account.location].filter(Boolean).join(" · ") || "-";

  return (
    <article className="rounded-[14px] border border-[#202837] bg-[#141922] px-[70px] py-8">
      <div className="mb-5 flex items-start gap-4">
        <button
          type="button"
          onClick={onToggle}
          className="mt-2 shrink-0"
          aria-pressed={selected}
          aria-label={selected ? "取消选择客户" : "选择客户"}
        >
          <GradientCheckbox checked={selected} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h2 className="text-[26px] font-bold leading-tight text-white">{account.companyName || "-"}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Tag>{account.industry || "-"}</Tag>
            <Tag>{locationLabel}</Tag>
            <span className="rounded-[6px] border border-[#5FC597] bg-[#235D46] px-4 py-1 text-[16px] text-[#62D59A]">
              匹配{matchScore}分
            </span>
          </div>
        </div>
      </div>

      <div className="mb-7 rounded-[8px] bg-[#203454] px-5 py-3 text-[18px] leading-7 text-[#5AA0FF]">
        为什么是目标：{account.whyTarget || "-"}
      </div>

      <h3 className="mb-4 text-[22px] font-medium text-[#C7CFDA]">决策链</h3>
      <div className="grid gap-3 xl:grid-cols-2">
        {(decisionChain.length > 0 ? decisionChain : [{ step: "-", typicalRole: "-", influence: 0, notes: "-" }]).map((item, itemIndex) => (
          <div key={`${item.step ?? "decision"}-${itemIndex}`} className="rounded-[8px] bg-[#060A11] px-7 py-5">
            <div className="mb-1 flex items-start justify-between gap-4">
              <div>
                <p className="text-[22px] font-semibold text-white">{item.step || "-"}</p>
                <p className="mt-1 text-[20px] text-[#C7CFDA]">{item.typicalRole || "-"}</p>
              </div>
              <div className="shrink-0 pt-1 text-[16px] text-[#D7DCE6] flex ">
                <span>影响力</span>
                <InfluenceStars value={item.influence ?? 0} />
              </div>
            </div>
            <p className="text-[16px] leading-6 text-[#687286]">{item.notes || "-"}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function MarketPanel({ report }: { report: DeepResearchReport }) {
  const analysis = report.marketAnalysis;
  return (
    <section className="grid gap-5 xl:grid-cols-2">
      <Panel title="目标行业">
        <div className="space-y-3">
          {(analysis?.industryBreakdown ?? []).map((item, index) => (
            <div key={`${item.industry ?? "industry"}-${index}`} className="rounded-[8px] bg-[#060A11] p-5">
              <div className="mb-2 flex items-center justify-between gap-4">
                <p className="text-[20px] font-semibold text-white">{item.industry || "-"}</p>
                <Tag>{item.estimatedMarket || "-"}</Tag>
              </div>
              <p className="text-[16px] leading-7 text-[#A4ADBD]">{item.demandDrivers || "-"}</p>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="市场概览">
        <div className="space-y-4 text-[18px]">
          <InfoRow label="公司规模" value={analysis?.companySizeRange} />
          <InfoRow label="采购周期" value={analysis?.buyingCycle} />
          <InfoRow label="预算范围" value={analysis?.budgetRange} />
          <div>
            <p className="mb-2 text-[#687286]">热门地区</p>
            <div className="flex flex-wrap gap-2">
              {(analysis?.geographicHotspots ?? []).map((item) => <Tag key={item}>{item}</Tag>)}
            </div>
          </div>
        </div>
      </Panel>
    </section>
  );
}

function OutreachPanel({ report }: { report: DeepResearchReport }) {
  const strategy = report.outreachStrategy;
  return (
    <section className="grid gap-5 xl:grid-cols-2">
      <Panel title="触达渠道">
        <div className="space-y-3">
          {(strategy?.channels ?? []).map((item, index) => (
            <div key={`${item.channel ?? "channel"}-${index}`} className="rounded-[8px] bg-[#060A11] p-5">
              <div className="mb-2 flex items-center justify-between gap-4">
                <p className="text-[20px] font-semibold text-white">{item.channel || "-"}</p>
                <Tag>{item.effectiveness || "-"}</Tag>
              </div>
              <p className="text-[16px] leading-7 text-[#A4ADBD]">{item.tips || "-"}</p>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="关键触点">
        <div className="space-y-5 text-[18px] text-[#C7CFDA]">
          <div>
            <p className="mb-2 text-[#687286]">关键展会</p>
            <div className="flex flex-wrap gap-2">
              {(strategy?.keyConferences ?? []).map((item) => <Tag key={item}>{item}</Tag>)}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[#687286]">推荐平台</p>
            <p>{strategy?.keyPlatforms?.join("、") || "-"}</p>
          </div>
          <div>
            <p className="mb-2 text-[#687286]">竞争情报</p>
            <p className="leading-7">{strategy?.competitorIntel || "-"}</p>
          </div>
        </div>
      </Panel>
    </section>
  );
}

function ActionPlanPanel({ report }: { report: DeepResearchReport }) {
  const phases = [
    { title: "第一周", data: report.actionPlan?.week1 },
    { title: "第2-4周", data: report.actionPlan?.week2_4 },
    { title: "第2-3个月", data: report.actionPlan?.month2_3 },
  ].filter((item) => item.data?.length);

  return (
    <section className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-3">
        {phases.map((phase) => (
          <Panel key={phase.title} title={phase.title}>
            <ul className="space-y-3 text-[17px] leading-7 text-[#C7CFDA]">
              {phase.data?.map((item, index) => (
                <li key={`${item}-${index}`} className="flex gap-3">
                  <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[#6FB1FF]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
      <Panel title="核心指标">
        <div className="flex flex-wrap gap-3">
          {(report.actionPlan?.kpis ?? []).map((item) => <Tag key={item}>{item}</Tag>)}
        </div>
      </Panel>
    </section>
  );
}

function GradientCheckbox({ checked }: { checked: boolean }) {
  return (
    <span
      className="relative block h-[34px] w-[34px] bg-transparent"
      style={{
        border: "2px solid",
        borderImageSource: gradient,
        borderImageSlice: 1,
      }}
    >
      {checked && (
        <span
          className="absolute left-[7px] top-[8px] block h-[10px] w-[18px] -rotate-45"
          style={{
            borderStyle: "solid",
            borderWidth: "0 0 2px 2px",
            borderImageSource: gradient,
            borderImageSlice: 1,
          }}
        />
      )}
    </span>
  );
}


function InfluenceStars({ value }: { value: number }) {
  const count = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span className="ml-1 whitespace-nowrap text-[#F7C55B] flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, index) => (
        <span key={index} className={index < count ? "" : "opacity-25"}>
          <Image src="/img/rating.png" alt="star" width={16} height={16} />
        </span>
      ))}
    </span>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[14px] border border-[#202837] bg-[#141922] p-7">
      <h2 className="mb-5 text-[24px] font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[5px] border border-[#2B5E9D] bg-[#060A11] px-4 py-1 text-[16px] leading-6 text-[#D8DEEA]">
      {children}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-[#202837] pb-3">
      <span className="text-[#687286]">{label}</span>
      <span className="text-right text-[#D8DEEA]">{value || "-"}</span>
    </div>
  );
}
