"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { AuthField } from "../_components/AuthField";
import { AuthHeading, authButtonClass, linkClass, quietLinkClass } from "../_components/AuthHeading";
import { CodeBoxes } from "../_components/CodeBoxes";
import { Strength } from "../_components/Strength";
import { markFreshAccount, startFreshBusiness } from "@/lib/api";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESEND_SECONDS = 30;

// Sign up in two steps: the form, then a code sent to the email. Demo: any six
// digits confirm, and the account goes on to onboarding.
export default function SignUpPage() {
  const router = useRouter();
  const t = useTranslations("auth.signUp");
  const e = useTranslations("auth.err");
  const [phase, setPhase] = useState<"form" | "verify">("form");
  const [name, setName] = useState("");
  const [business, setBusiness] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tried, setTried] = useState(false);
  const [code, setCode] = useState("");
  const [codeTried, setCodeTried] = useState(false);
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [resent, setResent] = useState(false);
  const [loading, setLoading] = useState(false);

  // The resend countdown only runs while the code step is open.
  useEffect(() => {
    if (phase !== "verify") return;
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const nameErr = tried && !name.trim() ? e("nameMissing") : undefined;
  const bizErr = tried && !business.trim() ? e("businessMissing") : undefined;
  const emailErr = !tried ? undefined : !email.trim() ? e("emailMissing") : !EMAIL.test(email.trim()) ? e("emailInvalid") : undefined;
  const pwErr = !tried ? undefined : !password ? e("passwordMissing") : password.length < 8 ? e("passwordShort") : undefined;

  const submitForm = (ev: React.FormEvent) => {
    ev.preventDefault();
    setTried(true);
    if (!name.trim() || !business.trim() || !EMAIL.test(email.trim()) || password.length < 8) return;
    setSeconds(RESEND_SECONDS);
    setResent(false);
    setPhase("verify");
  };

  const confirm = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (loading) return;
    setCodeTried(true);
    if (code.length < 6) return;
    setLoading(true);
    // A confirmed account starts empty, and a reload keeps it that way.
    startFreshBusiness();
    markFreshAccount(business.trim(), { ownerName: name.trim() });
    setTimeout(() => router.push("/onboarding"), 600);
  };

  const resend = () => {
    setSeconds(RESEND_SECONDS);
    setResent(true);
    setCode("");
  };

  const step = (n: number) => (
    <div className="flex items-center gap-comfortable">
      <span className="text-sm font-medium text-muted">{t("step", { n, total: 2 })}</span>
      <span className="flex w-16 gap-inline" aria-hidden>
        <span className="h-1 flex-1 rounded-full bg-ember-solid" />
        <span className={n === 2 ? "h-1 flex-1 rounded-full bg-ember-solid" : "h-1 flex-1 rounded-full bg-line"} />
      </span>
    </div>
  );

  if (phase === "verify") {
    const codeErr = codeTried && code.length < 6 ? t("codeMissing") : undefined;
    const mm = `0:${String(seconds).padStart(2, "0")}`;
    return (
      <form onSubmit={confirm} noValidate className="flex flex-col gap-major">
        <AuthHeading
          eyebrow={step(2)}
          title={t("checkTitle")}
          lead={t("checkLead", { email: email.trim() })}
        />
        <div className="flex flex-col gap-tight">
          <CodeBoxes value={code} onChange={setCode} invalid={!!codeErr} describedBy={codeErr ? "code-msg" : undefined} />
          {codeErr && <p id="code-msg" className="text-sm text-danger">{codeErr}</p>}
        </div>
        <Button type="submit" fullWidth size="md" className={authButtonClass} loading={loading}>{t("confirm")}</Button>
        <div className="flex flex-col items-center gap-inline text-center text-sm text-muted">
          {seconds > 0 ? (
            <p className="inline-flex items-center max-sm:min-h-11 [@media(pointer:coarse)]:min-h-11">{t("resendIn", { time: mm })}</p>
          ) : (
            <button type="button" onClick={resend} className={linkClass}>{t("resend")}</button>
          )}
          {resent && <p role="status">{t("resent")}</p>}
          <button type="button" onClick={() => setPhase("form")} className={quietLinkClass}>{t("changeEmail")}</button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={submitForm} noValidate className="flex flex-col gap-major">
      <AuthHeading eyebrow={step(1)} title={t("title")} lead={t("lead")} />
      <div className="flex flex-col gap-section">
        <AuthField label={t("name")} name="name" autoComplete="name" placeholder={t("namePlaceholder")} value={name} onChange={(ev) => setName(ev.target.value)} error={nameErr} />
        <AuthField label={t("business")} name="business" autoComplete="organization" placeholder={t("businessPlaceholder")} value={business} onChange={(ev) => setBusiness(ev.target.value)} error={bizErr} />
        <AuthField label={t("email")} type="email" name="email" autoComplete="email" inputMode="email" placeholder={t("emailPlaceholder")} value={email} onChange={(ev) => setEmail(ev.target.value)} error={emailErr} />
        <AuthField
          label={t("password")}
          type="password"
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={(ev) => setPassword(ev.target.value)}
          error={pwErr}
          help={password ? undefined : t("passwordHelp")}
          below={<Strength password={password} />}
        />
      </div>
      <div className="flex flex-col gap-section">
        <Button type="submit" fullWidth size="md" className={authButtonClass}>{t("submit")}</Button>
        <p className="text-center text-sm text-muted">{t("terms")}</p>
      </div>
      <p className="border-t border-hairline pt-major text-center text-sm text-muted">
        {t("haveAccount")}{" "}
        <Link href="/sign-in" className="font-medium text-brand-foreground underline-offset-4 hover:underline">{t("signIn")}</Link>
      </p>
    </form>
  );
}
