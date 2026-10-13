"use client";

import { type SubmitEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Image from "next/image";
import { resolveSafeSmartEyeNextPath } from "@/lib/api/browser-auth";
import { useI18n } from "@/lib/i18n";

export default function LoginPage() {
  const { lang } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("请输入邮箱和密码");
      return;
    }
    setLoading(true);

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await response.json();

      if (!response.ok) {
        const err = data.error;
        const message =
          typeof err === "object" && err !== null && "message" in err && typeof err.message === "string"
            ? err.message
            : typeof err === "string"
              ? err
              : "操作失败";
        toast.error(message);
        setLoading(false);
        return;
      }

      toast.success(mode === "login" ? "欢迎回来！" : "注册成功！");
      const nextPath = new URLSearchParams(window.location.search).get("next");
      router.push(resolveSafeSmartEyeNextPath(nextPath, lang));
    } catch {
      toast.error("网络错误，请重试");
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-[calc(100vh-64px)] items-center justify-center bg-[#070B14] px-4 py-10 text-[#F2F4F8]">
      <div className="absolute inset-0 bg-[#04070D]/[0.88]" />

      <section className="relative w-full max-w-[640px] rounded-[14px] border border-[#1F242C] bg-[#0A0C10] px-6 pb-[34px] pt-10 sm:px-12 lg:min-h-[577px] lg:px-6">
        <div className="mx-auto mb-7 flex size-[72px] items-center justify-center sm:mb-8">
          <Image src="/img/logo.png" alt="logo" width={72} height={72} />
        </div>

        <div className="mb-[52px] text-center">
          <h1 className="text-[28px] font-medium leading-none text-[#F2F4F8] sm:text-[32px]">
            {mode === "login" ? "灵眸智售登录页" : "注册账号"}
          </h1>
          <p className="mt-4 text-[20px] leading-none text-[#6E7588] sm:text-[26px]">
            {mode === "login" ? "Osmo Smart Sales Login Page" : "Create your Smart Sales Account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mx-auto w-full max-w-[592px] space-y-[30px]">
          <label className="relative block">
            <Image src="/img/email.png" alt="email" width={24} height={18} className="absolute left-[13px] top-1/2 -translate-y-1/2" />
            <input
              id="email"
              type="text"
              placeholder="邮箱/电话号码"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              className="h-14 w-full rounded-[10px] border border-white/10 bg-[#04070D] px-[43px] text-[20px] text-[#F2F4F8] outline-none transition placeholder:text-[#757575] focus:border-[#5B9BFF]"
            />
          </label>

          <label className="relative block">
            <Image src="/img/pwd.png" alt="password" width={24} height={22} className="absolute left-[13px] top-1/2 -translate-y-1/2" />
            <input
              id="password"
              type={showPwd ? "text" : "password"}
              placeholder={mode === "register" ? "至少 8 位" : "密码"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="h-14 w-full rounded-[10px] border border-white/10 bg-[#04070D] px-[46px] pr-16 text-[20px] text-[#F2F4F8] outline-none transition placeholder:text-[#757575] focus:border-[#5B9BFF]"
            />
            <button
              type="button"
              onClick={() => setShowPwd((value) => !value)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[#6E7588] transition hover:text-[#B0B6C4]"
              aria-label={showPwd ? "隐藏密码" : "显示密码"}
            >
              {showPwd ? "隐藏" : "显示"}
            </button>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="btn-bg h-14 w-full rounded-[10px] text-[20px] font-medium text-[#0A0613] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "处理中..." : mode === "login" ? "确认" : "注册"}
          </button>
        </form>

        <div className="mt-[31px] text-center">
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            className="text-sm leading-[18px] text-[#6E7588] transition hover:text-[#B0B6C4]"
          >
            {mode === "login" ? "没有账号？点击注册" : "已有账号？点击登录"}
            {/* {mode === "login" ? "" : "已有账号？点击登录"} */}
          </button>
        </div>
      </section>
    </main>
  );
}
