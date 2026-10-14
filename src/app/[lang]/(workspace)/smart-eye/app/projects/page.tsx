"use client";

import { useUiText } from "@/app/[lang]/(workspace)/smart-eye/_hooks/use-ui-text";
import pageStyles from "@/app/[lang]/(workspace)/smart-eye/_styles/pages.module.css";

import { useLocale } from "@/app/[lang]/(workspace)/smart-eye/_hooks/use-locale";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/app/[lang]/(workspace)/smart-eye/_components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/app/[lang]/(workspace)/smart-eye/_components/ui/dialog";
import { Input } from "@/app/[lang]/(workspace)/smart-eye/_components/ui/input";
import { DatePicker } from "@/app/[lang]/(workspace)/smart-eye/_components/ui/date-picker";
import { Label } from "@/app/[lang]/(workspace)/smart-eye/_components/ui/label";
import { Textarea } from "@/app/[lang]/(workspace)/smart-eye/_components/ui/textarea";
import { useApi } from "@/app/[lang]/(workspace)/smart-eye/_hooks/use-api";
import { accountsApi, projectsApi } from "@/lib/api/client";
import { toast } from "sonner";
interface ProjectListItem {
  id: string;
  projectName?: string;
  buyerName?: string;
  budgetRange?: string;
  location?: string;
  industry?: string;
  summary?: string;
}

interface AccountOption {
  id: string;
  companyName?: string;
}

const checkboxGradient = "linear-gradient(180deg, #5b9bff 0%, #464660 100%)";

function GradientCheckbox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="relative block size-6 shrink-0"
      style={{
        border: "2px solid",
        borderImageSource: checkboxGradient,
        borderImageSlice: 1,
      }}
    >
      {checked ? (
        <span
          className="absolute left-[3px] top-[4px] block h-[9px] w-[14px] -rotate-45"
          style={{
            borderStyle: "solid",
            borderWidth: "0 0 2px 2px",
            borderImageSource: checkboxGradient,
            borderImageSlice: 1,
          }}
        />
      ) : null}
    </span>
  );
}

export default function ProjectsPage() {
  const uiText = useUiText();
  const lang = useLocale();
  const searchParams = useSearchParams();
  const [showCreate, setShowCreate] = useState(false);
  const { data: projects, loading, refetch } = useApi(() => projectsApi.list());
  const { data: accounts } = useApi(() => accountsApi.list());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    projectName: "",
    buyerName: "",
    budgetRange: "",
    location: "",
    deadline: "",
    summary: "",
    accountId: "",
    industry: "半导体",
  });

  const projectList = (Array.isArray(projects) ? projects : []) as ProjectListItem[];
  const accountList = (Array.isArray(accounts) ? accounts : []) as AccountOption[];
  const allSelected = projectList.length > 0 && selected.size === projectList.length;

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(projectList.map((project) => project.id)));
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(uiText("删除选中的 {0} 个项目？", { 0: selected.size }))) return;
    setDeleting(true);
    let count = 0;
    for (const id of selected) {
      try {
        await projectsApi.delete(id);
        count++;
      } catch {}
    }
    toast.success(uiText("删除了 {0} 个项目", { 0: count }));
    setSelected(new Set());
    setDeleting(false);
    refetch();
  };

  useEffect(() => {
    queueMicrotask(() => {
      if (searchParams.get("new") === "true") {
        setForm({
          projectName: "",
          buyerName: searchParams.get("buyerName") || "",
          budgetRange: "",
          location: searchParams.get("location") || "",
          deadline: "",
          summary: "",
          accountId: searchParams.get("accountId") || "",
          industry: searchParams.get("industry") || "半导体",
        });
        setShowCreate(true);
      }
    });
  }, [searchParams]);

  const handleCreate = async () => {
    if (!form.projectName) {
      toast.error(uiText("请输入项目名称"));
      return;
    }
    try {
      await projectsApi.create({
        ...form,
        projectType: "potential_opportunity",
        status: "active",
        buyerContact: {},
        timeline: form.deadline ? { bidDeadline: form.deadline } : {},
      });
      toast.success(uiText("项目已创建"));
      setShowCreate(false);
      setForm({ projectName: "", buyerName: "", budgetRange: "", location: "", deadline: "", summary: "", accountId: "", industry: "半导体" });
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : uiText("创建失败"));
    }
  };

  const handleExport = () => {
    const csv = ["项目名称,采购单位,预算,所在地,行业"].concat(
      projectList.map((project) =>
        `"${project.projectName || ""}","${project.buyerName || ""}","${project.budgetRange || ""}","${project.location || ""}","${project.industry || ""}"`
      )
    ).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "项目列表.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className={`${pageStyles.page} ${pageStyles.projects}`}>
      <div className="max-w-[1665px]">
        <div className="mb-8 flex flex-col items-stretch gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1>{uiText("项目跟进")}</h1>
            <p className="mt-3 text-base text-[#52637a] sm:text-xl">{uiText("管理你的销售项目，从发现到成交")}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex size-10 items-center justify-center rounded-[10px] border border-border bg-card transition hover:border-[#3b6ea8]"
              onClick={handleExport}
              title={uiText("导出项目")}
            >
              <img src="/img/smart-eye/download.svg" alt="" />
            </button>
            <button type="button" className="btn-bg h-10 rounded-[10px] px-5 text-sm font-semibold" onClick={() => setShowCreate(true)}>
              {uiText("新建项目")}</button>
          </div>
        </div>

        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent
            className="smart-eye-dialog max-w-lg"
            overlayClassName="bg-black/70 supports-backdrop-filter:backdrop-blur-sm"
          >
            <DialogHeader><DialogTitle>{uiText("新建项目")}</DialogTitle></DialogHeader>
            <div className="smart-eye-dialog__body space-y-3">
              <div className="space-y-1">
                <Label>{uiText("项目名称 *")}</Label>
                <Input value={form.projectName} onChange={(event) => setForm({ ...form, projectName: event.target.value })} placeholder={uiText("如：某晶圆厂真空泵采购项目")} />
              </div>
              <div className="smart-eye-dialog__columns grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>{uiText("采购单位")}</Label>
                  <Input value={form.buyerName} onChange={(event) => setForm({ ...form, buyerName: event.target.value })} placeholder={uiText("公司/机构名称")} />
                </div>
                <div className="space-y-1">
                  <Label>{uiText("预算")}</Label>
                  <Input value={form.budgetRange} onChange={(event) => setForm({ ...form, budgetRange: event.target.value })} placeholder={uiText("如 ¥200-500万")} />
                </div>
              </div>
              <div className="smart-eye-dialog__columns grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>{uiText("所在地")}</Label>
                  <Input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder={uiText("城市")} />
                </div>
                <div className="space-y-1">
                  <Label>{uiText("截止日期")}</Label>
                  <DatePicker value={form.deadline} onChange={(deadline) => setForm({ ...form, deadline })} placeholder={uiText("选择截止日期")} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>{uiText("关联客户")}</Label>
                <select
                  className="smart-eye-dialog__select"
                  value={form.accountId}
                  onChange={(event) => setForm({ ...form, accountId: event.target.value })}
                >
                  <option value="">{uiText("不关联")}</option>
                  {accountList.map((account) => <option key={account.id} value={account.id}>{account.companyName}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>{uiText("行业")}</Label>
                <Input value={form.industry} onChange={(event) => setForm({ ...form, industry: event.target.value })} placeholder={uiText("输入行业名称")} />
              </div>
              <div className="space-y-1">
                <Label>{uiText("项目描述")}</Label>
                <Textarea value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} rows={3} placeholder={uiText("项目背景、采购内容、关键信息...")} />
              </div>
              <Button className="smart-eye-dialog-action btn-bg w-full" onClick={handleCreate}>{uiText("创建项目")}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {projectList.length > 0 ? (
          <div className="mb-6 flex min-h-[31px] flex-wrap items-center gap-4">
            <button type="button" onClick={selectAll} className="inline-flex items-center gap-2 text-base text-[#52637a] transition hover:text-foreground">
              <GradientCheckbox checked={allSelected} />
              {allSelected ? uiText("取消全选") : uiText("全选（{0}）", { 0: projectList.length })}
            </button>
            {selected.size > 0 ? (
              <button
                type="button"
                className="rounded-md border border-[#7a3030] px-3 py-1.5 text-sm text-[#ff7474] transition hover:bg-red-50 disabled:opacity-50"
                onClick={deleteSelected}
                disabled={deleting}
              >
                {uiText("删除选中（{0}）", { 0: selected.size })}
              </button>
            ) : null}
            <span className="w-full text-sm text-muted-foreground sm:ml-auto sm:w-auto">{uiText("点击复选框选择，点击标题进入详情")}</span>
          </div>
        ) : null}

        {loading ? (
          <div className="grid gap-[30px] lg:grid-cols-2">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-[216px] animate-pulse rounded-[12px] border border-border bg-card" />
            ))}
          </div>
        ) : projectList.length > 0 ? (
          <div className="grid gap-[30px] lg:grid-cols-2">
            {projectList.map((project) => {
              const checked = selected.has(project.id);
              return (
                <article key={project.id} className="min-w-0 rounded-[12px] border border-border bg-card px-5 py-6 transition hover:border-[#3b6ea8] sm:px-7 sm:py-6">
                  <div className="flex items-start gap-4">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        toggleSelect(project.id);
                      }}
                      className="mt-1 shrink-0"
                      aria-label={checked ? uiText("取消选择项目") : uiText("选择项目")}
                    >
                      <GradientCheckbox checked={checked} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <Link href={`/${lang}/smart-eye/app/projects/${project.id}`} className="block text-2xl font-bold leading-tight text-foreground transition hover:text-foreground">
                            <span className="line-clamp-1">{project.projectName}</span>
                          </Link>
                          {project.summary ? <p className="mt-1 line-clamp-1 text-lg text-[#52637a]">{project.summary}</p> : null}
                        </div>
                        <button
                          type="button"
                          className="group flex size-8 shrink-0 items-center justify-center"
                          onClick={async (event) => {
                            event.preventDefault();
                            if (!confirm(uiText("删除此项目？"))) return;
                            try {
                              await projectsApi.delete(project.id);
                              toast.success(uiText("已删除"));
                              refetch();
                            } catch {
                              toast.error(uiText("删除失败"));
                            }
                          }}
                          aria-label={uiText("删除项目")}
                        >
                          <img src="/img/smart-eye/delete_g.svg" alt="" />
                        </button>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-4">
                        <span className="rounded-md border border-[#b8c3d0] px-4 py-1.5 text-sm text-foreground">{project.industry || uiText("未分类")}</span>
                        {project.buyerName ? <span className="rounded bg-input px-4 py-1.5 text-sm text-foreground">{project.buyerName}</span> : null}
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-7 text-xl text-[#52637a]">
                        <span className="inline-flex items-center gap-2">
                          <img src="/img/smart-eye/location.svg" alt="" />
                          {project.location || "-"}
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <img src="/img/smart-eye/money.svg" alt="" />
                          {project.budgetRange || "-"}
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[12px] border border-border bg-card px-8 py-16 text-center text-muted-foreground">
            <div className="mx-auto mb-4 size-12 rounded-lg border border-border bg-card" />
            <p className="font-medium text-foreground">{uiText("暂无项目")}</p>
            <p className="mt-2 text-sm">{uiText("点击“新建项目”手动添加，或在目标客户页一键创建")}</p>
          </div>
        )}
      </div>
    </section>
  );
}
