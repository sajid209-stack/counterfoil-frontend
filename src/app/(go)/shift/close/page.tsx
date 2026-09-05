"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { AppearancePicker } from "@/components/ThemeProvider";

// Expected drawer is mocked here; the real screen sums the shift's cash sales.
const EXPECTED = 4785000; // ৳47,850.00

export default function ShiftClosePage() {
  const router = useRouter();
  const t = useTranslations("shift");
  const [counted, setCounted] = useState("");

  const countedMinor = useMemo(() => Math.round((parseFloat(counted) || 0) * 100), [counted]);
  const variance = countedMinor - EXPECTED;
  const tone = variance === 0 ? "text-success" : variance > 0 ? "text-info" : "text-danger";

  return (
    <main className="mx-auto flex max-w-md flex-col gap-section px-section py-hero">
      <div>
        <p className="type-label text-[13px] text-brand-foreground">{t("endLabel")}</p>
        <h1 className="type-h1 mt-tight text-2xl">{t("closeTitle")}</h1>
        <p className="type-body mt-tight text-muted">{t("closeHint")}</p>
      </div>

      <div className="rounded-sm border border-line bg-card p-section">
        <div className="flex justify-between text-muted"><span>{t("expected")}</span><span className="font-mono text-lg">{formatMoney(EXPECTED)}</span></div>
        <div className="mt-tight flex justify-between"><span>{t("counted")}</span><span className="font-mono text-lg">{formatMoney(countedMinor)}</span></div>
        <div className={`mt-tight flex justify-between text-xl font-medium ${tone}`}>
          <span>{t("variance")}</span>
          <span className="font-mono">{variance > 0 ? "+" : ""}{formatMoney(variance)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-tight">
        <label className="type-label text-[12px] text-muted">{t("countedCash")}</label>
        <input
          inputMode="decimal"
          value={counted}
          onChange={(e) => setCounted(e.target.value)}
          placeholder="0.00"
          className="h-14 rounded-sm border border-line bg-card px-section font-mono text-2xl outline-none focus:border-inverse"
        />
      </div>

      {/* Per device — an environment choice: daylight gates want light, night
          counters want dark. */}
      <AppearancePicker />

      <Button size="lg" fullWidth onClick={() => router.push("/login")}>{t("closeShift")}</Button>
    </main>
  );
}
