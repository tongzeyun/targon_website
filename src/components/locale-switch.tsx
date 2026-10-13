"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { Locale } from "@/lib/locales";

export function LocaleSwitch({ lang, className }: { lang: Locale; className?: string }) {
  return (
    <Suspense fallback={<span className={className}>{lang === "zh" ? "EN" : "中文"}</span>}>
      <LocaleSwitchLink lang={lang} className={className} />
    </Suspense>
  );
}

function LocaleSwitchLink({ lang, className }: { lang: Locale; className?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nextLang = lang === "zh" ? "en" : "zh";
  const href = pathname.replace(/^\/(zh|en)(?=\/|$)/, `/${nextLang}`);
  const query = searchParams.toString();
  const suffix = query ? `?${query}` : "";

  return (
    <Link className={className} href={href + suffix} hrefLang={nextLang} aria-label={lang === "zh" ? "Switch to English" : "切换到中文"}>
      {lang === "zh" ? "EN" : "中文"}
    </Link>
  );
}
