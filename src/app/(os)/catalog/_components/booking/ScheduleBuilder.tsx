"use client";

import { useState } from "react";
import { AlertTriangle, Plus, X } from "lucide-react";
import { formatClock, formatClockRange, formatDay } from "@/lib/format";
import { useTranslations } from "next-intl";
import { DateField, DurationInput, FormField, Select, TimeInput } from "@/components/ui";
import type { BookingTypeCode, DayHours, ProductSchedule, Staff } from "@/lib/api";
import {
  DEMO_TODAY,
  isDailyCapped,
  isGuided,
  isSlotBased,
  slotTimes,
} from "@/lib/schedule";
import { useCatalogFormat } from "../../_lib/useCatalogFormat";

const DURATION_CHIPS = [15, 30, 45, 60, 90, 120];
const WEEK = [0, 1, 2, 3, 4, 5, 6];

export function ScheduleBuilder({
  bookingType,
  value,
  onChange,
  team,
  /** "Time between bookings", set beside this builder (ScheduleBufferField) —
   *  passed in only so the overlap warning below can say so. Defaults to 0,
   *  which reproduces the old warning exactly for every seeded product that
   *  has no buffer set. */
  bufferMinutes = 0,
  /** The buffer field itself (`ScheduleBufferField`), rendered where it is
   *  part of the same decision as the slot interval — directly under "A new
   *  slot starts every / Each slot lasts" and before "First/Last slot" — so
   *  cause (the buffer) and effect (the overlap warning right under it) are
   *  never a screen apart. For a kind with no interval row (BT-05) it is the
   *  first thing drawn, which is still the top of this form. `null`/`undefined`
   *  draws nothing, which is what a kind that does not use a buffer passes. */
  bufferSlot,
}: {
  bookingType: BookingTypeCode;
  value: ProductSchedule;
  onChange: (schedule: ProductSchedule) => void;
  team: Staff[];
  bufferMinutes?: number;
  bufferSlot?: React.ReactNode;
}) {
  const t = useTranslations("catalog.fields");
  const { dur, dayShort, dayLong } = useCatalogFormat();
  const [exDate, setExDate] = useState("");
  const set = <K extends keyof ProductSchedule>(k: K, v: ProductSchedule[K]) => onChange({ ...value, [k]: v });
  const toggleDay = (d: number) =>
    set("openDays", value.openDays.includes(d) ? value.openDays.filter((x) => x !== d) : [...value.openDays, d].sort());
  const toggleGuide = (id: string) =>
    set("guideIds", value.guideIds.includes(id) ? value.guideIds.filter((x) => x !== id) : [...value.guideIds, id]);
  const addException = () => {
    if (!exDate) return;
    set("exceptions", [...value.exceptions, { date: exDate, kind: "closed" }]);
    setExDate("");
  };
  const removeException = (date: string) => set("exceptions", value.exceptions.filter((e) => e.date !== date));

  // Days whose hours differ from the rest ("Fri 14:00–23:00 while other days run base hours").
  const overrides = value.dayOverrides ?? {};
  const setOverride = (d: number, hrs: DayHours | null) => {
    const next: Record<number, DayHours> = { ...overrides };
    if (hrs) next[d] = hrs;
    else delete next[d];
    set("dayOverrides", Object.keys(next).length ? next : undefined);
  };
  const moveOverride = (from: number, to: number) => {
    const hrs = overrides[from];
    const next: Record<number, DayHours> = { ...overrides };
    delete next[from];
    next[to] = hrs;
    set("dayOverrides", next);
  };
  const addOverride = () => {
    const d = value.openDays.find((x) => !(x in overrides));
    if (d != null) setOverride(d, { startTime: value.startTime, endTime: value.endTime });
  };

  const slots = isSlotBased(bookingType) ? slotTimes(value) : [];
  const openCount = value.openDays.length;
  const overrideSummary = Object.entries(overrides)
    .map(([d, h]) => `${dayShort(Number(d))} ${formatClockRange(h.startTime, h.endTime)}`)
    .join(" · ");

  return (
    <div className="flex flex-col gap-section">
      {isSlotBased(bookingType) && (
        <div className="grid gap-section sm:grid-cols-2">
          <DurationInput label={t("every")} value={value.slotMinutes} min={5} onChange={(n) => set("slotMinutes", n)} chips={DURATION_CHIPS} help={t("everyHelp")} />
          <DurationInput label={t("lasts")} value={value.sessionMinutes} min={5} onChange={(n) => set("sessionMinutes", n)} chips={DURATION_CHIPS} />
        </div>
      )}

      {/* "Time between bookings" sits right under the interval it is part of
          the same decision as — for BT-05, which has no interval row above,
          this is simply the first thing on the form. */}
      {bufferSlot}

      {isSlotBased(bookingType) && (
        <>
          {/* Allowed — a rotating group can overlap — but never silent: in one
              room, a 45-minute show every 30 minutes cannot happen. Once a
              buffer is set it counts too: the room is not free again the
              instant the show ends. The fix button only appears when the
              buffer is the (or a) cause, because only then is there a gap to
              shorten or an interval to lengthen by exactly that much. */}
          {value.sessionMinutes + bufferMinutes > value.slotMinutes && (
            <div className="flex flex-col items-start gap-tight rounded-sm bg-warning-wash px-comfortable py-tight text-[13px] text-fg">
              <p className="flex items-start gap-tight">
                <AlertTriangle size={14} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0 text-warning" />
                <span>
                  {bufferMinutes > 0
                    ? t("overlapWithBuffer", { lasts: dur(value.sessionMinutes), buffer: dur(bufferMinutes), every: dur(value.slotMinutes) })
                    : t("overlap", { lasts: dur(value.sessionMinutes), every: dur(value.slotMinutes) })}
                </span>
              </p>
              {bufferMinutes > 0 && (
                <button
                  type="button"
                  onClick={() => set("slotMinutes", value.sessionMinutes + bufferMinutes)}
                  className="ml-6 flex h-9 items-center rounded-sm border border-line bg-card px-comfortable text-[13px] font-medium hover:border-inverse"
                >
                  {t("bufferFixInterval", { time: dur(value.sessionMinutes + bufferMinutes) })}
                </button>
              )}
            </div>
          )}
          <div className="grid gap-section sm:grid-cols-2">
            <TimeInput label={t("first")} value={value.startTime} onChange={(v) => set("startTime", v)} help={t("firstHelp")} />
            <TimeInput label={t("last")} value={value.endTime} onChange={(v) => set("endTime", v)} />
            <FormField label={t("holds")} variant="number" placeholder="20" value={String(value.capacityPerSession)} onChange={(e) => set("capacityPerSession", parseInt(e.target.value, 10) || 0)} />
          </div>
        </>
      )}

      {isDailyCapped(bookingType) && (
        <FormField
          label={t("perDay")}
          variant="number"
          placeholder="200"
          value={String(value.dailyCapacity ?? 0)}
          onChange={(e) => set("dailyCapacity", parseInt(e.target.value, 10) || 0)}
          className="max-w-xs"
          help={t("perDayHelp", { count: (value.dailyCapacity ?? 0).toLocaleString() })}
        />
      )}

      <div className="flex flex-col gap-tight">
        <span className="text-[0.8125rem] font-medium text-muted">{t("openDays")}</span>
        {/* Named days, not two letters: "Tu" and "Th" are one letter apart,
            and a day button that only a reader of English can tell apart is
            no use to a Bangla reader at all. */}
        <div className="flex flex-wrap gap-inline" role="group" aria-label={t("openDays")}>
          {WEEK.map((d) => {
            const on = value.openDays.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                aria-pressed={on}
                aria-label={dayLong(d)}
                title={dayLong(d)}
                className={`h-11 min-w-11 rounded-sm border px-tight text-[13px] md:h-10 md:min-w-12 ${on ? "border-inverse bg-inverse text-inverse-fg" : "border-line bg-card text-muted"}`}
              >
                {dayShort(d)}
              </button>
            );
          })}
        </div>
      </div>

      {isSlotBased(bookingType) && (
        <div className="flex flex-col gap-tight">
          <span className="text-[0.8125rem] font-medium text-muted">{t("overrides")}</span>
          {Object.entries(overrides).map(([dStr, hrs]) => {
            const d = Number(dStr);
            return (
              <div key={d} className="flex flex-wrap items-center gap-tight">
                <Select
                  value={String(d)}
                  onChange={(v) => moveOverride(d, Number(v))}
                  aria-label={t("overrideDay")}
                  className="w-auto"
                  triggerClassName="w-auto pl-tight text-sm md:h-10"
                  options={value.openDays
                    .filter((x) => x === d || !(x in overrides))
                    .map((x) => ({ value: String(x), label: dayLong(x) }))}
                />
                <TimeInput value={hrs.startTime} onChange={(v) => setOverride(d, { ...hrs, startTime: v })} className="w-32" />
                <span className="text-muted" aria-hidden>–</span>
                <TimeInput value={hrs.endTime} onChange={(v) => setOverride(d, { ...hrs, endTime: v })} className="w-32" />
                <button
                  type="button"
                  aria-label={t("removeOverride", { day: dayLong(d) })}
                  title={t("removeOverride", { day: dayLong(d) })}
                  onClick={() => setOverride(d, null)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm text-muted hover:bg-muted-wash hover:text-danger md:h-9 md:w-9"
                >
                  <X size={16} strokeWidth={1.5} aria-hidden />
                </button>
              </div>
            );
          })}
          {value.openDays.some((x) => !(x in overrides)) && (
            <button type="button" onClick={addOverride} className="flex h-11 w-fit items-center gap-inline rounded-sm border border-line px-comfortable text-sm hover:border-inverse md:h-10">
              <Plus size={16} strokeWidth={1.5} aria-hidden /> {t("addOverride")}
            </button>
          )}
        </div>
      )}

      {isGuided(bookingType) && (
        <div className="flex flex-col gap-tight">
          <span className="text-[0.8125rem] font-medium text-muted">{t("whoLeads")}</span>
          {team.length === 0 ? (
            <p className="rounded-sm bg-muted-wash px-comfortable py-comfortable text-[0.8125rem] text-muted">
              {t("noGuides")}
            </p>
          ) : (
            <div className="flex flex-wrap gap-inline">
              {team.map((m) => (
                <button key={m.id} type="button" aria-pressed={value.guideIds.includes(m.id)} onClick={() => toggleGuide(m.id)} className={`min-h-11 rounded-full bg-muted-wash px-comfortable py-tight text-[0.8125rem] md:min-h-9 ${value.guideIds.includes(m.id) ? "font-medium text-fg ring-2 ring-inset ring-ember" : "text-muted hover:text-fg"}`}>
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Live preview — the most important element. */}
      {isSlotBased(bookingType) && (
        <div className="rounded-sm bg-muted-wash p-section">
          <p className="text-[0.8125rem] font-medium text-muted">{t("preview")}</p>
          <p className="mt-inline text-[13px] tabular-nums">
            {slots.slice(0, 6).map((s) => formatClock(s)).join(" · ")}{slots.length > 6 ? ` … ${formatClock(slots[slots.length - 1])}` : ""}
          </p>
          <p className="mt-tight text-[13px] text-muted">
            {t.rich("capacityWeek", {
              perDay: slots.length,
              perWeek: slots.length * openCount,
              visitors: (slots.length * openCount * value.capacityPerSession).toLocaleString(),
              b: (c) => <span className="font-medium text-fg">{c}</span>,
            })}
          </p>
          {overrideSummary && <p className="mt-tight text-[12px] tabular-nums text-muted">{t("except", { days: overrideSummary })}</p>}
        </div>
      )}
      {isDailyCapped(bookingType) && (
        <div className="rounded-sm bg-muted-wash p-section text-[0.8125rem] text-muted">
          {t.rich("capacityDay", { visitors: (value.dailyCapacity ?? 0).toLocaleString(), days: openCount, b: (c) => <span className="font-medium text-fg">{c}</span> })}
        </div>
      )}

      {/* Days it is closed */}
      <div className="flex flex-col gap-tight">
        <span className="text-[0.8125rem] font-medium text-muted">{t("closedDates")}</span>
        {value.exceptions.map((e) => {
          const when = formatDay(e.date, { weekday: true });
          return (
            <div key={e.date} className="flex items-center justify-between rounded-sm bg-muted-wash py-inline pl-comfortable pr-inline text-sm">
              <span className="text-[13px]">{when}</span>
              <span className="flex items-center gap-tight">
                <span className="text-muted">{t("closed")}</span>
                <button
                  type="button"
                  aria-label={t("removeClosed", { date: when })}
                  title={t("removeClosed", { date: when })}
                  onClick={() => removeException(e.date)}
                  className="flex h-11 w-11 items-center justify-center rounded-sm text-muted hover:bg-muted-wash hover:text-danger md:h-9 md:w-9"
                >
                  <X size={16} strokeWidth={1.5} aria-hidden />
                </button>
              </span>
            </div>
          );
        })}
        <div className="flex gap-tight">
          <DateField value={exDate} today={DEMO_TODAY} onChange={setExDate} labels={{ previousMonth: t("previousMonth"), nextMonth: t("nextMonth"), today: t("today"), open: t("chooseDate") }} className="flex-1" />
          <button type="button" onClick={addException} className="flex h-11 items-center gap-inline rounded-sm border border-line px-comfortable text-sm hover:border-inverse md:h-10">
            <Plus size={16} strokeWidth={1.5} aria-hidden /> {t("addClosed")}
          </button>
        </div>
      </div>
    </div>
  );
}
