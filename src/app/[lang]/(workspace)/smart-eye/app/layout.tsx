import { Suspense } from "react";
import { WorkspaceShell } from "@/app/[lang]/(workspace)/smart-eye/_components/layout/workspace-shell";
import { SiteHeader } from "@/components/site-header/site-header";
import type { Locale } from "@/lib/locales";
import styles from "../_components/layout/workspace.module.css";

export default async function DashboardLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ lang: Locale }>;
}) {
  const { lang } = await params;
  return (
    <>
      <div className={styles.header}>
        <SiteHeader lang={lang} showCases activeHref={`/${lang}/smart-eye`} logoSrc="/img/smart-eye/header-logo.svg" versionLabel="V1.1.0" />
      </div>
      <WorkspaceShell>
        <Suspense fallback={<div className="animate-pulse h-96 bg-gray-100 rounded-lg" />}>
          {children}
        </Suspense>
      </WorkspaceShell>
    </>
  );
}
