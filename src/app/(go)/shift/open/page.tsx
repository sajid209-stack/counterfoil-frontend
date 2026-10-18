"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { peekPaymentSettings } from "@/lib/api";
import { GoCard } from "../../_components/Tiles";

export default function ShiftOpenPage() {
  const router = useRouter();
  const t = useTranslations("shift");
  // The float the business suggests, set in Settings → Payments.
  const [float, setFloat] = useState(() => (peekPaymentSettings().defaultFloat / 100).toFixed(2));

  return (
    <main className="mx-auto flex max-w-md flex-col gap-comfortable px-section py-section">
      <div>
        <h1 className="text-xl font-semibold tracking-title text-fg">{t("openingTitle")}</h1>
        <p className="mt-inline text-sm text-muted">{t("openingHint")}</p>
      </div>

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
  );
}
