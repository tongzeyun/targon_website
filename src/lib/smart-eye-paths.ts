import { isLocale, type Locale } from "@/lib/locales";

export function getDefaultLocale(): Locale {
  return process.env.SITE_DEFAULT_LOCALE === "en" ? "en" : "zh";
}

export function getSmartEyeLocale(pathname: string): Locale {
  const lang = pathname.split("/")[1];
  return isLocale(lang) ? lang : getDefaultLocale();
}
