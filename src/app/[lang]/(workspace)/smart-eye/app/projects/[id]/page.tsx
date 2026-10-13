"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/lib/hooks/use-api";
import { pipelineApi, projectsApi } from "@/lib/api/client";
import { parseJson } from "@/lib/utils";
import { toast } from "sonner";
import Image from "next/image";

const typeLabels: Record<string, string> = {
  public_bid: "公开招标",
  early_signal: "早期信号",
  potential_opportunity: "潜在机会",
};

const signalLabels: Record<string, string> = {
  bid: "招标公告",
  eia: "环评公示",
  land: "土地成交",
  approval: "发改立项",
  planning: "规划公示",
  company_change: "企业变更",
  recruitment: "招聘信号",
  news: "行业新闻",
};

const stageLabels: Record<string, string> = {
  discovered: "发现机会",
  tech_exchange: "技术交流",
  proposal: "方案提交",
  testing: "样机测试",
  negotiation: "商务谈判",
  won: "已签约",
  lost: "已丢单",
};

interface PipelineItem {
  id: string;
  projectId?: string;
  currentStage?: string;
  dealAmount?: string;
  probability?: number;
  nextAction?: string;
  nextActionDate?: string;
}

interface ProjectSignal {
  signalType?: string;
  publishDate?: string;
  title?: string;
  sourceName?: string;
  sourceUrl?: string;
  extractedData?: unknown;
}

interface BidDocument {
  bidPlatform?: string;
  bidNumber?: string;
  budgetAmount?: string;
  submissionDeadline?: string;
  requirements?: string;
}

interface ProjectDetail {
  projectName?: string;
  projectType?: string;
  industry?: string;
  matchScore?: number;
  budgetRange?: string;
  summary?: string;
  location?: string;
  buyerName?: string;
  fundingSource?: string;
  confidenceScore?: number;
  buyerContact?: unknown;
  timeline?: unknown;
  signals?: ProjectSignal[];
  bidDocuments?: BidDocument[];
}

interface BuyerContact {
  name?: string;
  phone?: string;
  email?: string;
}

interface TimelineItem {
  label: string;
  value: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [activeTab, setActiveTab] = useState<"overview" | "signals" | "bidding">("overview");
  const [showPipeline, setShowPipeline] = useState(false);
  const [pipeForm, setPipeForm] = useState({ nextAction: "", nextActionDate: "", dealAmount: "", currentStage: "discovered", notes: "" });
  const [pipeSaving, setPipeSaving] = useState(false);
  const [pipelines, setPipelines] = useState<PipelineItem[]>([]);
  const { data, loading } = useApi(() => projectsApi.get(id), [id]);

  useEffect(() => {
    pipelineApi
      .list()
      .then((items) => {
        if (Array.isArray(items)) {
          setPipelines(
            (items as PipelineItem[]).filter((item) => item.projectId === id)
          );
        }
      })
      .catch(() => {});
  }, [id]);

  const project = data as ProjectDetail | undefined;
  const signals = project?.signals || [];
  const bidDocs = project?.bidDocuments || [];
  const buyerContact = asRecord(parseJson(project?.buyerContact)) as BuyerContact;
  const timeline = asRecord(parseJson(project?.timeline));

  const timelineItems = useMemo<TimelineItem[]>(() => {
    const labels: Record<string, string> = {
      bidDeadline: "投标截止",
      announceDate: "开标日期",
      startDate: "预计开工",
      estimatedBidDate: "预计招标",
      estimatedStartDate: "预计启动",
      completion: "预计完工",
      estimatedCompletion: "预计完工",
    };
    return Object.entries(labels)
      .map(([key, label]) => {
        const value = timeline[key];
        if (!value || String(value).trim().length === 0 || String(value) === "null") return null;
        return { label, value: String(value).slice(0, 10) };
      })
      .filter((item): item is TimelineItem => item !== null);
  }, [timeline]);

  const openPipeline = () => {
    setPipeForm({
      nextAction: "",
      nextActionDate: "",
      dealAmount: project?.budgetRange || "",
      currentStage: "discovered",
      notes: "",
    });
    setShowPipeline(true);
  };

  const handleAddToPipeline = async () => {
    setPipeSaving(true);
    try {
      const created = await pipelineApi.create({
        projectId: id,
        dealAmount: pipeForm.dealAmount,
        currentStage: pipeForm.currentStage,
        notes: pipeForm.notes,
        nextAction: pipeForm.nextAction,
        nextActionDate: pipeForm.nextActionDate,
      });
      toast.success("已添加到管线");
      setPipelines((items) => [...items, created as PipelineItem]);
      setShowPipeline(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
    setPipeSaving(false);
  };

  if (loading) {
    return (
      <section className="min-h-[calc(100dvh-64px)] w-full min-w-0 max-w-full bg-[#070B14] px-4 pb-24 pt-24 text-slate-100 sm:px-6 lg:px-8 lg:pb-10 lg:pt-[110px]">
        <div className="grid max-w-[1560px] gap-6 lg:grid-cols-[minmax(0,1000px)_minmax(320px,530px)]">
          <div className="space-y-6">
            <div className="h-16 w-2/3 animate-pulse rounded-[12px] bg-[#11161F]" />
            <div className="h-[106px] animate-pulse rounded-[14px] bg-[#11161F]" />
            <div className="h-[134px] animate-pulse rounded-[14px] bg-[#11161F]" />
          </div>
          <div className="h-[265px] animate-pulse rounded-[14px] bg-[#11161F]" />
        </div>
      </section>
    );
  }

  if (!project) {
    return (
      <section className="min-h-[calc(100dvh-64px)] w-full min-w-0 max-w-full bg-[#070B14] px-4 pb-24 pt-24 text-center text-[#8D96A7] sm:px-6 lg:px-8 lg:pb-10 lg:pt-[110px]">
        项目不存在
      </section>
    );
  }

  const tabs = [
    { value: "overview" as const, label: "项目概览" },
    { value: "signals" as const, label: `情报来源（${signals.length}）` },
    ...(bidDocs.length > 0 ? [{ value: "bidding" as const, label: "招标详情" }] : []),
  ];

  return (
    <section className="min-h-[calc(100dvh-64px)] w-full min-w-0 max-w-full bg-[#070B14] px-4 pb-24 pt-24 text-[#F2F4F8] sm:px-6 lg:px-8 lg:pb-10 lg:pt-[110px]">
      <div className="max-w-[1560px]">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-[24px] font-semibold leading-[1.35] text-[#F2F4F8] lg:text-[20px]">
              {project.projectName || "未命名项目"}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <span className="rounded-[6px] border border-[rgba(91,155,255,0.45)] px-4 py-1 text-sm tracking-[0.03em] text-[#F2F4F8]">
                {typeLabels[project.projectType || ""] || project.projectType || "-"}
              </span>
              <span className="rounded-[6px] border border-white/5 bg-[#04070D] px-4 py-1 text-sm text-[#F2F4F8]">
                {project.industry || "未知行业"}
              </span>
              {project.matchScore ? (
                <span className="rounded-[6px] border border-[#3F9B6C] bg-[#1D4E3B] px-4 py-1 text-sm text-[#71D49C]">
                  匹配 {project.matchScore}%
                </span>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={openPipeline}
            className="btn-bg h-[34px] w-fit rounded-[10px] px-4 text-[13px] font-semibold text-[#0A0613] lg:mt-0"
          >
            添加到销售管线
          </button>
        </div>

        <Dialog open={showPipeline} onOpenChange={setShowPipeline}>
          <DialogContent
            className="smart-eye-dialog max-w-lg"
            overlayClassName="bg-black/70 supports-backdrop-filter:backdrop-blur-sm"
          >
            <DialogHeader><DialogTitle>添加到销售管线</DialogTitle></DialogHeader>
            <div className="smart-eye-dialog__body space-y-3">
              <div className="smart-eye-dialog__columns grid grid-cols-2 gap-3">
                <div><Label>当前阶段</Label>
                  <select className="smart-eye-dialog__select" value={pipeForm.currentStage} onChange={(event) => setPipeForm({ ...pipeForm, currentStage: event.target.value })}>
                    <option value="discovered">发现机会</option>
                    <option value="tech_exchange">技术交流</option>
                    <option value="proposal">方案提交</option>
                    <option value="testing">样机测试</option>
                    <option value="negotiation">商务谈判</option>
                  </select>
                </div>
                <div><Label>预计金额</Label><Input value={pipeForm.dealAmount} onChange={(event) => setPipeForm({ ...pipeForm, dealAmount: event.target.value })} placeholder="¥200万" /></div>
              </div>
              <div><Label>下一步行动</Label><Input value={pipeForm.nextAction} onChange={(event) => setPipeForm({ ...pipeForm, nextAction: event.target.value })} placeholder="如：安排技术团队到现场交流" /></div>
              <div className="smart-eye-dialog__columns grid grid-cols-2 gap-3">
                <div><Label>行动日期</Label><DatePicker value={pipeForm.nextActionDate} onChange={(nextActionDate) => setPipeForm({ ...pipeForm, nextActionDate })} /></div>
              </div>
              <div><Label>备注</Label><Textarea value={pipeForm.notes} onChange={(event) => setPipeForm({ ...pipeForm, notes: event.target.value })} rows={3} /></div>
              <button type="button" className="smart-eye-dialog-action btn-bg w-full" onClick={handleAddToPipeline} disabled={pipeSaving}>
                {pipeSaving ? "保存中..." : "添加到管线"}
              </button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="mb-6 flex w-full flex-col gap-1 rounded-[10px] bg-[#04070D] p-1 sm:w-fit sm:flex-row sm:flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={[
                "h-10 w-full min-w-0 rounded-[10px] px-4 text-base transition sm:w-auto sm:min-w-[164px] sm:px-7 sm:text-[20px]",
                activeTab === tab.value
                  ? "bg-[#6EA9F4] text-[#F2F4F8] shadow-[0_0_2px_rgba(138,184,255,0.75),0_0_24px_rgba(91,155,255,0.45)]"
                  : "text-[#6E7588] hover:text-[#B0B6C4]",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "overview" ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1000px)_minmax(320px,530px)]">
            <div className="space-y-6">
              <ProjectCard title="项目概述">
                <p className="text-sm text-[#B0B6C4]">{project.summary || "暂无描述"}</p>
              </ProjectCard>

              <ProjectCard title="时间节点">
                {timelineItems.length > 0 ? (
                  <div className="space-y-3">
                    {timelineItems.map((item) => (
                      <HighlightRow key={`${item.label}-${item.value}`} text={`${item.value}    ${item.label}`} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[#6E7588]">暂无时间节点</p>
                )}
              </ProjectCard>

              <ProjectCard title="销售管线">
                {pipelines.length > 0 ? (
                  <div className="space-y-4">
                    {pipelines.map((pipeline) => (
                      <div key={pipeline.id}>
                        <div className="mb-4 flex flex-wrap items-center gap-8 text-[20px] text-[#B0B6C4]">
                          <span className="flex items-center gap-2">
                            <Image src="/img/dollar_g.png" alt="money" width={20} height={20} className="size-4" />
                            <span>{pipeline.dealAmount || "-"}</span>
                          </span>
                          <span>概率：{pipeline.probability ?? 50}%</span>
                          <span>{stageLabels[pipeline.currentStage || ""] || pipeline.currentStage || "-"}</span>
                        </div>
                        {(pipeline.nextAction || pipeline.nextActionDate) ? (
                          <HighlightRow text={`${pipeline.nextActionDate?.slice(0, 10) || "-"}    ${pipeline.nextAction || "-"}`} />
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[#6E7588]">暂无销售管线记录</p>
                )}
              </ProjectCard>
            </div>

            <aside className="space-y-6">
              <ProjectCard title="基本信息" className="lg:min-h-[265px]">
                <div className="space-y-[18px] text-base">
                  <InfoRow label="预算" value={project.budgetRange || "-"} />
                  <InfoRow label="地点" value={project.location || "-"} />
                  <InfoRow label="采购单位" value={project.buyerName || "-"} />
                  <InfoRow label="资金来源" value={project.fundingSource || "-"} />
                  <InfoRow label="AI置信度" value={project.confidenceScore ? `${project.confidenceScore}%` : "-"} />
                </div>
              </ProjectCard>

              <ProjectCard title="联系人">
                {buyerContact.name || buyerContact.phone || buyerContact.email ? (
                  <div className="space-y-3 text-base">
                    {buyerContact.name ? <p className="text-[#B0B6C4]">{buyerContact.name}</p> : null}
                    {buyerContact.phone ? 
                      <p className="flex items-center gap-2 text-[#6E7588]">
                        <Image src="/img/phone.png" alt="phone" width={20} height={20} className="size-4" />
                        {buyerContact.phone}
                      </p> 
                      : 
                      null
                    }
                    {buyerContact.email ? <p className="text-[#6E7588]">{buyerContact.email}</p> : null}
                  </div>
                ) : (
                  <p className="text-base text-[#6E7588]">暂无联系人</p>
                )}
              </ProjectCard>
            </aside>
          </div>
        ) : null}

        {activeTab === "signals" ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {signals.length > 0 ? signals.map((signal, index) => {
              const extracted = asRecord(parseJson(signal.extractedData));
              return (
                <ProjectCard key={`${signal.title}-${index}`} title={signal.title || "未命名情报"}>
                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    <span className="rounded-[6px] border border-[rgba(91,155,255,0.45)] px-3 py-1 text-sm text-[#5B9BFF]">{signalLabels[signal.signalType || ""] || signal.signalType || "-"}</span>
                    <span className="text-sm text-[#6E7588]">{signal.publishDate?.slice(0, 10) || "-"}</span>
                    <span className="text-sm text-[#6E7588]">来源：{signal.sourceName || "-"}</span>
                  </div>
                  {Object.keys(extracted).length > 0 ? (
                    <div className="rounded-[10px] bg-[#04070D] p-4 text-sm text-[#B0B6C4]">
                      {Object.entries(extracted).slice(0, 5).map(([key, value]) => (
                        <div key={key} className="flex gap-2"><span className="text-[#6E7588]">{key}:</span><span>{String(value)}</span></div>
                      ))}
                    </div>
                  ) : null}
                  {signal.sourceUrl ? <a href={signal.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm text-[#5B9BFF]">查看来源</a> : null}
                </ProjectCard>
              );
            }) : (
              <ProjectCard title="情报来源"><p className="text-sm text-[#6E7588]">暂无信号数据</p></ProjectCard>
            )}
          </div>
        ) : null}

        {activeTab === "bidding" ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {bidDocs.map((doc, index) => (
              <ProjectCard key={`${doc.bidNumber}-${index}`} title={doc.bidPlatform || "招标文件"}>
                <div className="space-y-2 text-sm text-[#B0B6C4]">
                  <InfoLine label="编号" value={doc.bidNumber || "-"} />
                  <InfoLine label="预算" value={doc.budgetAmount || "-"} />
                  <InfoLine label="截止" value={doc.submissionDeadline || "-"} />
                  {doc.requirements ? <p>{doc.requirements}</p> : null}
                </div>
              </ProjectCard>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ProjectCard({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-[14px] border border-white/[0.06] bg-[#11161F] px-4 py-5 sm:px-[23px] sm:py-[21px] ${className}`}>
      <h2 className="mb-4 text-[20px] font-medium leading-[26px] text-[#F2F4F8]">{title}</h2>
      {children}
    </section>
  );
}

function HighlightRow({ text }: { text: string }) {
  return (
    <div className="flex min-h-12 items-center gap-3 rounded-[10px] bg-[rgba(91,155,255,0.14)] px-4 text-base text-[#5B9BFF]">
      <Image src="/img/node.png" alt="dot" width={16} height={16} className="size-4" />
      <span>{text}</span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <span className="shrink-0 text-[#6E7588]">{label}</span>
      <span className="text-right text-[#B0B6C4]">{value}</span>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return <p><span className="text-[#6E7588]">{label}：</span>{value}</p>;
}
