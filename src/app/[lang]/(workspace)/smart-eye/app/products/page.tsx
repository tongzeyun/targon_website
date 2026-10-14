"use client";

import { useUiText } from "@/app/[lang]/(workspace)/smart-eye/_hooks/use-ui-text";
import pageStyles from "@/app/[lang]/(workspace)/smart-eye/_styles/pages.module.css";

import { useMemo, useState } from "react";
import { Badge } from "@/app/[lang]/(workspace)/smart-eye/_components/ui/badge";
import { Button } from "@/app/[lang]/(workspace)/smart-eye/_components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/app/[lang]/(workspace)/smart-eye/_components/ui/dialog";
import { Input } from "@/app/[lang]/(workspace)/smart-eye/_components/ui/input";
import { Label } from "@/app/[lang]/(workspace)/smart-eye/_components/ui/label";
import { Textarea } from "@/app/[lang]/(workspace)/smart-eye/_components/ui/textarea";
import { JobStatus } from "@/app/[lang]/(workspace)/smart-eye/_components/jobs/job-status";
import { useApi } from "@/app/[lang]/(workspace)/smart-eye/_hooks/use-api";
import { aiApi, productsApi } from "@/lib/api/client";
import { parseJsonArr } from "@/lib/utils";
import { toast } from "sonner";

interface ProductListItem {
  id: string;
  name?: string;
  category?: string;
  model?: string;
  priceRange?: string;
  description?: string;
  targetIndustries?: unknown;
  applications?: unknown;
  isActive?: boolean;
}

interface NormalizedProduct extends ProductListItem {
  targetIndustries: string[];
  applications: string[];
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeProduct(product: ProductListItem): NormalizedProduct {
  const targetIndustries = Array.isArray(product.targetIndustries)
    ? product.targetIndustries.map(String)
    : parseJsonArr<string>(product.targetIndustries);
  const applications = Array.isArray(product.applications)
    ? product.applications.map(String)
    : parseJsonArr<string>(product.applications);

  return {
    ...product,
    targetIndustries: targetIndustries.length > 0 ? targetIndustries : [product.category || "未分类"],
    applications,
  };
}


export default function ProductsPage() {
  const uiText = useUiText();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [matchingId, setMatchingId] = useState<string | null>(null);
  const [matchJobId, setMatchJobId] = useState<string | null>(null);
  const [matchProductId, setMatchProductId] = useState<string | null>(null);
  const {
    data: apiProducts,
    loading,
    error,
    refetch,
  } = useApi(() => productsApi.list());

  const [form, setForm] = useState({
    name: "",
    category: "",
    model: "",
    priceRange: "",
    description: "",
    targetIndustries: [] as string[],
    applications: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [industryInput, setIndustryInput] = useState("");
  const [appInput, setAppInput] = useState("");

  const addTag = (field: "targetIndustries" | "applications", value: string) => {
    const tag = value.trim();
    if (tag && !form[field].includes(tag)) {
      setForm({ ...form, [field]: [...form[field], tag] });
    }
  };

  const removeTag = (field: "targetIndustries" | "applications", value: string) => {
    setForm({ ...form, [field]: form[field].filter((item) => item !== value) });
  };

  const products = useMemo(() => {
    const source = Array.isArray(apiProducts) ? apiProducts : [];
    return (source as ProductListItem[]).map(normalizeProduct);
  }, [apiProducts]);

  const filtered = products.filter((product) => {
    const keyword = search.toLowerCase();
    return (
      (product.name || "").toLowerCase().includes(keyword) ||
      (product.category || "").includes(search) ||
      (product.model || "").toLowerCase().includes(keyword)
    );
  });

  const resetForm = () => {
    setEditingId(null);
    setForm({ name: "", category: "", model: "", priceRange: "", description: "", targetIndustries: [], applications: [] });
    setIndustryInput("");
    setAppInput("");
  };

  const handleSave = async () => {
    if (!form.name || !form.category) {
      toast.error(uiText("产品名称和分类必填"));
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await productsApi.update(editingId, form);
        toast.success(uiText("产品已更新"));
      } else {
        await productsApi.create({ ...form, specs: {}, competitorProducts: [], isActive: true });
        toast.success(uiText("产品已添加"));
      }
      setShowAdd(false);
      resetForm();
      refetch();
    } catch (error) {
      toast.error(uiText("保存失败: ") + getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (product: NormalizedProduct) => {
    setForm({
      name: product.name || "",
      category: product.category || "",
      model: product.model || "",
      priceRange: product.priceRange || "",
      description: product.description || "",
      targetIndustries: product.targetIndustries,
      applications: product.applications,
    });
    setEditingId(product.id);
    setShowAdd(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(uiText("确认删除该产品？"))) return;
    try {
      await productsApi.delete(id);
      toast.success(uiText("已删除"));
      refetch();
    } catch {
      toast.error(uiText("删除失败"));
    }
  };

  const handleAIMatch = async (productId: string) => {
    setMatchingId(productId);
    try {
      const { jobId } = await aiApi.match(productId);
      if (!jobId) throw new Error(uiText("匹配任务未创建"));
      setMatchJobId(jobId);
      setMatchProductId(productId);
      toast.info(uiText("匹配任务已提交，正在后台处理"));
    } catch (error) {
      toast.error(uiText("AI 匹配失败: ") + getErrorMessage(error));
    } finally {
      setMatchingId(null);
    }
  };

  const handleMatchDone = (job: unknown) => {
    const result = job as {
      status?: string;
      errorMessage?: string | null;
      resultJson?: { matches?: number } | null;
    };
    setMatchJobId(null);
    setMatchProductId(null);
    if (result.status === "succeeded") {
      toast.success(uiText("AI 匹配完成，{0} 家客户已生成策略卡", { 0: result.resultJson?.matches ?? 0 }));
      refetch();
    } else if (result.status === "failed") {
      toast.error(result.errorMessage || uiText("AI 匹配失败"));
    }
  };

  return (
    <section className={`${pageStyles.page} ${pageStyles.products}`}>
      <div className="max-w-[1665px]">
        <div className="mb-[33px] flex flex-col items-stretch gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1>{uiText("产品库")}</h1>
            <p className="mt-3 text-base leading-7 text-[#52637a] sm:text-xl">{uiText("管理你的可售产品，AI将基于此匹配目标客户")}</p>
          </div>

          <Dialog
            open={showAdd}
            onOpenChange={(open) => {
              setShowAdd(open);
              if (!open) resetForm();
            }}
          >
            <div
              className="btn-bg mt-1 inline-flex h-10 w-fit items-center rounded-[10px] px-5 text-sm font-semibold cursor-pointer"
              onClick={() => setShowAdd(true)}
            >
              {uiText("添加产品")}</div>
            <DialogContent
              className="smart-eye-dialog max-w-2xl"
              overlayClassName="bg-black/70 supports-backdrop-filter:backdrop-blur-sm"
            >
              <DialogHeader>
                <DialogTitle>{editingId ? uiText("编辑产品") : uiText("添加新产品")}</DialogTitle>
              </DialogHeader>
              <div className="smart-eye-dialog__body space-y-4">
                <div className="smart-eye-dialog__columns grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{uiText("产品名称 *")}</Label>
                    <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>{uiText("产品型号")}</Label>
                    <Input value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} />
                  </div>
                </div>
                <div className="smart-eye-dialog__columns grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{uiText("产品分类 *")}</Label>
                    <Input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>{uiText("价格区间")}</Label>
                    <Input value={form.priceRange} onChange={(event) => setForm({ ...form, priceRange: event.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{uiText("目标行业")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {form.targetIndustries.map((tag) => (
                      <Badge key={tag} className="cursor-pointer" onClick={() => removeTag("targetIndustries", tag)}>
                        {tag} x
                      </Badge>
                    ))}
                  </div>
                  <Input
                    value={industryInput}
                    placeholder={uiText("输入行业，回车添加")}
                    onChange={(event) => setIndustryInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addTag("targetIndustries", industryInput);
                        setIndustryInput("");
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{uiText("适用场景/工艺")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {form.applications.map((tag) => (
                      <Badge key={tag} className="cursor-pointer" onClick={() => removeTag("applications", tag)}>
                        {tag} x
                      </Badge>
                    ))}
                  </div>
                  <Input
                    value={appInput}
                    placeholder={uiText("输入场景，回车添加")}
                    onChange={(event) => setAppInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addTag("applications", appInput);
                        setAppInput("");
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{uiText("产品描述")}</Label>
                  <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                </div>
                <Button className="smart-eye-dialog-action btn-bg w-full" onClick={handleSave} disabled={saving}>
                  {saving ? uiText("保存中...") : editingId ? uiText("更新产品") : uiText("保存产品")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative mb-8 max-w-[500px]">
          <img className="absolute left-4 top-1/2 -translate-y-1/2" src="/img/smart-eye/search.svg" alt="" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={uiText("搜索产品名称、分类、型号...")}
            className="h-10 rounded-[9px] border border-transparent pl-14 text-[17px] text-foreground placeholder:text-muted-foreground"
            style={{
              background:
                "linear-gradient(#ffffff, #ffffff) padding-box, linear-gradient(180deg, #5b9bff 0%, #464660 100%) border-box",
            }}
          />
        </div>

        <div className="grid gap-[30px] lg:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((product) => (
            <article
              key={product.id}
              className={`min-w-0 rounded-[12px] border border-border bg-card px-5 py-6 transition hover:border-[#3b6ea8] sm:px-6 sm:py-8 ${product.isActive === false ? "opacity-55" : ""}`}
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-5">
                  <span className="w-[40px] h-[40px] flex items-center justify-center bg-[#5B9BFF24] border border-[#5B9BFF73] rounded-[10px]">
                    <img src="/img/smart-eye/product.svg" alt="" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-2xl font-bold leading-tight text-foreground">{product.name}</h2>
                    <p className="mt-1 text-[17px] text-muted-foreground">{product.model}</p>
                  </div>
                </div>
                <span
                  className={
                    product.isActive === false
                      ? "rounded-full bg-input px-4 py-1 text-sm text-[#52637a]"
                      : "rounded-full border border-[#b8c3d0] bg-[#5b9bff]/15 px-4 py-1 text-sm text-[#5b9bff]"
                  }
                >
                  {product.isActive === false ? uiText("停售") : uiText("在售")}
                </span>
              </div>

              <p className="mb-4 min-h-[52px] text-lg leading-7 text-[#52637a]">
                {product.description || uiText("暂无产品描述")}
              </p>

              <div className="mb-3 flex flex-wrap gap-3">
                {product.targetIndustries.map((tag) => (
                  <span key={tag} className="rounded bg-input px-4 py-1.5 text-xs text-[#52637a]">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mb-4 flex flex-wrap gap-3">
                {product.applications.length > 0 ? (
                  product.applications.map((tag) => (
                    <span key={tag} className="rounded-md border border-[#b8c3d0] px-4 py-1.5 text-sm text-[#52637a]">
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="rounded-md border border-[#b8c3d0] px-4 py-1.5 text-sm text-[#52637a]">{uiText("待补充")}</span>
                )}
              </div>

              <div className="flex flex-col items-start gap-4 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xl font-bold text-foreground">{product.priceRange || "-"}</span>
                <div className="flex items-center gap-6">
                  <button
                    type="button"
                    title={uiText("AI匹配已有客户")}
                    className="flex size-8 items-center justify-center disabled:opacity-50"
                    onClick={() => handleAIMatch(product.id)}
                    disabled={!!matchJobId || matchingId === product.id || matchProductId === product.id}
                  >
                    {matchingId === product.id || matchProductId === product.id ? (
                      <span className="size-5 animate-spin rounded-full border-2 border-[#8d83ff] border-t-transparent" />
                    ) : (
                      <img src="/img/smart-eye/star.svg" alt="" />
                    )}
                  </button>
                  <button type="button" title={uiText("编辑")} className="flex size-8 items-center justify-center" onClick={() => handleEdit(product)}>
                    <img src="/img/smart-eye/edit.svg" alt="" />
                  </button>
                  <button type="button" title={uiText("删除")} className="flex size-8 items-center justify-center" onClick={() => handleDelete(product.id)}>
                    <img src="/img/smart-eye/delete.svg" alt="" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        {matchJobId ? (
          <div className="mt-8 rounded-md border border-border bg-card p-3">
            <JobStatus jobId={matchJobId} onDone={handleMatchDone} />
          </div>
        ) : null}

        {loading ? (
          <div className="py-20 text-center text-muted-foreground">
            {uiText("正在加载产品...")}</div>
        ) : error ? (
          <div className="py-20 text-center text-muted-foreground">
            <p>{uiText("产品加载失败：")}{error}</p>
            <button
              type="button"
              onClick={refetch}
              className="mt-4 rounded-[8px] border border-[#b8c3d0] px-4 py-2 text-sm text-[#5b9bff] transition hover:border-[#5b9bff]"
            >
              {uiText("重新加载")}</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            <p>{uiText("没有找到匹配的产品")}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
