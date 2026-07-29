"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button, FormField } from "@/components/ui";
import type { BookingTypeCode, Resource } from "@/lib/api";

/* The booking setup flow. Plain questions → the BT code is DERIVED, never shown.
   Now includes the resource path (space/equipment → BT-04 exclusive / BT-05). */

export interface BookingSetupResult {
  bookingType: BookingTypeCode;
  summary: string;
  validityDays?: number;
  resource?: {
    resourceIds: string[];
    exclusive: boolean;
    bufferMinutes: number;
    flexibleDurations?: number[];
  };
}

type Q1 = "anytime" | "date" | "datetime" | "resource";

const NOUNS = ["Field", "Court", "Lane", "Room", "Table", "Studio", "Bay"];

function Option({ title, helper, onClick }: { title: string; helper: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full flex-col items-start gap-inline rounded-sm border border-neutral-200 bg-white p-section text-left transition-colors hover:border-ink">
      <span className="text-sm font-medium">{title}</span>
      <span className="text-[13px] text-neutral-400">{helper}</span>
    </button>
  );
}

export function BookingSetup({
  value,
  onChange,
  resources = [],
  onCreateResource,
}: {
  value: BookingSetupResult | null;
  onChange: (result: BookingSetupResult | null) => void;
  resources?: Resource[];
  onCreateResource?: (name: string, noun: string) => Promise<Resource | null>;
}) {
  const [step, setStep] = useState<"q1" | "q2" | "q3" | "resource">("q1");

  // resource sub-flow local state
  const [picked, setPicked] = useState<string[]>([]);
  const [fixed, setFixed] = useState(true);
  const [exclusive, setExclusive] = useState(true);
  const [buffer, setBuffer] = useState("0");
  const [durations, setDurations] = useState<number[]>([60, 90, 120]);
  const [newName, setNewName] = useState("");
  const [newNoun, setNewNoun] = useState(resources[0]?.nounSingular ?? "Field");
  const [adding, setAdding] = useState(false);

  const finish = (bookingType: BookingTypeCode, summary: string, validityDays?: number) =>
    onChange({ bookingType, summary, validityDays });

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
  const nounLower = noun.toLowerCase();

  const finishResource = () => {
    const bookingType: BookingTypeCode = fixed && exclusive ? "BT-04" : "BT-05";
    const timeWord = fixed ? "a fixed slot" : "a start time and duration";
    const excl = exclusive ? `One booking per ${nounLower} at a time.` : `Shared — several bookings per ${nounLower}.`;
    const buf = parseInt(buffer, 10) > 0 ? ` ${buffer} min gap between bookings.` : "";
    onChange({
      bookingType,
      summary: `Visitors book a ${nounLower} for ${timeWord}. ${excl}${buf} ${picked.length} ${picked.length === 1 ? noun : noun + "s"}.`,
      resource: {
        resourceIds: picked,
        exclusive,
        bufferMinutes: parseInt(buffer, 10) || 0,
        flexibleDurations: fixed ? undefined : durations,
      },
    });
  };

  const addResource = async () => {
    if (!onCreateResource || !newName.trim()) return;
    setAdding(true);
    const created = await onCreateResource(newName, newNoun);
    setAdding(false);
    if (created) {
      setPicked((p) => [...p, created.id]);
      setNewName("");
    }
  };

  return (
    <div className="flex flex-col gap-tight">
      {step === "q1" && (
        <>
          <p className="type-h2 mb-tight text-base">How do visitors book this?</p>
          <Option title="They just show up — no date needed" helper="Visitors come whenever they like." onClick={() => finish("BT-01", "Visitors can come any time — no date needed.")} />
          <Option title="They pick a date" helper="A day, maybe with a daily limit." onClick={() => setStep("q2")} />
          <Option title="They pick a date and time" helper="A specific time slot." onClick={() => setStep("q3")} />
          <Option title="They book a space or equipment" helper="A field, court, lane, room…" onClick={() => setStep("resource")} />
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
          <Option title="No — visitors arrive at a set time" helper="Like a screening or session." onClick={() => finish("BT-03", "Visitors pick a date and time. Runs at set start times.")} />
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
                  <input type="checkbox" checked={picked.includes(r.id)} onChange={() => setPicked((p) => (p.includes(r.id) ? p.filter((x) => x !== r.id) : [...p, r.id]))} className="h-4 w-4 accent-ember" />
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

          <FieldRadio label="How is time booked?" value={fixed ? "fixed" : "flex"} onChange={(v) => setFixed(v === "fixed")}
            options={[{ value: "fixed", label: "Fixed slots", helper: "Bookings start at set times." }, { value: "flex", label: "Flexible", helper: "They choose a start time and how long." }]} />

          <FieldRadio label={`One booking at a time per ${noun.toLowerCase()}?`} value={exclusive ? "yes" : "no"} onChange={(v) => setExclusive(v === "yes")}
            options={[{ value: "yes", label: "Yes — exclusive", helper: "The turf case: one team per slot." }, { value: "no", label: "No — it holds several", helper: "Shared capacity on the resource." }]} />

          <FormField label="Gap between bookings (minutes)" variant="number" value={buffer} onChange={(e) => setBuffer(e.target.value)} className="max-w-xs" help="For changeover, cleaning, or reset." />

          <div className="flex items-center justify-between">
            <BackLink onClick={() => setStep("q1")} />
            <Button disabled={picked.length === 0} onClick={finishResource}>Done</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldRadio({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string; helper: string }[] }) {
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

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="self-start text-[13px] text-neutral-400 hover:text-ink">← Back</button>
  );
}
