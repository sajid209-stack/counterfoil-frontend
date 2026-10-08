"use client";

import { useTranslations } from "next-intl";
import { Copy, Plus, X } from "lucide-react";
import { useToast } from "@/components/ui";
import type { OpeningHours } from "@/lib/api";
import { toMinutes, toTime } from "@/lib/schedule";
import { formatClock } from "@/lib/format";
import { Switch } from "../../_components/SettingsKit";
import { TimeField } from "../../_components/TimeField";
import { DAY_KEY, WEEK, dayProblem } from "../_lib/hours";

const iconButton =
  "inline-flex h-11 w-11 items-center justify-center rounded-sm text-muted transition-colors duration-quick hover:bg-muted-wash hover:text-fg";

/**
 * A week of opening hours.
 *
 * The location page used to print the hours read-only, under a note that an
 * editor was "a follow-up an engineer picks up" — shipped to operators. Booking
 * systems that do this well share one shape: a row per day, a switch for open
 * or closed, a span of times, more than one span for a day with a break, and a
 * way to copy one day to the rest so a week of identical hours is one change
 * rather than seven. Problems are named on the day they belong to.
 *
 * "Add hours" and "Copy to all days" were text links under every open day —
 * twelve links down a six-day week, doubling each row's height to repeat the
 * same two words. They sit at the end of the day's row now as icon buttons,
 * the way Calendly's availability editor draws them, each named for the day it
 * acts on so a screen reader hears "Copy Tuesday's hours to every day".
 */
export function HoursEditor({ hours, onChange }: { hours: OpeningHours[]; onChange: (next: OpeningHours[]) => void }) {
  const t = useTranslations("settings");
  const toast = useToast();

  const dayOf = (d: OpeningHours["dayOfWeek"]) => hours.find((h) => h.dayOfWeek === d) ?? { dayOfWeek: d, intervals: [] };
  const setDay = (d: OpeningHours["dayOfWeek"], intervals: OpeningHours["intervals"]) =>
    onChange(hours.map((h) => (h.dayOfWeek === d ? { ...h, intervals } : h)));
  // A day switched on borrows the first open day's hours: the likeliest answer,
  // and one change away from right when it is not.
  const template = () =>
    WEEK.map(dayOf).find((h) => h.intervals.length > 0)?.intervals ?? [{ opensAt: "10:00", closesAt: "18:00" }];

  return (
    <ul className="divide-y divide-hairline">
      {WEEK.map((d) => {
        const day = dayOf(d);
        const open = day.intervals.length > 0;
        const problem = dayProblem(day.intervals);
        const name = t(`common.${DAY_KEY[d]}`);
        const labelId = `hours-day-${d}`;
        return (
          /* Two lines on a phone — the day, its switch and its two small
             buttons on the first, the times on the second — and one line from
             sm. Grid areas rather than DOM order, so tabbing still reads
             switch, times, then the buttons. */
          <li
            key={d}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-comfortable gap-y-inline px-card py-tight [grid-template-areas:'day_actions''times_times'] sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:[grid-template-areas:'day_times_actions']"
          >
            <div className="flex items-center gap-comfortable [grid-area:day]">
              <Switch
                checked={open}
                onChange={(on) => setDay(d, on ? template().map((i) => ({ ...i })) : [])}
                labelledBy={labelId}
              />
              <span id={labelId} className="text-sm font-medium text-fg">
                {name}
              </span>
            </div>

            {open ? (
              <div className="flex min-w-0 flex-col gap-tight pb-tight [grid-area:times] sm:py-tight">
                {day.intervals.map((iv, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-tight">
                    <TimeField
                      value={iv.opensAt}
                      label={t("locations.opensAtOn", { day: name })}
                      invalid={!!problem}
                      onChange={(v) => setDay(d, day.intervals.map((x, j) => (j === i ? { ...x, opensAt: v } : x)))}
                    />
                    <span aria-hidden className="text-muted">
                      –
                    </span>
                    <TimeField
                      value={iv.closesAt}
                      label={t("locations.closesAtOn", { day: name })}
                      invalid={!!problem}
                      onChange={(v) => setDay(d, day.intervals.map((x, j) => (j === i ? { ...x, closesAt: v } : x)))}
                    />
                    {day.intervals.length > 1 && (
                      <button
                        type="button"
                        aria-label={t("locations.removeHours", { day: name, from: formatClock(iv.opensAt), to: formatClock(iv.closesAt) })}
                        title={t("locations.removeHours", { day: name, from: formatClock(iv.opensAt), to: formatClock(iv.closesAt) })}
                        onClick={() => setDay(d, day.intervals.filter((_, j) => j !== i))}
                        className={iconButton}
                      >
                        <X size={16} strokeWidth={1.5} aria-hidden />
                      </button>
                    )}
                  </div>
                ))}
                {problem && (
                  <p className="text-[12px] text-danger">
                    {problem === "backwards" ? t("locations.hoursBackwards") : t("locations.hoursOverlap")}
                  </p>
                )}
              </div>
            ) : (
              /* A closed day is one line: on a phone the word sits where the
                 buttons would, at the row's right edge. */
              <p className="text-right text-sm text-muted [grid-area:actions] sm:text-left sm:[grid-area:times]">{t("locations.closed")}</p>
            )}

            {open && (
              <div className="flex shrink-0 items-center [grid-area:actions]">
                <button
                  type="button"
                  aria-label={t("locations.addHoursOn", { day: name })}
                  title={t("locations.addHours")}
                  className={iconButton}
                  onClick={() => {
                    const last = day.intervals[day.intervals.length - 1];
                    const start = Math.min(toMinutes(last.closesAt) + 60, 22 * 60);
                    const end = Math.min(start + 120, 23 * 60 + 59);
                    setDay(d, [...day.intervals, { opensAt: toTime(start), closesAt: toTime(end) }]);
                  }}
                >
                  <Plus size={16} strokeWidth={1.5} aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={t("locations.copyDayToAll", { day: name })}
                  title={t("locations.copyToAll")}
                  className={iconButton}
                  onClick={() => {
                    onChange(hours.map((h) => ({ ...h, intervals: day.intervals.map((i) => ({ ...i })) })));
                    toast.success(t("locations.copied", { day: name }));
                  }}
                >
                  <Copy size={16} strokeWidth={1.5} aria-hidden />
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
