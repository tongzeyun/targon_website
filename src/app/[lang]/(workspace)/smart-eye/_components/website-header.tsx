"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { LocaleSwitch } from "@/components/locale-switch";

const navItems = [
  { label: "首页 · Home", href: "/" },
  { label: "产品 · Product", href: "/products" },
  { label: "案例 · Cases", href: "/cases" },
  { label: "灵眸智售 · Smart Eye", href: "/smart-eye" },
  { label: "联系我们 · Contact", href: "/contact" },
];

function isActivePath(pathname: string, href: string) {
  if (/^\/(zh|en)$/.test(href)) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export function WebsiteHeader() {
  const { lang } = useI18n();
  const items = navItems.map(item => ({ ...item, href: `/${lang}${item.href === "/" ? "" : item.href}` }));
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isSmartEyeApp = pathname.startsWith(`/${lang}/smart-eye/app`);

  return (
    <header className="sticky top-0 z-50 border-b border-[#172033] bg-[#070B14B8] backdrop-blur-xl">
      <div className="flex h-[64px] w-full items-center justify-between px-6 lg:px-14 xl:px-[80px]">
        <div className="flex h-full min-w-0 items-center">
          <Link href={`/${lang}`} className="flex shrink-0 items-center gap-3">
            <Image src="/img/logo.png" alt="Targon" width={32} height={32} priority />
            <span className="text-[16px] font-medium text-slate-100">Targon</span>
          </Link>

          <span className="mx-[10px] hidden h-6 w-px bg-slate-700/80 sm:block" />
          <span className="hidden whitespace-nowrap text-[12px] tracking-[1.4px] text-[#6E7588] sm:block">
            探氩科技
          </span>

          <nav className="ml-8 hidden h-full items-center gap-5 lg:flex xl:gap-[28px]">
            {items.map((item) => {
              const active = isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "relative flex h-full items-center whitespace-nowrap text-sm font-medium transition",
                    active
                      ? "text-slate-100 after:absolute after:bottom-[-3px] after:left-0 after:h-[2px] after:w-full after:bg-gradient-to-r after:from-[#5B9BFF] after:to-[#B07DFF]"
                      : "text-slate-400 hover:text-slate-100"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-3 md:gap-5">
          <LocaleSwitch lang={lang} className="text-sm text-slate-200" />
          <span className="hidden font-mono text-xs tracking-[0.28em] text-slate-500 xl:inline">
            v 1.1.0
          </span>
          <Link
            href={`/${lang}/contact`}
            className={isSmartEyeApp ? "hidden" : "btn-bg hidden px-5 py-2.5 text-sm font-semibold sm:inline-flex"}
          >
            申请演示 · Request demo
          </Link>
          <button
            type="button"
            aria-label={open ? "关闭导航" : "打开导航"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className={isSmartEyeApp
              ? "hidden"
              : "inline-flex size-10 items-center justify-center rounded-lg border border-white/10 bg-[#11161F] text-slate-200 transition hover:border-white/20 lg:hidden"}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && !isSmartEyeApp ? (
        <div className="border-t border-[#172033] bg-[#070B14F2] lg:hidden">
          <div className="mx-auto grid w-full max-w-[1440px] gap-1 px-6 py-3 lg:px-14 xl:px-20">
            {items.map((item) => {
              const active = isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-lg px-3 py-3 text-sm font-medium transition",
                    active
                      ? "bg-[#11161F] text-slate-100"
                      : "text-slate-400 hover:bg-[#11161F] hover:text-slate-100"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            <Link
              href={`/${lang}/contact`}
              onClick={() => setOpen(false)}
              className="btn-bg mt-2 inline-flex h-10 items-center justify-center rounded-[10px] px-4 text-sm font-semibold sm:hidden"
            >
              申请演示 · Request demo
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
