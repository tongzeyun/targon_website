"use client";

import { useCallback } from "react";
import { useLocale } from "./use-locale";
import { translateUiText } from "../_lib/ui-text";

export function useUiText() {
  const lang = useLocale();
  return useCallback((text: string, values?: Record<string, unknown>) => translateUiText(lang, text, values), [lang]);
}
