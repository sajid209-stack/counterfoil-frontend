"use client";

import { useTranslations } from "next-intl";
import { Banknote } from "lucide-react";
import { Button } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import type { Minor } from "@/lib/api";
import { GoCard, TileGrid } from "../../_components/Tiles";

/**
 * The day, before anyone turns up: how many are expected, how many are in, how
 * many are still to come, and what is still to collect. It always speaks about
 * the WHOLE day — typing a guest's name into the search is a lookup, not a
 * claim that the day is now that one guest's two tickets.
 *
 * `compact` is the desktop strip under the scan panel: Arrived, Expected, Not
 * yet in one quiet row (Guest Manager leads with the same three counts).
 */
export function DaySummary({
  expected,
  arrived,
  owed,
  owingParties,
  onShowDue,
  compact = false,
}: {
  expected: number;
  arrived: number;
  owed: Minor;
  owingParties: number;
  onShowDue: () => void;
  compact?: boolean;
}) {
  const t = useTranslations("checkin");
  if (compact) {
    return (
      <div data-day-summary className="flex flex-col gap-tight">
        <div className="grid grid-cols-3 rounded-inner bg-subtle py-tight text-center">
          {(
            [
              ["arrived", arrived],
              ["expected", expected],
              ["notYet", Math.max(0, expected - arrived)],
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="flex min-w-0 flex-col items-center border-l border-line first:border-l-0">
              <span className="text-md font-semibold tabular-nums">{value}</span>
              <span className="text-sm text-muted">{t(`strip_${key}`)}</span>
            </div>
          ))}
        </div>
        {owed > 0 && (
          <div className="flex items-center justify-between gap-tight rounded-inner bg-warning-wash py-inline pl-comfortable pr-inline">
            <p className="min-w-0 text-sm font-medium text-fg">{t("owedAcrossDay", { amount: formatMoney(owed) })}</p>
            <Button variant="secondary" className="h-9 shrink-0" icon={<Banknote size={16} strokeWidth={1.75} aria-hidden />} onClick={onShowDue}>
              {t("showDue")}
            </Button>
          </div>
        )}
      </div>
    );
  }
  return (
    <>
      <GoCard data-day-summary title={t("summaryTitle")}>
        <TileGrid cols={3} className="rail:gap-0">
          {(
            [
              ["expected", expected],
              ["arrived", arrived],
              ["toCome", Math.max(0, expected - arrived)],
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="flex min-w-0 flex-col items-center gap-inline rounded-inner bg-subtle px-tight py-comfortable text-center rail:rounded-none rail:border-l rail:border-line rail:bg-transparent rail:first:border-l-0">
              <span className="text-xl font-semibold tabular-nums rail:text-2xl">{value}</span>
              <span className="text-sm text-muted">{t(`stat_${key}`)}</span>
            </div>
          ))}
        </TileGrid>
      </GoCard>
      {owed > 0 && (
        <GoCard as="div" className="bg-warning-wash">
          <p className="text-md font-semibold text-fg">{t("owedAcrossDay", { amount: formatMoney(owed) })}</p>
          <p className="-mt-tight text-sm text-fg-secondary">{t("owedParties", { count: owingParties })}</p>
          <Button variant="secondary" icon={<Banknote size={18} strokeWidth={1.75} aria-hidden />} onClick={onShowDue}>
            {t("showDue")}
          </Button>
        </GoCard>
      )}
    </>
  );
}
