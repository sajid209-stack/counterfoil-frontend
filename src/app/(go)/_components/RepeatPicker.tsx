"use client";

import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatClock, formatMoney } from "@/lib/format";
import type { Occurrence } from "@/lib/recurrence";
import { Tile, TileLabel } from "./Tiles";
import { TileText } from "./SheetParts";
import { Stepper } from "./Stepper";

/** Quick counts that FILL the stepper rather than limit it — the app's own
 *  rule for duration chips, applied to weeks. */
const CHIPS = [4, 8, 12];

const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(
    new Date(`${iso}T12:00:00`),
  );

/**
 * "The next 7 Wednesdays at 6."
 *
 * The count is a stepper because the answer is a number the customer says out
 * loud, and the dates are listed because the honest answer to "can I have all
 * seven?" is usually "six of them" — and the cashier has to be able to say
 * which one is missing before taking the money, not after.
 */
export function RepeatPicker({
  count,
  onCount,
  plan,
  time,
  unitPrice,
  currency,
  max = 26,
}: {
  count: number;
  onCount: (n: number) => void;
  plan: Occurrence[];
  time?: string;
  unitPrice: number;
  currency: string;
  max?: number;
}) {
  const t = useTranslations("pos");
  const bookable = plan.filter((o) => o.ok).length;
  const blocked = plan.length - bookable;

  return (
    <div className="mb-section flex flex-col gap-tight">
      <TileLabel>{t("repeat.title")}</TileLabel>

      {/* One row of separate tiles at rest, the off state its own tile; the
          round stepper only appears once someone has asked to repeat, which
          is the only time a count between the presets is worth reaching for. */}
      <div className="grid grid-cols-2 gap-tight sm:grid-cols-4">
        <Tile selected={count === 1} onClick={() => onCount(1)} className="min-h-12">
          <TileText label={t("repeat.offChip")} selected={count === 1} />
        </Tile>
        {CHIPS.map((n) => (
          <Tile key={n} selected={count === n} onClick={() => onCount(n)} className="min-h-12">
            <TileText label={t("repeat.weeks", { count: n })} selected={count === n} />
          </Tile>
        ))}
      </div>

      {/* Fine adjustment, only once repeating is on. The tiles FILL this. */}
      {count > 1 && (
        <div className="card-surface flex items-center justify-between gap-comfortable p-comfortable">
          <span className="text-base font-semibold text-fg">{t("repeat.fine")}</span>
          <Stepper variant="round" value={count} min={1} max={max} onChange={onCount} lessLabel={t("repeat.fewer")} moreLabel={t("repeat.more")} />
        </div>
      )}

      {count > 1 && (
        <>
          <ul className="card-surface flex flex-col p-comfortable">
            {plan.map((o) => (
              <li key={o.date} className="flex min-h-11 items-center gap-comfortable">
                <span className={cn("shrink-0", o.ok ? "text-success" : "text-muted")}>
                  {o.ok ? <Check size={14} strokeWidth={2} /> : <X size={14} strokeWidth={2} />}
                </span>
                <span className={cn("min-w-0 flex-1 truncate text-sm tabular-nums", !o.ok && "text-muted line-through")}>
                  {dayLabel(o.date)}
                  {time ? ` · ${formatClock(time)}` : ""}
                </span>
                {!o.ok && (
                  <span className="shrink-0 whitespace-nowrap text-sm text-muted">
                    {t(`repeat.reason_${o.reason ?? "taken"}`)}
                  </span>
                )}
              </li>
            ))}
          </ul>

          <p className="text-sm text-muted">
            {blocked > 0
              ? t("repeat.summarySkipping", {
                  count: bookable,
                  skipped: blocked,
                  amount: formatMoney(unitPrice * bookable, currency),
                })
              : t("repeat.summary", { count: bookable, amount: formatMoney(unitPrice * bookable, currency) })}
          </p>
        </>
      )}
    </div>
  );
}
