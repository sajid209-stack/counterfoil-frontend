"use client";

import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { ConfirmDialog } from "@/components/ui";
import { DateField, TimeInput } from "@/components/ui";
import { formatDay } from "@/lib/format";
import { DEMO_TODAY } from "@/lib/schedule";
import { daysForRange, nextDay } from "@/lib/events/days";
import type { EventContent } from "./EventArchitect";

/**
 * How many days it runs, and what each one is called.
 *
 * Not there until it is wanted: a one-night gig should never see a day list,
 * so this is a single line of text until somebody says the event runs longer.
 * Pressed, it sets a last day one on and the days appear — because **the range
 * IS the day list**, and asking an operator to type an end date and then add
 * "Day 2" by hand is asking for the same fact twice. Nudging the last day
 * keeps everything already said about a date that survives.
 *
 * `showTimes` is the difference between making an event and refining one. The
 * hours of each separate day are a real thing a tournament has and almost
 * nobody sets while first typing a name in, so the creation flow asks for a
 * date and a name and the editor asks for the rest.
 */
export function EventDays({
  content,
  onContent,
  t,
  dateLabels,
  error,
  showTimes = false,
  scopedTickets = 0,
  onUntieTickets,
}: {
  content: EventContent;
  onContent: (p: Partial<EventContent>) => void;
  t: (k: string, v?: Record<string, string | number>) => string;
  dateLabels: React.ComponentProps<typeof DateField>["labels"];
  error?: string;
  showTimes?: boolean;
  /** How many tickets are tied to a particular day. Going back to one day
   *  unties them, and that has to be said before it happens rather than
   *  discovered afterwards. */
  scopedTickets?: number;
  onUntieTickets?: () => void;
}) {
  const days = content.days;
  const multi = days.length > 1;
  const [confirming, setConfirming] = useState(false);
  const tiedEntries = content.lineup.filter((l) => !!l.dayId).length;
  /**
   * Going back to one day is destructive, and used not to look it.
   *
   * Emptying `days` on its own left every ticket's `dayIds` and every
   * programme entry's `dayId` pointing at ids that no longer existed — so a
   * ticket admitted a day that was gone, the page still computed a saving
   * against it, and turning days back on minted fresh ids that nothing
   * matched. The references are cleared WITH the days, and the operator is
   * told what they are about to lose first.
   */
  const dropDays = () => {
    onContent({ endDate: "", days: [], lineup: content.lineup.map((l) => (l.dayId ? { ...l, dayId: undefined } : l)) });
    onUntieTickets?.();
    setConfirming(false);
  };
  const askDrop = () => (scopedTickets > 0 || tiedEntries > 0 ? setConfirming(true) : dropDays());
  const setRange = (endDate: string) => onContent({ endDate, days: daysForRange(content.date, endDate, days) });
  const patchDay = (id: string, p: Partial<(typeof days)[number]>) =>
    onContent({ days: days.map((x) => (x.id === id ? { ...x, ...p } : x)) });

  if (!multi) {
    return (
      <button
        type="button"
        onClick={() => setRange(nextDay(content.date || DEMO_TODAY, 1))}
        className="min-h-11 self-start rounded-sm px-tight text-[13px] font-medium text-muted hover:bg-subtle hover:text-fg sm:min-h-9"
      >
        {t("days.add")}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-tight rounded-sm border border-line bg-subtle/40 p-comfortable">
      {/* The count and the way out on one line, the control that changes the
          count under it — at 390px all three on one row wrapped into three. */}
      <div className="flex items-center justify-between gap-tight">
        <span className="flex items-center gap-inline text-[13px] font-medium">
          <CalendarRange size={15} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
          {t("days.runsFor", { count: days.length })}
        </span>
        {/* The one destructive control in this block, drawn as a control
            rather than as a caption sitting flush right of a count. */}
        <button
          type="button"
          onClick={askDrop}
          className="flex min-h-11 shrink-0 items-center rounded-full border border-line bg-card px-comfortable text-[13px] font-medium text-muted transition-colors duration-quick hover:border-strong hover:text-fg sm:min-h-9"
        >
          {t("days.remove")}
        </button>
      </div>
      <span className="flex flex-wrap items-center gap-inline text-[13px]">
        <span className="text-muted">{t("days.lastDay")}</span>
        <DateField
          value={content.endDate || days[days.length - 1].date}
          today={content.date || DEMO_TODAY}
          min={content.date || undefined}
          onChange={setRange}
          labels={dateLabels}
          shape="inline"
        />
      </span>
      {error && <span className="text-[12px] text-danger">{error}</span>}
      {/* Nothing here is required. A day with no name is "Day 2" wherever it
          appears, which is what most of them are called anyway. */}
      <ul className="flex flex-col gap-inline">
        {days.map((d, i) => (
          <li
            key={d.id}
            className={
              showTimes
                ? "grid grid-cols-1 items-center gap-tight sm:grid-cols-[7rem_minmax(0,1fr)_auto]"
                : "grid grid-cols-1 items-center gap-tight sm:grid-cols-[7rem_minmax(0,1fr)]"
            }
          >
            <span className="text-[13px] font-medium tabular-nums">{formatDay(d.date, { weekday: true })}</span>
            <input
              value={d.name ?? ""}
              onChange={(e) => patchDay(d.id, { name: e.target.value })}
              placeholder={t("days.namePlaceholder", { n: i + 1 })}
              aria-label={t("days.nameLabel", { n: i + 1 })}
              className="h-11 min-w-0 rounded-sm border border-line bg-card px-comfortable text-[13px] outline-none placeholder:text-muted focus:border-inverse sm:h-9"
            />
            {showTimes && (
              <span className="flex items-center gap-inline">
                <TimeInput value={d.startTime ?? ""} onChange={(v) => patchDay(d.id, { startTime: v })} className="w-24" />
                <span aria-hidden className="text-muted">–</span>
                <TimeInput value={d.endTime ?? ""} onChange={(v) => patchDay(d.id, { endTime: v })} className="w-24" />
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="text-[12px] text-muted">{showTimes ? t("days.helpTimes") : t("days.help")}</p>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={dropDays}
        title={t("days.dropTitle")}
        message={t("days.dropBody", { tickets: scopedTickets, entries: tiedEntries })}
        confirmLabel={t("days.remove")}
      />
    </div>
  );
}
