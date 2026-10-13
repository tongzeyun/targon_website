"use client";

import { useI18n } from "@/lib/i18n";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useApi } from "@/lib/hooks/use-api";
import { pipelineApi } from "@/lib/api/client";
import Image from "next/image";

const gradient = "linear-gradient(135deg, #6FB1FF 14.64%, #8E8DFF 51.41%, #B07DFF 85.36%)";

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
      toast.success("已更新");
      setEditing(null);
      refetch();
    } catch {
      toast.error("保存失败");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("删除此管线记录？")) return;
    try {
      await pipelineApi.update(id, { currentStage: "lost" });
      toast.success("已标记为丢单");
      refetch();
    } catch {
      toast.error("失败");
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
    <div className="w-full min-w-0 max-w-[1665px] px-4 pb-24 pt-24 text-[#E8EDF7] sm:px-6 lg:px-8 lg:pb-10 lg:pt-[112px]">
      <div className="mb-9">
        <h1 className="text-[28px] font-bold leading-tight text-white sm:text-[36px]">销售管线</h1>
        <p className="mt-2 text-base leading-7 text-[#A4ADBD] sm:text-[22px] sm:leading-8">管理销售机会从发现到成交</p>
      </div>

      <div className="mb-9 grid gap-8 xl:grid-cols-3">
        <StatCard icon={'/img/active.png'} label="活跃" value={String(activeCount)} />
        <StatCard icon={'/img/dollar.png'} label="加权金额" value={`¥${amountText}万`} />
        <StatCard icon={'/img/recent.png'} label="近期行动" value={String(actionCount)} />
      </div>

      <div className="mb-8 w-full rounded-[9px] border border-[#1D2533] bg-[#060A11] p-1 sm:mb-11 sm:w-fit">
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
                    ? "text-white shadow-[0_0_18px_rgba(111,177,255,0.46)]"
                    : "text-[#687286] hover:text-slate-200",
                ].join(" ")}
                style={active ? { background: gradient } : undefined}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="rounded-[14px] border border-[#202837] bg-[#141922] py-14 text-center text-[#687286]">加载中...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[14px] border border-[#202837] bg-[#141922] py-14 text-center text-[#687286]">暂无数据，在项目详情页添加</div>
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
            <DialogTitle>编辑管线</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="smart-eye-dialog__body space-y-3">
              <div className="smart-eye-dialog__columns grid grid-cols-2 gap-3">
                <div>
                  <Label>阶段</Label>
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
                  <Label>成交概率(%)</Label>
                  <Input
                    type="number"
                    value={editing.probability}
                    onChange={(event) => setEditing({ ...editing, probability: parseInt(event.target.value) || 0 })}
                  />
                </div>
              </div>
              <div>
                <Label>预计金额</Label>
                <Input
                  value={editing.dealAmount}
                  onChange={(event) => setEditing({ ...editing, dealAmount: event.target.value })}
                />
              </div>
              <div>
                <Label>下一步行动</Label>
                <Input
                  value={editing.nextAction}
                  onChange={(event) => setEditing({ ...editing, nextAction: event.target.value })}
                />
              </div>
              <div className="smart-eye-dialog__columns grid grid-cols-2 gap-3">
                <div>
                  <Label>行动日期</Label>
                  <DatePicker
                    value={editing.nextActionDate}
                    onChange={(nextActionDate) => setEditing({ ...editing, nextActionDate })}
                  />
                </div>
                <div>
                  <Label>状态</Label>
                  <select
                    className="smart-eye-dialog__select"
                    value={editing.currentStage}
                    onChange={(event) => setEditing({ ...editing, currentStage: event.target.value })}
                  >
                    <option value="discovered">活跃</option>
                    <option value="won">已签约</option>
                    <option value="lost">已丢单</option>
                  </select>
                </div>
              </div>
              <div>
                <Label>备注</Label>
                <Input
                  value={editing.notes || ""}
                  onChange={(event) => setEditing({ ...editing, notes: event.target.value })}
                />
              </div>
              <Button className="smart-eye-dialog-action btn-bg w-full" onClick={handleSave} disabled={saving}>
                {saving ? "保存中..." : "保存"}
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
  const { lang } = useI18n();
  const closeDate = pipeline.expectedCloseDate?.slice(0, 10);
  const actionDate = pipeline.nextActionDate?.slice(0, 10);

  return (
    <article className="min-w-0 rounded-[14px] border border-[#202837] bg-[#141922] px-5 py-6 sm:px-7 sm:py-7">
      <div className="mb-4 flex items-start justify-between gap-4 sm:gap-6">
        <div className="min-w-0 flex-1">
          {pipeline.projectId ? (
            <Link
              href={`/${lang}/smart-eye/app/projects/${pipeline.projectId}`}
              className="block truncate text-[21px] font-bold leading-tight text-white transition hover:text-[#6FB1FF] sm:text-[26px]"
            >
              {pipeline.projectName || "项目详情"}
            </Link>
          ) : (
            <h2 className="truncate text-[21px] font-bold leading-tight text-white sm:text-[26px]">{pipeline.projectName || "未关联项目"}</h2>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-base text-[#A4ADBD] sm:gap-9 sm:text-[22px]">
            <span className="inline-flex items-center gap-2">
              <Image src="/img/dollar_g.png" alt="dollar" width={18} height={18} />
              {pipeline.dealAmount || "-"}
            </span>
            <span>概率：{pipeline.probability || 50}%</span>
            <span>预计成交：{closeDate || "-"}</span>
            <StagePill stage={pipeline.currentStage} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-4 sm:gap-6">
          <button type="button" onClick={onEdit} className="text-[#A4ADBD] transition hover:text-[#6FB1FF]" aria-label="编辑管线">
            <Image src="/img/edit.png" alt="edit" width={18} height={18} />
          </button>
          {pipeline.currentStage !== "lost" && (
            <button type="button" onClick={onDelete} className="text-[#FF6B6B] transition hover:text-[#FF8585]" aria-label="删除管线">
              <Image src="/img/delete.png" alt="delete" width={18} height={18} />
            </button>
          )}
        </div>
      </div>

      {pipeline.nextAction && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-[10px] bg-[#5B9BFF24] px-4 py-3 text-base leading-7 text-[#5B9BFF] sm:text-[18px]">
          <Image src="/img/pipe_item.png" alt="clock" width={16} height={16} />
          <span className="font-medium">{actionDate || "待定"}</span>
          <span>{pipeline.nextAction}</span>
        </div>
      )}

      {pipeline.notes && <p className="text-[16px] leading-7 text-[#687286]">{pipeline.notes}</p>}
    </article>
  );
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <section className="rounded-[14px] border border-[#202837] bg-[#141922] px-5 py-8 sm:px-7 sm:py-[50px]">
      <div className="flex items-center gap-5">
        <div className="p-[13px] rounded-[8px] border border-[#5B9BFF73] bg-[#5B9BFF24]">
          <Image src={icon} alt={label} width={22} height={22} />
        </div>
        <div>
          <p className="text-[20px] font-semibold leading-tight text-white">{label}</p>
          <p className="mt-1 text-[32px] font-bold leading-none text-white">{value}</p>
        </div>
      </div>
    </section>
  );
}

function StagePill({ stage }: { stage?: string }) {
  if (!stage) return null;
  const label = stages[stage] || stage;
  return (
    <span className="rounded-[6px] border border-[#2B5E9D] bg-[#060A11] px-3 py-1 text-[16px] text-[#D8DEEA]">
      {label}
    </span>
  );
}
