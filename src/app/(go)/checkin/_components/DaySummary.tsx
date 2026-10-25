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
