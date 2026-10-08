import Link from "next/link";
import { LocaleSwitch } from "@/components/locale-switch";
import type { Locale } from "@/lib/locales";
import styles from "./site-header.module.css";

export function SiteHeader({ lang }: { lang: Locale }) {
  const isZh = lang === "zh";
  const links = [
    { href: `/${lang}`, label: isZh ? "首页" : "Home" },
    { href: `/${lang}/products`, label: isZh ? "产品" : "Products" },
    // { href: `/${lang}/cases`, label: isZh ? "案例" : "Cases" },
    { href: "/smart-eye", label: isZh ? "灵眸智售" : "Smart Eye" },
    { href: `/${lang}/contact`, label: isZh ? "联系我们" : "Contact" },
  ];

  return (
    <header className={styles.header}>
      <div className={`site-container ${styles.inner}`}>
        <Link className={styles.brand} href={`/${lang}`} aria-label={isZh ? "探氩科技首页" : "Targon home"}>
          <img className={styles.logo} src="/image/logo.svg" alt="" width="40" height="40" />
          <span>TARGON</span>
        </Link>
        <nav className={styles.nav} aria-label={isZh ? "主导航" : "Main navigation"}>
          {links.map(({ href, label }) => (
            <Link href={href} key={href}><span aria-hidden="true">·</span>{label}</Link>
          ))}
        </nav>
        <div className={styles.actions}>
          <LocaleSwitch lang={lang} className={styles.locale} />
          <Link className={`site-button site-button--primary ${styles.demo}`} href={`/${lang}/contact`}>
            {isZh ? "预约演示" : "Book a Demo"}
          </Link>
        </div>
      </div>
    </header>
  );
}
