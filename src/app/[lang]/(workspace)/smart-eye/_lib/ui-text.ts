import type { Locale } from "@/lib/locales";
import { uiEnglish } from "./ui-copy.en";
import { uiChinese } from "./ui-copy.zh";

// Translate fixed display copy only; never use this function to construct API data.
export function translateUiText(lang: Locale, text: string, values: Record<string, unknown> = {}): string {
  const dictionary = lang === "en" ? uiEnglish : uiChinese;
  const message = Object.prototype.hasOwnProperty.call(dictionary, text) ? dictionary[text] : text;
  return message.replace(/\{(\d+)\}/g, (slot, key: string) => {
    if (!(key in values)) return slot;
    const value = values[key];
    return typeof value === "number"
      ? new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "en-US").format(value)
      : String(value ?? "");
  });
}
