"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, GitCompareArrows } from "lucide-react";
import { DateRangePicker, formatRange, type DateRangeLabels } from "@/components/ui";
import { comparisonRange, type CompareMode } from "@/lib/api";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/cn";

/* ── "Compare to", beside the date range ───────────────────────────────────
 *
 * Shopify Analytics, GA4, Stripe and Amplitude all put a second control next
 * to the period: the same three answers (the period before, the same dates a
 * year ago, a range you draw) and "none". The button names the actual dates,
 * not the rule, so the person reads what the figures are being set against
 * without opening anything.
 *
 * An option whose dates start before the venue's first order is shown but not
 * pickable, with the reason beside it: a comparison against an empty window
 * produces a "+15663%" that is worse than none. The custom calendar greys the
 * same days out.
 */

export interface CompareValue {
  mode: CompareMode;
  /** Only for "custom". */
  from?: string;
  to?: string;
}

const MODES: CompareMode[] = ["previous", "year", "custom", "none"];

export function ComparePicker({
  value,
  from,
  to,
  ledgerStart,
  today,
  onChange,
  calendarLabels,
  className,
}: {
  value: CompareValue;
  /** The period being looked at. */
  from: string;
  to: string;
  /** First day with an order: null with no orders, undefined while loading. */
  ledgerStart: string | null | undefined;
  today: string;
  onChange: (next: CompareValue) => void;
  calendarLabels: DateRangeLabels;
  className?: string;
}) {
  const t = useTranslations("analytics");
  const [open, setOpen] = useState(false);
  const [calendar, setCalendar] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const rangeOf = (mode: CompareMode) => comparisonRange(mode, from, to, value.from, value.to);
  const shown = rangeOf(value.mode);
  const startsBefore = (r: { from: string } | null) => ledgerStart === null || (ledgerStart !== undefined && r !== null && r.from < ledgerStart);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };

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
    requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    const items = [...(panel.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => {
      e.preventDefault();
      items[(n + items.length) % items.length]?.focus();
    };
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(items.length - 1);
    else if (e.key === "Tab") close(false);
  };

  const pick = (mode: CompareMode, disabled: boolean) => {
    if (disabled) return;
    if (mode === "custom") {
      setOpen(false);
      setCalendar(true);
      return;
    }
    onChange({ mode });
    close();
  };

  const label: Record<CompareMode, string> = {
    previous: t("compare.previous"),
    year: t("compare.year"),
    custom: t("compare.custom"),
    none: t("compare.none"),
  };
  const dayText = (iso: string) => formatDay(iso);
  // A custom range's calendar opens on what is being compared now, or on the period before.
  const seed = (value.mode === "custom" && value.from && value.to ? { from: value.from, to: value.to } : null) ?? rangeOf("previous");

  return (
    <div ref={wrap} className={cn("relative", className)}>
      <button
        ref={trigger}
        type="button"
        data-compare-trigger
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={t("compare.aria", { value: shown ? formatRange(shown.from, shown.to) : label.none })}
        onClick={() => (open ? close() : setOpen(true))}
        className={cn(
          "flex h-11 w-full min-w-0 items-center gap-tight rounded-sm border bg-card px-comfortable text-left text-sm transition-colors duration-quick hover:border-strong md:h-9 md:w-auto",
          open ? "border-inverse" : "border-line",
        )}
      >
        <GitCompareArrows size={15} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
        {shown ? (
          <>
            <span className="shrink-0 font-medium">{t("compare.label")}</span>
            <span className="min-w-0 truncate tabular-nums text-muted">{formatRange(shown.from, shown.to)}</span>
          </>
        ) : (
          <span className="min-w-0 truncate font-medium">{label.none}</span>
        )}
        <ChevronDown size={14} strokeWidth={1.5} aria-hidden className={cn("ml-auto shrink-0 text-muted transition-transform duration-quick", open && "rotate-180")} />
      </button>

      {open && <div aria-hidden onClick={() => close(false)} className="fixed inset-0 z-40 bg-ink/40 md:hidden" />}
      {open && (
        <div
          ref={panel}
          id={panelId}
          role="menu"
          aria-label={t("compare.menu")}
          onKeyDown={onMenuKey}
          className="fixed inset-x-0 bottom-0 z-50 flex flex-col gap-0.5 rounded-t-md border border-line bg-card p-tight pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-xl md:absolute md:inset-x-auto md:bottom-auto md:left-0 md:top-[calc(100%+6px)] md:w-72 md:rounded-md md:pb-tight"
        >
          {MODES.map((mode) => {
            const r = rangeOf(mode);
            const off = mode === "custom" ? ledgerStart === null : mode !== "none" && startsBefore(r);
            const on = value.mode === mode;
            const sub =
              mode === "none"
                ? null
                : off
                  ? ledgerStart
                    ? t("compare.starts", { date: dayText(ledgerStart) })
                    : t("compare.noRecords")
                  : mode === "custom"
                    ? on && r
                      ? formatRange(r.from, r.to)
                      : t("compare.pickDates")
                    : r
                      ? formatRange(r.from, r.to)
                      : null;
            return (
              <button
                key={mode}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                aria-disabled={off || undefined}
                onClick={() => pick(mode, off)}
                className={cn(
                  "flex min-h-11 w-full items-center gap-tight rounded-sm px-comfortable py-inline text-left text-[0.8125rem] transition-colors duration-quick md:min-h-10",
                  off ? "cursor-not-allowed text-muted" : "hover:bg-muted-wash",
                  on && "bg-muted-wash font-medium",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block">{label[mode]}</span>
                  {sub && <span className={cn("block text-[0.75rem] tabular-nums text-muted", on && "font-normal")}>{sub}</span>}
                </span>
                {on && <Check size={14} strokeWidth={2} aria-hidden className="shrink-0" />}
              </button>
            );
          })}
        </div>
      )}

      {calendar && (
        <DateRangePicker
          // The panel only: the Compare button above is the trigger.
          hideTrigger
          defaultOpen
          presets={[]}
          value={{ preset: "custom", from: seed?.from ?? from, to: seed?.to ?? to }}
          min={ledgerStart ?? undefined}
          max={today}
          today={today}
          labels={{ ...calendarLabels, choose: t("compare.chooseDates") }}
          className="absolute left-0 top-full h-0 w-0"
          onChange={(r) => onChange({ mode: "custom", from: r.from, to: r.to })}
          onClose={(refocus) => {
            setCalendar(false);
            if (refocus) requestAnimationFrame(() => trigger.current?.focus());
          }}
        />
      )}
    </div>
  );
}
