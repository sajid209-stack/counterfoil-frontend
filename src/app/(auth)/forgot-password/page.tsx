"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { AuthField } from "../_components/AuthField";
import { AuthHeading, authButtonClass, linkClass, quietLinkClass } from "../_components/AuthHeading";

// Account recovery — the response NEVER reveals whether an account exists.
export default function ForgotPasswordPage() {
  const t = useTranslations("auth.forgot");
  const [contact, setContact] = useState("");
  const [missing, setMissing] = useState(false);
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="flex flex-col gap-major">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success-wash text-success">
          <MailCheck size={20} aria-hidden />
        </span>
        <AuthHeading title={t("sentTitle")} lead={t("sentLead", { contact: contact.trim() })} />
        <p className="text-sm text-muted">{t("sentHelp")}</p>
        <div className="flex flex-col items-start gap-inline">
          <Link href="/sign-in" className={linkClass}>{t("back")}</Link>
          {/* demo shortcut to the reset screen */}
          <Link href="/reset/demo-token" className={quietLinkClass}>{t("demo")}</Link>
        </div>
      </div>
    );
  }

  /* The button is never greyed out: pressed with nothing typed, it says what
     is missing beside the field, which a disabled button cannot. */
  const send = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!contact.trim()) {
      setMissing(true);
      return;
    }
    setSent(true);
  };

  return (
    <form onSubmit={send} noValidate className="flex flex-col gap-major">
      <AuthHeading title={t("title")} lead={t("lead")} />
      <AuthField
        label={t("contact")}
        name="contact"
        placeholder={t("contactPlaceholder")}
        value={contact}
        autoComplete="username"
        onChange={(e) => { setContact(e.target.value); setMissing(false); }}
        error={missing ? t("contactMissing") : undefined}
      />
      <Button type="submit" size="md" className={authButtonClass} fullWidth>{t("submit")}</Button>
      <Link href="/sign-in" className={quietLinkClass + " self-center"}>{t("back")}</Link>
    </form>
  );
}
