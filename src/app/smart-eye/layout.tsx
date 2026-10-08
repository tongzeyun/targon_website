import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Smart Eye",
  icons: { icon: [{ url: "/image/logo.svg", type: "image/svg+xml", sizes: "any" }] },
  robots: { index: false, follow: false },
};

export default function SmartEyeLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
