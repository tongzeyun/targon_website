import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, locales } from "@/lib/locales";
import "../globals.css";
type Props = {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return {
    title: lang === "zh" ? "探氩科技" : "Targon",
    description: lang === "zh" ? "探氩科技官网" : "Targon official website",
    icons: { icon: [{ url: "/image/logo.svg", type: "image/svg+xml", sizes: "any" }] },
    robots: { index: false, follow: false },
  };
}

export default async function WebsiteLayout({ children, params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <html lang={lang === "zh" ? "zh-CN" : "en"}>
      <body>{children}</body>
    </html>
  );
}
