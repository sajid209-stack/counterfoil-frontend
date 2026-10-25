"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { peekPaymentSettings } from "@/lib/api";
import { GoCard } from "../../_components/Tiles";
import { GoPage, GoPageHeader } from "../../_components/GoPage";

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
  const TOLERANCE = peekPaymentSettings().countTolerance; // Settings → Payments — inside this, call it square.
  const tier = !entered ? "idle" : Math.abs(variance) <= TOLERANCE ? "ok" : "off";
  const blocked = !entered || (tier === "off" && !reason.trim());
  const why = !entered ? t("closeWhyCount") : t("closeWhyReason");

  return (
    <GoPage width="narrow">
    <div className="mx-auto max-w-104 pb-section pt-tight rail:max-w-none rail:py-0">
    <GoPageHeader title={t("closeTitle")} subtitle={t("closeHint")} className="mb-comfortable! rail:mb-major!" />
    {/* Phone: one column. Desktop: the sum on the left, the count (and the
        reason, when the drawer is out) on the right, and the one orange button
        bottom-right under them. */}
    <main className="flex flex-col gap-comfortable rail:grid rail:grid-cols-2 rail:items-start rail:gap-section">
      <GoCard className="rail:row-span-2">
        <div className="flex justify-between text-muted"><span>{t("expected")}</span><span className="text-lg font-semibold tabular-nums text-fg">{formatMoney(EXPECTED)}</span></div>
        <div className="flex justify-between"><span>{t("counted")}</span><span className="text-lg font-semibold tabular-nums">{entered ? formatMoney(countedMinor) : <span className="text-muted">—</span>}</span></div>
        <div className="flex justify-between text-lg font-semibold text-fg">
          <span>{t("variance")}</span>
          <span className="tabular-nums">{!entered ? "—" : `${variance > 0 ? "+" : ""}${formatMoney(variance)}`}</span>
        </div>
        {/* Says what the difference means right now, not only when it is a
            problem — "square" is worth hearing at the end of a shift. */}
        {tier === "off" && (
          <p className="text-sm text-warning">{t("varianceOff", { amount: formatMoney(TOLERANCE) })}</p>
        )}
        {tier === "ok" && (
          <p className="text-sm text-success">{t("varianceOk", { amount: formatMoney(TOLERANCE) })}</p>
        )}
      </GoCard>

      <GoCard>
        <label htmlFor="counted-cash" className="text-md font-semibold text-fg">{t("countedCash")}</label>
        <input
          id="counted-cash"
          inputMode="decimal"
          value={counted}
          onChange={(e) => setCounted(e.target.value)}
          placeholder="0.00"
          className="h-14 rounded-inner bg-subtle px-section text-2xl font-semibold tabular-nums text-fg"
        />
      </GoCard>

      {tier === "off" && (
        <GoCard className="rail:col-start-2">
          <label className="text-md font-semibold text-fg" htmlFor="variance-reason">{t("varianceReason")}</label>
          <textarea
            id="variance-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder={t("varianceReasonPlaceholder")}
            className="min-h-[72px] rounded-inner bg-subtle p-section text-base text-fg"
          />
        </GoCard>
      )}

      {/* Never a grey ghost: while it cannot be pressed it is an outlined button
          that still reads "End shift", with the reason under it. */}
      <Button
        size="lg"
        variant={blocked ? "secondary" : "primary"}
        className="h-13 text-md font-semibold disabled:opacity-100 disabled:text-muted rail:col-span-2 rail:ml-auto rail:min-w-72 rail:w-auto"
        fullWidth
        disabled={blocked}
        aria-describedby={blocked ? "close-why" : undefined}
        onClick={() => router.push("/login")}
      >
        {t("closeShift")}
      </Button>
      {blocked && <p id="close-why" className="text-center text-sm text-muted rail:col-span-2 rail:text-right">{why}</p>}
    </main>
    </div>
    </GoPage>
  );
}
