"use client";

import { useI18n } from "@/lib/i18n";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { JobStatus } from "@/app/[lang]/(workspace)/smart-eye/_components/jobs/job-status";
import { useApi } from "@/lib/hooks/use-api";
import { accountsApi, aiApi, productsApi, strategyCardsApi } from "@/lib/api/client";
import { toast } from "sonner";
import Image from "next/image";
function ColFilter({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger>
        <span className="inline-flex items-center gap-2 text-base font-semibold text-[#A6AEBD] transition hover:text-white">
          <span>{label}</span>
          {value !== "all" ? <span className="rounded bg-[#173259] px-1.5 text-[10px] text-[#8AB7FF]">1</span> : null}
          <ChevronGlyph />
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-44 border-[#253048] bg-[#111722] p-1 text-slate-100" align="start">
        {options.slice(0, 20).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onSelect(option)}
            className={`block w-full rounded px-3 py-2 text-left text-sm transition hover:bg-[#1A2230] ${
              option === value || (option === "全部" && value === "all") ? "bg-[#173259] text-[#8AB7FF]" : ""
            }`}
          >
            {option.length > 14 ? `${option.slice(0, 14)}...` : option}
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
  if (score == null) return "border-[#334155] bg-[#1A2230] text-[#A6AEBD]";
  if (score >= 90) return "border-[#4BAF7A] bg-[#214C3D] text-[#68D095]";
  if (score >= 80) return "border-[#3B6EA8] bg-[#243D64] text-[#76A8FF]";
  return "border-[#B88737] bg-[#5A4324] text-[#E2B75F]";
}

function statusLabel(status?: string) {
  if (status === "active") return "跟进中";
  if (status === "competitor") return "竞品";
  if (status === "inactive") return "待激活";
  return status || "-";
}

function statusClass(status?: string) {
  if (status === "competitor") return "bg-white text-[#111722] shadow-[0_0_18px_rgb(255_255_255_/_25%)]";
  if (status === "inactive") return "border border-[#334155] bg-[#1A2230] text-[#A6AEBD]";
  return "bg-[#7FB2FF] text-[#12213A] shadow-[0_0_18px_rgb(127_178_255_/_45%)]";
}

export default function AccountsPage() {
  const { lang } = useI18n();
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
        toast.success(`AI 匹配完成！${matched} 条策略卡已生成（${succeeded}/${batchMatchJobs.length} 个任务）`);
        refetch();
      } else {
        toast.error(batchMatchJobs[0]?.errorMessage || "匹配失败");
      }
      setBatchMatchJobs([]);
    });
  }, [batchMatchJobs, batchMatching, refetch]);

  const handleBatchMatch = async () => {
    if (products.length === 0) {
      toast.error("请先添加产品");
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
    toast.info("匹配任务已提交，正在后台处理");
    if (rows.every((row) => row.done)) setBatchMatching(false);
  };

  const handleAddAccount = async () => {
    if (!form.companyName) {
      toast.error("请输入公司名称");
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
      toast.success("客户已添加");
      setShowAdd(false);
      setForm({ companyName: "", industry: "", subIndustry: "", size: "", location: "", website: "" });
      refetch();
    } catch (error) {
      toast.error("添加失败: " + getErrorMessage(error));
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
    <section className="min-h-[calc(100dvh-64px)] w-full min-w-0 max-w-full bg-[#070B14] px-4 pb-24 pt-24 text-slate-100 sm:px-6 lg:px-8 lg:pb-10 lg:pt-[112px]">
      <div className="max-w-[1665px]">
        <div className="mb-7 flex flex-col items-stretch gap-5 sm:flex-row sm:items-start sm:justify-between lg:mb-9">
          <div>
            <h1 className="text-[28px] font-bold leading-tight text-white sm:text-[32px]">目标客户</h1>
            <p className="mt-3 text-base text-[#A6AEBD] sm:text-xl">{accounts.length}家客户</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="flex size-10 items-center justify-center rounded-[10px] border border-[#253048] bg-[#111722] transition hover:border-[#3B6EA8]"
              onClick={handleExport}
              title="导出客户"
            >
              <Image src="/img/download.png" alt="download" width={14} height={16} />
            </button>
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-[#253048] bg-[#111722] px-4 text-sm font-semibold text-[#A6AEBD] transition hover:border-[#3B6EA8] hover:text-white disabled:opacity-50"
              onClick={handleBatchMatch}
              disabled={batchMatching}
            >
              AI批量匹配
            </button>
            <Button className="btn-bg h-10 rounded-[10px] px-5 text-sm font-semibold text-[#0A0613]" onClick={() => setShowAdd(true)}>
              添加客户
            </Button>
          </div>
        </div>

        {batchMatchJobs.length > 0 ? (
          <div className="mb-6 space-y-2 rounded-md border border-[#253048] bg-[#111722] p-3">
            <p className="text-sm text-[#A6AEBD]">匹配任务后台处理中...</p>
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
            <DialogHeader><DialogTitle>添加客户</DialogTitle></DialogHeader>
            <div className="smart-eye-dialog__body space-y-3">
              <div className="space-y-1">
                <Label>公司名称 *</Label>
                <Input value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} />
              </div>
              <div className="smart-eye-dialog__columns grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>行业</Label>
                  <Input value={form.industry} onChange={(event) => setForm({ ...form, industry: event.target.value })} placeholder="半导体制造" />
                </div>
                <div className="space-y-1">
                  <Label>子行业</Label>
                  <Input value={form.subIndustry} onChange={(event) => setForm({ ...form, subIndustry: event.target.value })} placeholder="晶圆代工" />
                </div>
              </div>
              <div className="smart-eye-dialog__columns grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>规模</Label>
                  <Input value={form.size} onChange={(event) => setForm({ ...form, size: event.target.value })} placeholder="5000+" />
                </div>
                <div className="space-y-1">
                  <Label>所在地</Label>
                  <Input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="上海" />
                </div>
              </div>
              <div className="space-y-1">
                <Label>官网</Label>
                <Input value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} placeholder="www.example.com" />
              </div>
              <Button className="smart-eye-dialog-action btn-bg w-full" onClick={handleAddAccount} disabled={saving}>
                {saving ? "保存中..." : "保存"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="relative mb-8 max-w-[534px]">
          <Image className="absolute left-4 top-1/2 -translate-y-1/2"  src="/img/search.png" alt="search" width={18} height={18} />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索产品名称、分类、型号..."
            className="h-[44px] rounded-[9px] border border-transparent pl-14 text-base text-slate-100 placeholder:text-[#8D96A7]"
            style={{
              background:
                "linear-gradient(#070B14, #070B14) padding-box, linear-gradient(135deg, #6FB1FF 14.64%, #8E8DFF 51.41%, #B07DFF 85.36%) border-box",
            }}
          />
        </div>

        <div className="max-w-full overflow-x-auto rounded-[12px] border border-[#202839] bg-[#131821] overscroll-x-contain">
          <table className="w-full min-w-[1200px] border-collapse">
            <thead>
              <tr className="text-left">
                <th className="px-7 py-7 text-base font-semibold text-[#F1F5FA]">公司名称</th>
                <th className="px-5 py-7"><ColFilter label="行业" value={industryFilter} options={["全部", ...industries]} onSelect={(value) => setIndustryFilter(value === "全部" ? "all" : value)} /></th>
                <th className="px-5 py-7"><ColFilter label="匹配产品" value={productFilter} options={["全部", ...products.map((product) => product.name)]} onSelect={(value) => setProductFilter(value === "全部" ? "all" : value)} /></th>
                <th className="px-5 py-7"><ColFilter label="所在地" value={locationFilter} options={["全部", ...locations]} onSelect={(value) => setLocationFilter(value === "全部" ? "all" : value)} /></th>
                <th className="px-5 py-7 text-base font-semibold text-[#F1F5FA]">匹配分</th>
                <th className="px-5 py-7"><ColFilter label="状态" value={statusFilter} options={["全部", "跟进中", "竞品阵地", "待激活"]} onSelect={(value) => setStatusFilter(value === "全部" ? "all" : value === "跟进中" ? "active" : value === "竞品阵地" ? "competitor" : "inactive")} /></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3, 4].map((item) => (
                  <tr key={item}>
                    <td className="px-7 py-5" colSpan={6}>
                      <div className="h-8 animate-pulse rounded bg-[#1A2230]" />
                    </td>
                  </tr>
                ))
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-7 py-16 text-center text-[#8D96A7]">
                    暂无客户，点击添加客户或使用 AI 发现
                  </td>
                </tr>
              ) : (
                sorted.map((account) => {
                  const matchedProducts = accountProducts[account.id] || [];
                  return (
                    <tr key={account.id} className={highlightIds.has(account.id) ? "bg-[#332A16]" : ""}>
                      <td className="px-7 py-4">
                        <Link href={`/${lang}/smart-eye/app/accounts/${account.id}`} className="flex min-w-[430px] items-center gap-3 text-xl font-medium text-[#DDE3EC] transition hover:text-white">
                          <Image src="/img/user.png" alt="user" width={20} height={20} />
                          <span className="truncate">{account.companyName}</span>
                          {highlightIds.has(account.id) ? <span className="rounded bg-[#E2B75F] px-2 py-0.5 text-xs text-[#111722]">新</span> : null}
                        </Link>
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-md bg-[#050914] px-4 py-2 text-lg text-[#A6AEBD]">{account.subIndustry || account.industry || "-"}</span>
                      </td>
                      <td className="px-5 py-4 text-center text-xl text-[#A6AEBD]">
                        {matchedProducts.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {matchedProducts.slice(0, 2).map((name) => (
                              <span key={name} className="rounded-md border border-[#396AA8] px-3 py-1 text-sm text-[#A6AEBD]">{name}</span>
                            ))}
                          </div>
                        ) : "-"}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-2 text-xl text-[#A6AEBD]">
                          <Image src="/img/location.png" alt="pin" width={20} height={20} />
                          {parseLoc(account.locations)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex min-w-[76px] items-center justify-center rounded-md border px-4 py-1.5 text-base ${scoreClass(account.matchScore)}`}>
                          {account.matchScore != null ? `${account.matchScore}分` : "-"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <Link href={`/${lang}/smart-eye/app/accounts/${account.id}`} className={`inline-flex min-w-[78px] items-center justify-center rounded-md px-4 py-2 text-base font-semibold ${statusClass(account.status)}`}>
                          {statusLabel(account.status)}
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
