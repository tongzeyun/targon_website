import Link from "next/link";
import type { Locale } from "@/lib/locales";
import styles from "./site-footer.module.css";

export function SiteFooter({ lang }: { lang: Locale }) {
  const isZh = lang === "zh";

  return (
    <footer className={styles.footer}>
      <div className="site-container">
        <div className={styles.intro}>
          <div>
            <strong>TARGON</strong>
            <p>
              {isZh
                ? "TARGON 以 Vacuum AI 为核心产业平台，连接工业设备、企业业务与产业销售，推动 AI 在真实场景中应用。"
                : "TARGON connects industrial equipment, enterprise operations, and sales through Vacuum AI and practical AI products."}
            </p>
          </div>
          <div className={styles.actions}>
            <Link className="site-button site-button--primary" href={`/${lang}/contact`}>
              {isZh ? "预约演示" : "Book a Demo"}
            </Link>
            <Link className="site-button site-button--outline" href={`/${lang}/contact`}>
              {isZh ? "联系我们" : "Contact Us"}
            </Link>
          </div>
        </div>
        <div className={styles.columns}>
          <div className={styles.identity}>
            <Link className={styles.brand} href={`/${lang}`} aria-label={isZh ? "探氩科技首页" : "Targon home"}>
              <img className={styles.logo} src="/image/logo.svg" alt="" width="56" height="56" />
              <span>TARGON</span>
            </Link>
            <small>SHANGHAI TARGON INTELLIGENT TECH. CO., LTD.</small>
          </div>
          <div className={styles.links}>
            <h2>{isZh ? "产品" : "Products"}</h2>
            <Link href={`/${lang}/products`}>Vacuum AI</Link>
            <Link href={`/${lang}/products`}>Local Industrial Agent</Link>
            <Link href={`/${lang}/products`}>Enterprise Brain</Link>
            <Link href="/smart-eye">{isZh ? "灵眸智售" : "Smart Eye"}</Link>
          </div>
          <div className={styles.links}>
            <h2>{isZh ? "联系" : "Contact"}</h2>
            <a href="mailto:Charles.zhang@Targon.cn">Charles.zhang@Targon.cn</a>
            <a href="tel:+8618321395819">+86 183 2139 5819</a>
            <span>{isZh ? "上海市浦东新区张江集电港" : "Zhangjiang, Pudong, Shanghai"}</span>
          </div>
        </div>
      </div>
      <div className={styles.legal}>
        <div className="site-container">© {new Date().getFullYear()} {isZh ? "上海探氩智能科技有限公司" : "Shanghai Targon Intelligent Tech. Co., Ltd."} · 沪ICP备2024098247号-1</div>
      </div>
    </footer>
  );
}
