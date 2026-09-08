"use client";

/* ── Counterfoil's own calendar ───────────────────────────────────────────
 *
 * Every date field in the app was `<input type="date">`, which hands the job
 * to the browser: a blue-and-white grid with system type, its own radii, its
 * own "Clear / Today" links, and a text format taken from the operating
 * system rather than from us — so a till showing "29 Jul 2026" everywhere
 * opened a picker reading 07/29/2026. On the Go surface, which is otherwise
 * 18px corners and 44px targets, it was simply a different product.
 *
 * This is the same grid drawn in the design system: our tokens, our radii,
 * our ember for the chosen day, our hairline ruling, and the 44px touch floor
 * where the surface asks for it.
 *
 * Dates are handled as local `yyyy-mm-dd` strings throughout. `toISOString`
 * is never used to derive one — at +06:00 it reports the previous day for
 * anything before 06:00, which is how a booking ends up filed to yesterday.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export interface DatePickerLabels {
  previousMonth: string;
  nextMonth: string;
  today: string;
}

/** Local ISO date — never `toISOString`, which shifts the day at +06:00. */
const isoOf = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const parseIso = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const addDays = (d: Date, n: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

const addMonths = (d: Date, n: number): Date => {
  // Anchored on the 1st so stepping from the 31st does not skip a month.
  const x = new Date(d.getFullYear(), d.getMonth() + n, 1);
  return x;
};

/** The 6×7 grid, Monday first — the week the rest of the app already uses. */
function monthMatrix(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const shift = (first.getDay() + 6) % 7; // Sunday=0 → 6
  const start = addDays(first, -shift);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/* en-GB rather than the UI locale, deliberately: `lib/format` renders every
   other date in the app this way, and a picker that alone spoke a different
   language would disagree with the field it fills in. */
const MONTH_FMT = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const WEEKDAYS = Array.from({ length: 7 }, (_, i) =>
  // 2026-06-01 is a Monday, so this walks Mon→Sun.
  new Intl.DateTimeFormat("en-GB", { weekday: "narrow" }).format(new Date(2026, 5, 1 + i)),
);
const FULL_DAY_FMT = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function DatePicker({
  value,
  onChange,
  today,
  min,
  max,
  isDisabled,
  labels,
  shape = "default",
  autoFocus = false,
  className,
}: {
  /** Selected day as `yyyy-mm-dd`, or null. */
  value: string | null;
  onChange: (iso: string) => void;
  /** What the app considers today — passed in so the demo clock and the real
   *  one both mark the right square. */
  today: string;
  min?: string;
  max?: string;
  /** Days the caller will not accept — a closed weekday, a sold-out date. */
  isDisabled?: (iso: string) => boolean;
  labels: DatePickerLabels;
  /** `go` takes the till's 18px corners and 44px squares. */
  shape?: "default" | "go";
  autoFocus?: boolean;
  className?: string;
}) {
  const selected = value ?? null;
  const [cursor, setCursor] = useState<Date>(
    () => parseIso(selected) ?? parseIso(today) ?? new Date(),
  );
  /* The square arrow keys are on. Separate from the selection: moving around a
     calendar is not the same act as choosing a day, and a picker that selected
     on every arrow press would fire onChange six times crossing a week. */
  const [focusIso, setFocusIso] = useState<string>(selected ?? today);
  const gridRef = useRef<HTMLDivElement>(null);
  const shouldFocus = useRef(autoFocus);

  const days = useMemo(() => monthMatrix(cursor), [cursor]);

  const blocked = (iso: string) =>
    (min != null && iso < min) || (max != null && iso > max) || (isDisabled?.(iso) ?? false);

  useEffect(() => {
    if (!shouldFocus.current) return;
    shouldFocus.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>('[data-focus="true"]')?.focus();
  }, []);

  const move = (next: Date) => {
    const iso = isoOf(next);
    setFocusIso(iso);
    // Turn the page here, in the event that caused it, rather than in an
    // effect watching for it afterwards — arrowing off the end of a month is
    // the only way the two can disagree.
    if (next.getMonth() !== cursor.getMonth() || next.getFullYear() !== cursor.getFullYear()) {
      setCursor(new Date(next.getFullYear(), next.getMonth(), 1));
    }
    // Focus follows on the next paint, once the square exists.
    requestAnimationFrame(() => {
      gridRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${iso}"]`)?.focus();
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const from = parseIso(focusIso);
    if (!from) return;
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (step[e.key] != null) {
      e.preventDefault();
      move(addDays(from, step[e.key]));
      return;
    }
    if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      move(addMonths(from, e.key === "PageUp" ? -1 : 1));
      return;
    }
    if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      const dow = (from.getDay() + 6) % 7;
      move(addDays(from, e.key === "Home" ? -dow : 6 - dow));
    }
  };

  const cell = shape === "go" ? "h-11 w-11 rounded-go-sm text-[15px]" : "h-9 w-9 rounded-sm text-[13px]";

  return (
    <div
      className={cn(
        "flex flex-col gap-tight",
        shape === "go" ? "rounded-go p-comfortable" : "rounded-md p-comfortable",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-tight">
        <button
          type="button"
          aria-label={labels.previousMonth}
          onClick={() => setCursor((c) => addMonths(c, -1))}
          className={cn(
            "flex items-center justify-center border border-line text-fg transition-colors duration-quick hover:bg-subtle",
            shape === "go" ? "h-11 w-11 rounded-go-sm" : "h-8 w-8 rounded-sm",
          )}
        >
          <ChevronLeft size={16} strokeWidth={1.5} />
        </button>
        <span aria-live="polite" className="text-sm font-medium tracking-tight">
          {MONTH_FMT.format(cursor)}
        </span>
        <button
          type="button"
          aria-label={labels.nextMonth}
          onClick={() => setCursor((c) => addMonths(c, 1))}
          className={cn(
            "flex items-center justify-center border border-line text-fg transition-colors duration-quick hover:bg-subtle",
            shape === "go" ? "h-11 w-11 rounded-go-sm" : "h-8 w-8 rounded-sm",
          )}
        >
          <ChevronRight size={16} strokeWidth={1.5} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5" aria-hidden>
        {WEEKDAYS.map((w, i) => (
          // The label row takes the cell's WIDTH so the columns line up, but
          // not its height — a 44px touch square is for something you tap.
          <span
            key={`${w}-${i}`}
            className={cn(
              "type-label flex h-6 items-center justify-center text-[12px] text-muted",
              shape === "go" ? "w-11" : "w-9",
            )}
          >
            {w}
          </span>
        ))}
      </div>

      {/* role=grid with one tab stop: arrows move within, Tab leaves. */}
      <div ref={gridRef} role="grid" onKeyDown={onKeyDown} className="grid grid-cols-7 gap-0.5">
        {days.map((d) => {
          const iso = isoOf(d);
          const outside = d.getMonth() !== cursor.getMonth();
          const isSelected = iso === selected;
          const isToday = iso === today;
          const off = blocked(iso);
          return (
            <button
              key={iso}
              type="button"
              role="gridcell"
              data-iso={iso}
              data-focus={iso === focusIso ? "true" : undefined}
              tabIndex={iso === focusIso ? 0 : -1}
              disabled={off}
              aria-selected={isSelected}
              aria-current={isToday ? "date" : undefined}
              aria-label={FULL_DAY_FMT.format(d)}
              onClick={() => {
                setFocusIso(iso);
                onChange(iso);
              }}
              className={cn(
                "flex items-center justify-center font-mono tabular-nums transition-colors duration-quick",
                cell,
                off && "cursor-not-allowed text-muted",
                !off && !isSelected && outside && "text-muted hover:bg-subtle",
                !off && !isSelected && !outside && "text-fg hover:bg-subtle",
                // The house rule: white inside a solid ember frame.
                isSelected && "bg-ember-solid font-semibold text-white",
                // Today, when it is not the chosen day, is outlined rather than
                // filled — two filled squares would read as two selections.
                !isSelected && isToday && "border border-ember text-brand-foreground",
              )}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => {
          setCursor(parseIso(today) ?? new Date());
          setFocusIso(today);
          if (!blocked(today)) onChange(today);
        }}
        className={cn(
          "self-start px-tight text-[13px] text-brand-foreground transition-colors duration-quick hover:underline",
          shape === "go" ? "h-11" : "h-8",
        )}
      >
        {labels.today}
      </button>
    </div>
  );
}
