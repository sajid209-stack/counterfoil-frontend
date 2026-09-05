"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { DurationInput, FormField, TimeInput } from "@/components/ui";
import type { BookingTypeCode, DayHours, ProductSchedule, Staff } from "@/lib/api";
import {
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
          <DurationInput label="Sessions every" value={value.slotMinutes} min={5} onChange={(n) => set("slotMinutes", n)} chips={DURATION_CHIPS} help='Type anything — "45", "1:30", "1h15" all work.' />
          <DurationInput label="Each session lasts" value={value.sessionMinutes} min={5} onChange={(n) => set("sessionMinutes", n)} chips={DURATION_CHIPS} />
          <TimeInput label="First session" value={value.startTime} onChange={(t) => set("startTime", t)} help='Type "930", "1830" or "6:30p".' />
          <TimeInput label="Last session" value={value.endTime} onChange={(t) => set("endTime", t)} />
          <FormField label="Each session holds" variant="number" value={String(value.capacityPerSession)} onChange={(e) => set("capacityPerSession", parseInt(e.target.value, 10) || 0)} />
        </div>
      )}

      {isDailyCapped(bookingType) && (
        <FormField label="Visitors per day" variant="number" value={String(value.dailyCapacity ?? 0)} onChange={(e) => set("dailyCapacity", parseInt(e.target.value, 10) || 0)} className="max-w-xs" help="Once full, that date stops selling." />
      )}

      <div className="flex flex-col gap-tight">
        <span className="type-label text-[12px] text-muted">Open days</span>
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
          <span className="type-label text-[12px] text-muted">Different hours on some days</span>
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
                <span className="text-faint">–</span>
                <TimeInput value={hrs.endTime} onChange={(t) => setOverride(d, { ...hrs, endTime: t })} className="w-32" />
                <button type="button" aria-label="Remove override" onClick={() => setOverride(d, null)} className="text-faint hover:text-danger"><X size={16} strokeWidth={1.5} /></button>
              </div>
            );
          })}
          {value.openDays.some((x) => !(x in overrides)) && (
            <button type="button" onClick={addOverride} className="flex h-10 w-fit items-center gap-inline rounded-sm border border-line px-comfortable text-sm hover:border-inverse">
              <Plus size={16} strokeWidth={1.5} /> Add day override
            </button>
          )}
        </div>
      )}

      {isGuided(bookingType) && (
        <div className="flex flex-col gap-tight">
          <span className="type-label text-[12px] text-muted">Who can lead this?</span>
          {team.length === 0 ? (
            <p className="rounded-sm border border-dashed border-line px-comfortable py-comfortable text-[13px] text-faint">
              No team members yet — add your first guide from the Team screen.
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
          <p className="type-label text-[12px] text-faint">Preview</p>
          <p className="mt-inline font-mono text-[13px]">
            {slots.slice(0, 6).join(" · ")}{slots.length > 6 ? ` … ${slots[slots.length - 1]}` : ""}
          </p>
          <p className="mt-tight text-[13px] text-muted">
            {slots.length} sessions/day · {slots.length * openCount}/week · up to{" "}
            <span className="font-medium text-fg">{(slots.length * openCount * value.capacityPerSession).toLocaleString()}</span> visitors/week
          </p>
          {overrideSummary && <p className="mt-tight font-mono text-[12px] text-muted">Except {overrideSummary}</p>}
        </div>
      )}
      {isDailyCapped(bookingType) && (
        <div className="rounded-sm border border-inverse bg-card p-section text-[13px] text-muted">
          Up to <span className="font-medium text-fg">{(value.dailyCapacity ?? 0).toLocaleString()}</span> visitors/day, {openCount} days a week.
        </div>
      )}

      {/* Exceptions */}
      <div className="flex flex-col gap-tight">
        <span className="type-label text-[12px] text-muted">Closed & special dates</span>
        {value.exceptions.map((e) => (
          <div key={e.date} className="flex items-center justify-between rounded-sm border border-line px-comfortable py-tight text-sm">
            <span className="font-mono text-[13px]">{e.date}</span>
            <span className="flex items-center gap-section">
              <span className="text-faint">Closed</span>
              <button type="button" aria-label="Remove" onClick={() => removeException(e.date)} className="text-faint hover:text-danger"><X size={16} strokeWidth={1.5} /></button>
            </span>
          </div>
        ))}
        <div className="flex gap-tight">
          <input type="date" value={exDate} onChange={(e) => setExDate(e.target.value)} className="h-10 flex-1 rounded-sm border border-line px-comfortable text-sm outline-none focus:border-inverse" />
          <button type="button" onClick={addException} className="flex h-10 items-center gap-inline rounded-sm border border-line px-comfortable text-sm hover:border-inverse">
            <Plus size={16} strokeWidth={1.5} /> Add closed date
          </button>
        </div>
      </div>
    </div>
  );
}
