"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu } from "lucide-react";
import { navigation, Sidebar, SidebarIcon } from "@/app/[lang]/(workspace)/smart-eye/_components/layout/sidebar";
import { useLocale } from "@/app/[lang]/(workspace)/smart-eye/_hooks/use-locale";
import { getSmartEyeCopy } from "@/app/[lang]/(workspace)/smart-eye/_lib/copy";
import styles from "@/app/[lang]/(workspace)/smart-eye/_components/layout/workspace.module.css";

const mobileNav = navigation.filter((item) => item.mobile);

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const lang = useLocale();
  const copy = getSmartEyeCopy(lang);
  const pathname = usePathname().replace(/^\/(zh|en)(?=\/)/, "");
  return (
    <div className={styles.shell}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className={styles.content}>{children}</main>
      <button type="button" className={styles.toggle} onClick={() => setSidebarOpen(true)}
        aria-label={copy.common.openNav} aria-expanded={sidebarOpen}><Menu size={22} /></button>
      <nav className={styles.mobileNav} aria-label={copy.common.mobileNav}>
        {mobileNav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.key} className={styles.mobileLink} href={`/${lang}${item.href}`}
              onClick={() => setSidebarOpen(false)} aria-current={active ? "page" : undefined}>
              <SidebarIcon name={item.key} active={active} /><span>{copy.nav[item.key]}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
