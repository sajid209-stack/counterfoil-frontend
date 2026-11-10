"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";
import { FILTERS, type CheckInFilter } from "../_lib/parties";

/**
 * All · Due · Not in yet · In — a quiet segmented track, each option saying how
 * many.
 *
 * One pill-shaped track on a subtle fill with the chosen option raised on a card
 * with a hairline ring (the ring matters in dark mode, where the card and the
 * track are the same colour). The word comes first, then its count in muted text.
 * On a phone the track is full width, the options share it equally and stay 44px
 * tall; on a desktop it hugs its content at 32px. The track scrolls sideways
 * rather than wrapping when a language runs long. It is the radio-group pattern
 * (one tab stop, the arrow keys move and choose).
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
    <div
      ref={group}
      role="radiogroup"
      aria-label={label}
      className="flex max-w-full gap-0.5 overflow-x-auto rounded-full bg-subtle p-0.5 [scrollbar-width:none] rail:inline-flex rail:shrink-0"
    >
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
            onClick={() => onChange(f)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(i, 1); }
              else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(i, -1); }
            }}
            className={cn(
              "inline-flex h-11 shrink-0 items-center justify-center gap-inline whitespace-nowrap rounded-full px-comfortable text-sm font-medium transition-colors duration-quick rail:h-8 flex-1 rail:flex-none",
              on ? "bg-card text-fg shadow-card ring-1 ring-inset ring-line" : "text-fg-secondary hover:text-fg",
            )}
          >
            <span>{labels[f]}</span>
            <span className={cn("tabular-nums", on ? "text-fg-secondary" : "text-muted")}>{counts[f]}</span>
          </button>
        );
      })}
    </div>
  );
}
