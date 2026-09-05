"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/cn";
import { hhmm, isoDate, monthMatrix, sameDay, TONE_CLASS, TONE_DOT, type CalEvent } from "./model";

/** How many chips fit in a cell before the rest collapse into "+N more". */
const MAX_CHIPS = 3;
/** A 45px phone cell holds this many dots before it starts to smear. */
const MAX_DOTS = 4;

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
  compact = false,
  dayHeading,
  emptyLabel,
}: {
  /** Any date inside the month to render. */
  month: Date;
  events: CalEvent[];
  /** Seven short weekday names, Monday first — the page owns formatting. */
  weekdayLabels: string[];
  moreLabel: (count: number) => string;
  onSelect?: (event: CalEvent) => void;
  onPickDay?: (date: Date) => void;
  /** Phone: cells carry dots, and the chosen day opens as a list underneath. */
  compact?: boolean;
  dayHeading?: (d: Date) => string;
  emptyLabel?: string;
}) {
  /** Which day the agenda underneath is showing. Only consulted when compact.
   *  Held as an ISO string so that changing month drops it automatically — the
   *  fallback below only accepts a day that is actually on screen. */
  const [picked, setPicked] = useState<string | null>(null);
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

  /* ── phone ────────────────────────────────────────────────────────────────
     A 704px month inside a 390px screen is a month you read through a letter
     box. Chips cannot survive the squeeze — a 45px cell fits about four
     characters — so the cell states HOW MUCH is on that day and in what state,
     as dots, and the day itself opens as a list underneath. That is the shape
     every phone calendar settled on, and it is the right one: on a small
     screen the grid is for choosing a day, not for reading one. */
  if (compact) {
    const inMonth = (d: Date) => d.getMonth() === month.getMonth();
    // The day the page is already pointing at — `month` is the cursor, not just
    // a month stamp. Falling back to the real today would open the agenda on a
    // blank 1st whenever the cursor is in some other month, which is exactly
    // what it did.
    const fallback = isoDate(month);
    const selectedKey =
      picked && cells.some((d) => isoDate(d) === picked && inMonth(d)) ? picked : fallback;
    const agenda = byDay.get(selectedKey) ?? [];
    const selectedDate = cells.find((d) => isoDate(d) === selectedKey) ?? now;

    return (
      <div>
        <div className="grid grid-cols-7 border-b border-line">
          {weekdayLabels.map((w) => (
            <div key={w} className="type-label py-tight text-center text-[10px] text-muted">
              {w.slice(0, 1)}
            </div>
          ))}
        </div>

        {visible.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-line last:border-0">
            {week.map((d) => {
              const key = isoDate(d);
              const list = byDay.get(key) ?? [];
              const outside = !inMonth(d);
              const today = sameDay(d, now);
              const on = key === selectedKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPicked(key)}
                  className={cn(
                    "flex min-h-[3.25rem] flex-col items-center gap-1 border-r border-line py-tight last:border-r-0",
                    outside && "bg-subtle/40",
                    on && "bg-ember/10",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full font-mono text-[12px]",
                      today && "bg-ember text-ink",
                      !today && on && "border border-ember text-brand-foreground",
                      !today && !on && outside && "text-faint",
                      !today && !on && !outside && "text-fg",
                    )}
                  >
                    {d.getDate()}
                  </span>
                  <span className="flex h-1.5 items-center gap-0.5">
                    {list.slice(0, MAX_DOTS).map((e) => (
                      <span
                        key={e.id}
                        className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[e.tone])}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        ))}

        {/* The chosen day, in full — the reason the grid can afford to be dots. */}
        <div className="border-t border-line">
          <p className="type-label px-comfortable pt-comfortable text-[11px] text-muted">
            {dayHeading ? dayHeading(selectedDate) : isoDate(selectedDate)}
          </p>
          {agenda.length === 0 ? (
            <p className="px-comfortable py-comfortable text-[13px] text-faint">{emptyLabel}</p>
          ) : (
            <ul className="flex flex-col gap-tight p-comfortable">
              {agenda.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={onSelect ? () => onSelect(e) : undefined}
                    className={cn(
                      "flex w-full items-start gap-comfortable rounded-xs border px-comfortable py-tight text-left",
                      TONE_CLASS[e.tone],
                    )}
                  >
                    <span className="w-12 shrink-0 font-mono text-[12px] opacity-70">
                      {e.allDay ? "—" : hhmm(e.start)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-0.5 text-[13px] font-medium leading-tight">
                        {e.locked && <Lock size={11} strokeWidth={2.5} className="shrink-0" />}
                        <span className="min-w-0 break-words">{e.title}</span>
                      </span>
                      {e.subtitle && (
                        <span className="mt-0.5 block break-words text-[12px] leading-tight opacity-70">
                          {e.subtitle}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

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
