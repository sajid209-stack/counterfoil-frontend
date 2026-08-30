"use client";

import { Lock } from "lucide-react";
import { cn } from "@/lib/cn";
import { hhmm, isoDate, monthMatrix, sameDay, TONE_CLASS, type CalEvent } from "./model";

/** How many chips fit in a cell before the rest collapse into "+N more". */
const MAX_CHIPS = 3;

/** The month as a proper 7-column date grid. The old view listed one card per
 *  day down the page, which meant a month of trading needed a page of
 *  scrolling and no two days could be compared at a glance. */
export function MonthGrid({
  month,
  events,
  weekdayLabels,
  moreLabel,
  onSelect,
  onPickDay,
}: {
  /** Any date inside the month to render. */
  month: Date;
  events: CalEvent[];
  /** Seven short weekday names, Monday first — the page owns formatting. */
  weekdayLabels: string[];
  moreLabel: (count: number) => string;
  onSelect?: (event: CalEvent) => void;
  onPickDay?: (date: Date) => void;
}) {
  const cells = monthMatrix(month);
  const now = new Date();

  // Bucket once rather than filtering 42 times.
  const byDay = new Map<string, CalEvent[]>();
  for (const e of events) {
    const k = isoDate(e.start);
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  // Trailing weeks that belong entirely to the next month are dead space.
  const weeks: Date[][] = [];
  for (let i = 0; i < 42; i += 7) weeks.push(cells.slice(i, i + 7));
  const visible = weeks.filter(
    (w, i) => i < 4 || w.some((d) => d.getMonth() === month.getMonth()),
  );

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[44rem]">
        <div className="grid grid-cols-7 border-b border-line">
          {weekdayLabels.map((w) => (
            <div key={w} className="type-label px-tight py-tight text-[10px] text-muted">
              {w}
            </div>
          ))}
        </div>

        {visible.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-line last:border-0">
            {week.map((d) => {
              const key = isoDate(d);
              const list = byDay.get(key) ?? [];
              const outside = d.getMonth() !== month.getMonth();
              const today = sameDay(d, now);
              const shown = list.slice(0, MAX_CHIPS);
              const rest = list.length - shown.length;

              return (
                <div
                  key={key}
                  className={cn(
                    "min-h-[7rem] border-r border-line p-1 last:border-r-0",
                    outside && "bg-subtle/40",
                  )}
                >
                  <button
                    type="button"
                    onClick={onPickDay ? () => onPickDay(d) : undefined}
                    className={cn(
                      "mb-1 flex h-6 w-6 items-center justify-center rounded-full font-mono text-[12px] transition-colors duration-quick",
                      today && "bg-ember text-ink",
                      !today && outside && "text-faint",
                      !today && !outside && "text-fg",
                      onPickDay && !today && "hover:bg-subtle",
                    )}
                  >
                    {d.getDate()}
                  </button>

                  <div className="flex flex-col gap-0.5">
                    {shown.map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={onSelect ? () => onSelect(e) : undefined}
                        title={`${e.title} · ${hhmm(e.start)}${e.subtitle ? ` · ${e.subtitle}` : ""}`}
                        className={cn(
                          "flex w-full items-center gap-0.5 overflow-hidden rounded-xs border px-1 py-0.5 text-left text-[10px] leading-tight",
                          TONE_CLASS[e.tone],
                        )}
                      >
                        {e.locked && <Lock size={8} strokeWidth={2.5} className="shrink-0" />}
                        {!e.allDay && (
                          <span className="shrink-0 font-mono opacity-70">{hhmm(e.start)}</span>
                        )}
                        <span className="truncate">{e.title}</span>
                      </button>
                    ))}
                    {rest > 0 && (
                      <button
                        type="button"
                        onClick={onPickDay ? () => onPickDay(d) : undefined}
                        className="px-1 text-left text-[10px] text-muted transition-colors duration-quick hover:text-fg"
                      >
                        {moreLabel(rest)}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
