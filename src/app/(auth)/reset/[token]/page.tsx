"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { TimerOff, ShieldCheck } from "lucide-react";
import { Button, useToast } from "@/components/ui";
import { AuthField } from "../../_components/AuthField";
import { AuthHeading } from "../../_components/AuthHeading";

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
      <div className="flex flex-col gap-major">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warning-wash text-warning">
          {token === "used" ? <ShieldCheck size={24} aria-hidden /> : <TimerOff size={24} aria-hidden />}
        </span>
        <AuthHeading title={token === "used" ? t("usedTitle") : t("expiredTitle")} lead={token === "used" ? t("usedLead") : t("expiredLead")} />
        <Link href="/forgot-password"><Button size="lg" fullWidth>{t("again")}</Button></Link>
      </div>
    );
  }

  /* Said beside the field, and only once it can be true: a "too short" under
     a password nobody has started typing reads as a telling-off. */
  const shortErr = (tried || pw.length > 0) && pw.length < 8 ? t("tooShort") : undefined;
  const matchErr = (tried || pw2.length > 0) && pw2 !== pw ? t("mismatch") : undefined;

  const save = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (pw.length < 8 || pw !== pw2) {
      setTried(true);
      return;
    }
    toast.success(t("done"));
    router.push("/sign-in");
  };

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-major">
      <AuthHeading title={t("title")} lead={t("lead")} />
      <div className="flex flex-col gap-section">
        <AuthField label={t("password")} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} error={shortErr} />
        <AuthField label={t("repeat")} type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} error={matchErr} />
      </div>
      <Button type="submit" size="lg" fullWidth>{t("submit")}</Button>
    </form>
  );
}
