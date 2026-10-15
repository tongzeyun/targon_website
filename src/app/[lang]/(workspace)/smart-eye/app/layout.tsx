import { Suspense } from "react";
import { notFound } from "next/navigation";
import { WorkspaceShell } from "@/app/[lang]/(workspace)/smart-eye/_components/layout/workspace-shell";
import { SiteHeader } from "@/components/site-header/site-header";
import { isLocale } from "@/lib/locales";
import styles from "../_components/layout/workspace.module.css";

export default async function DashboardLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <>
      <div className={styles.header}>
        <SiteHeader lang={lang} activeHref={`/${lang}/smart-eye`} />
      </div>
      <WorkspaceShell>
        <Suspense fallback={<div className="animate-pulse h-96 bg-gray-100 rounded-lg" />}>
          {children}
        </Suspense>
      </WorkspaceShell>
    </>
  );
}
