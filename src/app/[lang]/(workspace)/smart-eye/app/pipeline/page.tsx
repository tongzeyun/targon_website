"use client";

import { useUiText } from "@/app/[lang]/(workspace)/smart-eye/_hooks/use-ui-text";
import pageStyles from "@/app/[lang]/(workspace)/smart-eye/_styles/pages.module.css";

import { useLocale } from "@/app/[lang]/(workspace)/smart-eye/_hooks/use-locale";
import { formatPipelineAmount } from "@/app/[lang]/(workspace)/smart-eye/_lib/copy";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/app/[lang]/(workspace)/smart-eye/_components/ui/button";
import { Input } from "@/app/[lang]/(workspace)/smart-eye/_components/ui/input";
import { DatePicker } from "@/app/[lang]/(workspace)/smart-eye/_components/ui/date-picker";
import { Label } from "@/app/[lang]/(workspace)/smart-eye/_components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/app/[lang]/(workspace)/smart-eye/_components/ui/dialog";
import { toast } from "sonner";
import { useApi } from "@/app/[lang]/(workspace)/smart-eye/_hooks/use-api";
import { pipelineApi } from "@/lib/api/client";

const gradient = "linear-gradient(180deg, #5b9bff 0%, #464660 100%)";

const stages: Record<string, string> = {
  discovered: "发现机会",
  tech_exchange: "技术交流",
  proposal: "方案提交",
  testing: "样机测试",
  negotiation: "商务谈判",
  won: "已签约",
  lost: "已丢单",
};

const filters = [
  { key: "active", label: "活跃" },
  { key: "won", label: "已签约" },
  { key: "lost", label: "已丢单" },
  { key: "all", label: "全部" },
];

interface PipelineItem {
  id: string;
  projectId?: string;
  projectName?: string;
  currentStage?: string;
  dealAmount?: string;
  probability?: number;
  expectedCloseDate?: string;
  nextAction?: string;
  nextActionDate?: string;
  notes?: string;
}

interface PipelineEdit {
  [key: string]: unknown;
  id: string;
  currentStage?: string;
  dealAmount: string;
  nextAction: string;
  nextActionDate: string;
  notes: string;
  probability: number;
}

function parseDealAmount(dealAmount?: string): number {
  const value = parseFloat((dealAmount || "0").replace(/[^0-9.]/g, ""));
  return Number.isNaN(value) ? 0 : value;
}

export default function PipelinePage() {
  const uiText = useUiText();
  const lang = useLocale();
  const { data: items, loading, refetch } = useApi(() => pipelineApi.list());
  const [filter, setFilter] = useState("active");
  const [editing, setEditing] = useState<PipelineEdit | null>(null);
  const [saving, setSaving] = useState(false);

  const list = (Array.isArray(items) ? items : []) as PipelineItem[];

  const filtered = list.filter((pipeline) => {
    if (filter === "active") return pipeline.currentStage !== "won" && pipeline.currentStage !== "lost";
    if (filter === "won") return pipeline.currentStage === "won";
    if (filter === "lost") return pipeline.currentStage === "lost";
    return true;
  });

  const activeCount = list.filter((pipeline) => pipeline.currentStage !== "won" && pipeline.currentStage !== "lost").length;
  const actionCount = filtered.filter((pipeline) => pipeline.nextActionDate).length;
  const amountText = (() => {
    const amount = filtered.reduce((sum, pipeline) => {
      return sum + (parseDealAmount(pipeline.dealAmount) * (pipeline.probability || 50)) / 100;
    }, 0);
    return Math.round(amount);
  })();

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await pipelineApi.update(editing.id, editing);
      toast.success(uiText("已更新"));
      setEditing(null);
      refetch();
    } catch {
      toast.error(uiText("保存失败"));
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(uiText("删除此管线记录？"))) return;
    try {
      await pipelineApi.update(id, { currentStage: "lost" });
      toast.success(uiText("已标记为丢单"));
      refetch();
    } catch {
      toast.error(uiText("失败"));
    }
  };

  const startEdit = (pipeline: PipelineItem) => {
    setEditing({
      id: pipeline.id,
      currentStage: pipeline.currentStage,
      dealAmount: pipeline.dealAmount || "",
      nextAction: pipeline.nextAction || "",
      nextActionDate: pipeline.nextActionDate?.slice(0, 10) || "",
      notes: pipeline.notes || "",
      probability: pipeline.probability || 50,
    });
  };

  return (
    <div className={`${pageStyles.page} ${pageStyles.pipeline}`}>
      <div className="mb-[31px]">
        <h1>{uiText("销售管线")}</h1>
        <p className="mt-2 text-base leading-7 text-[#52637a] sm:text-[22px] sm:leading-8">{uiText("管理销售机会从发现到成交")}</p>
      </div>

      <div className="mb-8 grid gap-[30px] xl:grid-cols-3">
        <StatCard icon={'/img/smart-eye/active.svg'} label={uiText("活跃")} value={String(activeCount)} />
        <StatCard icon={'/img/smart-eye/dollar.svg'} label={uiText("加权金额")} value={formatPipelineAmount(amountText, lang)} />
        <StatCard icon={'/img/smart-eye/recent.svg'} label={uiText("近期行动")} value={String(actionCount)} />
      </div>

      <div className="mb-8 w-full rounded-[9px] border border-border bg-input p-1 sm:mb-10 sm:w-fit">
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
          {filters.map((item) => {
            const active = filter === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={[
                  "h-[42px] min-w-0 rounded-[8px] px-2 text-base font-semibold transition sm:min-w-[96px] sm:px-5 sm:text-[20px]",
                  active
                    ? "text-white"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
                style={active ? { background: gradient } : undefined}
              >
                {uiText(item.label)}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="rounded-[14px] border border-border bg-card py-14 text-center text-muted-foreground">{uiText("加载中...")}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[14px] border border-border bg-card py-14 text-center text-muted-foreground">{uiText("暂无数据，在项目详情页添加")}</div>
      ) : (
        <div className="space-y-5">
          {filtered.map((pipeline) => (
            <PipelineCard
              key={pipeline.id}
              pipeline={pipeline}
              onEdit={() => startEdit(pipeline)}
              onDelete={() => handleDelete(pipeline.id)}
            />
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent
          className="smart-eye-dialog"
          overlayClassName="bg-black/70 supports-backdrop-filter:backdrop-blur-sm"
        >
          <DialogHeader>
            <DialogTitle>{uiText("编辑管线")}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="smart-eye-dialog__body space-y-3">
              <div className="smart-eye-dialog__columns grid grid-cols-2 gap-3">
                <div>
                  <Label>{uiText("阶段")}</Label>
                  <select
                    className="smart-eye-dialog__select"
                    value={editing.currentStage}
                    onChange={(event) => setEditing({ ...editing, currentStage: event.target.value })}
                  >
                    {Object.entries(stages).filter(([key]) => key !== "won" && key !== "lost").map(([key, value]) => (
                      <option key={key} value={key}>{value}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>{uiText("成交概率(%)")}</Label>
                  <Input
                    type="number"
                    value={editing.probability}
                    onChange={(event) => setEditing({ ...editing, probability: parseInt(event.target.value) || 0 })}
                  />
                </div>
              </div>
              <div>
                <Label>{uiText("预计金额")}</Label>
                <Input
                  value={editing.dealAmount}
                  onChange={(event) => setEditing({ ...editing, dealAmount: event.target.value })}
                />
              </div>
              <div>
                <Label>{uiText("下一步行动")}</Label>
                <Input
                  value={editing.nextAction}
                  onChange={(event) => setEditing({ ...editing, nextAction: event.target.value })}
                />
              </div>
              <div className="smart-eye-dialog__columns grid grid-cols-2 gap-3">
                <div>
                  <Label>{uiText("行动日期")}</Label>
                  <DatePicker
                    value={editing.nextActionDate}
                    onChange={(nextActionDate) => setEditing({ ...editing, nextActionDate })}
                  />
                </div>
                <div>
                  <Label>{uiText("状态")}</Label>
                  <select
                    className="smart-eye-dialog__select"
                    value={editing.currentStage}
                    onChange={(event) => setEditing({ ...editing, currentStage: event.target.value })}
                  >
                    <option value="discovered">{uiText("活跃")}</option>
                    <option value="won">{uiText("已签约")}</option>
                    <option value="lost">{uiText("已丢单")}</option>
                  </select>
                </div>
              </div>
              <div>
                <Label>{uiText("备注")}</Label>
                <Input
                  value={editing.notes || ""}
                  onChange={(event) => setEditing({ ...editing, notes: event.target.value })}
                />
              </div>
              <Button className="smart-eye-dialog-action btn-bg w-full" onClick={handleSave} disabled={saving}>
                {saving ? uiText("保存中...") : uiText("保存")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PipelineCard({
  pipeline,
  onEdit,
  onDelete,
}: {
  pipeline: PipelineItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const uiText = useUiText();
  const lang = useLocale();
  const closeDate = pipeline.expectedCloseDate?.slice(0, 10);
  const actionDate = pipeline.nextActionDate?.slice(0, 10);

  return (
    <article className="min-w-0 rounded-[14px] border border-border bg-card px-5 py-6 sm:px-7 sm:py-7">
      <div className="mb-4 flex items-start justify-between gap-4 sm:gap-6">
        <div className="min-w-0 flex-1">
          {pipeline.projectId ? (
            <Link
              href={`/${lang}/smart-eye/app/projects/${pipeline.projectId}`}
              className="block truncate text-[21px] font-bold leading-tight text-foreground transition hover:text-[#5b9bff] sm:text-[26px]"
            >
              {pipeline.projectName || uiText("项目详情")}
            </Link>
          ) : (
            <h2 className="truncate text-[21px] font-bold leading-tight text-foreground sm:text-[26px]">{pipeline.projectName || uiText("未关联项目")}</h2>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-base text-[#52637a] sm:gap-9 sm:text-[22px]">
            <span className="inline-flex items-center gap-2">
              <img src="/img/smart-eye/dollar_g.svg" alt="" />
              {pipeline.dealAmount || "-"}
            </span>
            <span>{uiText("概率：")}{pipeline.probability || 50}%</span>
            <span>{uiText("预计成交：")}{closeDate || "-"}</span>
            <StagePill stage={pipeline.currentStage} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-4 sm:gap-6">
          <button type="button" onClick={onEdit} className="text-[#52637a] transition hover:text-[#5b9bff]" aria-label={uiText("编辑管线")}>
            <img src="/img/smart-eye/edit.svg" alt="" />
          </button>
          {pipeline.currentStage !== "lost" && (
            <button type="button" onClick={onDelete} className="text-[#ff6b6b] transition hover:text-red-600" aria-label={uiText("删除管线")}>
              <img src="/img/smart-eye/delete.svg" alt="" />
            </button>
          )}
        </div>
      </div>

      {pipeline.nextAction && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-[10px] bg-[#5B9BFF24] px-4 py-3 text-base leading-7 text-[#5b9bff] sm:text-[18px]">
          <img src="/img/smart-eye/pipe_item.svg" alt="" />
          <span className="font-medium">{actionDate || uiText("待定")}</span>
          <span>{pipeline.nextAction}</span>
        </div>
      )}

      {pipeline.notes && <p className="text-[16px] leading-7 text-muted-foreground">{pipeline.notes}</p>}
    </article>
  );
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <section data-stat-card className="flex items-center rounded-[14px] border border-border bg-card px-5 py-6 sm:px-7">
      <div className="flex items-center gap-5">
        <div className="p-[13px] rounded-[8px] border border-[#5B9BFF73] bg-[#5B9BFF24]">
          <img src={icon} alt="" />
        </div>
        <div>
          <p className="text-[20px] font-semibold leading-tight text-foreground">{label}</p>
          <p className="mt-1 text-[32px] font-bold leading-none text-foreground">{value}</p>
        </div>
      </div>
    </section>
  );
}

function StagePill({ stage }: { stage?: string }) {
  const uiText = useUiText();
  if (!stage) return null;
  const label = stages[stage] || stage;
  return (
    <span className="rounded-[6px] border border-[#b8c3d0] bg-input px-3 py-1 text-[16px] text-foreground">
      {uiText(label)}
    </span>
  );
}
