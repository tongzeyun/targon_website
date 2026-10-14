"use client";

import { useLocale } from "@/app/[lang]/(workspace)/smart-eye/_hooks/use-locale";

import Link from "next/link";
import { useApi } from "@/app/[lang]/(workspace)/smart-eye/_hooks/use-api";
import { accountsApi, pipelineApi, projectsApi } from "@/lib/api/client";
import { formatPipelineAmount, getSmartEyeCopy } from "../../_lib/copy";
import styles from "./dashboard.module.css";

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
  const lang = useLocale();
  const copy = getSmartEyeCopy(lang).dashboard;
  const number = (value: number) => value.toLocaleString(lang === "zh" ? "zh-CN" : "en-US");
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
      icon: "/img/smart-eye/kpi-accounts.svg",
      value: number(accountList.length),
      label: copy.accounts,
      sub: copy.matched.replace("{count}", number(matchedAccounts)),
    },
    {
      href: `/${lang}/smart-eye/app/projects`,
      icon: "/img/smart-eye/kpi-projects.svg",
      value: number(activeProjects),
      label: copy.projects,
      sub: "",
    },
    {
      href: `/${lang}/smart-eye/app/pipeline`,
      icon: "/img/smart-eye/kpi-pipeline.svg",
      value: formatPipelineAmount(weightedPipeline, lang),
      label: copy.weighted,
      sub: copy.total.replace("{amount}", lang === "zh" ? `${number(Math.round(totalPipeline))}万` : formatPipelineAmount(totalPipeline, lang)),
    },
    {
      href: `/${lang}/smart-eye/app/pipeline`,
      icon: "/img/smart-eye/kpi-won.svg",
      value: formatPipelineAmount(wonAmount, lang),
      label: copy.won,
      sub: copy.deals.replace("{count}", number(wonPipelines.length)),
    },
  ];

  return (
    <section className={styles.page} aria-busy={loading} aria-label={loading ? copy.loading : copy.title}>
      <div>
        <div className={styles.heading}>
          <h1 className={styles.title}>{copy.title}</h1>
          <p className={styles.subtitle}>{copy.subtitle}</p>
        </div>

        <div className={styles.grid}>
          {kpis.map((kpi, index) => (
            <Link
              key={kpi.label}
              href={kpi.href}
              className={styles.card}
            >
              <div className={styles.icon}>
                <img src={kpi.icon} alt="" />
              </div>
              {index === 0 && <img className={styles.arrow} src="/img/smart-eye/kpi-arrow.svg" alt="" />}
              <div className={styles.value}>
                {loading ? "-" : kpi.value}
              </div>
              <div className={styles.label}>{kpi.label}</div>
              {kpi.sub ? <div className={styles.detail}>{loading ? "-" : kpi.sub}</div> : null}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
