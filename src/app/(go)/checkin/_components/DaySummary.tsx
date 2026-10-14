"use client";

import { useTranslations } from "next-intl";
import { Banknote } from "lucide-react";
import { Button } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import type { Minor } from "@/lib/api";

/**
 * The day, before anyone turns up: how many are expected, how many are in, how
 * many are still to come, and what is still to collect. It always speaks about
 * the WHOLE day — typing a guest's name into the search is a lookup, not a
 * claim that the day is now that one guest's two tickets.
 */
export function DaySummary({
  expected,
  arrived,
  owed,
  owingParties,
  onShowDue,
}: {
  expected: number;
  arrived: number;
  owed: Minor;
  owingParties: number;
  onShowDue: () => void;
}) {
  const t = useTranslations("checkin");
  return (
    <section data-day-summary className="card-surface flex flex-col gap-comfortable p-card">
      <h2 className="text-md font-semibold text-fg">{t("summaryTitle")}</h2>
      <div className="grid grid-cols-3 divide-x divide-line overflow-hidden rounded-inner border border-line text-center">
        {(
          [
            ["expected", expected],
            ["arrived", arrived],
            ["toCome", Math.max(0, expected - arrived)],
          ] as const
        ).map(([key, value]) => (
          <div key={key} className="flex flex-col items-center gap-inline py-comfortable">
            <span className="text-xl font-semibold tabular-nums">{value}</span>
            <span className="text-sm text-muted">{t(`stat_${key}`)}</span>
          </div>
        ))}
      </div>
      {owed > 0 && (
        <div className="flex flex-col gap-tight rounded-inner border border-warning-line bg-warning-wash p-comfortable">
          <p className="text-md font-semibold text-fg">{t("owedAcrossDay", { amount: formatMoney(owed) })}</p>
          <p className="text-sm text-fg-secondary">{t("owedParties", { count: owingParties })}</p>
          <Button variant="secondary" icon={<Banknote size={18} strokeWidth={1.75} aria-hidden />} onClick={onShowDue}>
            {t("showDue")}
          </Button>
        </div>
      )}
    </section>
  );
}
