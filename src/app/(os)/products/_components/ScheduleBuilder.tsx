"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { FormField } from "@/components/ui";
import type { BookingTypeCode, ProductSchedule, Staff } from "@/lib/api";
import {
  DAY_LABELS,
  isDailyCapped,
  isGuided,
  isSlotBased,
  slotTimes,
} from "@/lib/schedule";

const SLOT_INTERVALS = [15, 30, 45, 60];
const SESSION_LENGTHS = [30, 45, 60, 90, 120];

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

  const slots = isSlotBased(bookingType) ? slotTimes(value) : [];
  const openCount = value.openDays.length;

  return (
    <div className="flex flex-col gap-section">
      {isSlotBased(bookingType) && (
        <div className="grid gap-section sm:grid-cols-2">
          <FormField label="Sessions every" variant="select" value={String(value.slotMinutes)} onChange={(e) => set("slotMinutes", parseInt(e.target.value, 10))} options={SLOT_INTERVALS.map((n) => ({ value: String(n), label: `${n} min` }))} />
          <FormField label="Each session lasts" variant="select" value={String(value.sessionMinutes)} onChange={(e) => set("sessionMinutes", parseInt(e.target.value, 10))} options={SESSION_LENGTHS.map((n) => ({ value: String(n), label: `${n} min` }))} />
          <FormField label="First session" variant="text" value={value.startTime} onChange={(e) => set("startTime", e.target.value)} help="HH:MM" />
          <FormField label="Last session" variant="text" value={value.endTime} onChange={(e) => set("endTime", e.target.value)} help="HH:MM" />
          <FormField label="Each session holds" variant="number" value={String(value.capacityPerSession)} onChange={(e) => set("capacityPerSession", parseInt(e.target.value, 10) || 0)} />
        </div>
      )}

      {isDailyCapped(bookingType) && (
        <FormField label="Visitors per day" variant="number" value={String(value.dailyCapacity ?? 0)} onChange={(e) => set("dailyCapacity", parseInt(e.target.value, 10) || 0)} className="max-w-xs" help="Once full, that date stops selling." />
      )}

      <div className="flex flex-col gap-tight">
        <span className="type-label text-[12px] text-neutral-600">Open days</span>
        <div className="flex gap-inline">
          {DAY_LABELS.map((label, d) => (
            <button key={d} type="button" onClick={() => toggleDay(d)} className={`h-10 w-10 rounded-sm border text-[13px] ${value.openDays.includes(d) ? "border-ink bg-ink text-paper" : "border-neutral-200 bg-white text-neutral-600"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {isGuided(bookingType) && (
        <div className="flex flex-col gap-tight">
          <span className="type-label text-[12px] text-neutral-600">Who can lead this?</span>
          {team.length === 0 ? (
            <p className="rounded-sm border border-dashed border-neutral-200 px-comfortable py-comfortable text-[13px] text-neutral-400">
              No team members yet — add your first guide from the Team screen.
            </p>
          ) : (
            <div className="flex flex-wrap gap-inline">
              {team.map((m) => (
                <button key={m.id} type="button" onClick={() => toggleGuide(m.id)} className={`rounded-sm border px-comfortable py-tight text-[13px] ${value.guideIds.includes(m.id) ? "border-ember bg-ember/10 text-ember" : "border-neutral-200 text-neutral-600"}`}>
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Live preview — the most important element. */}
      {isSlotBased(bookingType) && (
        <div className="rounded-sm border border-ink bg-white p-section">
          <p className="type-label text-[11px] text-neutral-400">Preview</p>
          <p className="mt-inline font-mono text-[13px]">
            {slots.slice(0, 6).join(" · ")}{slots.length > 6 ? ` … ${slots[slots.length - 1]}` : ""}
          </p>
          <p className="mt-tight text-[13px] text-neutral-600">
            {slots.length} sessions/day · {slots.length * openCount}/week · up to{" "}
            <span className="font-medium text-ink">{(slots.length * openCount * value.capacityPerSession).toLocaleString()}</span> visitors/week
          </p>
        </div>
      )}
      {isDailyCapped(bookingType) && (
        <div className="rounded-sm border border-ink bg-white p-section text-[13px] text-neutral-600">
          Up to <span className="font-medium text-ink">{(value.dailyCapacity ?? 0).toLocaleString()}</span> visitors/day, {openCount} days a week.
        </div>
      )}

      {/* Exceptions */}
      <div className="flex flex-col gap-tight">
        <span className="type-label text-[12px] text-neutral-600">Closed & special dates</span>
        {value.exceptions.map((e) => (
          <div key={e.date} className="flex items-center justify-between rounded-sm border border-neutral-200 px-comfortable py-tight text-sm">
            <span className="font-mono text-[13px]">{e.date}</span>
            <span className="flex items-center gap-section">
              <span className="text-neutral-400">Closed</span>
              <button type="button" aria-label="Remove" onClick={() => removeException(e.date)} className="text-neutral-400 hover:text-danger"><X size={16} strokeWidth={1.5} /></button>
            </span>
          </div>
        ))}
        <div className="flex gap-tight">
          <input type="date" value={exDate} onChange={(e) => setExDate(e.target.value)} className="h-10 flex-1 rounded-sm border border-neutral-200 px-comfortable text-sm outline-none focus:border-ink" />
          <button type="button" onClick={addException} className="flex h-10 items-center gap-inline rounded-sm border border-neutral-200 px-comfortable text-sm hover:border-ink">
            <Plus size={16} strokeWidth={1.5} /> Add closed date
          </button>
        </div>
      </div>
    </div>
  );
}
