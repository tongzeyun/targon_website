import { Suspense } from "react";
import { MobileShell } from "@/app/[lang]/(workspace)/smart-eye/_components/mobile-shell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <MobileShell offsetTop>
      <Suspense fallback={<div className="animate-pulse h-96 bg-gray-100 rounded-lg" />}>
        {children}
      </Suspense>
    </MobileShell>
  );
}
