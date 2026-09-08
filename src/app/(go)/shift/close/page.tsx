"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { formatMoney } from "@/lib/format";

// Expected drawer is mocked here; the real screen sums the shift's cash sales.
const EXPECTED = 4785000; // ৳47,850.00

export default function ShiftClosePage() {
  const router = useRouter();
  const t = useTranslations("shift");
  const [counted, setCounted] = useState("");
  const [reason, setReason] = useState("");

  /* Nothing counted yet is not a count of zero.
     The variance used to read "counted − expected" from the first render, so a
     cashier opening a routine end-of-shift form was met with −৳47,850.00 in the
     alarm colour before touching the keypad. It anchors badly, and worse, it
     trains staff to ignore the variance figure — which defeats the only cash
     control on the screen. */
  const entered = counted.trim() !== "" && Number.isFinite(parseFloat(counted));
  const countedMinor = useMemo(() => Math.round((parseFloat(counted) || 0) * 100), [counted]);
  const variance = countedMinor - EXPECTED;

  /* Three tiers, not two. A drawer that is a few taka out is a rounding
     artefact; one that is thousands out is an incident, and only the second
     needs a reason recorded. The threshold is stated once here so the colour,
     the wording and the required note cannot disagree. */
  const TOLERANCE = 10000; // ৳100 — inside this, call it square.
  const tier = !entered ? "idle" : Math.abs(variance) <= TOLERANCE ? "ok" : "off";
  const tone = tier === "idle" ? "text-muted" : tier === "ok" ? "text-success" : "text-warning";

  return (
    <main className="mx-auto flex max-w-md flex-col gap-section px-section py-hero">
      <div>
        <p className="type-label text-[13px] text-brand-foreground">{t("endLabel")}</p>
        <h1 className="type-h1 mt-tight text-2xl">{t("closeTitle")}</h1>
        <p className="type-body mt-tight text-muted">{t("closeHint")}</p>
      </div>

      <div className="rounded-go border border-line bg-card p-section">
        <div className="flex justify-between text-muted"><span>{t("expected")}</span><span className="font-mono text-lg">{formatMoney(EXPECTED)}</span></div>
        <div className="mt-tight flex justify-between"><span>{t("counted")}</span><span className="font-mono text-lg">{entered ? formatMoney(countedMinor) : <span className="text-muted">—</span>}</span></div>
        <div className={`mt-tight flex justify-between text-xl font-medium ${tone}`}>
          <span>{t("variance")}</span>
          <span className="font-mono">{!entered ? "—" : `${variance > 0 ? "+" : ""}${formatMoney(variance)}`}</span>
        </div>
        {tier === "off" && (
          <p className="mt-tight text-[13px] text-warning">{t("varianceOff")}</p>
        )}
      </div>

      <div className="flex flex-col gap-tight">
        <label className="type-label text-[13px] text-muted">{t("countedCash")}</label>
        <input
          inputMode="decimal"
          value={counted}
          onChange={(e) => setCounted(e.target.value)}
          placeholder="0.00"
          className="h-14 rounded-go-sm border border-line bg-card px-section font-mono text-2xl outline-none focus:border-inverse"
        />
      </div>

      {tier === "off" && (
        <div className="flex flex-col gap-tight">
          <label className="type-label text-[13px] text-muted" htmlFor="variance-reason">{t("varianceReason")}</label>
          <textarea
            id="variance-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder={t("varianceReasonPlaceholder")}
            className="min-h-[72px] rounded-go-sm border border-warning/50 bg-card p-section text-sm outline-none focus:border-inverse"
          />
        </div>
      )}

      <Button
        shape="pill"
        size="lg"
        fullWidth
        disabled={!entered || (tier === "off" && !reason.trim())}
        onClick={() => router.push("/login")}
      >
        {t("closeShift")}
      </Button>
    </main>
  );
}
