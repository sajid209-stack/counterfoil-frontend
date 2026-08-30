"use client";

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
 * Fixed slots across several resources — fields, courts, lanes.
 *
 * The version this replaces printed the price into every single cell, so a
 * two-field day was "৳1,500.00" written twenty-eight times inside a table that
 * had to scroll sideways to show the afternoon. Nobody can find a free 19:00
 * in that.
 *
 * Here a cell carries the TIME and its state, which is what is being chosen.
 * The price is stated once underneath, and appears in a cell only where it
 * actually differs from the base rate — which is the only time it is news.
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
  if (rows.length === 0) return null;

  const times = rows[0].cells.map((c) => c.time);
  // The base rate is the one most slots charge; anything else is an uplift
  // worth calling out.
  const counts = new Map<number, number>();
  for (const r of rows) for (const c of r.cells) counts.set(c.price, (counts.get(c.price) ?? 0) + 1);
  const base = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
  const uplifts = [...counts.keys()].filter((p) => p !== base).sort((a, b) => a - b);

  return (
    <div className="mb-section flex flex-col gap-tight">
      <div className="overflow-x-auto">
        <div className="min-w-max">
          {/* One shared time header, not a price in every cell. */}
          <div className="mb-inline flex gap-inline">
            <span className="w-24 shrink-0" />
            {times.map((time) => (
              <span
                key={time}
                className="w-14 shrink-0 text-center font-mono text-[10px] text-faint"
              >
                {time}
              </span>
            ))}
          </div>

          {rows.map((row) => (
            <div key={row.id} className="mb-inline flex items-center gap-inline">
              <span
                className={cn(
                  "w-24 shrink-0 truncate text-[13px] font-medium",
                  row.outOfService && "text-danger",
                )}
                title={row.name}
              >
                {row.name}
              </span>
              {row.cells.map((cell) => {
                const selected = selectedResourceId === row.id && selectedTime === cell.time;
                const uplifted = cell.available && cell.price !== base;
                if (!cell.available) {
                  return (
                    <button
                      key={cell.time}
                      type="button"
                      onClick={() =>
                        onBlocked(
                          row.outOfService
                            ? t("sheet.outOfService")
                            : t("sheet.slotTaken", { time: cell.time, name: row.name }),
                        )
                      }
                      className="flex h-12 w-14 shrink-0 items-center justify-center rounded-xs border border-line bg-[repeating-linear-gradient(45deg,var(--color-subtle),var(--color-subtle)_3px,transparent_3px,transparent_7px)] font-mono text-[10px] text-muted"
                    >
                      {row.outOfService ? "—" : t("sheet.booked")}
                    </button>
                  );
                }
                return (
                  <button
                    key={cell.time}
                    type="button"
                    onClick={() => onSelect(row.id, cell.time)}
                    className={cn(
                      "flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-xs border font-mono transition-colors duration-quick",
                      selected
                        ? "border-inverse bg-inverse text-inverse-fg"
                        : "border-line bg-card hover:bg-subtle active:bg-ember/10",
                    )}
                  >
                    <span className="text-[11px] tabular-nums">{cell.time}</span>
                    {/* Only where it is not the usual rate. */}
                    {uplifted && (
                      <span
                        className={cn(
                          "text-[9px] tabular-nums",
                          selected ? "opacity-80" : "text-brand-foreground",
                        )}
                      >
                        {formatMoney(cell.price, currency)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* The price, said once. */}
      <p className="text-[12px] text-muted">
        {t("sheet.ratePer", { amount: formatMoney(base, currency), noun: resourceNoun.toLowerCase() })}
        {uplifts.length > 0 && (
          <span className="text-brand-foreground">
            {" · "}
            {t("sheet.rateUplift", {
              amounts: uplifts.map((p) => formatMoney(p, currency)).join(" / "),
            })}
          </span>
        )}
      </p>
    </div>
  );
}
