"use client";

import { ErrorBoundary } from "@/components/error-boundary";
import { I18nProvider } from "@/lib/i18n";
import type { Locale } from "@/lib/locales";

export function ClientProviders({ children, lang }: { children: React.ReactNode; lang: Locale }) {
  return (
    <ErrorBoundary>
      <I18nProvider lang={lang}>
        {children}
      </I18nProvider>
    </ErrorBoundary>
  );
}
