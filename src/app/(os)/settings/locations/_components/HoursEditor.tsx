"use client";

import { useTranslations } from "next-intl";
import { Copy, Plus, X } from "lucide-react";
import { useToast } from "@/components/ui";
import type { OpeningHours } from "@/lib/api";
import { toMinutes, toTime } from "@/lib/schedule";
import { Switch } from "../../_components/SettingsKit";
import { TimeField } from "../../_components/TimeField";
import { DAY_KEY, WEEK, dayProblem } from "../_lib/hours";

const quiet =
  "inline-flex min-h-11 items-center gap-inline rounded-sm px-tight text-[13px] font-medium text-muted transition-colors duration-quick hover:bg-subtle/60 hover:text-fg md:min-h-9";

/**
 * A week of opening hours.
 *
 * The location page used to print the hours read-only, under a note that an
 * editor was "a follow-up an engineer picks up" — shipped to operators. Booking
 * systems that do this well share one shape: a row per day, a switch for open
 * or closed, a span of times, more than one span for a day with a break, and a
 * way to copy one day to the rest so a week of identical hours is one change
 * rather than seven. Problems are named on the day they belong to.
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
          <li key={d} className="flex flex-wrap items-start gap-x-section gap-y-tight px-major py-comfortable">
            <div className="flex w-full items-center gap-comfortable sm:w-32">
              <Switch
                checked={open}
                onChange={(on) => setDay(d, on ? template().map((i) => ({ ...i })) : [])}
                labelledBy={labelId}
              />
              <span id={labelId} className="text-sm font-medium text-fg">
                {name}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              {open ? (
                <div className="flex flex-col gap-tight">
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
                          aria-label={t("locations.removeHours")}
                          onClick={() => setDay(d, day.intervals.filter((_, j) => j !== i))}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-sm text-muted transition-colors duration-quick hover:bg-subtle/60 hover:text-fg"
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
                  <div className="-ml-tight flex flex-wrap gap-x-tight">
                    <button
                      type="button"
                      className={quiet}
                      onClick={() => {
                        const last = day.intervals[day.intervals.length - 1];
                        const start = Math.min(toMinutes(last.closesAt) + 60, 22 * 60);
                        const end = Math.min(start + 120, 23 * 60 + 59);
                        setDay(d, [...day.intervals, { opensAt: toTime(start), closesAt: toTime(end) }]);
                      }}
                    >
                      <Plus size={14} strokeWidth={1.5} aria-hidden />
                      {t("locations.addHours")}
                    </button>
                    <button
                      type="button"
                      className={quiet}
                      onClick={() => {
                        onChange(hours.map((h) => ({ ...h, intervals: day.intervals.map((i) => ({ ...i })) })));
                        toast.success(t("locations.copied", { day: name }));
                      }}
                    >
                      <Copy size={14} strokeWidth={1.5} aria-hidden />
                      {t("locations.copyToAll")}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="flex min-h-11 items-center text-sm text-muted">{t("locations.closed")}</p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
