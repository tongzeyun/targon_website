"use client";

import { useUiText } from "@/app/[lang]/(workspace)/smart-eye/_hooks/use-ui-text";
import pageStyles from "@/app/[lang]/(workspace)/smart-eye/_styles/pages.module.css";

import { useLocale } from "@/app/[lang]/(workspace)/smart-eye/_hooks/use-locale";
import { formatPipelineAmount } from "@/app/[lang]/(workspace)/smart-eye/_lib/copy";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/app/[lang]/(workspace)/smart-eye/_components/ui/card";
import { Badge } from "@/app/[lang]/(workspace)/smart-eye/_components/ui/badge";
import { Button } from "@/app/[lang]/(workspace)/smart-eye/_components/ui/button";
import { Skeleton } from "@/app/[lang]/(workspace)/smart-eye/_components/ui/skeleton";
import { toast } from "sonner";
import { useApi } from "@/app/[lang]/(workspace)/smart-eye/_hooks/use-api";
import { pipelineApi } from "@/lib/api/client";
import { Columns3, DollarSign } from "lucide-react";

const STAGES = [
  { key: "discovered", label: "发现", color: "bg-gray-100 border-gray-300" },
  { key: "tech_exchange", label: "技术交流", color: "bg-blue-50 border-blue-300" },
  { key: "proposal", label: "方案", color: "bg-purple-50 border-purple-300" },
  { key: "testing", label: "测试", color: "bg-orange-50 border-orange-300" },
  { key: "negotiation", label: "谈判", color: "bg-yellow-50 border-yellow-300" },
  { key: "won", label: "成交", color: "bg-green-50 border-green-300" },
  { key: "lost", label: "丢单", color: "bg-red-50 border-red-300" },
];

interface PipelineBoardItem {
  id: string;
  projectId?: string;
  projectName?: string;
  currentStage?: string;
  dealAmount?: string;
  probability?: number;
}

function parseDealAmount(dealAmount?: string): number {
  const value = parseFloat((dealAmount || "0").replace(/[^0-9.]/g, ""));
  return Number.isNaN(value) ? 0 : value;
}

export default function PipelineBoardPage() {
  const uiText = useUiText();
  const lang = useLocale();
  const { data, loading, refetch } = useApi(() => pipelineApi.list());
  const items = (Array.isArray(data) ? data : []) as PipelineBoardItem[];
  const [moving, setMoving] = useState<string | null>(null);

  const grouped = STAGES.reduce((acc, stage) => {
    acc[stage.key] = items.filter((p) => (p.currentStage || "discovered") === stage.key);
    return acc;
  }, {} as Record<string, PipelineBoardItem[]>);

  const handleMove = async (itemId: string, toStage: string) => {
    setMoving(itemId);
    try {
      await pipelineApi.update(itemId, { currentStage: toStage });
      toast.success(uiText("已移动到 {0}", { 0: uiText(STAGES.find(s => s.key === toStage)?.label || toStage) }));
      refetch();
    } catch {
      toast.error(uiText("移动失败"));
    } finally {
      setMoving(null);
    }
  };

  return (
    <div className={`${pageStyles.page} ${pageStyles.board} space-y-6`}>
      <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2">
            <Columns3 className="h-6 w-6 text-blue-600" />{uiText("管线看板")}</h1>
          <p className="text-muted-foreground mt-1">{items.length} {uiText("个机会 · 点击按钮切换阶段")}</p>
        </div>
        <Link href={`/${lang}/smart-eye/app/pipeline`} className="self-start sm:self-auto">
          <Button variant="outline" size="sm">{uiText("列表视图")}</Button>
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {STAGES.map(s => <Skeleton key={s.key} className="h-96 w-full min-w-0" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5" style={{ minHeight: 400 }}>
          {STAGES.map((stage) => {
            const cards = grouped[stage.key] || [];
            const totalAmount = cards.reduce((sum, pipeline) => sum + parseDealAmount(pipeline.dealAmount), 0);

            return (
              <div key={stage.key} className="flex min-w-0 flex-col">
                {/* Column Header */}
                <div className={`p-3 rounded-t-lg border-b-2 ${stage.color} border-b-current`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">{uiText(stage.label)}</h3>
                    <Badge variant="secondary" className="text-xs">{cards.length}</Badge>
                  </div>
                  {totalAmount > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">{formatPipelineAmount(Math.round(totalAmount), lang)}</p>
                  )}
                </div>

                {/* Cards */}
                <div className="flex-1 bg-gray-50 rounded-b-lg p-2 space-y-2 min-h-[200px]">
                  {cards.length === 0 ? (
                    <div className="text-center py-8 text-xs text-muted-foreground">{uiText("暂无机会")}</div>
                  ) : (
                    cards.map((p) => (
                      <Card key={p.id} className={`shadow-sm border hover:shadow-md transition-shadow ${moving === p.id ? "opacity-50" : ""}`}>
                        <CardContent className="p-3">
                          <Link href={`/${lang}/smart-eye/app/projects/${p.projectId || ""}`} className="block">
                            <p className="text-sm font-medium truncate hover:text-blue-600">
                              {p.projectName || uiText("未关联项目")}
                            </p>
                          </Link>
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            {p.dealAmount && (
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />{p.dealAmount}
                              </span>
                            )}
                            {p.probability != null && (
                              <Badge variant="outline" className="text-[10px]">{p.probability}%</Badge>
                            )}
                          </div>
                          {/* Stage move buttons */}
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {STAGES.filter(s => s.key !== stage.key).slice(0, 3).map(s => (
                              <button
                                key={s.key}
                                onClick={(e) => { e.preventDefault(); handleMove(p.id, s.key); }}
                                disabled={moving === p.id}
                                className="text-[10px] px-2 py-0.5 rounded border bg-white hover:bg-gray-100 transition-colors"
                                title={uiText("移到 {0}", { 0: uiText(s.label) })}
                              >
                                → {uiText(s.label)}
                              </button>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
