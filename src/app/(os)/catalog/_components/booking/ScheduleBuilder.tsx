"use client";

import { useState } from "react";
import { AlertTriangle, Plus, X } from "lucide-react";
import { formatDuration } from "@/lib/duration";
import { formatDay } from "@/lib/format";
import { useTranslations } from "next-intl";
import { DateField, DurationInput, FormField, TimeInput } from "@/components/ui";
import type { BookingTypeCode, DayHours, ProductSchedule, Staff } from "@/lib/api";
import {
  DEMO_TODAY,
  DAY_LABELS,
  DAY_NAMES,
  isDailyCapped,
  isGuided,
  isSlotBased,
  slotTimes,
} from "@/lib/schedule";

const DURATION_CHIPS = [15, 30, 45, 60, 90, 120];

export function ScheduleBuilder({
  bookingType,
  value,
  onChange,
  team,
}: {
  bookingType: BookingTypeCode;
  value: ProductSchedule;
  onChange: (schedule: ProductSchedule) => void;
  team: Staff[];
}) {
  const t = useTranslations("catalog.fields");
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

  // Per-day hour overrides ("Fri 14:00–23:00 while other days run base hours").
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
    .map(([d, h]) => `${DAY_LABELS[Number(d)]} ${h.startTime}–${h.endTime}`)
    .join(" · ");

  return (
    <div className="flex flex-col gap-section">
      {isSlotBased(bookingType) && (
        <div className="grid gap-section sm:grid-cols-2">
          <DurationInput label={t("every")} value={value.slotMinutes} min={5} onChange={(n) => set("slotMinutes", n)} chips={DURATION_CHIPS} help={t("everyHelp")} />
          <DurationInput label={t("lasts")} value={value.sessionMinutes} min={5} onChange={(n) => set("sessionMinutes", n)} chips={DURATION_CHIPS} />
          <TimeInput label={t("first")} value={value.startTime} onChange={(t) => set("startTime", t)} help={t("firstHelp")} />
          <TimeInput label={t("last")} value={value.endTime} onChange={(t) => set("endTime", t)} />
          <FormField label={t("holds")} variant="number" value={String(value.capacityPerSession)} onChange={(e) => set("capacityPerSession", parseInt(e.target.value, 10) || 0)} />
          {/* Allowed — a rotating group can overlap — but never silent: in one
              room, a 45-minute show every 30 minutes cannot happen. */}
          {value.sessionMinutes > value.slotMinutes && (
            <p className="flex items-start gap-tight rounded-sm bg-warning-wash px-comfortable py-tight text-[13px] text-fg sm:col-span-2">
              <AlertTriangle size={14} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0 text-warning" />
              {t("overlap", { lasts: formatDuration(value.sessionMinutes), every: formatDuration(value.slotMinutes) })}
            </p>
          )}
        </div>
      )}

      {isDailyCapped(bookingType) && (
        <FormField label={t("perDay")} variant="number" value={String(value.dailyCapacity ?? 0)} onChange={(e) => set("dailyCapacity", parseInt(e.target.value, 10) || 0)} className="max-w-xs" help={t("perDayHelp")} />
      )}

      <div className="flex flex-col gap-tight">
        <span className="type-label text-[12px] text-muted">{t("openDays")}</span>
        <div className="flex gap-inline">
          {DAY_LABELS.map((label, d) => (
            <button key={d} type="button" onClick={() => toggleDay(d)} className={`h-10 w-10 rounded-sm border text-[13px] ${value.openDays.includes(d) ? "border-inverse bg-inverse text-inverse-fg" : "border-line bg-card text-muted"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {isSlotBased(bookingType) && (
        <div className="flex flex-col gap-tight">
          <span className="type-label text-[12px] text-muted">{t("overrides")}</span>
          {Object.entries(overrides).map(([dStr, hrs]) => {
            const d = Number(dStr);
            return (
              <div key={d} className="flex items-center gap-tight">
                <select value={d} onChange={(e) => moveOverride(d, Number(e.target.value))} className="h-11 md:h-10 rounded-sm border border-line bg-card px-tight text-sm outline-none focus:border-inverse">
                  {value.openDays.filter((x) => x === d || !(x in overrides)).map((x) => (
                    <option key={x} value={x}>{DAY_NAMES[x]}</option>
                  ))}
                </select>
                <TimeInput value={hrs.startTime} onChange={(t) => setOverride(d, { ...hrs, startTime: t })} className="w-32" />
                <span className="text-muted">–</span>
                <TimeInput value={hrs.endTime} onChange={(t) => setOverride(d, { ...hrs, endTime: t })} className="w-32" />
                <button type="button" aria-label={t("removeOverride")} onClick={() => setOverride(d, null)} className="text-muted hover:text-danger"><X size={16} strokeWidth={1.5} /></button>
              </div>
            );
          })}
          {value.openDays.some((x) => !(x in overrides)) && (
            <button type="button" onClick={addOverride} className="flex h-10 w-fit items-center gap-inline rounded-sm border border-line px-comfortable text-sm hover:border-inverse">
              <Plus size={16} strokeWidth={1.5} /> {t("addOverride")}
            </button>
          )}
        </div>
      )}

      {isGuided(bookingType) && (
        <div className="flex flex-col gap-tight">
          <span className="type-label text-[12px] text-muted">{t("whoLeads")}</span>
          {team.length === 0 ? (
            <p className="rounded-sm border border-dashed border-line px-comfortable py-comfortable text-[13px] text-muted">
              {t("noGuides")}
            </p>
          ) : (
            <div className="flex flex-wrap gap-inline">
              {team.map((m) => (
                <button key={m.id} type="button" onClick={() => toggleGuide(m.id)} className={`rounded-sm border px-comfortable py-tight text-[13px] ${value.guideIds.includes(m.id) ? "border-ember bg-ember/10 text-brand-foreground" : "border-line text-muted"}`}>
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Live preview — the most important element. */}
      {isSlotBased(bookingType) && (
        <div className="rounded-sm border border-inverse bg-card p-section">
          <p className="type-label text-[12px] text-muted">{t("preview")}</p>
          <p className="mt-inline text-[13px] tabular-nums">
            {slots.slice(0, 6).join(" · ")}{slots.length > 6 ? ` … ${slots[slots.length - 1]}` : ""}
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
        <div className="rounded-sm border border-inverse bg-card p-section text-[13px] text-muted">
          {t.rich("capacityDay", { visitors: (value.dailyCapacity ?? 0).toLocaleString(), days: openCount, b: (c) => <span className="font-medium text-fg">{c}</span> })}
        </div>
      )}

      {/* Exceptions */}
      <div className="flex flex-col gap-tight">
        <span className="type-label text-[12px] text-muted">{t("closedDates")}</span>
        {value.exceptions.map((e) => (
          <div key={e.date} className="flex items-center justify-between rounded-sm border border-line px-comfortable py-tight text-sm">
            <span className="text-[13px]">{formatDay(e.date, { weekday: true })}</span>
            <span className="flex items-center gap-section">
              <span className="text-muted">{t("closed")}</span>
              <button type="button" aria-label={t("remove")} onClick={() => removeException(e.date)} className="text-muted hover:text-danger"><X size={16} strokeWidth={1.5} /></button>
            </span>
          </div>
        ))}
        <div className="flex gap-tight">
          <DateField value={exDate} today={DEMO_TODAY} onChange={setExDate} labels={{ previousMonth: t("previousMonth"), nextMonth: t("nextMonth"), today: t("today"), open: t("chooseDate") }} className="flex-1" />
          <button type="button" onClick={addException} className="flex h-10 items-center gap-inline rounded-sm border border-line px-comfortable text-sm hover:border-inverse">
            <Plus size={16} strokeWidth={1.5} /> {t("addClosed")}
          </button>
        </div>
      </div>
    </div>
  );
}
