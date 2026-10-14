"use client";

import { type SubmitEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LocaleSwitch } from "@/components/locale-switch";
import { resolveSafeSmartEyeNextPath } from "@/lib/api/browser-auth";
import { useLocale } from "@/app/[lang]/(workspace)/smart-eye/_hooks/use-locale";
import { getSmartEyeCopy } from "@/app/[lang]/(workspace)/smart-eye/_lib/copy";
import styles from "@/app/[lang]/(workspace)/smart-eye/login/login.module.css";

export default function LoginPage() {
  const lang = useLocale();
  const copy = getSmartEyeCopy(lang).login;
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error(copy.required);
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
        const code = typeof err === "object" && err !== null && typeof err.code === "string" ? err.code : "";
        const translated = (copy.errors as Record<string, string>)[code];
        const message = translated || (lang === "zh" && typeof err?.message === "string" ? err.message : copy.failed);
        toast.error(message);
        setLoading(false);
        return;
      }

      toast.success(mode === "login" ? copy.welcome : copy.registered);
      const nextPath = new URLSearchParams(window.location.search).get("next");
      router.push(resolveSafeSmartEyeNextPath(nextPath, lang));
    } catch {
      toast.error(copy.networkError);
      setLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <LocaleSwitch lang={lang} className={styles.locale} />
      <section className={styles.card} aria-labelledby="login-title">
        <div className={styles.logo}>
          <img src="/img/smart-eye/login-logo.svg" alt="" />
        </div>
        <div className={styles.heading}>
          <h1 id="login-title" className={styles.title}>{mode === "login" ? copy.title : copy.registerTitle}</h1>
          <p className={styles.subtitle}>{mode === "login" ? copy.subtitle : copy.registerSubtitle}</p>
        </div>
        <form onSubmit={handleSubmit} className={styles.form} aria-busy={loading}>
          <label className={styles.field}>
            <span className="sr-only">{copy.email}</span>
            <span className={styles.fieldIcon}><img src="/img/smart-eye/login-email.svg" alt="" /></span>
            <input id="email" type="email" placeholder={copy.email} value={email}
              onChange={(event) => setEmail(event.target.value)} autoComplete="email"
              className={styles.input} />
          </label>
          <label className={styles.field}>
            <span className="sr-only">{copy.password}</span>
            <span className={styles.fieldIcon}><img src="/img/smart-eye/login-password.svg" alt="" /></span>
            <input id="password" type={showPwd ? "text" : "password"}
              placeholder={mode === "register" ? copy.passwordHint : copy.password} value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className={`${styles.input} ${styles.password}`} />
            <button type="button" onClick={() => setShowPwd((value) => !value)} className={styles.visibility}
              aria-label={showPwd ? copy.hidePassword : copy.showPassword} aria-pressed={showPwd}>
              {showPwd ? copy.hide : copy.show}
            </button>
          </label>
          <button type="submit" disabled={loading} className={styles.submit}>
            {loading ? copy.processing : mode === "login" ? copy.submit : copy.register}
          </button>
        </form>
        <div className={styles.switch}>
          <button type="button" onClick={() => setMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? copy.toRegister : copy.toLogin}
          </button>
        </div>
      </section>
    </main>
  );
}
