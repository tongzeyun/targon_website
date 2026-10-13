"use client";

import { useI18n } from "@/lib/i18n";

import { useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { JobStatus } from "@/app/[lang]/(workspace)/smart-eye/_components/jobs/job-status";
import Image from "next/image";
import {
  accountsApi,
  aiApi,
  contactsApi,
  decisionChainsApi,
  strategyCardsApi,
} from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { cn, parseJson } from "@/lib/utils";
import {
  DEFAULT_CONTACT_INFLUENCE,
  normalizeContactInfluenceLevel,
} from "@/lib/contact-influence";
import { resolveContactSaveAction } from "./contact-save-action";
import { InfluenceRating } from "./influence-rating";

type DetailTab = "overview" | "strategy" | "contacts";

interface AccountForm {
  [key: string]: unknown;
  companyName?: string;
  industry?: string;
  subIndustry?: string;
  size?: string;
  revenue?: string;
  website?: string;
  status?: string;
}

interface ContactItem {
  id?: string;
  name?: string;
  title?: string;
  department?: string;
  roleInDecision?: string;
  influenceLevel?: number;
  contactInfo?: unknown;
  notes?: string;
  _edit?: boolean;
  _new?: boolean;
  _deleted?: boolean;
}

interface Milestone {
  stage?: string;
  action?: string;
  expectedDate?: string;
  riskLevel?: string;
  tips?: string;
}

interface DecisionStep {
  step?: string;
  person?: string;
  title?: string;
  influence?: number;
  notes?: string;
}

interface StrategyForm {
  matchReasoning: string;
  recommendedApproach: string;
  competitorAnalysis: string;
  talkingPoints: string;
  riskWarnings: string;
  milestones: Milestone[];
  decisionSteps: DecisionStep[];
}

interface StrategyCardItem {
  id: string;
  recommendedApproach?: string;
  competitorAnalysis?: string;
  talkingPoints?: unknown;
  riskWarnings?: unknown;
  keyMilestones?: unknown;
}

interface DecisionChain {
  id: string;
  steps?: unknown;
}

interface LocationItem {
  city?: string;
  province?: string;
  type?: string;
}

interface AccountDetail {
  id: string;
  companyName?: string;
  industry?: string;
  subIndustry?: string;
  size?: string;
  revenue?: string;
  website?: string;
  status?: string;
  matchScore?: number;
  matchReasoning?: string;
  locations?: unknown;
  techStack?: unknown;
  contacts?: ContactItem[];
  strategyCards?: StrategyCardItem[];
  decisionChain?: DecisionChain;
}

const tabs: Array<{ value: DetailTab; label: string }> = [
  { value: "overview", label: "公司概览" },
  { value: "strategy", label: "销售策略卡" },
  { value: "contacts", label: "联系人" },
];

const milestoneRiskOptions = [
  { value: "low", label: "低风险" },
  { value: "medium", label: "中风险" },
  { value: "high", label: "高风险" },
];

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function getContactInfo(contact: ContactItem): Record<string, unknown> {
  return asRecord(parseJson(contact.contactInfo));
}

function getContactInfoValue(contact: ContactItem, key: "phone" | "email"): string {
  const value = getContactInfo(contact)[key];
  return typeof value === "string" ? value : "";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toDisplay(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (value == null || value === "") return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function AccountDetailPage() {
  const { lang } = useI18n();
  const params = useParams();
  const id = params.id as string;
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AccountForm>({});
  const [contactList, setContactList] = useState<ContactItem[]>([]);
  const [strategyForm, setStrategyForm] = useState<StrategyForm>({
    matchReasoning: "",
    recommendedApproach: "",
    competitorAnalysis: "",
    talkingPoints: "",
    riskWarnings: "",
    milestones: [],
    decisionSteps: [],
  });
  const [enrichJobId, setEnrichJobId] = useState<string | null>(null);
  const [enrichPending, setEnrichPending] = useState(false);
  const { data, loading, refetch } = useApi(() => accountsApi.get(id), [id]);

  if (loading) {
    return (
      <main className="min-h-[calc(100dvh-64px)] w-full min-w-0 max-w-full bg-[#070B14] px-4 pb-24 pt-24 text-[#F2F4F8] sm:px-6 lg:px-8 lg:pt-28">
        <Skeleton className="mb-4 h-8 w-80 bg-[#11161F]" />
        <Skeleton className="h-[260px] w-full bg-[#11161F]" />
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-[calc(100dvh-64px)] w-full min-w-0 max-w-full bg-[#070B14] px-4 pb-24 pt-24 text-center text-[#8D96A7] sm:px-6 lg:px-8 lg:pt-28">
        客户不存在
      </main>
    );
  }

  const account = data as AccountDetail;
  const contacts = account.contacts || [];
  const strategyCards = account.strategyCards || [];
  const decisionChain = account.decisionChain;
  const topCard = strategyCards[0];
  const locations = asArray<LocationItem>(parseJson(account.locations));
  const techStack = asRecord(parseJson(account.techStack));
  const visibleContacts = editing ? contactList : contacts;

  const startEdit = () => {
    setForm({
      companyName: account.companyName || "",
      industry: account.industry || "",
      subIndustry: account.subIndustry || "",
      size: account.size || "",
      revenue: account.revenue || "",
      website: account.website || "",
      status: account.status || "",
    });
    setContactList((contacts || []).map((c) => ({ ...c, _edit: false })));
    setStrategyForm({
      matchReasoning: account.matchReasoning || "",
      recommendedApproach: topCard?.recommendedApproach || "",
      competitorAnalysis: topCard?.competitorAnalysis || "",
      talkingPoints: asArray<string>(parseJson(topCard?.talkingPoints)).join("\n"),
      riskWarnings: asArray<string>(parseJson(topCard?.riskWarnings)).join("\n"),
      milestones: asArray<Milestone>(parseJson(topCard?.keyMilestones)),
      decisionSteps: decisionChain ? asArray<DecisionStep>(parseJson(decisionChain.steps)) : [],
    });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await accountsApi.update(id, form);
      for (const c of contactList) {
        const action = resolveContactSaveAction(c);
        if (action === "delete" && c.id) {
          await contactsApi.delete(c.id);
        } else if (action === "create") {
          await contactsApi.create({ ...c, accountId: id } as Record<string, unknown>);
        } else if (action === "update" && c.id) {
          await contactsApi.update(c.id, { ...c } as Record<string, unknown>);
        }
      }
      if (topCard && strategyForm.matchReasoning !== undefined) {
        await strategyCardsApi.update(topCard.id, {
          recommendedApproach: strategyForm.recommendedApproach,
          competitorAnalysis: strategyForm.competitorAnalysis,
          talkingPoints: strategyForm.talkingPoints.split("\n").filter(Boolean),
          riskWarnings: strategyForm.riskWarnings.split("\n").filter(Boolean),
          keyMilestones: strategyForm.milestones,
        });
        if (decisionChain) {
          await decisionChainsApi.update(decisionChain.id, {
            steps: strategyForm.decisionSteps,
          });
        }
      }
      toast.success("已保存");
      setEditing(false);
      refetch();
    } catch (e) {
      toast.error("保存失败: " + getErrorMessage(e));
    }
    setSaving(false);
  };

  const handleAIEnrich = async () => {
    setEnrichPending(true);
    try {
      const { jobId } = await aiApi.enrichAccount(id);
      if (!jobId) throw new Error("完善任务未创建");
      setEnrichJobId(jobId);
      toast.info("AI 完善任务已提交，正在后台处理");
    } catch (e) {
      toast.error(getErrorMessage(e));
      setEnrichPending(false);
    }
  };

  const handleEnrichDone = (job: unknown) => {
    const j = job as { status?: string; errorMessage?: string | null };
    setEnrichJobId(null);
    setEnrichPending(false);
    if (j.status === "succeeded") {
      toast.success("AI 完善完成");
      refetch();
    } else if (j.status === "failed") {
      toast.error(j.errorMessage || "AI 完善失败");
    }
  };

  const updateContact = (index: number, patch: Partial<ContactItem>) => {
    const next = [...contactList];
    next[index] = { ...next[index], ...patch, _edit: true };
    setContactList(next);
  };

  const addMilestone = () => {
    setStrategyForm({
      ...strategyForm,
      milestones: [...strategyForm.milestones, { stage: "", action: "", expectedDate: "", riskLevel: "low", tips: "" }],
    });
  };

  const addDecisionStep = () => {
    setStrategyForm({
      ...strategyForm,
      decisionSteps: [...strategyForm.decisionSteps, { step: "", person: "", title: "", influence: 3, notes: "" }],
    });
  };

  return (
    <main className="min-h-[calc(100dvh-64px)] w-full min-w-0 max-w-full bg-[#070B14] px-4 pb-24 pt-24 text-[#F2F4F8] sm:px-6 lg:px-8 lg:pb-14 lg:pt-[110px]">
      <section className="mx-auto w-full max-w-[1560px]">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-xl font-medium leading-[27px] text-[#F2F4F8]">
              {account.companyName || "未命名客户"}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <DetailTag>{account.industry || "未知行业"}</DetailTag>
              {account.subIndustry && <DetailTag bordered>{account.subIndustry}</DetailTag>}
              {account.matchScore != null && <ScoreTag score={account.matchScore} />}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {editing ? (
              <>
                <ActionButton onClick={() => setEditing(false)}>取消</ActionButton>
                <GradientButton onClick={handleSave} disabled={saving}>
                  {saving ? "保存中" : "保存修改"}
                </GradientButton>
              </>
            ) : (
              <ActionButton onClick={startEdit}>编辑</ActionButton>
            )}
            <ActionButton onClick={handleAIEnrich} disabled={enrichPending}>
              {enrichPending ? "处理中" : "AI 完善"}
            </ActionButton>
            <GradientButton onClick={() => { window.location.href = `/${lang}/smart-eye/app/accounts?new=true`; }}>
              添加客户
            </GradientButton>
          </div>
        </div>

        {enrichJobId && (
          <div className="mb-5 rounded-[14px] border border-white/[0.06] bg-[#11161F] p-4">
            <JobStatus jobId={enrichJobId} onDone={handleEnrichDone} />
          </div>
        )}

        <TabBar activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === "overview" && (
          <OverviewPanel
            account={account}
            editing={editing}
            form={form}
            locations={locations}
            techStack={techStack}
            onFormChange={(patch) => setForm({ ...form, ...patch })}
          />
        )}

        {activeTab === "strategy" && (
          <StrategyPanel
            account={account}
            topCard={topCard}
            decisionChain={decisionChain}
            editing={editing}
            strategyForm={strategyForm}
            onStrategyChange={(patch) => setStrategyForm({ ...strategyForm, ...patch })}
            onAddMilestone={addMilestone}
            onAddDecisionStep={addDecisionStep}
          />
        )}

        {activeTab === "contacts" && (
          <ContactsPanel
            contacts={visibleContacts}
            editing={editing}
            onAdd={() => setContactList([...contactList, { _new: true, _edit: true, name: "", title: "", department: "", roleInDecision: "", influenceLevel: DEFAULT_CONTACT_INFLUENCE, contactInfo: { phone: "", email: "" }, notes: "" }])}
            onChange={updateContact}
          />
        )}
      </section>
    </main>
  );
}

function TabBar({ activeTab, onChange }: { activeTab: DetailTab; onChange: (tab: DetailTab) => void }) {
  return (
    <div className="mb-5 grid h-12 w-full max-w-[500px] grid-cols-3 rounded-[10px] border border-white/[0.06] bg-[#04070D] p-1">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={cn(
            "rounded-[10px] text-base text-[#6E7588] transition-colors md:text-xl",
            activeTab === tab.value && "bg-[#6EA9F4] text-[#F2F4F8] shadow-[0_0_2px_rgba(138,184,255,0.75),0_0_24px_rgba(91,155,255,0.45)]",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function OverviewPanel({
  account,
  editing,
  form,
  locations,
  techStack,
  onFormChange,
}: {
  account: AccountDetail;
  editing: boolean;
  form: AccountForm;
  locations: LocationItem[];
  techStack: Record<string, unknown>;
  onFormChange: (patch: Partial<AccountForm>) => void;
}) {
  const fallbackRows = Object.keys(techStack).length > 0
    ? Object.entries(techStack)
    : [["process", "-"], ["wafersize", "-"]];

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <DarkCard title="基本信息" className={editing ? "min-h-[402px]" : "min-h-[265px]"}>
        {editing ? (
          <div className="grid gap-5">
            <EditableField label="公司名称" value={form.companyName || ""} onChange={(value) => onFormChange({ companyName: value })} wide />
            <div className="grid gap-5 md:grid-cols-2">
              <EditableField label="行业" value={form.industry || ""} onChange={(value) => onFormChange({ industry: value })} />
              <EditableField label="子行业" value={form.subIndustry || ""} onChange={(value) => onFormChange({ subIndustry: value })} />
              <EditableField label="规模" value={form.size || ""} onChange={(value) => onFormChange({ size: value })} />
              <EditableField label="营收" value={form.revenue || ""} onChange={(value) => onFormChange({ revenue: value })} />
            </div>
            <EditableField label="官网" value={form.website || ""} onChange={(value) => onFormChange({ website: value })} wide />
          </div>
        ) : (
          <div className="space-y-5">
            <InfoRow label="行业" value={`${account.industry || "-"} / ${account.subIndustry || "-"}`} />
            <InfoRow label="规模" value={account.size || "-"} />
            <InfoRow label="官网" value={account.website || "-"} />
            <InfoRow label="营收" value={account.revenue || "-"} />
            <InfoRow label="状态" value={account.status || "-"} />
          </div>
        )}
      </DarkCard>

      <DarkCard title="技术栈" className={editing ? "min-h-[402px]" : "min-h-[265px]"}>
        <div className="space-y-5">
          {fallbackRows.map(([key, value]) => (
            <InfoRow key={String(key)} label={String(key)} value={toDisplay(value)} />
          ))}
        </div>
      </DarkCard>

      <DarkCard title="分支机构" className="xl:col-span-2">
        {locations.length > 0 ? (
          <div className="space-y-4">
            {locations.map((location, index) => (
              <InfoRow
                key={`${location.city || "location"}-${index}`}
                label={location.city || location.province || "-"}
                value={location.type || "-"}
              />
            ))}
          </div>
        ) : (
          <InfoRow label="-" value="-" />
        )}
      </DarkCard>
    </div>
  );
}

function StrategyPanel({
  account,
  topCard,
  decisionChain,
  editing,
  strategyForm,
  onStrategyChange,
  onAddMilestone,
  onAddDecisionStep,
}: {
  account: AccountDetail;
  topCard?: StrategyCardItem;
  decisionChain?: DecisionChain;
  editing: boolean;
  strategyForm: StrategyForm;
  onStrategyChange: (patch: Partial<StrategyForm>) => void;
  onAddMilestone: () => void;
  onAddDecisionStep: () => void;
}) {
  const milestones = asArray<Milestone>(parseJson(topCard?.keyMilestones));
  const decisionSteps = decisionChain ? asArray<DecisionStep>(parseJson(decisionChain.steps)) : [];
  const talkingPoints = asArray<string>(parseJson(topCard?.talkingPoints));
  const riskWarnings = asArray<string>(parseJson(topCard?.riskWarnings));

  const updateMilestone = (index: number, patch: Partial<Milestone>) => {
    const next = [...strategyForm.milestones];
    next[index] = { ...next[index], ...patch };
    onStrategyChange({ milestones: next });
  };

  const removeMilestone = (index: number) => {
    onStrategyChange({
      milestones: strategyForm.milestones.filter((_, milestoneIndex) => milestoneIndex !== index),
    });
  };

  if (!topCard && !decisionChain && !editing) {
    return (
      <DarkCard className="flex min-h-[360px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-5 h-12 w-12 rounded-[10px] border border-[#6E7588]" />
          <p className="text-xl text-[#B0B6C4]">暂无策略卡</p>
          <p className="mt-2 text-base text-[#6E7588]">点“AI完善”或产品库的“发现”按钮生成</p>
        </div>
      </DarkCard>
    );
  }

  if (editing) {
    return (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1000px)_minmax(360px,530px)]">
        <div className="space-y-6">
          <DarkCard title="匹配分析">
            <EditableArea
              value={strategyForm.matchReasoning || account.matchReasoning || ""}
              onChange={(value) => onStrategyChange({ matchReasoning: value })}
              rows={2}
            />
          </DarkCard>
          <DarkCard
            title="关键里程碑"
            action={<SmallGradientButton onClick={onAddMilestone}>添加</SmallGradientButton>}
          >
            {strategyForm.milestones.length === 0 ? (
              <p className="text-lg text-[#B0B6C4]">关键里程碑</p>
            ) : (
              <div className="space-y-4">
                {strategyForm.milestones.map((milestone, index) => (
                  <div key={index} className="rounded-[10px] border border-white/[0.06] bg-[#04070D] p-4">
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <span className="text-sm font-medium text-[#8AB7FF]">里程碑 {index + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeMilestone(index)}
                        className="text-sm text-[#FF7474] transition hover:text-[#FF9A9A]"
                      >
                        删除
                      </button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <EditableField
                        label="阶段"
                        value={milestone.stage || ""}
                        onChange={(stage) => updateMilestone(index, { stage })}
                      />
                      <label className="block">
                        <span className="mb-2 block text-base text-[#B0B6C4]">预计日期</span>
                        <DatePicker
                          value={milestone.expectedDate || ""}
                          onChange={(expectedDate) => updateMilestone(index, { expectedDate })}
                          legacyHint="原预计时间不是具体日期，请选择后替换"
                          className="h-10 rounded-[10px] border-white/[0.06] bg-[#04070D] px-4 text-lg text-[#B0B6C4]"
                        />
                      </label>
                      <EditableField
                        label="行动"
                        value={milestone.action || ""}
                        onChange={(action) => updateMilestone(index, { action })}
                        wide
                      />
                      <label className="block">
                        <span className="mb-2 block text-base text-[#B0B6C4]">风险等级</span>
                        <Select
                          items={milestoneRiskOptions}
                          value={milestone.riskLevel || "low"}
                          onValueChange={(riskLevel) => {
                            if (riskLevel !== null) updateMilestone(index, { riskLevel });
                          }}
                        >
                          <SelectTrigger
                            aria-label="风险等级"
                            className="h-10 w-full rounded-[10px] border-white/[0.06] bg-[#04070D] px-4 text-base text-[#B0B6C4] hover:border-[#465A78] focus-visible:border-[#6FB1FF] focus-visible:ring-[#6FB1FF]/15"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent
                            align="start"
                            alignItemWithTrigger={false}
                            className="border border-[#334158] bg-[#111722] text-[#F2F4F8] shadow-2xl ring-0"
                          >
                            {milestoneRiskOptions.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                                className="px-2 py-1.5 text-[#C7CEDA] [--accent-foreground:#F2F4F8] focus:bg-[#263247] focus:text-[#F2F4F8]"
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>
                      <EditableField
                        label="提示"
                        value={milestone.tips || ""}
                        onChange={(tips) => updateMilestone(index, { tips })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DarkCard>
          <DarkCard title="沟通要点" caption="每行一个要点">
            <EditableArea
              value={strategyForm.talkingPoints}
              onChange={(value) => onStrategyChange({ talkingPoints: value })}
              rows={3}
            />
          </DarkCard>
        </div>

        <div className="space-y-6">
          <DarkCard title="推荐策略">
            <EditableField
              label=""
              value={strategyForm.recommendedApproach}
              onChange={(value) => onStrategyChange({ recommendedApproach: value })}
              wide
            />
          </DarkCard>
          <DarkCard
            title="决策链"
            action={<SmallGradientButton onClick={onAddDecisionStep}>添加</SmallGradientButton>}
          >
            {strategyForm.decisionSteps.length === 0 ? (
              <p className="text-lg text-[#B0B6C4]">决策链</p>
            ) : (
              <div className="space-y-3">
                {strategyForm.decisionSteps.map((step, index) => (
                  <EditableArea
                    key={index}
                    value={[step.step, step.person, step.title].filter(Boolean).join(" / ")}
                    onChange={(value) => {
                      const next = [...strategyForm.decisionSteps];
                      next[index] = { ...next[index], step: value };
                      onStrategyChange({ decisionSteps: next });
                    }}
                    rows={2}
                  />
                ))}
              </div>
            )}
          </DarkCard>
          <DarkCard title="竞争分析">
            <EditableArea
              value={strategyForm.competitorAnalysis}
              onChange={(value) => onStrategyChange({ competitorAnalysis: value })}
              rows={2}
            />
          </DarkCard>
          <DarkCard title="风险提示" caption="每行一个风险">
            <EditableArea
              value={strategyForm.riskWarnings}
              onChange={(value) => onStrategyChange({ riskWarnings: value })}
              rows={3}
            />
          </DarkCard>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1000px)_minmax(360px,530px)]">
      <div className="space-y-6">
        <DarkCard title="匹配分析">
          <p className="rounded-[10px] border border-white/[0.06] bg-[#04070D] px-4 py-3 text-base leading-7 text-[#B0B6C4]">
            {account.matchReasoning || "暂无分析"}
          </p>
        </DarkCard>
        <DarkCard title="关键里程碑">
          {milestones.length === 0 ? (
            <p className="text-base text-[#6E7588]">暂无关键里程碑</p>
          ) : (
            <div className="space-y-3">
              {milestones.map((milestone, index) => (
                <div key={index} className="rounded-[10px] border border-white/[0.06] bg-[#04070D] px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-[#F2F4F8]">{milestone.stage || `里程碑 ${index + 1}`}</span>
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-xs",
                      milestone.riskLevel === "high" && "bg-[#3A171B] text-[#FF8585]",
                      milestone.riskLevel === "medium" && "bg-[#302711] text-[#F6BE5B]",
                      (!milestone.riskLevel || milestone.riskLevel === "low") && "bg-[#163025] text-[#69D6A4]",
                    )}>
                      {milestone.riskLevel === "high" ? "高风险" : milestone.riskLevel === "medium" ? "中风险" : "低风险"}
                    </span>
                  </div>
                  {milestone.action && <p className="mt-2 text-base text-[#B0B6C4]">{milestone.action}</p>}
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-[#6E7588]">
                    {milestone.expectedDate && <span>预计日期：{milestone.expectedDate}</span>}
                    {milestone.tips && <span>提示：{milestone.tips}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DarkCard>
        <DarkCard title="沟通要点">
          <ItemList items={talkingPoints} empty="暂无沟通要点" />
        </DarkCard>
      </div>
      <div className="space-y-6">
        <DarkCard title="推荐策略">
          <p className="rounded-[10px] border border-white/[0.06] bg-[#04070D] px-4 py-3 text-base text-[#B0B6C4]">
            {topCard?.recommendedApproach || "-"}
          </p>
        </DarkCard>
        <DarkCard title="决策链">
          <ItemList items={decisionSteps.map((step) => [step.step, step.person, step.title].filter(Boolean).join(" · "))} empty="暂无决策链" />
        </DarkCard>
        <DarkCard title="竞争分析">
          <p className="rounded-[10px] border border-white/[0.06] bg-[#04070D] px-4 py-3 text-base leading-7 text-[#B0B6C4]">
            {topCard?.competitorAnalysis || "-"}
          </p>
        </DarkCard>
        <DarkCard title="风险提示">
          <ItemList items={riskWarnings} empty="暂无风险提示" />
        </DarkCard>
      </div>
    </div>
  );
}

function ContactsPanel({
  contacts,
  editing,
  onAdd,
  onChange,
}: {
  contacts: ContactItem[];
  editing: boolean;
  onAdd: () => void;
  onChange: (index: number, patch: Partial<ContactItem>) => void;
}) {
  const visible = contacts.map((contact, index) => ({ contact, index })).filter(({ contact }) => !contact._deleted);

  return (
    <div className="space-y-4">
      {editing && (
        <div className="flex justify-end">
          <GradientButton onClick={onAdd}>添加联系人</GradientButton>
        </div>
      )}
      {visible.length === 0 ? (
        <DarkCard className="flex min-h-[260px] items-center justify-center">
          <p className="text-xl text-[#8D96A7]">暂无联系人</p>
        </DarkCard>
      ) : (
        visible.map(({ contact, index }) => (
          <DarkCard key={contact.id || index} className="min-h-[109px]">
            {editing && contact._edit ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <EditableField label="姓名" value={contact.name || ""} onChange={(value) => onChange(index, { name: value })} />
                <EditableField label="职位" value={contact.title || ""} onChange={(value) => onChange(index, { title: value })} />
                <EditableField label="部门" value={contact.department || ""} onChange={(value) => onChange(index, { department: value })} />
                <EditableField label="角色" value={contact.roleInDecision || ""} onChange={(value) => onChange(index, { roleInDecision: value })} />
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-base text-[#B0B6C4]">影响力</p>
                    <InfluenceRating
                      value={contact.influenceLevel}
                      onValueChange={(value) => onChange(index, { influenceLevel: value })}
                    />
                  </div>
                  <EditableField
                    label="电话"
                    value={getContactInfoValue(contact, "phone")}
                    onChange={(value) => onChange(index, { contactInfo: { ...getContactInfo(contact), phone: value } })}
                  />
                  <EditableField
                    label="邮箱"
                    value={getContactInfoValue(contact, "email")}
                    onChange={(value) => onChange(index, { contactInfo: { ...getContactInfo(contact), email: value } })}
                  />
                </div>
                <div className="md:col-span-2 xl:col-span-3">
                  <p className="mb-2 text-base text-[#B0B6C4]">备注</p>
                  <EditableArea value={contact.notes || ""} onChange={(value) => onChange(index, { notes: value })} rows={2} />
                </div>
                <div className="flex items-end">
                  <ActionButton onClick={() => onChange(index, { _deleted: true })}>删除</ActionButton>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <IconPlaceholder />
                  <div className="min-w-0">
                    <p className="truncate text-xl font-medium text-[#F2F4F8]">
                      {contact.name || contact.title || "未命名联系人"}
                    </p>
                    <p className="mt-1 truncate text-base text-[#8D96A7]">
                      {[contact.title, contact.department].filter(Boolean).join(" · ") || "-"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[#8D96A7]">
                      <span>电话：<span className="text-[#B0B6C4]">{getContactInfoValue(contact, "phone") || "-"}</span></span>
                      <span>邮箱：<span className="text-[#B0B6C4]">{getContactInfoValue(contact, "email") || "-"}</span></span>
                    </div>
                    {contact.roleInDecision && <DetailTag className="mt-2 inline-flex">{contact.roleInDecision}</DetailTag>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-4 sm:gap-5">
                  <InfluenceRating value={contact.influenceLevel} readOnly />
                  {editing && (
                    <ActionButton
                      onClick={() => onChange(index, {
                        _edit: true,
                        influenceLevel: normalizeContactInfluenceLevel(contact.influenceLevel),
                      })}
                    >
                      编辑
                    </ActionButton>
                  )}
                </div>
              </div>
            )}
          </DarkCard>
        ))
      )}
    </div>
  );
}

function DarkCard({
  title,
  caption,
  action,
  className,
  children,
}: {
  title?: string;
  caption?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("min-w-0 rounded-[14px] border border-white/[0.06] bg-[#11161F] p-4 sm:p-6", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            {title && <h2 className="text-xl font-medium leading-[25.5px] text-[#F2F4F8]">{title}</h2>}
            {caption && <p className="mt-4 text-base text-[#B0B6C4]">{caption}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-6 text-base">
      <span className="text-[#6E7588]">{label}</span>
      <span className="min-w-0 truncate text-right text-[#B0B6C4]">{value || "-"}</span>
    </div>
  );
}

function EditableField({
  label,
  value,
  onChange,
  wide,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  wide?: boolean;
}) {
  return (
    <label className={cn("block", wide && "md:col-span-2")}>
      {label && <span className="mb-2 block text-base text-[#B0B6C4]">{label}</span>}
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-[10px] border border-white/[0.06] bg-[#04070D] px-4 text-lg text-[#B0B6C4] placeholder:text-[#6E7588]"
      />
    </label>
  );
}

function EditableArea({ value, onChange, rows }: { value: string; onChange: (value: string) => void; rows: number }) {
  return (
    <Textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={rows}
      className="min-h-0 resize-none rounded-[10px] border border-white/[0.06] bg-[#04070D] px-4 py-3 text-lg leading-7 text-[#B0B6C4] placeholder:text-[#6E7588]"
    />
  );
}

function DetailTag({ children, bordered = false, className }: { children: React.ReactNode; bordered?: boolean; className?: string }) {
  return (
    <span className={cn(
      "rounded-md px-3.5 py-1.5 text-sm leading-[16.5px] text-[#F2F4F8]",
      bordered ? "border border-[rgba(91,155,255,0.45)] bg-transparent" : "border border-white/[0.06] bg-[#04070D]",
      className,
    )}>
      {children}
    </span>
  );
}

function ScoreTag({ score }: { score: number }) {
  return (
    <span className="rounded-md border border-[#66D49E] bg-[rgba(102,212,158,0.34)] px-3.5 py-1.5 text-sm leading-[19.5px] text-[#66D49E]">
      {score}分
    </span>
  );
}

function ActionButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      disabled={disabled}
      className="h-[34px] rounded-[10px] border border-white/10 bg-[#11161F] px-4 text-sm text-[#F2F4F8] hover:bg-[#17202C] hover:text-[#F2F4F8]"
    >
      {children}
    </Button>
  );
}

function GradientButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="btn-bg h-[34px] rounded-[10px] px-4 text-sm font-medium text-[#0A0613] shadow-[0_0_2px_rgba(138,184,255,0.75),0_0_24px_rgba(91,155,255,0.45)]"
    >
      {children}
    </Button>
  );
}

function SmallGradientButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <Button
      type="button"
      onClick={onClick}
      className="btn-bg h-[34px] rounded-[10px] px-4 text-sm font-medium text-[#0A0613] shadow-[0_0_2px_rgba(138,184,255,0.75),0_0_24px_rgba(91,155,255,0.45)]"
    >
      {children}
    </Button>
  );
}

function ItemList({ items, empty }: { items: string[]; empty: string }) {
  const visible = items.filter(Boolean);
  if (visible.length === 0) return <p className="text-base text-[#8D96A7]">{empty}</p>;
  return (
    <div className="space-y-3">
      {visible.map((item, index) => (
        <p key={`${item}-${index}`} className="rounded-[10px] border border-white/[0.06] bg-[#04070D] px-4 py-3 text-base leading-7 text-[#B0B6C4]">
          {item}
        </p>
      ))}
    </div>
  );
}

function IconPlaceholder() {
  return (
    <div className="relative h-6 w-6 shrink-0 rounded-full ">
      <Image src="/img/avatar.png" alt="icon" width={24} height={26} />
    </div>
  );
}
