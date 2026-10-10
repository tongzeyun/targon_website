"use client";

import { useState } from "react";
import styles from "./enterprise-brain.module.css";

type Slide = {
  title: string;
  description: string;
  alt: string;
  image: string;
  topAligned: boolean;
};

type Props = {
  label: string;
  previousLabel: string;
  nextLabel: string;
  slides: Slide[];
};

export function BrainCarousel({ label, previousLabel, nextLabel, slides }: Props) {
  const [active, setActive] = useState(0);

  return (
    <div className={styles.carousel} role="region" aria-label={label} aria-roledescription="carousel">
      <div className={styles.carouselCanvas}>
        {slides.map((slide, index) => (
          <article className={styles.carouselSlide} data-active={index === active} aria-hidden={index !== active} inert={index !== active} key={slide.title}>
            <div className={styles.carouselImage}>
              <img src={slide.image} alt={slide.alt} data-top-aligned={slide.topAligned} width="1000" height="562" />
            </div>
            <div className={styles.carouselCopy}><h3>{slide.title}</h3><p>{slide.description}</p></div>
          </article>
        ))}
      </div>
      <button className={`${styles.carouselArrow} ${styles.previousArrow}`} type="button" aria-label={previousLabel} onClick={() => setActive((index) => (index - 1 + slides.length) % slides.length)}>
        <img src="/image/enterprise-brain-previous.png" alt="" width="78" height="78" />
      </button>
      <button className={`${styles.carouselArrow} ${styles.nextArrow}`} type="button" aria-label={nextLabel} onClick={() => setActive((index) => (index + 1) % slides.length)}>
        <img src="/image/enterprise-brain-next.png" alt="" width="78" height="78" />
      </button>
      <span className="sr-only" aria-live="polite" aria-atomic="true">{slides[active].title} ({active + 1}/{slides.length})</span>
    </div>
  );
}
