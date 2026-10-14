import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/locales";
import { ErrorBoundary } from "@/app/[lang]/(workspace)/smart-eye/_components/error-boundary";
import { Toaster } from "@/app/[lang]/(workspace)/smart-eye/_components/ui/sonner";
import "./_styles/smart-eye.css";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return {
    title: { absolute: lang === "zh" ? "灵眸智售 · Smart Eye｜探氩科技" : "Smart Eye | Targon" },
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
        noimageindex: true,
      },
    },
  };
}

export default async function SmartEyeLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <div className="smart-eye-scope min-h-screen antialiased">
      <ErrorBoundary lang={lang}>
        {children}
        <Toaster position="top-right" />
      </ErrorBoundary>
    </div>
  );
}
