"use client";

import { useState } from "react";
import type { Locale } from "@/lib/locales";
import styles from "./home.module.css";

type Slide = { name: string; headline: string; description: string; image: string; imageAlt: string };

export function HomeCarousel({ slides, lang }: { slides: readonly Slide[]; lang: Locale }) {
  const [active, setActive] = useState(0);

  return (
    <section className={styles.scenes} aria-label={lang === "zh" ? "AI 应用场景" : "AI applications"}>
      <div className={`site-container ${styles.scenesInner}`}>
        <div className={styles.sceneControls} aria-label={lang === "zh" ? "切换应用场景" : "Choose an application"}>
          {slides.map((slide, index) => <button key={slide.name} type="button" aria-pressed={active === index} onClick={() => setActive(index)}>{slide.name}</button>)}
        </div>
        <div className={styles.sceneViewport}>
          <div className={styles.sceneTrack} style={{ transform: `translateX(-${active * 100}%)` }}>
            {slides.map((slide, index) => <article className={styles.sceneSlide} aria-hidden={active !== index} key={slide.name}>
              <div className={styles.sceneCopy}><h2>{slide.headline}</h2><p>{slide.description}</p></div>
              <div className={`site-bg-box ${styles.sceneImage}`} style={{ backgroundImage: `url("${slide.image}")` }} role="img" aria-label={slide.imageAlt} />
            </article>)}
          </div>
        </div>
        <div className={styles.sceneArrows}>
          <button type="button" aria-label={lang === "zh" ? "上一个场景" : "Previous application"} onClick={() => setActive((index) => (index - 1 + slides.length) % slides.length)}>←</button>
          <button type="button" aria-label={lang === "zh" ? "下一个场景" : "Next application"} onClick={() => setActive((index) => (index + 1) % slides.length)}>→</button>
        </div>
      </div>
    </section>
  );
}
