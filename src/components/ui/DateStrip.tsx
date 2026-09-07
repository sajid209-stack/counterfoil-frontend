"use client";

/* ── Choosing a day ────────────────────────────────────────────────────────
 *
 * A wrapping grid, never a row that scrolls sideways.
 *
 * The scrolling row it replaces had two faults. A chip that has scrolled out
 * of view is a day nobody knows is on offer — the affordance is a cut edge,
 * which reads as a clipped container at least as often as it reads as "there
 * is more this way". And it put the calendar button at the END of that
 * scroll, so reaching any date beyond the fifth meant scrolling past the four
 * you did not want in order to find the control that offers all of them.
 *
 * So: the days sit in a grid that wraps, and the calendar is a full-width row
 * beneath them where it can always be seen. Nothing here scrolls in either
 * direction.
 *
 * `Today` and `Tomorrow` are named rather than dated, because that is what a
 * cashier and a customer both say out loud. Everything after them is a
 * weekday and a number, which is the shortest form that cannot be mistaken
 * for a different week.
 */

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/cn";

export interface DateStripLabels {
  today: string;
  tomorrow: string;
  /** The control that opens a full calendar. */
  pick: string;
}

export function DateStrip({
  dates,
  value,
  onChange,
  today,
  tomorrow,
  labels,
  /** Days that already have something chosen on them, so a multi-day
   *  selection is visible from the day picker rather than only from the list
   *  underneath it. */
  marked = [],
  /** A caption under a day — remaining places, say. */
  caption,
  min,
  className,
}: {
  dates: string[];
  value: string;
  onChange: (date: string) => void;
  today: string;
  tomorrow: string;
  labels: DateStripLabels;
  marked?: string[];
  caption?: (date: string) => { text: string; low?: boolean } | null;
  min?: string;
  className?: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const label = (d: string) => {
    if (d === today) return labels.today;
    if (d === tomorrow) return labels.tomorrow;
    return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short" });
  };
  const sub = (d: string) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <div className={cn("flex flex-col gap-tight", className)}>
      {/* Three across on the narrowest phone, five once there is room — so
          five days are at most two rows and never a sideways scroll. */}
      <div className="grid grid-cols-3 gap-tight sm:grid-cols-5">
        {dates.map((d) => {
          const on = value === d;
          const cap = caption?.(d) ?? null;
          const isMarked = marked.includes(d);
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(d)}
              className={cn(
                "relative flex min-h-[56px] flex-col items-center justify-center rounded-go border px-inline py-tight text-center transition-colors duration-quick",
                on
                  ? "border-ember bg-ember/10 ring-1 ring-inset ring-ember"
                  : "border-line bg-card active:bg-ember/10",
              )}
            >
              {/* A day carrying part of the sale says so, so the selection is
                  legible from here and not only from the list below. */}
              {isMarked && (
                <span
                  className={cn(
                    "absolute right-1.5 top-1.5 size-1.5 rounded-full",
                    on ? "bg-brand-foreground" : "bg-ember",
                  )}
                  aria-hidden
                />
              )}
              <span
                className={cn(
                  "w-full truncate text-[13px] font-medium leading-tight",
                  on && "text-brand-foreground",
                )}
              >
                {label(d)}
              </span>
              <span
                className={cn(
                  "w-full truncate text-[12px] leading-tight",
                  on ? "text-brand-foreground/70" : "text-muted",
                )}
              >
                {sub(d)}
              </span>
              {cap && (
                <span
                  className={cn(
                    "w-full truncate text-[12px] leading-tight",
                    cap.low ? "font-medium text-brand-foreground" : on ? "text-brand-foreground/70" : "text-muted",
                  )}
                >
                  {cap.text}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* The calendar, always visible rather than parked at the end of a
          scroll. It opens in place; it does not cover anything. */}
      {pickerOpen ? (
        <input
          type="date"
          autoFocus
          value={value}
          min={min}
          aria-label={labels.pick}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          onBlur={() => setPickerOpen(false)}
          className="h-12 w-full rounded-go border border-ember bg-card px-comfortable text-sm outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex min-h-12 w-full items-center justify-center gap-tight rounded-go border border-dashed border-strong text-[13px] text-muted active:bg-ember/10"
        >
          <CalendarDays size={15} strokeWidth={1.5} />
          {labels.pick}
        </button>
      )}
    </div>
  );
}
