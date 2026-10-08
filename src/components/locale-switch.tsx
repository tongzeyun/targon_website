"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/locales";

export function LocaleSwitch({ lang, className }: { lang: Locale; className?: string }) {
  const pathname = usePathname();
  const nextLang = lang === "zh" ? "en" : "zh";
  const href = pathname.replace(/^\/(zh|en)(?=\/|$)/, `/${nextLang}`);

  return (
    <Link className={className} href={href} hrefLang={nextLang} aria-label={lang === "zh" ? "Switch to English" : "切换到中文"}>
      {lang === "zh" ? "EN" : "中文"}
    </Link>
  );
}
