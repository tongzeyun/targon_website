import { notFound } from "next/navigation";
import { AosInit } from "@/components/aos-init";
import { SiteFooter } from "@/components/site-footer/site-footer";
import { SiteHeader } from "@/components/site-header/site-header";
import { isLocale } from "@/lib/locales";
import "aos/dist/aos.css";

export default async function WebsiteLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <div className="site-body">
      <AosInit />
      <noscript><style>{"[data-aos]{opacity:1!important;transform:none!important}"}</style></noscript>
      <SiteHeader lang={lang} />
      <div className="site-content">{children}</div>
      <SiteFooter lang={lang} />
    </div>
  );
}
