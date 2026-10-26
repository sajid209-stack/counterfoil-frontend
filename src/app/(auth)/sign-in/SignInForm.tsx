"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Checkbox } from "@/components/ui";
import { AuthField } from "../_components/AuthField";
import { AuthHeading, authButtonClass, linkClass, quietLinkClass } from "../_components/AuthHeading";
import m from "../_components/auth-motion.module.css";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Sign in. This is a demo: there is no backend, so a well-formed email and any
// password show a short loading state and open the dashboard.
export function SignInForm() {
  const router = useRouter();
  const t = useTranslations("auth.signIn");
  const e = useTranslations("auth.err");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tried, setTried] = useState(false);
  const [loading, setLoading] = useState(false);

  const emailErr = !tried ? undefined : !email.trim() ? e("emailMissing") : !EMAIL.test(email.trim()) ? e("emailInvalid") : undefined;
  const pwErr = tried && !password ? e("passwordMissing") : undefined;

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (loading) return;
    setTried(true);
    if (!email.trim() || !EMAIL.test(email.trim()) || !password) return;
    setLoading(true);
    setTimeout(() => router.push("/dashboard"), 600);
  };

  return (
    <form onSubmit={submit} noValidate className={`flex flex-col gap-major ${m.stagger}`}>
      <AuthHeading title={t("title")} lead={t("lead")} />

      <div className="flex flex-col gap-section">
        <AuthField
          label={t("email")}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder={t("emailPlaceholder")}
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          error={emailErr}
        />
        <AuthField
          label={t("password")}
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(ev) => setPassword(ev.target.value)}
          error={pwErr}
          labelAside={<Link href="/forgot-password" className={linkClass}>{t("forgot")}</Link>}
        />
        <Checkbox label={t("remember")} name="remember" defaultChecked className="-my-2 [&_span.block]:text-sm" />
      </div>

      <Button type="submit" fullWidth size="md" className={authButtonClass} loading={loading}>{t("submit")}</Button>

      <div className="flex flex-col items-center gap-inline border-t border-dashed border-line pt-section text-center text-sm text-muted">
        <p>
          {t("noAccount")}{" "}
          <Link href="/sign-up" className="font-medium text-brand-foreground underline-offset-4 hover:underline">{t("createAccount")}</Link>
        </p>
        <p>
          {t("pinQuestion")}{" "}
          <Link href="/login" className={quietLinkClass + " underline"}>{t("pinLink")}</Link>
        </p>
      </div>
    </form>
  );
}
