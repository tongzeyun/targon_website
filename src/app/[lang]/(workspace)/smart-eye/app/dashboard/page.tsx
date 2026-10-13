"use client";

import { useI18n } from "@/lib/i18n";

import Link from "next/link";
import { useApi } from "@/lib/hooks/use-api";
import { accountsApi, pipelineApi, projectsApi } from "@/lib/api/client";
import Image from "next/image";

interface ProjectDashboardItem {
  status?: string;
}

interface AccountDashboardItem {
  matchScore?: number;
}

interface PipelineDashboardItem {
  currentStage?: string;
  dealAmount?: string;
  probability?: number;
}

function parseDealAmount(dealAmount?: string): number {
  const value = parseFloat((dealAmount || "0").replace(/[^0-9.]/g, ""));
  return Number.isNaN(value) ? 0 : value;
}


export default function DashboardPage() {
  const { lang } = useI18n();
  const { data: projects, loading: projectsLoading } = useApi(() => projectsApi.list());
  const { data: accounts, loading: accountsLoading } = useApi(() => accountsApi.list());
  const { data: pipelines, loading: pipelinesLoading } = useApi(() => pipelineApi.list());

  const projectList = (Array.isArray(projects) ? projects : []) as ProjectDashboardItem[];
  const accountList = (Array.isArray(accounts) ? accounts : []) as AccountDashboardItem[];
  const pipelineList = (Array.isArray(pipelines) ? pipelines : []) as PipelineDashboardItem[];

  const activePipelines = pipelineList.filter((item) => item.currentStage !== "won" && item.currentStage !== "lost");
  const wonPipelines = pipelineList.filter((item) => item.currentStage === "won");
  const totalPipeline = activePipelines.reduce((sum, item) => sum + parseDealAmount(item.dealAmount), 0);
  const weightedPipeline = activePipelines.reduce(
    (sum, item) => sum + (parseDealAmount(item.dealAmount) * (item.probability || 50)) / 100,
    0
  );
  const wonAmount = wonPipelines.reduce((sum, item) => sum + parseDealAmount(item.dealAmount), 0);
  const activeProjects = projectList.filter((item) => item.status === "active").length;
  const matchedAccounts = accountList.filter((item) => item.matchScore && item.matchScore >= 60).length;
  const loading = projectsLoading || accountsLoading || pipelinesLoading;

  const kpis = [
    {
      href: `/${lang}/smart-eye/app/accounts`,
      icon: "/img/dashboard_0.png",
      value: accountList.length,
      label: "客户总数",
      sub: `${matchedAccounts}家已匹配`,
    },
    {
      href: `/${lang}/smart-eye/app/projects`,
      icon: "/img/dashboard_1.png",
      value: activeProjects,
      label: "活跃项目",
      sub: "",
    },
    {
      href: `/${lang}/smart-eye/app/pipeline`,
      icon: "/img/dashboard_2.png",
      value: `¥${Math.round(weightedPipeline)}万`,
      label: "加权管线金额",
      sub: `总${Math.round(totalPipeline)}万`,
    },
    {
      href: `/${lang}/smart-eye/app/pipeline`,
      icon: "/img/dashboard_3.png",
      value: `¥${Math.round(wonAmount)}万`,
      label: "已签约金额",
      sub: `${wonPipelines.length}单成交`,
    },
  ];

  return (
    <section className="min-h-[calc(100dvh-64px)] w-full min-w-0 max-w-full bg-[#070B14] px-4 pb-24 pt-24 text-slate-100 sm:px-6 lg:px-8 lg:pb-10 lg:pt-[110px]">
      <div className="">
        <div className="mb-8">
          <h1 className="text-[28px] font-bold leading-tight text-white sm:text-[32px]">总览</h1>
          <p className="mt-3 text-base text-[#A6AEBD] sm:text-xl">销售数据全景</p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => (
            <Link
              key={kpi.label}
              href={kpi.href}
              className="min-h-[190px] rounded-[12px] border border-[#202839] bg-[#131821] px-5 py-6 transition hover:border-[#3B6EA8] sm:min-h-[216px] sm:px-6 sm:py-8"
            >
              <div className="w-[40px] h-[40px] mb-6 flex items-center justify-center bg-[#5B9BFF24] border border-[#5B9BFF73] rounded-[10px]">
                <Image src={kpi.icon} alt={''} width={18} height={18} />
              </div>
              <div className="text-[40px] font-bold leading-none tracking-tight text-[#F1F5FA]">
                {loading ? "-" : kpi.value}
              </div>
              <div className="mt-4 text-base font-semibold text-[#F1F5FA]">{kpi.label}</div>
              {kpi.sub ? <div className="mt-2 text-sm text-[#8D96A7]">{loading ? "-" : kpi.sub}</div> : null}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
