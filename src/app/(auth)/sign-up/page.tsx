"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, FormField } from "@/components/ui";

export default function SignUpPage() {
  const router = useRouter();
  const t = useTranslations("auth.signUp");
  const [phase, setPhase] = useState<"form" | "verify">("form");

  return (
    <div className="card-surface p-card">
      <p className="type-label text-[13px] text-brand-foreground">Counterfoil</p>

      {phase === "form" ? (
        <>
          <h1 className="type-h1 mt-inline text-2xl">{t("title")}</h1>
          <p className="type-body mt-tight text-[13px] text-muted">{t("lead")}</p>
          <div className="mt-major flex flex-col gap-section">
            <FormField label={t("name")} autoComplete="name" placeholder={t("namePlaceholder")} />
            <FormField label={t("email")} variant="email" autoComplete="email" placeholder={t("emailPlaceholder")} />
            <FormField label={t("password")} variant="password" autoComplete="new-password" help={t("passwordHelp")} />
          </div>
          <Button fullWidth size="lg" className="mt-major" onClick={() => setPhase("verify")}>
            {t("submit")}
          </Button>
          <p className="type-body mt-section text-center text-[13px] text-muted">
            {t("haveAccount")}{" "}
            <Link href="/sign-in" className="text-brand-foreground underline-offset-4 hover:underline">{t("signIn")}</Link>
          </p>
        </>
      ) : (
        <>
          <h1 className="type-h1 mt-inline text-2xl">{t("checkTitle")}</h1>
          <p className="type-body mt-tight text-[13px] text-muted">{t("checkLead")}</p>
          <div className="mt-major">
            <FormField label={t("code")} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" />
          </div>
          <Button fullWidth size="lg" className="mt-major" onClick={() => router.push("/onboarding")}>
            {t("confirm")}
          </Button>
          <button type="button" onClick={() => setPhase("form")} className="mt-section flex min-h-11 w-full items-center justify-center text-[13px] text-muted hover:text-fg">
            {t("back")}
          </button>
        </>
      )}
    </div>
  );
}
