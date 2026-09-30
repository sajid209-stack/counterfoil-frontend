"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, FormField, useToast } from "@/components/ui";

// Set a new password. Expired or used tokens get a clear state, not an error.
export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const toast = useToast();
  const t = useTranslations("auth.reset");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [tried, setTried] = useState(false);

  const dead = token === "expired" || token === "used";
  if (dead) {
    return (
      <div className="card-surface flex flex-col gap-section p-card text-center">
        <h1 className="type-h1 text-2xl">{token === "used" ? t("usedTitle") : t("expiredTitle")}</h1>
        <p className="type-body text-[13px] text-muted">{token === "used" ? t("usedLead") : t("expiredLead")}</p>
        <Link href="/forgot-password"><Button size="lg" fullWidth>{t("again")}</Button></Link>
      </div>
    );
  }

  /* Said beside the field, and only once it can be true: a "too short" under
     a password nobody has started typing reads as a telling-off. */
  const shortErr = (tried || pw.length > 0) && pw.length < 8 ? t("tooShort") : undefined;
  const matchErr = (tried || pw2.length > 0) && pw2 !== pw ? t("mismatch") : undefined;

  const save = () => {
    if (pw.length < 8 || pw !== pw2) {
      setTried(true);
      return;
    }
    toast.success(t("done"));
    router.push("/sign-in");
  };

  return (
    <div className="card-surface flex flex-col gap-section p-card">
      <div>
        <h1 className="type-h1 text-2xl">{t("title")}</h1>
        <p className="type-body mt-tight text-[13px] text-muted">{t("lead")}</p>
      </div>
      <FormField label={t("password")} variant="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} error={shortErr} />
      <FormField label={t("repeat")} variant="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} error={matchErr} />
      <Button size="lg" fullWidth onClick={save}>{t("submit")}</Button>
    </div>
  );
}
