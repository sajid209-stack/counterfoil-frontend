"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";

export interface MatrixCell {
  time: string;
  available: boolean;
  price: number;
}

export interface MatrixRow {
  id: string;
  name: string;
  outOfService?: boolean;
  cells: MatrixCell[];
}

/**
 * Fixed slots across several resources — fields, courts, lanes — as two
 * questions rather than one table.
 *
 * The grid this replaces put every resource against every time. That is the
 * right shape for a wall planner and the wrong one for a phone: two fields
 * across a fourteen-hour day is a table that has to scroll sideways to reach
 * the afternoon, and the row labels scroll away with it. A counter is not
 * comparing the whole day, it is answering "which pitch, then what time".
 *
 * So the resource is chosen first and the times below belong to it. Nothing is
 * hidden by that — an unavailable time still says so and still explains itself
 * when tapped, and switching resource re-answers the same question rather than
 * opening a different screen.
 *
 * Every available time carries its own price. An earlier version printed it
 * only where it differed from the base rate, on the reasoning that a repeated
 * figure is noise — but a cashier reading a slot to a customer should never
 * have to work out which line underneath applies to the tile they are looking
 * at. The rate underneath now states the basis (per what, per when); the tiles
 * state what this one costs.
 */
export function SlotMatrix({
  rows,
  selectedResourceId,
  selectedTime,
  currency,
  onSelect,
  onBlocked,
  resourceNoun,
}: {
  rows: MatrixRow[];
  selectedResourceId?: string;
  selectedTime?: string;
  currency: string;
  onSelect: (resourceId: string, time: string) => void;
  onBlocked: (reason: string) => void;
  resourceNoun: string;
}) {
  const t = useTranslations("pos");

  /** Which resource's times are on show. It is not the same thing as the
   *  chosen slot: a cashier browses a pitch before committing to an hour on
   *  it, and the sale is only made when both are answered. Defaults to the
   *  first one that has anything free, so the grid opens on something usable. */
  const firstUsable = rows.find((r) => !r.outOfService && r.cells.some((c) => c.available)) ?? rows[0];
  const [viewId, setViewId] = useState<string | undefined>(selectedResourceId ?? firstUsable?.id);
  const activeId = selectedResourceId ?? viewId;
  const active = rows.find((r) => r.id === activeId) ?? firstUsable;

  if (rows.length === 0 || !active) return null;

  // The rate most slots charge, for the basis line underneath.
  const counts = new Map<number, number>();
  for (const r of rows) for (const c of r.cells) counts.set(c.price, (counts.get(c.price) ?? 0) + 1);
  const base = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;

  return (
    <div className="mb-section flex flex-col gap-tight">
      <span className="type-label text-[12px] text-muted">{resourceNoun}</span>
      <div className="-mx-comfortable flex items-stretch gap-tight overflow-x-auto px-comfortable pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {rows.map((row) => {
          const on = row.id === active.id;
          const free = row.cells.filter((c) => c.available).length;
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => {
                if (row.outOfService) return onBlocked(t("sheet.outOfService"));
                setViewId(row.id);
                // Keep a chosen time only where the new resource also has it.
                if (selectedTime && row.cells.some((c) => c.time === selectedTime && c.available)) {
                  onSelect(row.id, selectedTime);
                }
              }}
              className={cn(
                "flex min-h-12 shrink-0 flex-col items-center justify-center rounded-sm border px-comfortable py-tight text-[13px] transition-colors duration-quick",
                row.outOfService
                  ? "border-line bg-subtle text-faint line-through"
                  : on
                    ? "border-ember bg-ember/10 font-medium text-ember"
                    : "border-line bg-card active:bg-ember/10",
              )}
            >
              <span className="whitespace-nowrap">{row.name}</span>
              {!row.outOfService && (
                <span className={cn("whitespace-nowrap text-[12px]", on ? "opacity-80" : "text-muted")}>
                  {free > 0 ? t("sheet.slotsFree", { count: free }) : t("sheet.fullyBooked")}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <span className="type-label mt-tight text-[12px] text-muted">{t("sheet.time")}</span>
      <div className="grid grid-cols-4 gap-tight">
        {active.cells.map((cell) => {
          const selected = active.id === selectedResourceId && selectedTime === cell.time;
          if (!cell.available) {
            return (
              <button
                key={cell.time}
                type="button"
                onClick={() =>
                  onBlocked(
                    active.outOfService
                      ? t("sheet.outOfService")
                      : t("sheet.slotTaken", { time: cell.time, name: active.name }),
                  )
                }
                className="flex min-h-12 items-center justify-center rounded-sm border border-line bg-subtle px-1 py-tight text-[13px] text-faint line-through"
              >
                {cell.time}
              </button>
            );
          }
          return (
            <button
              key={cell.time}
              type="button"
              onClick={() => onSelect(active.id, cell.time)}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center rounded-sm border px-1 py-tight text-[13px] transition-colors duration-quick",
                // The time is the last thing decided and the thing the CTA
                // then names, so it is the one selection in this pattern drawn
                // as a fill rather than a tint.
                selected
                  ? "border-ember bg-ember font-medium text-white"
                  : "border-line bg-card active:bg-ember/10",
              )}
            >
              <span>{cell.time}</span>
              <span
                className={cn(
                  "whitespace-nowrap text-[12px]",
                  selected ? "opacity-90" : cell.price === base ? "text-muted" : "text-brand-foreground",
                )}
              >
                {formatMoney(cell.price, currency)}
              </span>
            </button>
          );
        })}
      </div>

      {/* What the figure on each tile is the price OF. */}
      <p className="text-[12px] text-muted">
        {t("sheet.ratePer", { amount: formatMoney(base, currency), noun: resourceNoun.toLowerCase() })}
      </p>
    </div>
  );
}
