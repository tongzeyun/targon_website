"use client";

import { useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/locales";
import styles from "./products.module.css";

type Product = { slug: string; title: string; description: string; image: string };

type Props = {
  items: Product[];
  lang: Locale;
  viewProduct: string;
};

export function SoftwareCarousel({ items, lang, viewProduct }: Props) {
  const [active, setActive] = useState(1);
  const [direction, setDirection] = useState<"previous" | "next" | null>(null);

  return (
    <div className={styles.softwareViewport}>
      <div className={styles.carousel} role="region" aria-labelledby="software-heading" aria-roledescription={lang === "zh" ? "轮播" : "carousel"}>
        {items.map((item, index) => {
          const position = index === active ? "active" : index === (active - 1 + items.length) % items.length ? "previous" : "next";
          const wraps = (direction === "next" && position === "next") || (direction === "previous" && position === "previous");

          return (
            <article className={styles.softwareCard} data-position={position} data-wrap={wraps} aria-hidden={position !== "active"} key={item.title}>
              <div className={styles.softwareVisual}><img src={item.image} alt={lang === "zh" ? `${item.title} 软件界面` : `${item.title} software interface`} width="898" height="464" /></div>
              <div className={styles.softwareBody}>
                <h3 data-aos="fade">{item.title}</h3>
                <p data-aos="fade">{item.description}</p>
                <Link className={`site-button site-button--primary ${styles.productLink}`} href={`/${lang}/products/${item.slug}`} tabIndex={position === "active" ? 0 : -1}>
                  {viewProduct}
                </Link>
              </div>
            </article>
          );
        })}
        <button
          className={`${styles.carouselArrow} ${styles.previousArrow}`}
          type="button"
          aria-label={lang === "zh" ? "上一个产品" : "Previous product"}
          onClick={() => { setDirection("previous"); setActive((index) => (index - 1 + items.length) % items.length); }}
        >
          <span aria-hidden="true" />
        </button>
        <button
          className={`${styles.carouselArrow} ${styles.nextArrow}`}
          type="button"
          aria-label={lang === "zh" ? "下一个产品" : "Next product"}
          onClick={() => { setDirection("next"); setActive((index) => (index + 1) % items.length); }}
        >
          <span aria-hidden="true" />
        </button>
        <span className="sr-only" aria-live="polite">{items[active].title}</span>
      </div>
    </div>
  );
}
