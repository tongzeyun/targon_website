"use client";

import { useI18n } from "@/lib/i18n";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/lib/hooks/use-api";
import { accountsApi, projectsApi } from "@/lib/api/client";
import { toast } from "sonner";
import Image from "next/image";
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

const checkboxGradient = "linear-gradient(135deg, #6FB1FF 14.64%, #8E8DFF 51.41%, #B07DFF 85.36%)";

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
  const { lang } = useI18n();
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
    if (!confirm(`删除选中的 ${selected.size} 个项目？`)) return;
    setDeleting(true);
    let count = 0;
    for (const id of selected) {
      try {
        await projectsApi.delete(id);
        count++;
      } catch {}
    }
    toast.success(`删除了 ${count} 个项目`);
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
      toast.error("请输入项目名称");
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
      toast.success("项目已创建");
      setShowCreate(false);
      setForm({ projectName: "", buyerName: "", budgetRange: "", location: "", deadline: "", summary: "", accountId: "", industry: "半导体" });
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建失败");
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
    <section className="min-h-[calc(100dvh-64px)] w-full min-w-0 max-w-full bg-[#070B14] px-4 pb-24 pt-24 text-slate-100 sm:px-6 lg:px-8 lg:pb-10 lg:pt-[112px]">
      <div className="max-w-[1665px]">
        <div className="mb-8 flex flex-col items-stretch gap-5 sm:flex-row sm:items-start sm:justify-between lg:mb-10">
          <div>
            <h1 className="text-[28px] font-bold leading-tight text-white sm:text-[32px]">项目跟进</h1>
            <p className="mt-3 text-base text-[#A6AEBD] sm:text-xl">管理你的销售项目，从发现到成交</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex size-10 items-center justify-center rounded-[10px] border border-[#253048] bg-[#111722] transition hover:border-[#3B6EA8]"
              onClick={handleExport}
              title="导出项目"
            >
              <Image src="/img/download.png" alt="download" width={14} height={16} />
            </button>
            <div className="btn-bg h-10 rounded-[10px] px-5 text-sm font-semibold" onClick={() => setShowCreate(true)}>
              新建项目
            </div>
          </div>
        </div>

        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent
            className="smart-eye-dialog max-w-lg"
            overlayClassName="bg-black/70 supports-backdrop-filter:backdrop-blur-sm"
          >
            <DialogHeader><DialogTitle>新建项目</DialogTitle></DialogHeader>
            <div className="smart-eye-dialog__body space-y-3">
              <div className="space-y-1">
                <Label>项目名称 *</Label>
                <Input value={form.projectName} onChange={(event) => setForm({ ...form, projectName: event.target.value })} placeholder="如：某晶圆厂真空泵采购项目" />
              </div>
              <div className="smart-eye-dialog__columns grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>采购单位</Label>
                  <Input value={form.buyerName} onChange={(event) => setForm({ ...form, buyerName: event.target.value })} placeholder="公司/机构名称" />
                </div>
                <div className="space-y-1">
                  <Label>预算</Label>
                  <Input value={form.budgetRange} onChange={(event) => setForm({ ...form, budgetRange: event.target.value })} placeholder="如 ¥200-500万" />
                </div>
              </div>
              <div className="smart-eye-dialog__columns grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>所在地</Label>
                  <Input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="城市" />
                </div>
                <div className="space-y-1">
                  <Label>截止日期</Label>
                  <DatePicker value={form.deadline} onChange={(deadline) => setForm({ ...form, deadline })} placeholder="选择截止日期" />
                </div>
              </div>
              <div className="space-y-1">
                <Label>关联客户</Label>
                <select
                  className="smart-eye-dialog__select"
                  value={form.accountId}
                  onChange={(event) => setForm({ ...form, accountId: event.target.value })}
                >
                  <option value="">不关联</option>
                  {accountList.map((account) => <option key={account.id} value={account.id}>{account.companyName}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>行业</Label>
                <Input value={form.industry} onChange={(event) => setForm({ ...form, industry: event.target.value })} placeholder="输入行业名称" />
              </div>
              <div className="space-y-1">
                <Label>项目描述</Label>
                <Textarea value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} rows={3} placeholder="项目背景、采购内容、关键信息..." />
              </div>
              <Button className="smart-eye-dialog-action btn-bg w-full" onClick={handleCreate}>创建项目</Button>
            </div>
          </DialogContent>
        </Dialog>

        {projectList.length > 0 ? (
          <div className="mb-8 flex flex-wrap items-center gap-4">
            <button type="button" onClick={selectAll} className="inline-flex items-center gap-2 text-base text-[#A6AEBD] transition hover:text-white">
              <GradientCheckbox checked={allSelected} />
              {allSelected ? "取消全选" : `全选（${projectList.length}）`}
            </button>
            {selected.size > 0 ? (
              <button
                type="button"
                className="rounded-md border border-[#7A3030] px-3 py-1.5 text-sm text-[#FF7474] transition hover:bg-[#2B1518] disabled:opacity-50"
                onClick={deleteSelected}
                disabled={deleting}
              >
                删除选中（{selected.size}）
              </button>
            ) : null}
            <span className="w-full text-sm text-[#747D91] sm:ml-auto sm:w-auto">点击复选框选择，点击标题进入详情</span>
          </div>
        ) : null}

        {loading ? (
          <div className="grid gap-8 lg:grid-cols-2">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-[216px] animate-pulse rounded-[12px] border border-[#202839] bg-[#131821]" />
            ))}
          </div>
        ) : projectList.length > 0 ? (
          <div className="grid gap-8 lg:grid-cols-2">
            {projectList.map((project) => {
              const checked = selected.has(project.id);
              return (
                <article key={project.id} className="min-w-0 rounded-[12px] border border-[#202839] bg-[#131821] px-5 py-6 transition hover:border-[#3B6EA8] sm:px-8 sm:py-8">
                  <div className="flex items-start gap-4">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        toggleSelect(project.id);
                      }}
                      className="mt-1 shrink-0"
                      aria-label={checked ? "取消选择项目" : "选择项目"}
                    >
                      <GradientCheckbox checked={checked} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <Link href={`/${lang}/smart-eye/app/projects/${project.id}`} className="block text-2xl font-bold leading-tight text-[#F1F5FA] transition hover:text-white">
                            <span className="line-clamp-1">{project.projectName}</span>
                          </Link>
                          {project.summary ? <p className="mt-1 line-clamp-1 text-lg text-[#A6AEBD]">{project.summary}</p> : null}
                        </div>
                        <button
                          type="button"
                          className="group flex size-8 shrink-0 items-center justify-center"
                          onClick={async (event) => {
                            event.preventDefault();
                            if (!confirm("删除此项目？")) return;
                            try {
                              await projectsApi.delete(project.id);
                              toast.success("已删除");
                              refetch();
                            } catch {
                              toast.error("删除失败");
                            }
                          }}
                          aria-label="删除项目"
                        >
                          <Image src="/img/delete_g.png" alt="trash" width={18} height={18} />
                        </button>
                      </div>

                      <div className="mt-5 flex flex-wrap items-center gap-4">
                        <span className="rounded-md border border-[#396AA8] px-4 py-1.5 text-sm text-[#DDE3EC]">{project.industry || "未分类"}</span>
                        {project.buyerName ? <span className="rounded bg-[#050914] px-4 py-1.5 text-sm text-[#DDE3EC]">{project.buyerName}</span> : null}
                      </div>

                      <div className="mt-6 flex flex-wrap items-center gap-7 text-xl text-[#A6AEBD]">
                        <span className="inline-flex items-center gap-2">
                          <Image src="/img/location.png" alt="location" width={16} height={19} />
                          {project.location || "-"}
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <Image src="/img/money.png" alt="money" width={16} height={19} />
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
          <div className="rounded-[12px] border border-[#202839] bg-[#131821] px-8 py-16 text-center text-[#8D96A7]">
            <div className="mx-auto mb-4 size-12 rounded-lg border border-[#253048] bg-[#111722]" />
            <p className="font-medium text-[#DDE3EC]">暂无项目</p>
            <p className="mt-2 text-sm">点击“新建项目”手动添加，或在目标客户页一键创建</p>
          </div>
        )}
      </div>
    </section>
  );
}
