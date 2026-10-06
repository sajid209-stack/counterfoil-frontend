"use client";

import { useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { CalendarDays } from "lucide-react";
import { DatePicker } from "@/components/ui";
import { cn } from "@/lib/cn";

/**
 * A compact date strip: the next 7 bookable days in a 4-column grid (so they
 * sit in two rows, not four) plus a calendar cell to reach anything further
 * out. Picking a date from the calendar joins the row, in order, the same fix
 * the OS till's own date strip needed when a day outside the visible handful
 * had nowhere to show as chosen.
 */
export function DateChips({
  dates,
  value,
  onChange,
  now,
  labels,
}: {
  /** The next bookable days; only the first 7 are shown as chips. */
  dates: string[];
  value: string;
  onChange: (date: string) => void;
  now: Date;
  labels: { today: string; tomorrow: string; pickDate: string; previousMonth: string; nextMonth: string };
}) {
  const [open, setOpen] = useState(false);
  const locale = useLocale() === "bn" ? "bn-BD" : "en-GB";
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const tomorrowIso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;

  const shown = useMemo(() => {
    const first7 = dates.slice(0, 7);
    return !value || first7.includes(value) ? first7 : [...first7, value].sort();
  }, [dates, value]);

  const label = (d: string) => {
    if (d === todayIso) return labels.today;
    if (d === tomorrowIso) return labels.tomorrow;
    return new Date(`${d}T12:00:00`).toLocaleDateString(locale, { weekday: "short" });
  };
  const sub = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short" });

  return (
    <div className="flex flex-col gap-tight">
      <div className="grid grid-cols-4 gap-tight">
        {shown.map((d) => {
          const on = value === d;
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(d)}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-[12px] border px-inline py-tight text-center transition-colors duration-quick",
                on ? "border-[var(--sf-fill)] bg-[var(--sf-soft)] ring-1 ring-inset ring-[var(--sf-fill)]" : "border-line bg-white hover:border-strong",
              )}
            >
              <span className="w-full truncate text-[14px] font-medium">{label(d)}</span>
              <span className="w-full truncate text-[12px] text-muted">{sub(d)}</span>
            </button>
          );
        })}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-[12px] border px-inline text-center text-[12px] font-medium transition-colors duration-quick",
            open ? "border-fg bg-subtle text-fg" : "border-dashed border-strong bg-white text-fg hover:border-fg",
          )}
        >
          <CalendarDays size={16} strokeWidth={1.75} aria-hidden />
          {labels.pickDate}
        </button>
      </div>
      {open && (
        <div className="rounded-[12px] border border-line bg-white">
          <DatePicker
            value={value}
            today={todayIso}
            labels={{ previousMonth: labels.previousMonth, nextMonth: labels.nextMonth, today: labels.today }}
            autoFocus
            onChange={(iso) => {
              onChange(iso);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
