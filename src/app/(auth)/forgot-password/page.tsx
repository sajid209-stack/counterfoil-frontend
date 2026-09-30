"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, FormField } from "@/components/ui";

// Account recovery — the response NEVER reveals whether an account exists.
export default function ForgotPasswordPage() {
  const t = useTranslations("auth.forgot");
  const [contact, setContact] = useState("");
  const [missing, setMissing] = useState(false);
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="card-surface flex flex-col gap-section p-card text-center">
        <h1 className="type-h1 text-2xl">{t("sentTitle")}</h1>
        <p className="type-body text-[13px] text-muted">{t("sentLead", { contact: contact.trim() })}</p>
        <p className="text-[13px] text-muted">{t("sentHelp")}</p>
        <Link href="/sign-in" className="inline-flex min-h-11 items-center justify-center text-[13px] text-brand-foreground underline-offset-4 hover:underline">{t("back")}</Link>
        {/* demo shortcut to the reset screen */}
        <Link href="/reset/demo-token" className="font-mono text-[12px] text-muted hover:text-fg">{t("demo")}</Link>
      </div>
    );
  }

  /* The button is never greyed out: pressed with nothing typed, it says what
     is missing beside the field, which a disabled button cannot. */
  const send = () => {
    if (!contact.trim()) {
      setMissing(true);
      return;
    }
    setSent(true);
  };

  return (
    <div className="card-surface flex flex-col gap-section p-card">
      <div>
        <h1 className="type-h1 text-2xl">{t("title")}</h1>
        <p className="type-body mt-tight text-[13px] text-muted">{t("lead")}</p>
      </div>
      <FormField
        label={t("contact")}
        placeholder={t("contactPlaceholder")}
        value={contact}
        autoComplete="username"
        onChange={(e) => { setContact(e.target.value); setMissing(false); }}
        onKeyDown={(e) => { if (e.key === "Enter") send(); }}
        error={missing ? t("contactMissing") : undefined}
      />
      <Button size="lg" fullWidth onClick={send}>{t("submit")}</Button>
      <Link href="/sign-in" className="inline-flex min-h-11 items-center justify-center text-[13px] text-muted hover:text-fg">{t("back")}</Link>
    </div>
  );
}
