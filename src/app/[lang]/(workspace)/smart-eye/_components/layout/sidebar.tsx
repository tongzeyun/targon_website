"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useLocale } from "@/app/[lang]/(workspace)/smart-eye/_hooks/use-locale";
import { getSmartEyeCopy } from "@/app/[lang]/(workspace)/smart-eye/_lib/copy";
import styles from "@/app/[lang]/(workspace)/smart-eye/_components/layout/workspace.module.css";

export const navigation = [
  { key: "dashboard", mobile: true, href: "/smart-eye/app/dashboard" },
  { key: "products", mobile: false, href: "/smart-eye/app/products" },
  { key: "accounts", mobile: true, href: "/smart-eye/app/accounts" },
  { key: "projects", mobile: true, href: "/smart-eye/app/projects" },
  { key: "research", mobile: true, href: "/smart-eye/app/deep-research" },
  { key: "pipeline", mobile: true, href: "/smart-eye/app/pipeline" },
] as const;

const tools = [
  { key: "quotation", href: "/smart-eye/app/quotation" },
  { key: "contract", href: "/smart-eye/app/contract" },
  { key: "bid", href: "/smart-eye/app/bid" },
  { key: "meeting", href: "/smart-eye/app/meeting" },
  { key: "convert", href: "/smart-eye/app/convert" },
] as const;

export function SidebarIcon({ name, active }: { name: string; active: boolean }) {
  return <span className={styles.icon}><img src={`/img/smart-eye/nav-${name}${active ? "-active" : ""}.svg`} alt="" /></span>;
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const lang = useLocale();
  const copy = getSmartEyeCopy(lang);
  const pathname = usePathname().replace(/^\/(zh|en)(?=\/)/, "");
  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");
  return (
    <>
      {open && <button className={styles.backdrop} type="button" aria-label={copy.common.closeNav} onClick={onClose} />}
      <aside className={styles.sidebar} data-open={open}>
        <button className={styles.close} type="button" aria-label={copy.common.closeNav} onClick={onClose}><X size={20} /></button>
        <p className={styles.brand}>{lang === "zh" ? <>灵眸<span>智售</span></> : <>Smart <span>Eye</span></>}</p>
        <nav aria-label={copy.common.mainNav}>
          <div className={styles.group}>
            {navigation.map((item) => (
              <Link key={item.key} className={styles.link} href={`/${lang}${item.href}`} onClick={onClose}
                aria-current={active(item.href) ? "page" : undefined}>
                <SidebarIcon name={item.key} active={active(item.href)} />{copy.nav[item.key]}
              </Link>
            ))}
          </div>
          <div className={styles.tools}>
            <p className={styles.toolsTitle}>{copy.common.tools}</p>
            <div className={styles.toolLinks}>
              {tools.map((item) => (
                <Link key={item.key} className={styles.link} href={`/${lang}${item.href}`} onClick={onClose}
                  aria-current={active(item.href) ? "page" : undefined}>
                  <SidebarIcon name={item.key} active={active(item.href)} />{copy.nav[item.key]}
                </Link>
              ))}
            </div>
          </div>
          <Link className={`${styles.link} ${styles.settings}`} href={`/${lang}/smart-eye/app/settings`} onClick={onClose}
            aria-current={active("/smart-eye/app/settings") ? "page" : undefined}>
            <SidebarIcon name="settings" active={active("/smart-eye/app/settings")} />{copy.nav.settings}
          </Link>
        </nav>
        <UserFooter onNavigate={onClose} />
      </aside>
    </>
  );
}

function UserFooter({ onNavigate }: { onNavigate: () => void }) {
  const lang = useLocale();
  const copy = getSmartEyeCopy(lang).common;
  const [info, setInfo] = useState({ contact: "", company: "", email: "" });
  useEffect(() => {
    queueMicrotask(() => {
      const saved = localStorage.getItem("saleseye-settings");
      if (saved) { try { setInfo(JSON.parse(saved)); } catch {} }
    });
  }, []);
  return (
    <Link className={styles.user} href={`/${lang}/smart-eye/app/settings`} onClick={onNavigate}>
      <span className={styles.avatar} aria-hidden="true">
        {info.contact ? info.contact.charAt(0) : <img src="/img/smart-eye/user.svg" alt="" />}
      </span>
      <span className={styles.userText}>
        <span className={`block ${styles.userName}`}>{info.contact || copy.user}</span>
        <span className={`block ${styles.company}`}>{info.company || copy.companyUnset}</span>
      </span>
    </Link>
  );
}
