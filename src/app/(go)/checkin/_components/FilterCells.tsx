"use client";

import { useRef } from "react";
import { Tile, TileGrid } from "../../_components/Tiles";
import { FILTERS, type CheckInFilter } from "../_lib/parties";

/**
 * All · Due · Not in yet · In — four separate tiles, each saying how many.
 *
 * A segmented choice that fits a 320px phone: a word on top and the number
 * under it, so a steward who does not read the word reads the count. The chosen
 * cell is the till's one look for "chosen" (Tiles.tsx TILE_CHOSEN: solid orange
 * and a tick on a phone, a tint and a ring on a desktop). It is the radio-group
 * pattern (one tab stop, the arrow keys move and choose), and the same four
 * cells in the same order on every device.
 *
 * On a desktop it is a row of compact 36px chips (word, then its count), left
 * aligned in the list's toolbar rather than four wide tiles.
 */
export function FilterCells({
  value,
  onChange,
  counts,
  labels,
  label,
}: {
  value: CheckInFilter;
  onChange: (f: CheckInFilter) => void;
  counts: Record<CheckInFilter, number>;
  labels: Record<CheckInFilter, string>;
  label: string;
}) {
  const group = useRef<HTMLDivElement>(null);
  const move = (from: number, dir: 1 | -1) => {
    const to = (from + dir + FILTERS.length) % FILTERS.length;
    onChange(FILTERS[to]);
    group.current?.querySelectorAll<HTMLElement>('[role="radio"]')[to]?.focus();
  };
  return (
    <div ref={group} className="rail:min-w-0">
      <TileGrid cols={4} role="radiogroup" aria-label={label} className="rail:flex rail:flex-wrap rail:gap-inline">
        {FILTERS.map((f, i) => {
          const on = f === value;
          return (
            <Tile
              key={f}
              role="radio"
              aria-checked={on}
              selected={on}
              tabIndex={on ? 0 : -1}
              data-filter={f}
              onClick={() => onChange(f)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(i, 1); }
                else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(i, -1); }
              }}
              className="min-h-16 gap-0.5 px-1 rail:min-h-9 rail:flex-row-reverse rail:gap-tight rail:px-comfortable"
            >
              <span className="text-xl font-semibold tabular-nums leading-none rail:text-sm rail:font-medium">{counts[f]}</span>
              <span className={`max-w-full text-sm font-medium leading-tight rail:text-base ${on ? "text-on-solid" : "text-muted"}`}>{labels[f]}</span>
            </Tile>
          );
        })}
      </TileGrid>
    </div>
  );
}
