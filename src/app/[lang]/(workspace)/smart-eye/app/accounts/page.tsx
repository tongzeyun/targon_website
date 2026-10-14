"use client";

import { useUiText } from "@/app/[lang]/(workspace)/smart-eye/_hooks/use-ui-text";
import pageStyles from "@/app/[lang]/(workspace)/smart-eye/_styles/pages.module.css";

import { useLocale } from "@/app/[lang]/(workspace)/smart-eye/_hooks/use-locale";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/app/[lang]/(workspace)/smart-eye/_components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/app/[lang]/(workspace)/smart-eye/_components/ui/dialog";
import { Input } from "@/app/[lang]/(workspace)/smart-eye/_components/ui/input";
import { Label } from "@/app/[lang]/(workspace)/smart-eye/_components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/[lang]/(workspace)/smart-eye/_components/ui/popover";
import { JobStatus } from "@/app/[lang]/(workspace)/smart-eye/_components/jobs/job-status";
import { useApi } from "@/app/[lang]/(workspace)/smart-eye/_hooks/use-api";
import { accountsApi, aiApi, productsApi, strategyCardsApi } from "@/lib/api/client";
import { toast } from "sonner";
function ColFilter({
  label,
  value,
  options,
  onSelect,
  translateOptions = false,
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  translateOptions?: boolean;
}) {
  const uiText = useUiText();
  return (
    <Popover>
      <PopoverTrigger>
        <span className="inline-flex items-center gap-2 text-[17px] font-medium text-[#52637a] transition hover:text-foreground">
          <span>{label}</span>
          {value !== "all" ? <span className="rounded bg-[#5b9bff]/15 px-1.5 text-[10px] text-[#5b9bff]">1</span> : null}
          <ChevronGlyph />
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-44 border-border bg-card p-1 text-foreground" align="start">
        {options.slice(0, 20).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onSelect(option)}
            className={`block w-full rounded px-3 py-2 text-left text-sm transition hover:bg-input ${option === value || (option === "全部" && value === "all") ? "bg-accent text-foreground" : ""}`}
          >
            {option === "全部" || translateOptions ? uiText(option) : option.length > 14 ? `${option.slice(0, 14)}...` : option}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

interface AccountListItem {
  id: string;
  companyName?: string;
  industry?: string;
  subIndustry?: string;
  size?: string;
  locations?: unknown;
  status?: string;
  matchScore?: number;
  createdAt?: string;
}

interface ProductListItem {
  id: string;
  name: string;
}

interface StrategyCardListItem {
  accountId?: string;
  account_id?: string;
  productId?: string;
  product_id?: string;
}

interface LocationLike {
  city?: string;
  province?: string;
}

interface BatchMatchJob {
  productId: string;
  productName: string;
  jobId: string | null;
  done: boolean;
  status?: string;
  matches?: number;
  errorMessage?: string | null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function ChevronGlyph() {
  return <span className="size-2 rotate-45 border-b border-r border-current" />;
}

function scoreClass(score?: number) {
  if (score == null) return "border-border bg-input text-[#52637a]";
  if (score >= 90) return "border-[#4baf7a] bg-[#66d49e]/15 text-emerald-700";
  if (score >= 80) return "border-[#3b6ea8] bg-[#5b9bff]/15 text-[#5b9bff]";
  return "border-[#b88737] bg-[#f6be5b]/15 text-amber-700";
}

function statusLabel(status?: string) {
  if (status === "active") return "跟进中";
  if (status === "competitor") return "竞品";
  if (status === "inactive") return "待激活";
  return status || "-";
}

function statusClass(status?: string) {
  if (status === "competitor") return "bg-white text-foreground";
  if (status === "inactive") return "border border-border bg-input text-[#52637a]";
  return "bg-[#7fb2ff] text-white";
}

export default function AccountsPage() {
  const uiText = useUiText();
  const lang = useLocale();
  const searchParams = useSearchParams();
  const highlightNew = searchParams.get("new") === "true";
  const [search, setSearch] = useState("");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const { data: apiAccounts, loading, refetch } = useApi(() => accountsApi.list());
  const { data: apiProducts } = useApi(() => productsApi.list());
  const [batchMatching, setBatchMatching] = useState(false);
  const [batchMatchJobs, setBatchMatchJobs] = useState<BatchMatchJob[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ companyName: "", industry: "", subIndustry: "", size: "", location: "", website: "" });
  const [saving, setSaving] = useState(false);

  const accounts = useMemo(
    () => (Array.isArray(apiAccounts) && apiAccounts.length > 0 ? (apiAccounts as AccountListItem[]) : []),
    [apiAccounts]
  );
  const products = useMemo(
    () => (Array.isArray(apiProducts) ? (apiProducts as ProductListItem[]) : []),
    [apiProducts]
  );
  const highlightIds = useMemo(() => {
    if (!highlightNew || accounts.length === 0) return new Set<string>();
    const sortedByCreated = [...accounts].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return new Set(sortedByCreated.slice(0, 5).map((account) => account.id));
  }, [accounts, highlightNew]);

  const [accountProducts, setAccountProducts] = useState<Record<string, string[]>>({});
  useEffect(() => {
    strategyCardsApi
      .list()
      .then((cards) => {
        const map: Record<string, string[]> = {};
        if (Array.isArray(cards)) {
          (cards as StrategyCardListItem[]).forEach((card) => {
            const accountId = card.accountId || card.account_id;
            const productId = card.productId || card.product_id;
            if (!accountId || !productId) return;

            const product = products.find((item) => item.id === productId);
            const name = product?.name || productId.slice(0, 8);
            if (!map[accountId]) map[accountId] = [];
            if (!map[accountId].includes(name)) map[accountId].push(name);
          });
        }
        setAccountProducts(map);
      })
      .catch(() => {});
  }, [products]);

  function parseLoc(value: unknown): string {
    if (!value) return "-";
    const parsed = typeof value === "string"
      ? (() => {
          try {
            return JSON.parse(value) as unknown;
          } catch {
            return value;
          }
        })()
      : value;
    if (typeof parsed === "string") return parsed;
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((location: LocationLike) => location.city || location.province || "").filter(Boolean).join(", ") || "-";
    }
    return "-";
  }

  const filtered = accounts.filter((account) => {
    const matchesSearch = (account.companyName || "").toLowerCase().includes(search.toLowerCase());
    const matchesIndustry = industryFilter === "all" || account.industry === industryFilter;
    const matchesProduct = productFilter === "all" || (accountProducts[account.id] || []).some((name) => name.includes(productFilter));
    const matchesLocation = locationFilter === "all" || parseLoc(account.locations).includes(locationFilter);
    const matchesStatus = statusFilter === "all" || account.status === statusFilter;
    return matchesSearch && matchesIndustry && matchesProduct && matchesLocation && matchesStatus;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (highlightIds.has(a.id) && !highlightIds.has(b.id)) return -1;
    if (!highlightIds.has(a.id) && highlightIds.has(b.id)) return 1;
    return (b.matchScore || 0) - (a.matchScore || 0);
  });

  const industries = [...new Set(accounts.map((account) => account.industry).filter(Boolean))] as string[];
  const locations = [...new Set(accounts.map((account) => parseLoc(account.locations)).filter((location) => location !== "-"))] as string[];

  const handleBatchMatchJobDone = useCallback((jobId: string) => (job: unknown) => {
    const done = job as {
      status?: string;
      resultJson?: { matches?: number } | null;
      errorMessage?: string | null;
    };
    setBatchMatchJobs((prev) =>
      prev.map((row) =>
        row.jobId === jobId
          ? { ...row, done: true, status: done.status, matches: done.resultJson?.matches ?? 0, errorMessage: done.errorMessage ?? null }
          : row
      )
    );
  }, []);

  useEffect(() => {
    if (!batchMatching || batchMatchJobs.length === 0) return;
    if (!batchMatchJobs.every((row) => row.done)) return;

    queueMicrotask(() => {
      setBatchMatching(false);
      const matched = batchMatchJobs.reduce((sum, row) => sum + (row.matches ?? 0), 0);
      const succeeded = batchMatchJobs.filter((row) => row.status === "succeeded").length;
      if (succeeded > 0) {
        toast.success(uiText("AI 匹配完成！{0} 条策略卡已生成（{1}/{2} 个任务）", { 0: matched, 1: succeeded, 2: batchMatchJobs.length }));
        refetch();
      } else {
        toast.error(batchMatchJobs[0]?.errorMessage || uiText("匹配失败"));
      }
      setBatchMatchJobs([]);
    });
  }, [batchMatchJobs, batchMatching, refetch]);

  const handleBatchMatch = async () => {
    if (products.length === 0) {
      toast.error(uiText("请先添加产品"));
      return;
    }
    setBatchMatching(true);
    setBatchMatchJobs([]);
    const rows: BatchMatchJob[] = [];

    for (const product of products) {
      try {
        const { jobId } = await aiApi.match(product.id);
        rows.push({ productId: product.id, productName: product.name, jobId, done: false });
      } catch (error) {
        const message = getErrorMessage(error);
        rows.push({ productId: product.id, productName: product.name, jobId: null, done: true, status: "failed", errorMessage: message });
        toast.error(`${product.name}: ${message}`);
      }
    }

    setBatchMatchJobs(rows);
    toast.info(uiText("匹配任务已提交，正在后台处理"));
    if (rows.every((row) => row.done)) setBatchMatching(false);
  };

  const handleAddAccount = async () => {
    if (!form.companyName) {
      toast.error(uiText("请输入公司名称"));
      return;
    }

    setSaving(true);
    try {
      await accountsApi.create({
        companyName: form.companyName,
        industry: form.industry,
        subIndustry: form.subIndustry,
        size: form.size,
        website: form.website,
        locations: form.location ? [{ city: form.location }] : [],
        tags: ["手动添加"],
        status: "active",
        matchScore: 0,
      });
      toast.success(uiText("客户已添加"));
      setShowAdd(false);
      setForm({ companyName: "", industry: "", subIndustry: "", size: "", location: "", website: "" });
      refetch();
    } catch (error) {
      toast.error(uiText("添加失败: ") + getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const csv = ["公司名称,行业,子行业,规模,所在地,匹配分"].concat(
      accounts.map((account) =>
        `"${account.companyName || ""}","${account.industry || ""}","${account.subIndustry || ""}","${account.size || ""}","${parseLoc(account.locations)}","${account.matchScore || ""}"`
      )
    ).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "客户列表.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className={`${pageStyles.page} ${pageStyles.accounts}`}>
      <div className="max-w-[1665px]">
        <div className="mb-[33px] flex flex-col items-stretch gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1>{uiText("目标客户")}</h1>
            <p className="mt-3 text-base text-[#52637a] sm:text-xl">{accounts.length}{uiText("家客户")}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="flex size-10 items-center justify-center rounded-[10px] border border-border bg-card transition hover:border-[#3b6ea8]"
              onClick={handleExport}
              title={uiText("导出客户")}
            >
              <img src="/img/smart-eye/download.svg" alt="" />
            </button>
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-border bg-card px-4 text-sm font-semibold text-[#52637a] transition hover:border-[#3b6ea8] hover:text-foreground disabled:opacity-50"
              onClick={handleBatchMatch}
              disabled={batchMatching}
            >
              {uiText("AI批量匹配")}</button>
            <Button className="btn-bg h-10 rounded-[10px] px-5 text-sm font-semibold text-white" onClick={() => setShowAdd(true)}>
              {uiText("添加客户")}</Button>
          </div>
        </div>

        {batchMatchJobs.length > 0 ? (
          <div className="mb-6 space-y-2 rounded-md border border-border bg-card p-3">
            <p className="text-sm text-[#52637a]">{uiText("匹配任务后台处理中...")}</p>
            {batchMatchJobs.map((row) =>
              row.jobId && !row.done ? (
                <div key={row.jobId} className="flex items-center gap-2">
                  <span className="shrink-0 text-sm">{row.productName}:</span>
                  <JobStatus jobId={row.jobId} onDone={handleBatchMatchJobDone(row.jobId)} />
                </div>
              ) : null
            )}
          </div>
        ) : null}

        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogContent
            className="smart-eye-dialog"
            overlayClassName="bg-black/70 supports-backdrop-filter:backdrop-blur-sm"
          >
            <DialogHeader><DialogTitle>{uiText("添加客户")}</DialogTitle></DialogHeader>
            <div className="smart-eye-dialog__body space-y-3">
              <div className="space-y-1">
                <Label>{uiText("公司名称 *")}</Label>
                <Input value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} />
              </div>
              <div className="smart-eye-dialog__columns grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>{uiText("行业")}</Label>
                  <Input value={form.industry} onChange={(event) => setForm({ ...form, industry: event.target.value })} placeholder={uiText("半导体制造")} />
                </div>
                <div className="space-y-1">
                  <Label>{uiText("子行业")}</Label>
                  <Input value={form.subIndustry} onChange={(event) => setForm({ ...form, subIndustry: event.target.value })} placeholder={uiText("晶圆代工")} />
                </div>
              </div>
              <div className="smart-eye-dialog__columns grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>{uiText("规模")}</Label>
                  <Input value={form.size} onChange={(event) => setForm({ ...form, size: event.target.value })} placeholder="5000+" />
                </div>
                <div className="space-y-1">
                  <Label>{uiText("所在地")}</Label>
                  <Input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder={uiText("上海")} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>{uiText("官网")}</Label>
                <Input value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} placeholder="www.example.com" />
              </div>
              <Button className="smart-eye-dialog-action btn-bg w-full" onClick={handleAddAccount} disabled={saving}>
                {saving ? uiText("保存中...") : uiText("保存")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="relative mb-8 max-w-[500px]">
          <img className="absolute left-4 top-1/2 -translate-y-1/2" src="/img/smart-eye/search.svg" alt="" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={uiText("搜索客户名称、行业、地点...")}
            className="h-10 rounded-[9px] border border-transparent pl-12 text-base text-foreground placeholder:text-muted-foreground"
            style={{
              background:
                "linear-gradient(#ffffff, #ffffff) padding-box, linear-gradient(180deg, #5b9bff 0%, #464660 100%) border-box",
            }}
          />
        </div>

        <div className="max-w-full overflow-x-auto rounded-[12px] border border-border bg-card overscroll-x-contain">
          <table className="w-full min-w-[1200px] border-collapse">
            <thead>
              <tr className="text-left">
                <th className="px-7 py-4 text-base font-semibold text-foreground">{uiText("公司名称")}</th>
                <th className="px-5 py-4"><ColFilter label={uiText("行业")} value={industryFilter} options={["全部", ...industries]} onSelect={(value) => setIndustryFilter(value === "全部" ? "all" : value)} /></th>
                <th className="px-5 py-4"><ColFilter label={uiText("匹配产品")} value={productFilter} options={["全部", ...products.map((product) => product.name)]} onSelect={(value) => setProductFilter(value === "全部" ? "all" : value)} /></th>
                <th className="px-5 py-4"><ColFilter label={uiText("所在地")} value={locationFilter} options={["全部", ...locations]} onSelect={(value) => setLocationFilter(value === "全部" ? "all" : value)} /></th>
                <th className="px-5 py-4 text-base font-semibold text-foreground">{uiText("匹配分")}</th>
                <th className="px-5 py-4"><ColFilter label={uiText("状态")} value={statusFilter} options={["全部", "跟进中", "竞品阵地", "待激活"]} translateOptions onSelect={(value) => setStatusFilter(value === "全部" ? "all" : value === "跟进中" ? "active" : value === "竞品阵地" ? "competitor" : "inactive")} /></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3, 4].map((item) => (
                  <tr key={item}>
                    <td className="px-7 py-5" colSpan={6}>
                      <div className="h-8 animate-pulse rounded bg-input" />
                    </td>
                  </tr>
                ))
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-7 py-16 text-center text-muted-foreground">
                    {uiText("暂无客户，点击添加客户或使用 AI 发现")}</td>
                </tr>
              ) : (
                sorted.map((account) => {
                  const matchedProducts = accountProducts[account.id] || [];
                  return (
                    <tr key={account.id} className={highlightIds.has(account.id) ? "bg-amber-50" : ""}>
                      <td className="px-7 py-4">
                        <Link href={`/${lang}/smart-eye/app/accounts/${account.id}`} className="flex min-w-[360px] items-center gap-3 text-lg font-medium text-foreground transition hover:text-primary">
                          <img src="/img/smart-eye/account-person.svg" alt="" />
                          <span className="truncate">{account.companyName}</span>
                          {highlightIds.has(account.id) ? <span className="rounded bg-[#e2b75f] px-2 py-0.5 text-xs text-foreground">{uiText("新")}</span> : null}
                        </Link>
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-md bg-input px-4 py-2 text-lg text-[#52637a]">{account.subIndustry || account.industry || "-"}</span>
                      </td>
                      <td className="px-5 py-4 text-center text-xl text-[#52637a]">
                        {matchedProducts.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {matchedProducts.slice(0, 2).map((name) => (
                              <span key={name} className="rounded-md border border-[#b8c3d0] px-3 py-1 text-sm text-[#52637a]">{name}</span>
                            ))}
                          </div>
                        ) : "-"}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-2 text-xl text-[#52637a]">
                          <img src="/img/smart-eye/location.svg" alt="" />
                          {parseLoc(account.locations)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex min-w-[76px] items-center justify-center rounded-md border px-4 py-1.5 text-base ${scoreClass(account.matchScore)}`}>
                          {account.matchScore != null ? uiText("{0}分", { 0: account.matchScore }) : "-"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <Link href={`/${lang}/smart-eye/app/accounts/${account.id}`} className={`inline-flex min-w-[78px] items-center justify-center rounded-md px-4 py-2 text-base font-semibold ${statusClass(account.status)}`}>
                          {uiText(statusLabel(account.status))}
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
