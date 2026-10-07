"use client";

import { useRef, useState } from "react";
import { CalendarDays, ChevronDown, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { DateRangePicker, formatRange, type RangePreset } from "@/components/ui";
import { cn } from "@/lib/cn";
import { DEMO_TODAY, PRESETS, presetOf } from "../_lib/filters";
import { chipBox } from "./FilterChip";

/**
 * The date filter, as a chip like the others.
 *
 * The app's own `DateRangePicker` does the choosing — named ranges down the
 * side, a two-month calendar beside them — but it always holds a range, and a
 * list starts with none: every date. So this draws the chip itself (**Date**,
 * or **Date: Last 7 days**) and borrows only the panel, which the picker
 * supports for exactly this (`hideTrigger`, `defaultOpen`, `onClose`).
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
  className,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  className?: string;
}) {
  const t = useTranslations("orders.range");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const closedAt = useRef(0);

  const set = !!(from && to);
  const preset = set ? presetOf(from, to) : "any";
  const named = PRESETS.some((p) => p.value === preset);
  const presets: RangePreset[] = PRESETS.map((p) => ({ value: p.value, label: t(p.value as "today"), range: p.range }));
  // Where the calendar opens when nothing is chosen yet: the last month, so the
  // days people actually ask about are in view.
  const [d0, d1] = PRESETS[3].range();
  const value = set ? { preset, from, to } : { preset: "any", from: d0, to: d1 };
  const text = !set ? "" : named ? t(preset as "today") : formatRange(from, to);

  return (
    <div className={cn("relative min-w-0", className)}>
      <div className={chipBox(set, open)}>
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
        {set && (
          <button
            type="button"
            onClick={() => onChange("", "")}
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
            labels={{
              choose: t("choose"),
              custom: t("custom"),
              from: t("from"),
              to: t("to"),
              apply: t("apply"),
              cancel: t("cancel"),
              previousMonth: tc("previousMonth"),
              nextMonth: tc("nextMonth"),
              days: (count) => t("days", { count }),
              pickEnd: t("pickEnd"),
            }}
          />
        </div>
      )}
    </div>
  );
}

