"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { formatClock, formatPriceShort } from "@/lib/format";
import { ClockCell } from "./Clock";
import { Tile, TileGrid, TileLabel } from "./Tiles";
import { TileText } from "./SheetParts";

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

  /* The till's card language: every resource and every hour is its own
     rounded tile with an 8px gap. A free hour is white with its price, the
     chosen one is solid orange with a tick, and an hour that is gone is the
     page's colour with a line and a struck time. */
  return (
    <div className="mb-section flex flex-col gap-tight">
      {rows.length > 1 && (
        <>
          <TileLabel>{resourceNoun}</TileLabel>
          <TileGrid cols={rows.length <= 2 ? 2 : rows.length === 3 ? 3 : 4}>
            {rows.map((row) => {
              const on = row.id === active.id;
              const free = row.cells.filter((c) => c.available).length;
              return (
                <Tile
                  key={row.id}
                  selected={on}
                  off={!!row.outOfService}
                  className="min-h-14"
                  onClick={() => {
                    if (row.outOfService) return onBlocked(t("sheet.outOfService"));
                    setViewId(row.id);
                    if (selectedTime && row.cells.some((c) => c.time === selectedTime && c.available)) {
                      onSelect(row.id, selectedTime);
                    }
                  }}
                >
                  <TileText
                    label={row.name}
                    sub={row.outOfService ? undefined : free > 0 ? t("sheet.slotsFree", { count: free }) : t("sheet.fullyBooked")}
                    selected={on}
                    struck={!!row.outOfService}
                  />
                </Tile>
              );
            })}
          </TileGrid>
        </>
      )}

      <TileLabel className="mt-tight">{t("sheet.time")}{rows.length === 1 ? ` · ${active.name}` : ""}</TileLabel>
      <TileGrid cols={4}>
        {active.cells.map((cell) => {
          const selected = active.id === selectedResourceId && selectedTime === cell.time;
          if (!cell.available) {
            return (
              <Tile
                key={cell.time}
                off
                aria-pressed={undefined}
                className="min-h-14"
                onClick={() =>
                  onBlocked(
                    active.outOfService
                      ? t("sheet.outOfService")
                      : t("sheet.slotTaken", { time: formatClock(cell.time), name: active.name }),
                  )
                }
              >
                <ClockCell hhmm={cell.time} className="text-base font-semibold line-through" />
              </Tile>
            );
          }
          return (
            <Tile key={cell.time} selected={selected} className="min-h-14 gap-0.5" onClick={() => onSelect(active.id, cell.time)}>
              <ClockCell hhmm={cell.time} className="text-md font-semibold tabular-nums" />
              <span className={cn("whitespace-nowrap text-sm tabular-nums", selected ? "text-on-solid" : cell.price === base ? "text-muted" : "font-semibold text-fg")}>
                {formatPriceShort(cell.price, currency)}
              </span>
            </Tile>
          );
        })}
      </TileGrid>

      {/* What the figure on each tile is the price OF. */}
      <p className="text-sm text-muted">{t("sheet.ratePer", { noun: resourceNoun.toLowerCase() })}</p>
    </div>
  );
}
