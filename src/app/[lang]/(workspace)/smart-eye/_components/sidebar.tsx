"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const navigation = [
  { name: "总览", mobileName: "总览", href: "/smart-eye/app/dashboard", icon:'/img/aside_1_n.png' , iconActive:'/img/aside_1_a.png' },
  { name: "产品库", href: "/smart-eye/app/products", icon:'/img/aside_2_n.png' , iconActive:'/img/aside_2_a.png' },
  { name: "目标客户", mobileName: "客户", href: "/smart-eye/app/accounts", icon:'/img/aside_3_n.png' , iconActive:'/img/aside_3_a.png' },
  { name: "项目跟进", mobileName: "项目", href: "/smart-eye/app/projects", icon:'/img/aside_4_n.png' , iconActive:'/img/aside_4_a.png' },
  { name: "深度情报", mobileName: "情报", href: "/smart-eye/app/deep-research", icon:'/img/aside_5_n.png' , iconActive:'/img/aside_5_a.png' },
  { name: "销售管线", mobileName: "管线", href: "/smart-eye/app/pipeline", icon:'/img/aside_6_n.png' , iconActive:'/img/aside_6_a.png' },
];

const toolsNav = [
  { name: "报价单", href: "/smart-eye/app/quotation", icon:'/img/aside_7_n.png' , iconActive:'/img/aside_7_a.png' },
  { name: "合同制作", href: "/smart-eye/app/contract", icon:'/img/aside_8_n.png' , iconActive:'/img/aside_8_a.png' },
  { name: "标书制作", href: "/smart-eye/app/bid", icon:'/img/aside_9_n.png' , iconActive:'/img/aside_9_a.png' },
  { name: "沟通梳理", href: "/smart-eye/app/meeting", icon:'/img/aside_10_n.png' , iconActive:'/img/aside_10_a.png' },
  { name: "格式转换", href: "/smart-eye/app/convert", icon:'/img/aside_11_n.png' , iconActive:'/img/aside_11_a.png' },
];

const secondaryNav = [
  { name: "系统设置", href: "/smart-eye/app/settings", icon:'/img/aside_12_n.png' , iconActive:'/img/aside_12_a.png' },
];

export function SidebarIcon({ src, className }: { src: string; className?: string }) {
  return (
    <span
      className={cn("size-5 shrink-0 bg-contain bg-center bg-no-repeat", className)}
      style={{ backgroundImage: `url(${src})` }}
    />
  );
}

export function Sidebar({
  open,
  onClose,
  offsetTop = false,
}: {
  open?: boolean;
  onClose?: () => void;
  offsetTop?: boolean;
}) {
  const { lang } = useI18n();
  const pathname = usePathname().replace(/^\/(zh|en)(?=\/)/, "");
  const smartEyeMode = offsetTop;

  return (
    <>
      {/* Keep the backdrop outside the translated aside so it cannot cover its links. */}
      {open && onClose && (
        <button
          type="button"
          aria-label="关闭侧栏"
          className={cn(
            "fixed inset-x-0 bottom-0 z-30 bg-black/45 md:hidden",
            smartEyeMode ? "top-16" : "top-0"
          )}
          onClick={onClose}
        />
      )}
      <aside className={cn(
        "fixed left-0 z-40 flex max-w-[calc(100vw-3rem)] flex-col overflow-hidden transition-transform duration-200",
        smartEyeMode ? "top-16 h-[calc(100dvh-4rem)] w-[244px] bg-[#070B14]" : "top-0 h-dvh w-64 bg-white",
        open === false ? "-translate-x-full" : "translate-x-0",
        "md:translate-x-0 md:shadow-none"
      )}>
      {/* Logo */}
      <div className={cn("pl-16", smartEyeMode ? "pt-8 pb-9" : "flex h-16 items-center gap-3 border-b")}>
        {smartEyeMode ? (
          <div >
            <div className="section-kicker">Smart Eye</div>
            <div className="mt-1 text-2xl font-bold leading-tight text-white">
              灵眸
              <span
                style={{
                  background:
                    "linear-gradient(135deg, #6FB1FF 14.64%, #8E8DFF 51.41%, #B07DFF 85.36%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  color: "transparent",
                  display: "inline-block"
                }}
              >
                智售
              </span>
            </div>
          </div>
        ) : (
          <>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white font-bold text-sm shadow-sm">
              <span className="size-5 rounded-full border-2 border-current" />
            </div>
            <div>
              <div className="font-bold text-base leading-tight">灵眸智售</div>
              <div className="text-[10px] text-muted-foreground leading-tight">Smart Eye</div>
            </div>
          </>
        )}
      </div>

      {/* Main Navigation */}
      <nav className={cn("flex-1 overflow-y-auto", smartEyeMode ? "px-6 pb-5" : "px-3 py-4")}>
        <div className={cn("mb-8",smartEyeMode ? "space-y-5" : "space-y-1")}>
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.name}
                href={`/${lang}${item.href}`}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-4 text-lg transition w-full pl-10",
                  smartEyeMode
                    ? isActive
                      ? "font-semibold text-white"
                      : "text-[#A6AEBD] hover:text-white"
                    : isActive
                      ? "font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                )}
              >
                <SidebarIcon src={isActive ? item.iconActive : item.icon} />
                {item.name}
              </Link>
            );
          })}
        </div>

        <div className="mb-8">
          <p className={cn("mb-5 text-sm pl-10", smartEyeMode ? "text-[#747D91]" : "px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider")}>
            文档工具
          </p>
          <div className={cn(smartEyeMode ? "space-y-5" : "space-y-1")}>
            {toolsNav.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.name}
                  href={`/${lang}${item.href}`}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-4 text-lg transition w-full pl-10",
                    smartEyeMode
                      ? isActive
                        ? "font-semibold text-white"
                        : "text-[#A6AEBD] hover:text-white"
                      : isActive
                        ? "font-medium text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <SidebarIcon src={isActive ? item.iconActive : item.icon} />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
        <div className={cn(smartEyeMode ? "space-y-5" : "space-y-1")}>
          {secondaryNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={`/${lang}${item.href}`}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-4 text-lg transition w-full pl-10",
                  smartEyeMode
                    ? isActive
                      ? "font-semibold text-white"
                      : "text-[#A6AEBD] hover:text-white"
                    : isActive
                      ? "font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                )}
              >
                <SidebarIcon src={isActive ? item.iconActive : item.icon} />
                {item.name}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User Footer */}
        <UserFooter dark={smartEyeMode} onNavigate={onClose} />
      </aside>
    </>
  );
}

function UserFooter({ dark, onNavigate }: { dark?: boolean; onNavigate?: () => void }) {
  const { lang } = useI18n();
  const [info, setInfo] = useState({ contact: "", company: "", email: "" });
  useEffect(() => {
    queueMicrotask(() => {
      const saved = localStorage.getItem("saleseye-settings");
      if (saved) { try { setInfo(JSON.parse(saved)); } catch {} }
    });
  }, []);

  return (
    <div className={cn(dark ? "px-6 pb-5" : "border-t p-3")}>
      <Link
        href={`/${lang}/smart-eye/app/settings`}
        onClick={onNavigate}
        className={cn(
          "flex cursor-pointer items-center gap-3 rounded-lg text-left transition",
          dark ? "p-0 text-slate-100 hover:text-white" : "w-full p-2 hover:bg-accent"
        )}
      >
        <Avatar className={cn("shrink-0", dark ? "size-12 ring-2 ring-[#7CA8FF]" : "h-8 w-8")}>
          <AvatarFallback className={cn(dark ? "bg-[#8D6DFF] text-lg text-white" : "bg-blue-100 text-blue-700 text-xs font-medium")}>
            {(info.contact || "用户").charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className={cn("truncate font-medium", dark ? "text-lg text-white" : "text-sm")}>{info.contact || "用户"}</p>
          <p className={cn("truncate", dark ? "text-sm text-[#A6AEBD]" : "text-xs text-muted-foreground")}>{info.company || "未设置公司"}</p>
        </div>
      </Link>
    </div>
  );
}
