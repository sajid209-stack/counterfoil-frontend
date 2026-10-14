"use client";

import { useRef } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { FILTERS, type CheckInFilter } from "../_lib/parties";

/**
 * All · Due · Not in yet · In — one row of flat cells, each saying how many.
 *
 * A segmented choice that fits a 320px phone: a word on top and the number
 * under it, so a steward who does not read the word reads the count. The chosen
 * cell is the till's one look for "chosen" — solid orange, white, a tick. It is
 * the radio-group pattern (one tab stop, the arrow keys move and choose), and
 * the same four cells in the same order on every device.
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
    <div ref={group} role="radiogroup" aria-label={label} className="card-surface grid grid-cols-4 overflow-hidden">
      {FILTERS.map((f, i) => {
        const on = f === value;
        return (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            data-filter={f}
            data-focus-inset
            onClick={() => onChange(f)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(i, 1); }
              else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(i, -1); }
            }}
            className={cn(
              "relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-center transition-colors duration-quick",
              i > 0 && "border-l border-line",
              on ? "bg-ember-solid text-on-solid" : "bg-card text-fg hover:bg-muted-wash active:bg-muted-wash",
            )}
          >
            <span className="text-xl font-semibold tabular-nums leading-none">{counts[f]}</span>
            <span className={cn("max-w-full text-sm font-medium leading-tight", on ? "text-on-solid" : "text-muted")}>{labels[f]}</span>
            {on && <Check size={14} strokeWidth={3} className="absolute right-1.5 top-1.5" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}
