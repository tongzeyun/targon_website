"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  navigation,
  Sidebar,
  SidebarIcon,
} from "@/app/[lang]/(workspace)/smart-eye/_components/sidebar";
import { Header } from "@/app/[lang]/(workspace)/smart-eye/_components/header";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const mobileNav = navigation.filter((item) => item.mobileName);

export function MobileShell({
  children,
  offsetTop = false,
}: {
  children: React.ReactNode;
  offsetTop?: boolean;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { lang } = useI18n();
  const pathname = usePathname().replace(/^\/(zh|en)(?=\/)/, "");
  return (
    <div className={cn("min-w-0 max-w-full overflow-x-clip", offsetTop ? "min-h-[calc(100dvh-64px)] bg-[#070B14]" : "min-h-screen bg-gray-50")}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} offsetTop={offsetTop} />
      <div className={cn("min-w-0 max-w-full", offsetTop ? "md:ml-[244px]" : "md:ml-64")}>
        {!offsetTop && <Header onMenuClick={() => setSidebarOpen(true)} />}
        {offsetTop && (
          <button
            className="fixed left-3 top-20 z-50 rounded-md border border-[#253048] bg-[#111722] p-2 text-slate-100 shadow-sm md:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="打开导航"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}
        <main className={cn("min-w-0 max-w-full overflow-x-clip pb-20 md:pb-0", offsetTop ? "p-0" : "p-3 md:p-6")}>{children}</main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav
        className={cn(
          "fixed bottom-0 left-0 right-0 z-30 flex justify-around border-t py-1.5 md:hidden",
          offsetTop ? "border-[#202839] bg-[#0B1019]" : "bg-white"
        )}
      >
        {mobileNav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.name} href={`/${lang}${item.href}`}
              onClick={() => setSidebarOpen(false)}
              className={cn("flex flex-col items-center gap-0.5 px-1 py-1 text-[10px] min-w-0",
                active ? "text-[#62A1FF]" : "text-[#8D96A7]")}>
              <SidebarIcon
                src={active ? item.iconActive : item.icon}
                className="size-[18px]"
              />
              <span>{item.mobileName}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
