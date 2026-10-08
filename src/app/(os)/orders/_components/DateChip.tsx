"use client";

import { useRef, useState } from "react";
import { CalendarDays, ChevronDown, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { DateRangePicker, formatRange, type RangePreset } from "@/components/ui";
import { cn } from "@/lib/cn";
import { DEMO_TODAY, PRESETS, presetOf } from "../_lib/filters";
import { chipBox } from "./chip";

/**
 * The date filter, as a chip on a list's toolbar.
 *
 * The app's own `DateRangePicker` does the choosing — named ranges down the
 * side, a two-month calendar beside them — and this draws the chip itself
 * (**Date**, or **Date: Last 7 days**) and borrows only the panel, which the
 * picker supports for exactly this (`hideTrigger`, `defaultOpen`, `onClose`).
 *
 * Two kinds of list use it. Orders starts with no range at all — every date —
 * so the chip says only "Date" and carries a clear button once one is chosen.
 * Issued orders and Activity always hold a range (their default), so the chip
 * names it ("Date: Last 30 days") and offers a way back to the default only
 * once it has been moved off it.
 *
 * Opening and closing is the caller's, which is the one awkward part: the
 * picker closes on a mouse-down outside itself, and the chip is outside it, so
 * pressing the chip to close it would close it and then — on the click that
 * follows — open it again. The moment it last closed is remembered, and a
 * click right behind it is ignored.
 */
export function DateChip({
  from,
  to,
  onChange,
  defaultRange,
  className,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  /** The range the list opens on, where it has one. Absent: the list opens on
   *  every date, and "no range" is `from === ""`. */
  defaultRange?: [string, string];
  className?: string;
}) {
  const t = useTranslations("orders.range");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const closedAt = useRef(0);
  /* One set of words for every list that uses the chip: the named ranges and
     the picker's own labels live in `orders.range`. */
  const presetNames: Record<string, string> = Object.fromEntries(PRESETS.map((p) => [p.value, t(p.value as "today")]));
  const labels = {
    choose: t("choose"),
    custom: t("custom"),
    from: t("from"),
    to: t("to"),
    apply: t("apply"),
    cancel: t("cancel"),
    previousMonth: tc("previousMonth"),
    nextMonth: tc("nextMonth"),
    days: (count: number) => t("days", { count }),
    pickEnd: t("pickEnd"),
  };

  const set = !!(from && to);
  const atDefault = !!defaultRange && from === defaultRange[0] && to === defaultRange[1];
  const preset = set ? presetOf(from, to) : "any";
  const named = preset !== "custom" && preset !== "any";
  const text = !set ? "" : named ? presetNames[preset] : formatRange(from, to);
  /* Marked as narrowing only when it is: a default range is just where the list
     starts, and a grey chip there would read as a filter somebody had applied. */
  const narrowing = set && !atDefault;

  const presets: RangePreset[] = PRESETS.map((p) => ({ value: p.value, label: presetNames[p.value], range: p.range }));
  /* Where the calendar opens when nothing is chosen yet: the last month, so the
     days people actually ask about are in view. */
  const [d0, d1] = defaultRange ?? PRESETS[3].range();
  const value = set ? { preset, from, to } : { preset: "any", from: d0, to: d1 };

  return (
    <div className={cn("relative min-w-0", className)}>
      <div className={chipBox(narrowing, open)}>
        <button
          ref={trigger}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={set ? `${t("label")}: ${text}` : t("label")}
          onClick={() => {
            if (open) return;
            if (performance.now() - closedAt.current < 400) return;
            setOpen(true);
          }}
          className="flex min-w-0 flex-1 items-center gap-tight rounded-sm px-comfortable text-left outline-none"
        >
          <CalendarDays size={14} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
          <span className="min-w-0 truncate">
            <span className="text-fg">{t("label")}</span>
            {set && (
              <>
                <span className="text-fg">: </span>
                <span className="font-medium text-fg" title={named ? formatRange(from, to) : undefined}>{text}</span>
              </>
            )}
          </span>
          <ChevronDown size={14} strokeWidth={1.5} aria-hidden className={cn("shrink-0 text-muted transition-transform duration-quick", open && "rotate-180")} />
        </button>
        {narrowing && (
          <button
            type="button"
            onClick={() => (defaultRange ? onChange(defaultRange[0], defaultRange[1]) : onChange("", ""))}
            aria-label={tc("clearFilter", { name: t("label") })}
            className="grid w-11 shrink-0 place-items-center rounded-r-sm text-muted transition-colors duration-quick hover:text-fg active:bg-muted-wash md:w-9"
          >
            <X size={14} strokeWidth={2} aria-hidden />
          </button>
        )}
      </div>

      {open && (
        /* A zero-size anchor under the chip: the picker's panel positions
           itself against its own wrapper, and that wrapper has no height with
           the trigger hidden. */
        <div className="absolute left-0 top-full h-0 w-0">
          <DateRangePicker
            hideTrigger
            defaultOpen
            value={value}
            presets={presets}
            today={DEMO_TODAY}
            max={DEMO_TODAY}
            onChange={(r) => onChange(r.from, r.to)}
            onClose={(refocus) => {
              closedAt.current = performance.now();
              setOpen(false);
              if (refocus) requestAnimationFrame(() => trigger.current?.focus());
            }}
            labels={labels}
          />
        </div>
      )}
    </div>
  );
}
