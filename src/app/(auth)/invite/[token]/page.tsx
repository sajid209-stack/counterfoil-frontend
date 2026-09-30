"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, FormField } from "@/components/ui";

/* Accepting an invitation. The token is read by the (future) auth call, not
   shown: it used to be printed under the heading, which is a developer's line
   in front of somebody on their first day. */
export default function InviteAcceptPage() {
  const router = useRouter();
  const t = useTranslations("auth.invite");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [tried, setTried] = useState(false);

  const shortErr = (tried || pw.length > 0) && pw.length < 8 ? t("tooShort") : undefined;
  const matchErr = (tried || pw2.length > 0) && pw2 !== pw ? t("mismatch") : undefined;

  const activate = () => {
    if (pw.length < 8 || pw !== pw2) {
      setTried(true);
      return;
    }
    router.push("/sign-in");
  };

  return (
    <div className="card-surface p-card">
      <p className="type-label text-[13px] text-brand-foreground">Counterfoil</p>
      <h1 className="type-h1 mt-inline text-2xl">{t("title")}</h1>
      <p className="type-body mt-tight text-[13px] text-muted">{t("lead")}</p>

      <div className="mt-major flex flex-col gap-section">
        <FormField label={t("password")} variant="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} error={shortErr} />
        <FormField label={t("repeat")} variant="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} error={matchErr} />
      </div>

      <Button fullWidth size="lg" className="mt-major" onClick={activate}>
        {t("submit")}
      </Button>
    </div>
  );
}
