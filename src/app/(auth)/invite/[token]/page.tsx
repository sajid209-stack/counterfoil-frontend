"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { AuthField } from "../../_components/AuthField";
import { AuthHeading } from "../../_components/AuthHeading";

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

  const activate = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (pw.length < 8 || pw !== pw2) {
      setTried(true);
      return;
    }
    router.push("/sign-in");
  };

  return (
    <form onSubmit={activate} noValidate className="flex flex-col gap-major">
      <AuthHeading title={t("title")} lead={t("lead")} />
      <div className="flex flex-col gap-section">
        <AuthField label={t("password")} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} error={shortErr} />
        <AuthField label={t("repeat")} type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} error={matchErr} />
      </div>
      <Button type="submit" fullWidth size="lg">{t("submit")}</Button>
    </form>
  );
}
