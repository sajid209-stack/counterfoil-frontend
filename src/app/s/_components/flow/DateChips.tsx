"use client";

import { useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { CalendarDays } from "lucide-react";
import { ChoiceCard, DatePicker } from "@/components/ui";
import { cn } from "@/lib/cn";
import { TILE, TILE_MAIN, TILE_SUB } from "./tile";

/**
 * A compact date strip: the next 5 bookable days in a 3-column grid (two rows
 * with the calendar cell) plus a calendar cell to reach anything further out.
 * Three across, not four: at four a tile was too narrow for "Tomorrow", which
 * read "Tomorr…". Every tile is the same two-line anatomy (tile.ts). Picking a date from the calendar joins the row, in order, the same fix
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
  /** The next bookable days; only the first 5 are shown as tiles. */
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
    const first = dates.slice(0, 5);
    return !value || first.includes(value) ? first : [...first.slice(0, 4), value].sort();
  }, [dates, value]);

  const label = (d: string) => {
    if (d === todayIso) return labels.today;
    if (d === tomorrowIso) return labels.tomorrow;
    return new Date(`${d}T12:00:00`).toLocaleDateString(locale, { weekday: "short" });
  };
  const sub = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short" });

  return (
    <div className="flex flex-col gap-tight">
      <div className="grid grid-cols-3 gap-tight">
        {shown.map((d) => {
          const on = value === d;
          return (
            <ChoiceCard
              key={d}
              selected={on}
              hideCheck
              onClick={() => onChange(d)}
              className={TILE}
            >
              <span className={cn(TILE_MAIN, on && "text-brand-foreground")}>{label(d)}</span>
              <span className={TILE_SUB}>{sub(d)}</span>
            </ChoiceCard>
          );
        })}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            TILE,
            "rounded-card border transition-colors duration-quick",
            open ? "border-fg bg-subtle text-fg" : "border-line bg-card text-fg hover:border-strong",
          )}
        >
          <CalendarDays size={18} strokeWidth={1.75} aria-hidden />
          <span className={cn(TILE_SUB, "font-medium text-fg")}>{labels.pickDate}</span>
        </button>
      </div>
      {open && (
        <div className="rounded-md border border-line bg-card">
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
