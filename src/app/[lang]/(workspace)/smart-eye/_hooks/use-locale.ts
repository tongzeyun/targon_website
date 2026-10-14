"use client";

import { useParams } from "next/navigation";
import type { Locale } from "@/lib/locales";

// The shared [lang] layout validates the route against the project's locales.
export function useLocale(): Locale {
  return useParams<{ lang: Locale }>().lang;
}
