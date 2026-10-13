import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/locales";
import { ClientProviders } from "@/components/client-providers";
import { Toaster } from "@/components/ui/sonner";
import { WebsiteHeader } from "./_components/website-header";
import "./smart-eye.css";

export const metadata: Metadata = {
  title: { absolute: "灵眸智售 · Smart Eye｜探氩科技" },
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

export default async function SmartEyeLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <div className="smart-eye-scope min-h-screen bg-[#050914] text-white antialiased">
      <ClientProviders lang={lang}>
        <WebsiteHeader />
        {children}
        <Toaster position="top-right" />
      </ClientProviders>
    </div>
  );
}
