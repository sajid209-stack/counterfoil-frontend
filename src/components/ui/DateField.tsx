"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDate, formatDay } from "@/lib/format";
import { DatePicker, type DatePickerLabels } from "./DatePicker";

/**
 * A date field that reads and opens in Counterfoil's own language.
 *
 * The drop-in replacement for `<input type="date">`. Two things it fixes
 * beyond the picker itself: the trigger states the date through
 * `lib/format`, so a field says "29 Jul 2026" like every other date on the
 * page instead of whatever the operating system's locale produces; and the
 * panel is ours, so a till with 18px corners stops opening a system dialog
 * with none.
 */
export function DateField({
  value,
  onChange,
  today,
  min,
  max,
  isDisabled,
  labels,
  shape = "default",
  compact = false,
  placeholder,
  className,
  id,
  size = "toolbar",
}: {
  value: string | null;
  onChange: (iso: string) => void;
  today: string;
  min?: string;
  max?: string;
  isDisabled?: (iso: string) => boolean;
  labels: DatePickerLabels & { open: string };
  /** `inline` reads as text until pointed at — for a sentence of controls,
   *  such as the calendar panel's "Wed 29 Jul · 14:00 – 15:00", where a boxed
   *  field would make one line look like a form. */
  shape?: "default" | "go" | "inline";
  /** Icon only. For a toolbar that already states the date beside it — the
   *  calendar's range label does — where a second copy of "29 Jul 2026" costs
   *  a whole row on a phone and says nothing new. The accessible name still
   *  carries the date, so nothing is lost to a screen reader. */
  compact?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
  /** `form` keeps the 44px height of the text and time fields it sits beside
   *  in a form; `toolbar` (the default) steps down to 36px from `md`, beside
   *  the toolbar selects and buttons it was first built for. A date and a
   *  start time side by side at two different heights read as two forms. */
  size?: "toolbar" | "form";
}) {
  const [open, setOpen] = useState(false);
  /* Which edge the panel hangs from. A field near the right of the window
     — the calendar toolbar's is — pushed the last two weekday columns off
     the screen when the panel always opened leftward. */
  const [alignEnd, setAlignEnd] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  /* Close on Escape or on a click outside, and put focus back on the trigger
     when Escape did it — losing your place in the form is the usual cost of a
     popover that only knows how to disappear. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    <div ref={wrap} className={cn("relative", className)}>
      <button
        ref={trigger}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={compact ? `${labels.open}${value ? ` — ${formatDate(value)}` : ""}` : undefined}
        onClick={() => {
          const r = trigger.current?.getBoundingClientRect();
          // The panel is about 288px of grid plus its padding.
          if (r) setAlignEnd(r.left + 300 > window.innerWidth);
          setOpen((v) => !v);
        }}
        className={cn(
          "flex items-center gap-tight border border-line bg-card text-left text-sm outline-none transition-colors duration-quick focus:border-inverse",
          compact ? "h-11 w-11 shrink-0 justify-center" : "w-full",
          shape === "go"
            ? "min-h-12 rounded-go px-comfortable"
            : shape === "inline"
              ? "h-9 w-auto rounded-sm border-transparent bg-transparent px-tight text-[14px] font-medium hover:bg-muted-wash focus-visible:bg-muted-wash"
              : cn("rounded-sm", compact ? "" : size === "form" ? "h-11 px-comfortable" : "h-11 px-comfortable md:h-9"),
        )}
      >
        {shape !== "inline" && (
          <CalendarDays size={compact ? 18 : 15} strokeWidth={1.5} className="shrink-0 text-muted" aria-hidden />
        )}
        {!compact && (
          <span className={cn("min-w-0 flex-1 truncate", !value && "text-muted")}>
            {value ? (shape === "inline" ? formatDay(value, { weekday: true }) : formatDate(value)) : (placeholder ?? labels.open)}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={labels.open}
          className={cn(
            "absolute top-[calc(100%+4px)] z-40 w-max border border-line bg-card shadow-lg",
            alignEnd ? "right-0" : "left-0",
            shape === "go" ? "rounded-go" : "rounded-md",
          )}
        >
          <DatePicker
            value={value}
            today={today}
            min={min}
            max={max}
            isDisabled={isDisabled}
            labels={labels}
            shape={shape === "go" ? "go" : "default"}
            autoFocus
            onChange={(iso) => {
              onChange(iso);
              setOpen(false);
              trigger.current?.focus();
            }}
          />
        </div>
      )}
    </div>
  );
}
