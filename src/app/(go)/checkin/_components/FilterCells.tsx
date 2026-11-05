"use client";

import { useRef } from "react";
import { Tile, TileGrid } from "../../_components/Tiles";
import { FILTERS, type CheckInFilter } from "../_lib/parties";

/**
 * All · Due · Not in yet · In — four separate tiles, each saying how many.
 *
 * One row of compact chips on every device, the word then its count ("Not in
 * yet 8"): 40px on a phone (the row scrolls sideways rather than wrapping when a
 * language runs long), 36px on a desktop. The four tall tiles this replaced
 * spent 64px of a phone on a filter and put the chosen tick over the words.
 * Chosen is the till's one look (Tiles.tsx TILE_CHOSEN) without the tick, which
 * a chip this size has no corner for. It is the radio-group pattern (one tab
 * stop, the arrow keys move and choose).
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
      <TileGrid cols={4} role="radiogroup" aria-label={label} className="flex gap-tight overflow-x-auto [scrollbar-width:none] rail:flex-wrap rail:gap-inline rail:overflow-visible">
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
              className="min-h-10 shrink-0 flex-row-reverse gap-tight px-comfortable [&>svg]:hidden rail:min-h-9"
            >
              <span className="text-base font-semibold tabular-nums leading-none rail:text-sm rail:font-medium">{counts[f]}</span>
              <span className={`whitespace-nowrap text-base font-medium leading-tight ${on ? "text-on-solid" : "text-fg-secondary"}`}>{labels[f]}</span>
            </Tile>
          );
        })}
      </TileGrid>
    </div>
  );
}
