"use client";

/* ── A date range, chosen in one place ─────────────────────────────────────
 *
 * The reports filter was six preset buttons, a seventh called Custom, and —
 * only after pressing Custom — two separate date fields with an arrow between
 * them. Eight controls for one question ("which dates?"), taking most of a
 * line before a single filter had been added.
 *
 * Every analytics product that people use daily has settled on the same
 * shape (Stripe, Shopify Analytics, GA4, Linear): ONE button that states the
 * range in words, opening a panel with the named ranges down the side and a
 * two-month calendar beside them. A named range is picked with one click and
 * applies at once; a custom one is drawn — first day, last day, with the span
 * shown under the pointer as it moves — and applied on purpose, so a
 * half-drawn range never reloads the report.
 *
 * Dates are local `yyyy-mm-dd` strings, as in `DatePicker`: never derived with
 * `toISOString`, which reports the previous day before 06:00 at +06:00.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export interface RangePreset {
  value: string;
  label: string;
  range: () => [string, string];
}

export interface DateRangeValue {
  /** A preset's value, or "custom". */
  preset: string;
  from: string;
  to: string;
}

export interface DateRangeLabels {
  choose: string;
  custom: string;
  from: string;
  to: string;
  apply: string;
  cancel: string;
  previousMonth: string;
  nextMonth: string;
  /** "{count} days" — given the length of the drawn range. */
  days: (count: number) => string;
  /** Said while only the first day is chosen. */
  pickEnd: string;
}

const isoOf = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const parseIso = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const monthMatrix = (month: Date): Date[] => {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = addDays(first, -((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
};
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86_400_000) + 1;

const MONTH_FMT = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const DAY_FMT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const DAY_YEAR_FMT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const FULL_FMT = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat("en-GB", { weekday: "narrow" }).format(new Date(2026, 5, 1 + i)));

/** "30 Jun – 29 Jul 2026", with the year said once when both ends share it. */
export function formatRange(from: string, to: string): string {
  const a = parseIso(from);
  const b = parseIso(to);
  if (!a || !b) return "—";
  if (from === to) return DAY_YEAR_FMT.format(a);
  return a.getFullYear() === b.getFullYear() ? `${DAY_FMT.format(a)} – ${DAY_YEAR_FMT.format(b)}` : `${DAY_YEAR_FMT.format(a)} – ${DAY_YEAR_FMT.format(b)}`;
}

export function DateRangePicker({
  value,
  onChange,
  presets,
  today,
  min,
  max,
  labels,
  className,
}: {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
  presets: RangePreset[];
  /** The app's today — the demo clock and the real one both mark it. */
  today: string;
  min?: string;
  /** Usually today: a sales report has nothing to say about tomorrow. */
  max?: string;
  labels: DateRangeLabels;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ from: string; to: string | null }>({ from: value.from, to: value.to });
  const [hover, setHover] = useState<string | null>(null);
  const [cursor, setCursor] = useState<Date>(() => addMonths(parseIso(value.to) ?? new Date(), -1));
  const [focusIso, setFocusIso] = useState(value.to);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const blocked = (iso: string) => (min != null && iso < min) || (max != null && iso > max);
  const presetLabel = presets.find((p) => p.value === value.preset)?.label;

  const openPanel = () => {
    setDraft({ from: value.from, to: value.to });
    setHover(null);
    // Two months ending with the one the range ends in — the range is in view.
    setCursor(addMonths(parseIso(value.to) ?? new Date(), -1));
    setFocusIso(value.to);
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };

  // Outside click and Escape close without applying — nothing half-drawn is kept.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) close(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(() => panel.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"], [data-focus="true"]')?.focus());
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pickPreset = (p: RangePreset) => {
    const [from, to] = p.range();
    onChange({ preset: p.value, from, to });
    close();
  };

  /* First click starts a range, the second ends it; a second click before the
     first flips them rather than refusing — people draw ranges both ways. */
  const pickDay = (iso: string) => {
    setFocusIso(iso);
    if (draft.to !== null || !draft.from) {
      setDraft({ from: iso, to: null });
      return;
    }
    setDraft(iso < draft.from ? { from: iso, to: draft.from } : { from: draft.from, to: iso });
    setHover(null);
  };

  const apply = () => {
    if (!draft.to) return;
    onChange({ preset: "custom", from: draft.from, to: draft.to });
    close();
  };

  // The span to paint: the drawn range, or first-day-to-pointer while drawing.
  const lo = draft.to === null && hover ? (hover < draft.from ? hover : draft.from) : draft.from;
  const hi = draft.to === null ? (hover ? (hover < draft.from ? draft.from : hover) : draft.from) : draft.to;

  const move = (next: Date) => {
    const iso = isoOf(next);
    setFocusIso(iso);
    const first = cursor;
    const last = addMonths(cursor, 1);
    if (next < first) setCursor(new Date(next.getFullYear(), next.getMonth(), 1));
    else if (next >= addMonths(last, 1)) setCursor(addMonths(new Date(next.getFullYear(), next.getMonth(), 1), -1));
    requestAnimationFrame(() => panel.current?.querySelector<HTMLButtonElement>(`[data-iso="${iso}"]`)?.focus());
  };
  const onGridKey = (e: React.KeyboardEvent) => {
    const from = parseIso(focusIso);
    if (!from) return;
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (step[e.key] != null) {
      e.preventDefault();
      move(addDays(from, step[e.key]));
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      const n = new Date(from);
      n.setMonth(n.getMonth() + (e.key === "PageUp" ? -1 : 1));
      move(n);
    }
  };

  const months = useMemo(() => [cursor, addMonths(cursor, 1)], [cursor]);

  // A render function, not a component: a component declared inside render is
  // a new type every render, which remounts the grid and drops keyboard focus.
  // On a phone only the second month shows — the one the range ends in.
  const renderMonth = (month: Date, second: boolean) => (
    <div key={isoOf(month)} className={cn("flex flex-col gap-tight", !second && "hidden lg:flex")}>
      <p className="text-center text-sm font-medium tracking-tight" aria-live="polite">{MONTH_FMT.format(month)}</p>
      {/* Fixed tracks: a shrinking panel must never squeeze seven 36px days into
          less than seven 36px columns — they overlap and swallow each other's clicks. */}
      <div className="grid grid-cols-[repeat(7,2.5rem)] md:grid-cols-[repeat(7,2.25rem)]" aria-hidden>
        {WEEKDAYS.map((w, i) => (
          <span key={`${w}-${i}`} className="type-label flex h-6 w-10 items-center justify-center text-[12px] text-muted md:w-9">{w}</span>
        ))}
      </div>
      <div role="grid" aria-label={MONTH_FMT.format(month)} onKeyDown={onGridKey} className="grid grid-cols-[repeat(7,2.5rem)] gap-y-0.5 md:grid-cols-[repeat(7,2.25rem)]">
        {monthMatrix(month).map((d) => {
          const iso = isoOf(d);
          const outside = d.getMonth() !== month.getMonth();
          // Days from a neighbouring month are drawn for shape, not picked here.
          if (outside) return <span key={iso} aria-hidden className="h-10 w-10 md:h-9 md:w-9" />;
          const off = blocked(iso);
          const inRange = iso >= lo && iso <= hi;
          const isEnd = iso === lo || iso === hi;
          const edgeL = iso === lo || d.getDay() === 1 || d.getDate() === 1;
          const edgeR = iso === hi || d.getDay() === 0 || addDays(d, 1).getMonth() !== d.getMonth();
          return (
            <button
              key={iso}
              type="button"
              role="gridcell"
              data-iso={iso}
              data-focus={iso === focusIso ? "true" : undefined}
              tabIndex={iso === focusIso ? 0 : -1}
              disabled={off}
              aria-selected={inRange}
              aria-current={iso === today ? "date" : undefined}
              aria-label={FULL_FMT.format(d)}
              onClick={() => pickDay(iso)}
              onMouseEnter={() => draft.to === null && setHover(iso)}
              className={cn(
                "relative flex h-10 w-10 items-center justify-center text-[13px] tabular-nums transition-colors duration-quick md:h-9 md:w-9",
                // The band: a continuous wash across the span, rounded only
                // where a week or the range starts and stops.
                inRange && !isEnd && "bg-ember/10 text-fg",
                inRange && edgeL && !isEnd && "rounded-l-sm",
                inRange && edgeR && !isEnd && "rounded-r-sm",
                // The ends: the house rule, white inside solid ember.
                isEnd && "rounded-sm bg-ember-solid font-semibold text-white",
                !inRange && !off && "rounded-sm text-fg hover:bg-subtle",
                off && "cursor-not-allowed text-muted opacity-50",
                !inRange && iso === today && "ring-1 ring-inset ring-ember",
              )}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );

  const drawnDays = draft.to ? daysBetween(draft.from, draft.to) : null;
  /* Which named range the panel is showing. Untouched, it is the one that was
     applied; once a range is being drawn it is whichever preset that range
     happens to be, and Custom when it is none of them — a list still saying
     "Last 30 days" over a hand-drawn 6–21 July is two answers at once. */
  const drawing = draft.from !== value.from || draft.to !== value.to;
  const pressed = !drawing
    ? value.preset
    : draft.to === null
      ? "custom"
      : (presets.find((p) => {
          const [f, t] = p.range();
          return f === draft.from && t === draft.to;
        })?.value ?? "custom");

  return (
    <div ref={wrap} className={cn("relative", className)}>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? close() : openPanel())}
        className={cn(
          "flex h-11 w-full min-w-0 items-center gap-tight rounded-sm border bg-card px-comfortable text-left text-sm transition-colors duration-quick hover:border-strong md:h-9 md:w-auto",
          open ? "border-inverse" : "border-line",
        )}
      >
        <CalendarDays size={15} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
        {presetLabel && <span className="shrink-0 font-medium">{presetLabel}</span>}
        <span className={cn("min-w-0 truncate tabular-nums", presetLabel ? "text-muted" : "font-medium")}>
          {formatRange(value.from, value.to)}
        </span>
        <ChevronDown size={14} strokeWidth={1.5} aria-hidden className={cn("ml-auto shrink-0 text-muted transition-transform duration-quick", open && "rotate-180")} />
      </button>

      {/* A phone's sheet dims the page behind it, and a tap there closes it. */}
      {open && <div aria-hidden onClick={() => close(false)} className="fixed inset-0 z-40 bg-ink/40 md:hidden" />}
      {open && (
        <div
          ref={panel}
          id={panelId}
          role="dialog"
          aria-label={labels.choose}
          className={cn(
            "z-50 flex flex-col overflow-hidden border border-line bg-card shadow-xl",
            // A sheet from the bottom on a phone; a popover under the button beyond.
            "fixed inset-x-0 bottom-0 max-h-[88vh] rounded-t-md md:absolute md:inset-x-auto md:bottom-auto md:left-0 md:top-[calc(100%+6px)] md:max-h-none md:w-max md:rounded-md",
          )}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-auto md:flex-row">
            {/* Named ranges — one click, applied at once. */}
            <ul className="flex shrink-0 flex-wrap gap-inline border-b border-hairline p-comfortable md:w-44 md:flex-col md:flex-nowrap md:gap-0.5 md:border-b-0 md:border-r md:p-tight">
              {presets.map((p) => {
                const on = pressed === p.value;
                return (
                  <li key={p.value}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => pickPreset(p)}
                      className={cn(
                        "flex h-11 w-full items-center gap-tight whitespace-nowrap rounded-sm px-comfortable text-left text-[13px] transition-colors duration-quick md:h-9",
                        on ? "bg-inverse font-medium text-inverse-fg" : "border border-line hover:bg-muted-wash md:border-0",
                      )}
                    >
                      <span className="flex-1">{p.label}</span>
                      {on && <Check size={14} strokeWidth={2} aria-hidden className="max-md:hidden" />}
                    </button>
                  </li>
                );
              })}
              <li className="max-md:hidden">
                <span
                  className={cn(
                    "flex h-9 items-center gap-tight rounded-sm px-comfortable text-[13px]",
                    pressed === "custom" ? "bg-inverse font-medium text-inverse-fg" : "text-muted",
                  )}
                >
                  <span className="flex-1">{labels.custom}</span>
                  {pressed === "custom" && <Check size={14} strokeWidth={2} aria-hidden />}
                </span>
              </li>
            </ul>

            <div className="flex flex-col gap-comfortable p-comfortable">
              {/* What is being drawn, end by end. */}
              <div className="flex items-center gap-tight text-[13px]">
                <span className="flex min-w-0 flex-1 flex-col whitespace-nowrap rounded-sm border border-line px-comfortable py-inline">
                  <span className="text-[12px] text-muted">{labels.from}</span>
                  <span className="font-medium tabular-nums">{parseIso(draft.from) ? DAY_YEAR_FMT.format(parseIso(draft.from)!) : "—"}</span>
                </span>
                <span aria-hidden className="text-muted">→</span>
                <span className={cn("flex min-w-0 flex-1 flex-col whitespace-nowrap rounded-sm border px-comfortable py-inline", draft.to === null ? "border-ember" : "border-line")}>
                  <span className="text-[12px] text-muted">{labels.to}</span>
                  <span className={cn("tabular-nums", draft.to ? "font-medium" : "text-muted")}>
                    {draft.to && parseIso(draft.to) ? DAY_YEAR_FMT.format(parseIso(draft.to)!) : labels.pickEnd}
                  </span>
                </span>
              </div>

              <div className="relative flex gap-section">
                <button
                  type="button"
                  aria-label={labels.previousMonth}
                  onClick={() => setCursor((c) => addMonths(c, -1))}
                  className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-sm border border-line hover:bg-subtle"
                >
                  <ChevronLeft size={16} strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  aria-label={labels.nextMonth}
                  onClick={() => setCursor((c) => addMonths(c, 1))}
                  className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-sm border border-line hover:bg-subtle"
                >
                  <ChevronRight size={16} strokeWidth={1.5} />
                </button>
                <div className="mx-auto flex gap-section" onMouseLeave={() => setHover(null)}>
                  {months.map((m, i) => renderMonth(m, i === 1))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-tight border-t border-hairline px-comfortable py-tight pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:pb-tight">
            <span className="min-w-0 flex-1 truncate text-[13px] text-muted">
              {drawnDays ? labels.days(drawnDays) : labels.pickEnd}
            </span>
            <button type="button" onClick={() => close()} className="h-11 rounded-sm px-comfortable text-[13px] font-medium text-muted hover:bg-muted-wash hover:text-fg md:h-9">
              {labels.cancel}
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={!draft.to}
              className="h-11 rounded-sm bg-ember-solid px-comfortable text-[13px] font-medium text-white transition-opacity duration-quick disabled:opacity-40 md:h-9"
            >
              {labels.apply}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
