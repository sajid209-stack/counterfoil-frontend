"use client";

import { Check } from "lucide-react";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { formatClock, formatPriceShort } from "@/lib/format";
import { ClockCell } from "./Clock";

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

  /* Drawn the way the Schedule draws its day: cells on ONE card, divided by
     hairlines. A free hour is white with its price, the chosen one is solid
     orange with a tick, and an hour that is gone sits on the page colour —
     the same three grounds, so a cashier who knows one screen reads the
     other. */
  return (
    <div className="mb-section flex flex-col gap-tight">
      {rows.length > 1 && (
        <>
          <span className="text-[0.875rem] font-semibold text-fg">{resourceNoun}</span>
          <div className="go-surface overflow-hidden rounded-go">
            <div className="-mb-px -mr-px grid" style={{ gridTemplateColumns: `repeat(${Math.min(rows.length, 4)}, minmax(0, 1fr))` }}>
              {rows.map((row) => {
                const on = row.id === active.id;
                const free = row.cells.filter((c) => c.available).length;
                return (
                  <button
                    key={row.id}
                    type="button"
                    aria-pressed={on}
                    data-focus-inset
                    onClick={() => {
                      if (row.outOfService) return onBlocked(t("sheet.outOfService"));
                      setViewId(row.id);
                      if (selectedTime && row.cells.some((c) => c.time === selectedTime && c.available)) {
                        onSelect(row.id, selectedTime);
                      }
                    }}
                    className={cn(
                      "relative flex min-h-14 flex-col items-center justify-center border-b border-r border-line px-inline py-tight text-center transition-colors duration-quick",
                      row.outOfService
                        ? "bg-surface text-muted line-through"
                        : on
                          ? "bg-ember-solid text-white"
                          : "bg-card text-fg active:bg-ember/10",
                    )}
                  >
                    {on && <Check size={13} strokeWidth={3} className="absolute right-1.5 top-1.5" aria-hidden />}
                    <span className="w-full truncate text-[0.875rem] font-semibold">{row.name}</span>
                    {!row.outOfService && (
                      <span className={cn("w-full truncate text-[0.8125rem]", on ? "text-white" : "text-muted")}>
                        {free > 0 ? t("sheet.slotsFree", { count: free }) : t("sheet.fullyBooked")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      <span className="mt-tight text-[0.875rem] font-semibold text-fg">{t("sheet.time")}{rows.length === 1 ? ` · ${active.name}` : ""}</span>
      <div className="go-surface overflow-hidden rounded-go">
        <div className="-mb-px -mr-px grid grid-cols-4">
          {active.cells.map((cell) => {
            const selected = active.id === selectedResourceId && selectedTime === cell.time;
            if (!cell.available) {
              return (
                <button
                  key={cell.time}
                  type="button"
                  data-focus-inset
                  onClick={() =>
                    onBlocked(
                      active.outOfService
                        ? t("sheet.outOfService")
                        : t("sheet.slotTaken", { time: formatClock(cell.time), name: active.name }),
                    )
                  }
                  className="flex min-h-14 items-center justify-center border-b border-r border-line bg-surface px-1 py-1 text-[0.875rem] text-muted line-through"
                >
                  <ClockCell hhmm={cell.time} className="line-through" />
                </button>
              );
            }
            return (
              <button
                key={cell.time}
                type="button"
                aria-pressed={selected}
                data-focus-inset
                onClick={() => onSelect(active.id, cell.time)}
                className={cn(
                  "relative flex min-h-14 flex-col items-center justify-center gap-0.5 border-b border-r border-line px-1 py-1 transition-colors duration-quick",
                  selected ? "bg-ember-solid text-white" : "bg-card text-fg active:bg-ember/10",
                )}
              >
                {selected && <Check size={12} strokeWidth={3} className="absolute right-1 top-1" aria-hidden />}
                <ClockCell hhmm={cell.time} className="text-[0.9375rem] font-semibold tabular-nums" />
                <span
                  className={cn(
                    "whitespace-nowrap text-[0.8125rem] tabular-nums",
                    selected ? "font-medium" : cell.price === base ? "text-muted" : "font-semibold text-fg",
                  )}
                >
                  {formatPriceShort(cell.price, currency)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* What the figure on each cell is the price OF. */}
      <p className="text-[0.8125rem] text-muted">
        {t("sheet.ratePer", { noun: resourceNoun.toLowerCase() })}
      </p>
    </div>
  );
}
