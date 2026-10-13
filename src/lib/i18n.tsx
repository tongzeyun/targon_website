/**
 * 国际化 (i18n) — 中英文双语支持
 *
 * 使用 React Context 传递 URL 语言；完整业务文案翻译在阶段B完成。
 */

"use client";

import { createContext, useContext, useCallback, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Locale } from "@/lib/locales";

export type Lang = Locale;

// 核心 UI 文案翻译
const messages: Record<Lang, Record<string, string>> = {
  zh: {
    "app.name": "SalesEye",
    "app.subtitle": "AI 驱动的 B2B 销售情报平台",
    "nav.dashboard": "总览",
    "nav.accounts": "客户",
    "nav.projects": "项目",
    "nav.pipeline": "管线",
    "nav.intelligence": "情报",
    "nav.settings": "设置",
    "common.save": "保存",
    "common.cancel": "取消",
    "common.delete": "删除",
    "common.edit": "编辑",
    "common.create": "新建",
    "common.search": "搜索",
    "common.export": "导出",
    "common.loading": "加载中...",
    "common.confirm": "确认",
    "common.back": "返回",
    "common.refresh": "刷新",
    "common.retry": "重试",
    "dashboard.title": "总览",
    "dashboard.subtitle": "销售数据全景",
    "dashboard.totalAccounts": "客户总数",
    "dashboard.activeProjects": "活跃项目",
    "dashboard.pipelineValue": "加权管线金额",
    "dashboard.wonAmount": "已签约金额",
    "accounts.title": "目标客户",
    "projects.title": "项目",
    "pipeline.title": "销售管线",
    "settings.title": "设置",
    "settings.company": "公司信息",
    "settings.apiKey": "DeepSeek API Key",
  },
  en: {
    "app.name": "SalesEye",
    "app.subtitle": "AI-Powered B2B Sales Intelligence Platform",
    "nav.dashboard": "Dashboard",
    "nav.accounts": "Accounts",
    "nav.projects": "Projects",
    "nav.pipeline": "Pipeline",
    "nav.intelligence": "Intelligence",
    "nav.settings": "Settings",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.create": "Create",
    "common.search": "Search",
    "common.export": "Export",
    "common.loading": "Loading...",
    "common.confirm": "Confirm",
    "common.back": "Back",
    "common.refresh": "Refresh",
    "common.retry": "Retry",
    "dashboard.title": "Dashboard",
    "dashboard.subtitle": "Sales Data Overview",
    "dashboard.totalAccounts": "Total Accounts",
    "dashboard.activeProjects": "Active Projects",
    "dashboard.pipelineValue": "Weighted Pipeline",
    "dashboard.wonAmount": "Closed Won",
    "accounts.title": "Target Accounts",
    "projects.title": "Projects",
    "pipeline.title": "Sales Pipeline",
    "settings.title": "Settings",
    "settings.company": "Company Info",
    "settings.apiKey": "DeepSeek API Key",
  },
};

// Context
interface I18nContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: "zh",
  setLang: () => {},
  t: (key: string) => key,
});

export function useI18n() {
  return useContext(I18nContext);
}

// Provider
export function I18nProvider({ children, lang }: { children: ReactNode; lang: Lang }) {
  const router = useRouter();
  const pathname = usePathname();

  const setLang = useCallback((l: Lang) => {
    router.push(pathname.replace(/^\/(zh|en)(?=\/|$)/, `/${l}`) + window.location.search + window.location.hash);
  }, [pathname, router]);

  const t = useCallback(
    (key: string) => messages[lang]?.[key] || key,
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}
