"use client";

import { useUiText } from "@/app/[lang]/(workspace)/smart-eye/_hooks/use-ui-text";
import pageStyles from "@/app/[lang]/(workspace)/smart-eye/_styles/pages.module.css";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { performBrowserLogout } from "@/lib/api/browser-auth";
import { useLocale } from "@/app/[lang]/(workspace)/smart-eye/_hooks/use-locale";

export default function SettingsPage() {
  const uiText = useUiText();
  const lang = useLocale();
  const [company, setCompany] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      const saved = localStorage.getItem("saleseye-settings");
      if (saved) {
        try {
          const d = JSON.parse(saved) as { company?: string; contact?: string; email?: string };
          setCompany(d.company || "");
          setContact(d.contact || "");
          setEmail(d.email || "");
        } catch {}
      }
    });
  }, []);

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    localStorage.setItem("saleseye-settings", JSON.stringify({ company, contact, email }));
    toast.success(uiText("已保存"));
    setSaving(false);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await performBrowserLogout({ lang });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : uiText("退出失败，请稍后重试")
      );
      setLoggingOut(false);
    }
  };

  return (
    <div className={`${pageStyles.page} ${pageStyles.settings}`}>
      <h1 className="mb-[34px]">{uiText("系统设置")}</h1>

      <form
        onSubmit={handleSave}
        className="w-full min-w-0 max-w-[613px] rounded-[14px] border border-border bg-card px-5 py-6 sm:px-[26px] sm:py-[28px]"
      >
        <h2 className="mb-8 font-semibold text-foreground">{uiText("公司信息")}</h2>

        <div className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-[16px] font-medium leading-none text-muted-foreground">{uiText("公司名称")}</span>
            <input
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder={uiText("输入公司名称")}
              className="h-[42px] w-full rounded-[8px] border border-transparent bg-input px-4 text-[18px] text-foreground outline-none transition placeholder:text-muted-foreground focus:border-[#4d8dff]"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-[16px] font-medium leading-none text-muted-foreground">{uiText("联系人")}</span>
              <input
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                placeholder={uiText("你的名字")}
                className="h-[42px] w-full rounded-[8px] border border-transparent bg-input px-4 text-[18px] text-foreground outline-none transition placeholder:text-muted-foreground focus:border-[#4d8dff]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[16px] font-medium leading-none text-muted-foreground">{uiText("邮箱")}</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="your@email.com"
                className="h-[42px] w-full rounded-[8px] border border-transparent bg-input px-4 text-[18px] text-foreground outline-none transition placeholder:text-muted-foreground focus:border-[#4d8dff]"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="btn-bg h-[46px] w-full rounded-[9px] text-[18px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? uiText("保存中...") : uiText("保存")}
          </button>
        </div>
      </form>

      <div className="mt-6 w-full min-w-0 max-w-[613px] rounded-[14px] border border-border bg-card px-5 py-6 sm:px-[26px] sm:py-[28px]">
        <h2 className="mb-5 text-[20px] font-semibold leading-none text-foreground">{uiText("账户")}</h2>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="h-[46px] w-full rounded-[9px] border border-border bg-transparent text-[18px] font-semibold text-foreground transition hover:border-[#5b6b88] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loggingOut ? uiText("退出中...") : uiText("退出登录")}
        </button>
      </div>
    </div>
  );
}
