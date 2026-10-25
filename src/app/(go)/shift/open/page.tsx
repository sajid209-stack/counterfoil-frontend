"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { peekPaymentSettings } from "@/lib/api";
import { GoCard } from "../../_components/Tiles";
import { GoPage, GoPageHeader } from "../../_components/GoPage";

export default function ShiftOpenPage() {
  const router = useRouter();
  const t = useTranslations("shift");
  // The float the business suggests, set in Settings → Payments.
  const [float, setFloat] = useState(() => (peekPaymentSettings().defaultFloat / 100).toFixed(2));

  return (
    <GoPage width="narrow">
    <div className="mx-auto max-w-104 pb-section pt-tight rail:max-w-lg rail:pb-0 rail:pt-major">
    <GoPageHeader title={t("openingTitle")} subtitle={t("openingHint")} className="mb-comfortable! rail:mb-major!" />
    <main className="flex flex-col gap-comfortable rail:gap-section">

      <GoCard>
        <label htmlFor="opening-cash" className="text-md font-semibold text-fg">{t("openingCash")}</label>
        <input
          id="opening-cash"
          inputMode="decimal"
          value={float}
          onChange={(e) => setFloat(e.target.value)}
          className="h-14 rounded-inner bg-subtle px-section text-2xl font-semibold tabular-nums text-fg"
        />
      </GoCard>

      <Button size="lg" fullWidth className="h-13 text-md font-semibold" onClick={() => router.push("/pos")}>
        {t("openShift")}
      </Button>
    </main>
    </div>
    </GoPage>
  );
}
