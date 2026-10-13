"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { JobStatus } from "@/app/[lang]/(workspace)/smart-eye/_components/jobs/job-status";
import { useApi } from "@/lib/hooks/use-api";
import { aiApi, productsApi } from "@/lib/api/client";
import { parseJsonArr } from "@/lib/utils";
import { toast } from "sonner";
import Image from "next/image";

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
      toast.error("产品名称和分类必填");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await productsApi.update(editingId, form);
        toast.success("产品已更新");
      } else {
        await productsApi.create({ ...form, specs: {}, competitorProducts: [], isActive: true });
        toast.success("产品已添加");
      }
      setShowAdd(false);
      resetForm();
      refetch();
    } catch (error) {
      toast.error("保存失败: " + getErrorMessage(error));
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
    if (!confirm("确认删除该产品？")) return;
    try {
      await productsApi.delete(id);
      toast.success("已删除");
      refetch();
    } catch {
      toast.error("删除失败");
    }
  };

  const handleAIMatch = async (productId: string) => {
    setMatchingId(productId);
    try {
      const { jobId } = await aiApi.match(productId);
      if (!jobId) throw new Error("匹配任务未创建");
      setMatchJobId(jobId);
      setMatchProductId(productId);
      toast.info("匹配任务已提交，正在后台处理");
    } catch (error) {
      toast.error("AI 匹配失败: " + getErrorMessage(error));
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
      toast.success(`AI 匹配完成，${result.resultJson?.matches ?? 0} 家客户已生成策略卡`);
      refetch();
    } else if (result.status === "failed") {
      toast.error(result.errorMessage || "AI 匹配失败");
    }
  };

  return (
    <section className="min-h-[calc(100dvh-64px)] w-full min-w-0 max-w-full bg-[#070B14] px-4 pb-24 pt-24 text-slate-100 sm:px-6 lg:px-8 lg:pb-10 lg:pt-[110px]">
      <div className="max-w-[1665px]">
        <div className="mb-7 flex flex-col items-stretch gap-5 sm:flex-row sm:items-start sm:justify-between lg:mb-9">
          <div>
            <h1 className="text-[28px] font-bold leading-tight text-white sm:text-[32px]">产品库</h1>
            <p className="mt-3 text-base leading-7 text-[#A6AEBD] sm:text-xl">管理你的可售产品，AI将基于此匹配目标客户</p>
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
              添加产品
            </div>
            <DialogContent
              className="smart-eye-dialog max-w-2xl"
              overlayClassName="bg-black/70 supports-backdrop-filter:backdrop-blur-sm"
            >
              <DialogHeader>
                <DialogTitle>{editingId ? "编辑产品" : "添加新产品"}</DialogTitle>
              </DialogHeader>
              <div className="smart-eye-dialog__body space-y-4">
                <div className="smart-eye-dialog__columns grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>产品名称 *</Label>
                    <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>产品型号</Label>
                    <Input value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} />
                  </div>
                </div>
                <div className="smart-eye-dialog__columns grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>产品分类 *</Label>
                    <Input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>价格区间</Label>
                    <Input value={form.priceRange} onChange={(event) => setForm({ ...form, priceRange: event.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>目标行业</Label>
                  <div className="flex flex-wrap gap-2">
                    {form.targetIndustries.map((tag) => (
                      <Badge key={tag} className="cursor-pointer" onClick={() => removeTag("targetIndustries", tag)}>
                        {tag} x
                      </Badge>
                    ))}
                  </div>
                  <Input
                    value={industryInput}
                    placeholder="输入行业，回车添加"
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
                  <Label>适用场景/工艺</Label>
                  <div className="flex flex-wrap gap-2">
                    {form.applications.map((tag) => (
                      <Badge key={tag} className="cursor-pointer" onClick={() => removeTag("applications", tag)}>
                        {tag} x
                      </Badge>
                    ))}
                  </div>
                  <Input
                    value={appInput}
                    placeholder="输入场景，回车添加"
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
                  <Label>产品描述</Label>
                  <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                </div>
                <Button className="smart-eye-dialog-action btn-bg w-full" onClick={handleSave} disabled={saving}>
                  {saving ? "保存中..." : editingId ? "更新产品" : "保存产品"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

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

        <div className="grid gap-8 lg:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((product) => (
            <article
              key={product.id}
              className={`min-w-0 rounded-[12px] border border-[#202839] bg-[#131821] px-5 py-6 transition hover:border-[#3B6EA8] sm:px-6 sm:py-8 ${
                product.isActive === false ? "opacity-55" : ""
              }`}
            >
              <div className="mb-8 flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-5">
                  <span className="w-[40px] h-[40px] flex items-center justify-center bg-[#5B9BFF24] border border-[#5B9BFF73] rounded-[10px]">
                    <Image src="/img/product.png" alt="product" width={20} height={20} />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-2xl font-bold leading-tight text-[#F1F5FA]">{product.name}</h2>
                    <p className="mt-2 text-xl text-[#747D91]">{product.model}</p>
                  </div>
                </div>
                <span
                  className={
                    product.isActive === false
                      ? "rounded-full bg-[#050914] px-4 py-1 text-sm text-[#A6AEBD]"
                      : "rounded-full border border-[#396AA8] bg-[#173259]/70 px-4 py-1 text-sm text-[#8AB7FF]"
                  }
                >
                  {product.isActive === false ? "停售" : "在售"}
                </span>
              </div>

              <p className="mb-6 min-h-[56px] text-lg leading-7 text-[#A6AEBD]">
                {product.description || "暂无产品描述"}
              </p>

              <div className="mb-4 flex flex-wrap gap-3">
                {product.targetIndustries.map((tag) => (
                  <span key={tag} className="rounded bg-[#050914] px-4 py-1.5 text-xs text-[#A6AEBD]">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mb-5 flex flex-wrap gap-3">
                {product.applications.length > 0 ? (
                  product.applications.map((tag) => (
                    <span key={tag} className="rounded-md border border-[#396AA8] px-4 py-1.5 text-sm text-[#A6AEBD]">
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="rounded-md border border-[#396AA8] px-4 py-1.5 text-sm text-[#A6AEBD]">待补充</span>
                )}
              </div>

              <div className="flex flex-col items-start gap-4 border-t border-[#202839] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xl font-bold text-[#F1F5FA]">{product.priceRange || "-"}</span>
                <div className="flex items-center gap-6">
                  <button
                    type="button"
                    title="AI匹配已有客户"
                    className="flex size-8 items-center justify-center disabled:opacity-50"
                    onClick={() => handleAIMatch(product.id)}
                    disabled={!!matchJobId || matchingId === product.id || matchProductId === product.id}
                  >
                    {matchingId === product.id || matchProductId === product.id ? (
                      <span className="size-5 animate-spin rounded-full border-2 border-[#8D83FF] border-t-transparent" />
                    ) : (
                      <Image src="/img/star.png" alt="ai" width={18} height={18} />
                    )}
                  </button>
                  <button type="button" title="编辑" className="flex size-8 items-center justify-center" onClick={() => handleEdit(product)}>
                    <Image src="/img/edit.png" alt="edit" width={18} height={18} />
                  </button>
                  <button type="button" title="删除" className="flex size-8 items-center justify-center" onClick={() => handleDelete(product.id)}>
                    <Image src="/img/delete.png" alt="delete" width={18} height={18} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        {matchJobId ? (
          <div className="mt-8 rounded-md border border-[#253048] bg-[#111722] p-3">
            <JobStatus jobId={matchJobId} onDone={handleMatchDone} />
          </div>
        ) : null}

        {loading ? (
          <div className="py-20 text-center text-[#8D96A7]">
            正在加载产品...
          </div>
        ) : error ? (
          <div className="py-20 text-center text-[#8D96A7]">
            <p>产品加载失败：{error}</p>
            <button
              type="button"
              onClick={refetch}
              className="mt-4 rounded-[8px] border border-[#396AA8] px-4 py-2 text-sm text-[#8AB7FF] transition hover:border-[#5B9BFF]"
            >
              重新加载
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-[#8D96A7]">
            <p>没有找到匹配的产品</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
