import { redirect } from "next/navigation";
import { isLocale } from "@/lib/locales";
import { notFound } from "next/navigation";

export default async function SmartEyeEntryPage({ params, searchParams }: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      query.append(key, item);
    }
  }
  const suffix = query.size ? `?${query}` : "";
  redirect(`/${lang}/smart-eye/app/quotation${suffix}`);
}
