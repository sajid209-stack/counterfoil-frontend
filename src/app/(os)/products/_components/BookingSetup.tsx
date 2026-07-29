"use client";

import { useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { Button, FormField } from "@/components/ui";
import type { BookingTypeCode, Product, Resource, Staff } from "@/lib/api";

/* Plain questions → the BT code is DERIVED, never shown. Covers all 14 types. */

export interface BookingSetupResult {
  bookingType: BookingTypeCode;
  summary: string;
  validityDays?: number;
  resource?: { resourceIds: string[]; exclusive: boolean; bufferMinutes: number; flexibleDurations?: number[] };
  provider?: { providerIds: string[]; noun: string; pickable: boolean; durationMinutes: number };
  course?: { dates: string[]; capacity: number };
  bundle?: { componentIds: string[] };
  credits?: { count: number; expiryDays: number; productIds: string[] };
}

const NOUNS = ["Field", "Court", "Lane", "Room", "Table", "Studio", "Bay"];
const PROVIDER_NOUNS = ["Therapist", "Instructor", "Stylist", "Coach", "Guide", "Trainer"];

function Option({ title, helper, onClick }: { title: string; helper: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full flex-col items-start gap-inline rounded-sm border border-neutral-200 bg-white p-section text-left transition-colors hover:border-ink">
      <span className="text-sm font-medium">{title}</span>
      <span className="text-[13px] text-neutral-400">{helper}</span>
    </button>
  );
}

type Step = "q1" | "q2" | "q3" | "resource" | "provider" | "course" | "bundle" | "credits";

export function BookingSetup({
  value,
  onChange,
  resources = [],
  team = [],
  products = [],
  onCreateResource,
}: {
  value: BookingSetupResult | null;
  onChange: (result: BookingSetupResult | null) => void;
  resources?: Resource[];
  team?: Staff[];
  products?: Product[];
  onCreateResource?: (name: string, noun: string) => Promise<Resource | null>;
}) {
  const [step, setStep] = useState<Step>("q1");
  // resource
  const [picked, setPicked] = useState<string[]>([]);
  const [fixed, setFixed] = useState(true);
  const [exclusive, setExclusive] = useState(true);
  const [buffer, setBuffer] = useState("0");
  const [newName, setNewName] = useState("");
  const [newNoun, setNewNoun] = useState(resources[0]?.nounSingular ?? "Field");
  const [adding, setAdding] = useState(false);
  // provider
  const [provNoun, setProvNoun] = useState("Therapist");
  const [provIds, setProvIds] = useState<string[]>([]);
  const [provDuration, setProvDuration] = useState("60");
  const [provPickable, setProvPickable] = useState(true);
  // course
  const [courseDates, setCourseDates] = useState<string[]>([]);
  const [courseDate, setCourseDate] = useState("");
  const [courseCap, setCourseCap] = useState("12");
  // bundle / credits
  const [bundleIds, setBundleIds] = useState<string[]>([]);
  const [creditIds, setCreditIds] = useState<string[]>([]);
  const [creditCount, setCreditCount] = useState("10");
  const [creditExpiry, setCreditExpiry] = useState("90");

  const finish = (bookingType: BookingTypeCode, summary: string, validityDays?: number) => onChange({ bookingType, summary, validityDays });

  if (value) {
    return (
      <div className="rounded-md border border-neutral-200 bg-white p-major">
        <div className="flex items-start justify-between gap-section">
          <p className="type-body text-sm">{value.summary}</p>
          <button type="button" onClick={() => { setStep("q1"); onChange(null); }} className="flex shrink-0 items-center gap-inline text-[13px] text-ember hover:underline">
            <Pencil size={14} strokeWidth={1.5} /> Change
          </button>
        </div>
      </div>
    );
  }

  const noun = resources.find((r) => picked.includes(r.id))?.nounSingular ?? newNoun;
  const toggle = (arr: string[], id: string) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  const finishResource = () => {
    const bookingType: BookingTypeCode = fixed && exclusive ? "BT-04" : "BT-05";
    const buf = parseInt(buffer, 10) > 0 ? ` ${buffer} min gap.` : "";
    onChange({ bookingType, summary: `Visitors book a ${noun.toLowerCase()} for ${fixed ? "a fixed slot" : "a start time and duration"}. ${exclusive ? "One at a time" : "Shared"}.${buf} ${picked.length} ${noun}${picked.length === 1 ? "" : "s"}.`, resource: { resourceIds: picked, exclusive, bufferMinutes: parseInt(buffer, 10) || 0, flexibleDurations: fixed ? undefined : [60, 90, 120] } });
  };
  const finishProvider = () => onChange({ bookingType: "BT-10", summary: `Visitors book a ${provNoun.toLowerCase()} for ${provDuration} min${provPickable ? ", chosen by name" : " — first available"}. ${provIds.length} ${provNoun.toLowerCase()}${provIds.length === 1 ? "" : "s"}.`, provider: { providerIds: provIds, noun: provNoun, pickable: provPickable, durationMinutes: parseInt(provDuration, 10) || 60 } });
  const finishCourse = () => onChange({ bookingType: "BT-13", summary: `A course of ${courseDates.length} sessions, ${courseCap} places across the course.`, course: { dates: courseDates, capacity: parseInt(courseCap, 10) || 0 } });
  const finishBundle = () => onChange({ bookingType: "BT-08", summary: `One ticket combining ${bundleIds.length} products.`, bundle: { componentIds: bundleIds } });
  const finishCredits = () => onChange({ bookingType: "BT-12", summary: `A pack of ${creditCount} credits, valid ${creditExpiry} days, spendable on ${creditIds.length} products.`, credits: { count: parseInt(creditCount, 10) || 0, expiryDays: parseInt(creditExpiry, 10) || 0, productIds: creditIds } });

  const addResource = async () => {
    if (!onCreateResource || !newName.trim()) return;
    setAdding(true);
    const created = await onCreateResource(newName, newNoun);
    setAdding(false);
    if (created) { setPicked((p) => [...p, created.id]); setNewName(""); }
  };

  return (
    <div className="flex flex-col gap-tight">
      {step === "q1" && (
        <>
          <p className="type-h2 mb-tight text-base">How do visitors book this?</p>
          <Option title="They just show up — no date needed" helper="Come whenever they like." onClick={() => finish("BT-01", "Visitors can come any time — no date needed.")} />
          <Option title="They pick a date" helper="A day, maybe with a daily limit." onClick={() => setStep("q2")} />
          <Option title="They pick a date and time" helper="A specific time slot." onClick={() => setStep("q3")} />
          <Option title="They book a space or equipment" helper="A field, court, lane, room…" onClick={() => setStep("resource")} />
          <Option title="They book a person" helper="A therapist, instructor, coach…" onClick={() => setStep("provider")} />
          <Option title="They enrol in a course" helper="One signup, many dates." onClick={() => setStep("course")} />
          <Option title="It combines other products" helper="A bundle sold as one ticket." onClick={() => setStep("bundle")} />
          <Option title="It's a pack of credits" helper="Buy now, book later." onClick={() => setStep("credits")} />
        </>
      )}

      {step === "q2" && (
        <>
          <p className="type-h2 mb-tight text-base">Do you limit how many visitors per day?</p>
          <Option title="No limit" helper="Sell as many as you like." onClick={() => finish("BT-02", "Visitors pick a date. No daily limit.", 1)} />
          <Option title="Yes, cap it per day" helper="Once full, that date stops selling." onClick={() => finish("BT-06", "Visitors pick a date, capped per day.")} />
          <BackLink onClick={() => setStep("q1")} />
        </>
      )}

      {step === "q3" && (
        <>
          <p className="type-h2 mb-tight text-base">Is it led by a guide or host?</p>
          <Option title="No — visitors arrive at a set time" helper="A screening or session." onClick={() => finish("BT-03", "Visitors pick a date and time. Runs at set start times.")} />
          <Option title="Yes — a guide runs each departure" helper="Capacity limited by who leads." onClick={() => finish("BT-09", "Visitors pick a date and time. A guide runs each departure.")} />
          <BackLink onClick={() => setStep("q1")} />
        </>
      )}

      {step === "resource" && (
        <div className="flex flex-col gap-section">
          <div>
            <p className="type-h2 mb-tight text-base">Which {noun.toLowerCase()}s can they book?</p>
            <div className="flex flex-col gap-tight">
              {resources.map((r) => (
                <label key={r.id} className="flex cursor-pointer items-center gap-tight text-sm">
                  <input type="checkbox" checked={picked.includes(r.id)} onChange={() => setPicked((p) => toggle(p, r.id))} className="h-4 w-4 accent-ember" />
                  {r.name} <span className="text-[12px] text-neutral-400">({r.nounSingular})</span>
                </label>
              ))}
              {onCreateResource && (
                <div className="flex flex-wrap items-end gap-tight rounded-sm border border-dashed border-neutral-200 p-comfortable">
                  <FormField label="Add one" placeholder="Field 1" value={newName} onChange={(e) => setNewName(e.target.value)} />
                  <FormField label="Type" variant="select" value={newNoun} onChange={(e) => setNewNoun(e.target.value)} options={NOUNS.map((n) => ({ value: n, label: n }))} />
                  <Button size="sm" variant="secondary" icon={<Plus size={14} strokeWidth={1.5} />} loading={adding} onClick={addResource}>Add</Button>
                </div>
              )}
            </div>
          </div>
          <Radio label="How is time booked?" value={fixed ? "fixed" : "flex"} onChange={(v) => setFixed(v === "fixed")} options={[{ value: "fixed", label: "Fixed slots", helper: "Set start times." }, { value: "flex", label: "Flexible", helper: "Start time + duration." }]} />
          <Radio label={`One booking at a time per ${noun.toLowerCase()}?`} value={exclusive ? "yes" : "no"} onChange={(v) => setExclusive(v === "yes")} options={[{ value: "yes", label: "Yes — exclusive", helper: "The turf case." }, { value: "no", label: "No — shared", helper: "Several at once." }]} />
          <FormField label="Gap between bookings (min)" variant="number" value={buffer} onChange={(e) => setBuffer(e.target.value)} className="max-w-xs" />
          <FlowFooter onBack={() => setStep("q1")} onDone={finishResource} disabled={picked.length === 0} />
        </div>
      )}

      {step === "provider" && (
        <div className="flex flex-col gap-section">
          <FormField label="What do you call them?" variant="select" value={provNoun} onChange={(e) => setProvNoun(e.target.value)} options={PROVIDER_NOUNS.map((n) => ({ value: n, label: n }))} />
          <div className="flex flex-col gap-tight">
            <span className="type-label text-[12px] text-neutral-600">Who?</span>
            {team.length === 0 ? <p className="text-[13px] text-neutral-400">Add team members first, then pick them here.</p> : team.map((m) => (
              <label key={m.id} className="flex cursor-pointer items-center gap-tight text-sm"><input type="checkbox" checked={provIds.includes(m.id)} onChange={() => setProvIds((p) => toggle(p, m.id))} className="h-4 w-4 accent-ember" />{m.name}</label>
            ))}
          </div>
          <FormField label="How long does it take? (min)" variant="number" value={provDuration} onChange={(e) => setProvDuration(e.target.value)} className="max-w-xs" />
          <FormField label="Can visitors pick the person?" variant="toggle" checked={provPickable} onChange={(e) => setProvPickable((e.target as HTMLInputElement).checked)} help="Off = first available." />
          <FlowFooter onBack={() => setStep("q1")} onDone={finishProvider} disabled={provIds.length === 0} />
        </div>
      )}

      {step === "course" && (
        <div className="flex flex-col gap-section">
          <div className="flex flex-col gap-tight">
            <span className="type-label text-[12px] text-neutral-600">Session dates</span>
            {courseDates.map((d) => (
              <div key={d} className="flex items-center justify-between rounded-sm border border-neutral-200 px-comfortable py-tight text-sm"><span className="font-mono text-[13px]">{d}</span><button type="button" onClick={() => setCourseDates((ds) => ds.filter((x) => x !== d))} className="text-neutral-400 hover:text-danger"><X size={16} strokeWidth={1.5} /></button></div>
            ))}
            <div className="flex gap-tight">
              <input type="date" value={courseDate} onChange={(e) => setCourseDate(e.target.value)} className="h-10 flex-1 rounded-sm border border-neutral-200 px-comfortable text-sm" />
              <Button size="sm" variant="secondary" icon={<Plus size={14} strokeWidth={1.5} />} onClick={() => { if (courseDate && !courseDates.includes(courseDate)) { setCourseDates((d) => [...d, courseDate].sort()); setCourseDate(""); } }}>Add date</Button>
            </div>
          </div>
          <FormField label="Places across the whole course" variant="number" value={courseCap} onChange={(e) => setCourseCap(e.target.value)} className="max-w-xs" />
          <FlowFooter onBack={() => setStep("q1")} onDone={finishCourse} disabled={courseDates.length === 0} />
        </div>
      )}

      {step === "bundle" && (
        <div className="flex flex-col gap-section">
          <p className="type-h2 text-base">Which products does it combine?</p>
          <div className="flex flex-col gap-tight">
            {products.map((p) => (<label key={p.id} className="flex cursor-pointer items-center gap-tight text-sm"><input type="checkbox" checked={bundleIds.includes(p.id)} onChange={() => setBundleIds((b) => toggle(b, p.id))} className="h-4 w-4 accent-ember" />{p.name}</label>))}
          </div>
          <FlowFooter onBack={() => setStep("q1")} onDone={finishBundle} disabled={bundleIds.length < 2} />
        </div>
      )}

      {step === "credits" && (
        <div className="flex flex-col gap-section">
          <div className="grid grid-cols-2 gap-section max-w-md">
            <FormField label="Number of credits" variant="number" value={creditCount} onChange={(e) => setCreditCount(e.target.value)} />
            <FormField label="Expiry (days)" variant="number" value={creditExpiry} onChange={(e) => setCreditExpiry(e.target.value)} />
          </div>
          <div className="flex flex-col gap-tight">
            <span className="type-label text-[12px] text-neutral-600">Spendable on</span>
            {products.map((p) => (<label key={p.id} className="flex cursor-pointer items-center gap-tight text-sm"><input type="checkbox" checked={creditIds.includes(p.id)} onChange={() => setCreditIds((c) => toggle(c, p.id))} className="h-4 w-4 accent-ember" />{p.name}</label>))}
          </div>
          <FlowFooter onBack={() => setStep("q1")} onDone={finishCredits} disabled={creditIds.length === 0} />
        </div>
      )}
    </div>
  );
}

function Radio({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string; helper: string }[] }) {
  return (
    <div className="flex flex-col gap-tight">
      <span className="type-label text-[12px] text-neutral-600">{label}</span>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} className={`flex flex-col items-start rounded-sm border p-comfortable text-left ${value === o.value ? "border-ink" : "border-neutral-200"}`}>
          <span className="text-sm font-medium">{o.label}</span>
          <span className="text-[12px] text-neutral-400">{o.helper}</span>
        </button>
      ))}
    </div>
  );
}

function FlowFooter({ onBack, onDone, disabled }: { onBack: () => void; onDone: () => void; disabled: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <BackLink onClick={onBack} />
      <Button disabled={disabled} onClick={onDone}>Done</Button>
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} className="self-start text-[13px] text-neutral-400 hover:text-ink">← Back</button>;
}
