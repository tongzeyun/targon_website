"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { performBrowserLogout } from "@/lib/api/browser-auth";
import { useI18n } from "@/lib/i18n";

export default function SettingsPage() {
  const { lang } = useI18n();
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
    toast.success("已保存");
    setSaving(false);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await performBrowserLogout({ lang });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "退出失败，请稍后重试"
      );
      setLoggingOut(false);
    }
  };

  return (
    <div className="min-h-full w-full min-w-0 max-w-full px-4 pb-24 pt-24 text-[#E8EDF7] sm:px-6 lg:px-8 lg:pb-10 lg:pt-[112px]">
      <h1 className="mb-8 text-[28px] font-bold leading-none text-white sm:mb-10 sm:text-[32px]">系统设置</h1>

      <form
        onSubmit={handleSave}
        className="w-full min-w-0 max-w-[613px] rounded-[14px] border border-[#202837] bg-[#141922] px-5 py-6 sm:px-[26px] sm:py-[28px]"
      >
        <h2 className="mb-9 text-[20px] font-semibold leading-none text-white">公司信息</h2>

        <div className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-[16px] font-medium leading-none text-[#687286]">公司名称</span>
            <input
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="输入公司名称"
              className="h-[42px] w-full rounded-[8px] border border-transparent bg-[#070B14] px-4 text-[18px] text-slate-100 outline-none transition placeholder:text-[#687286] focus:border-[#4D8DFF]"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-[16px] font-medium leading-none text-[#687286]">联系人</span>
              <input
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                placeholder="你的名字"
                className="h-[42px] w-full rounded-[8px] border border-transparent bg-[#070B14] px-4 text-[18px] text-slate-100 outline-none transition placeholder:text-[#687286] focus:border-[#4D8DFF]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[16px] font-medium leading-none text-[#687286]">邮箱</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="your@email.com"
                className="h-[42px] w-full rounded-[8px] border border-transparent bg-[#070B14] px-4 text-[18px] text-slate-100 outline-none transition placeholder:text-[#687286] focus:border-[#4D8DFF]"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="btn-bg h-[46px] w-full rounded-[9px] text-[18px] font-semibold text-[#0A0613] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </form>

      <div className="mt-6 w-full min-w-0 max-w-[613px] rounded-[14px] border border-[#202837] bg-[#141922] px-5 py-6 sm:px-[26px] sm:py-[28px]">
        <h2 className="mb-5 text-[20px] font-semibold leading-none text-white">账户</h2>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="h-[46px] w-full rounded-[9px] border border-[#3A4458] bg-transparent text-[18px] font-semibold text-[#E8EDF7] transition hover:border-[#5B6B88] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loggingOut ? "退出中..." : "退出登录"}
        </button>
      </div>
    </div>
  );
}
