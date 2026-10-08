"use client";

import { useEffect } from "react";

let initialized = false;

export function AosInit() {
  useEffect(() => {
    let cancelled = false;
    import("aos").then(({ default: AOS }) => {
      if (cancelled) return;
      if (initialized) AOS.refreshHard();
      else {
        AOS.init({ duration: 1500, once: true, offset: 24, easing: "ease-out" });
        initialized = true;
      }
    });
    return () => { cancelled = true; };
  }, []);

  return null;
}
