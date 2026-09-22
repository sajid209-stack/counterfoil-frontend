"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Pencil, Plus, X } from "lucide-react";
import { Button, DateField, DurationInput, FormField } from "@/components/ui";
import { DEMO_TODAY } from "@/lib/schedule";
import { formatDay } from "@/lib/format";
import { formatDuration } from "@/lib/duration";
import type { BookingTypeCode, Product, Resource, Staff } from "@/lib/api";

/* Plain questions → the BT code is DERIVED, never shown. Covers all 14 types. */

export interface BookingSetupResult {
  bookingType: BookingTypeCode;
  summary: string;
  validityDays?: number;
  resource?: {
    resourceIds: string[]; exclusive: boolean; bufferMinutes: number; flexibleDurations?: number[];
    /** Flexible only — the duration-engine core; the editor holds the rest. */
    durationCore?: { minMinutes: number; maxMinutes: number; incrementMinutes: number };
    basis?: "per_booking" | "per_person";
  };
  provider?: { providerIds: string[]; noun: string; pickable: boolean; durationMinutes: number };
  course?: { dates: string[]; capacity: number };
  bundle?: { componentIds: string[] };
  credits?: { count: number; expiryDays: number; productIds: string[] };
}

const NOUNS = ["Field", "Court", "Lane", "Room", "Table", "Studio", "Bay"];
const PROVIDER_NOUNS = ["Therapist", "Instructor", "Stylist", "Coach", "Guide", "Trainer"];

/** Where the questions start. `q1` is the whole tree for somebody who is not
 *  sure; the rest are the branch a chooser card already picked. */
export type SetupStart = "q1" | "entry" | "q3" | "resource" | "provider" | "course" | "bundle" | "credits";
type Step = SetupStart | "q2";

function Option({ title, helper, onClick }: { title: string; helper: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full flex-col items-start gap-inline rounded-md border border-line bg-card p-comfortable text-left transition-all duration-quick hover:border-ember/50 hover:shadow-sm active:bg-ember/5">
      <span className="text-sm font-medium">{title}</span>
      <span className="text-[13px] text-muted">{helper}</span>
    </button>
  );
}

export function BookingSetup({
  value,
  onChange,
  resources = [],
  team = [],
  products = [],
  onCreateResource,
  start = "q1",
}: {
  value: BookingSetupResult | null;
  onChange: (result: BookingSetupResult | null) => void;
  resources?: Resource[];
  team?: Staff[];
  products?: Product[];
  onCreateResource?: (name: string, noun: string) => Promise<Resource | null>;
  start?: SetupStart;
}) {
  const t = useTranslations("catalog.setup");
  const [step, setStep] = useState<Step>(start);
  // resource — seeded from what the booking already has, so re-opening the
  // flow to change one answer does not silently empty the field list and make
  // the operator re-tick every lane they own.
  const [picked, setPicked] = useState<string[]>(value?.resource?.resourceIds ?? []);
  const [fixed, setFixed] = useState(!value?.resource?.flexibleDurations);
  const [exclusive, setExclusive] = useState(value?.resource?.exclusive ?? true);
  const [basis, setBasis] = useState<"per_booking" | "per_person">(value?.resource?.basis ?? "per_booking");
  const [buffer, setBuffer] = useState(value?.resource?.bufferMinutes ?? 0);
  const [durMin, setDurMin] = useState(60);
  const [durMax, setDurMax] = useState(180);
  const [durInc, setDurInc] = useState(30);
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
  const [doneError, setDoneError] = useState(false);

  const finish = (bookingType: BookingTypeCode, summary: string, validityDays?: number) => onChange({ bookingType, summary, validityDays });
  /** Every branch hangs off the first question, so back is always to it —
   *  and from the branch a chooser card opened on, that is "all the questions",
   *  the way to a different kind without leaving the form. */
  const back = () => setStep("q1");

  if (value) {
    return (
      <div className="rounded-md border border-line bg-card p-comfortable">
        <div className="flex items-start justify-between gap-section">
          <p className="text-sm">{value.summary}</p>
          <button type="button" onClick={() => { setStep(start); onChange(null); }} className="-my-tight flex min-h-11 shrink-0 items-center gap-inline rounded-sm px-tight text-[13px] font-medium text-brand-foreground hover:bg-muted-wash md:min-h-9">
            <Pencil size={14} strokeWidth={1.5} /> {t("change")}
          </button>
        </div>
      </div>
    );
  }

  const noun = resources.find((r) => picked.includes(r.id))?.nounSingular ?? newNoun;
  const toggle = (arr: string[], id: string) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  const finishResource = () => {
    const bookingType: BookingTypeCode = fixed && exclusive ? "BT-04" : "BT-05";
    const flexOptions: number[] = [];
    if (!fixed) for (let d = durMin; d <= durMax; d += durInc) flexOptions.push(d);
    const timing = fixed
      ? t("summary.fixedSlot")
      : t("summary.flexRange", { min: formatDuration(durMin), max: formatDuration(durMax), step: formatDuration(durInc) });
    const summary = [
      t("summary.resource", { noun: noun.toLowerCase(), timing, count: picked.length }),
      t(exclusive ? "summary.exclusive" : "summary.shared"),
      buffer > 0 ? t("summary.gap", { gap: formatDuration(buffer) }) : "",
    ].filter(Boolean).join(" ");
    onChange({
      bookingType,
      summary,
      resource: {
        resourceIds: picked, exclusive, bufferMinutes: buffer,
        flexibleDurations: fixed ? undefined : flexOptions,
        durationCore: fixed ? undefined : { minMinutes: durMin, maxMinutes: durMax, incrementMinutes: durInc },
        basis,
      },
    });
  };
  const finishProvider = () => {
    const minutes = parseInt(provDuration, 10) || 60;
    onChange({
      bookingType: "BT-10",
      summary: t("summary.provider", { noun: provNoun.toLowerCase(), duration: formatDuration(minutes), pick: provPickable ? "name" : "first", count: provIds.length }),
      provider: { providerIds: provIds, noun: provNoun, pickable: provPickable, durationMinutes: minutes },
    });
  };
  const finishCourse = () => onChange({ bookingType: "BT-13", summary: t("summary.course", { count: courseDates.length, places: courseCap }), course: { dates: courseDates, capacity: parseInt(courseCap, 10) || 0 } });
  const finishBundle = () => onChange({ bookingType: "BT-08", summary: t("summary.bundle", { count: bundleIds.length }), bundle: { componentIds: bundleIds } });
  const finishCredits = () => onChange({ bookingType: "BT-12", summary: t("summary.credits", { count: creditCount, days: creditExpiry, products: creditIds.length }), credits: { count: parseInt(creditCount, 10) || 0, expiryDays: parseInt(creditExpiry, 10) || 0, productIds: creditIds } });

  const addResource = async () => {
    if (!onCreateResource || !newName.trim()) return;
    setAdding(true);
    const created = await onCreateResource(newName, newNoun);
    setAdding(false);
    if (created) { setPicked((p) => [...p, created.id]); setNewName(""); }
  };

  const head = (text: string) => <div className="mb-inline"><Question>{text}</Question></div>;
  const backLink = () =>
    step === "q1" ? null : (
      <button type="button" onClick={back} className="flex min-h-11 items-center gap-inline self-start text-[13px] text-muted hover:text-fg md:min-h-0">
        <ArrowLeft size={14} strokeWidth={1.5} /> {t(start === step ? "allQuestions" : "back")}
      </button>
    );
  /* Done is never greyed out. Pressed with an answer missing, it says which
     one, beside the button — a disabled button that will not say why is the
     commonest dead end in a form. */
  const footer = (onDone: () => void, missing: string | null) => (
    <div className="flex flex-col gap-tight">
      {doneError && missing && (
        <p role="alert" className="text-[13px] font-medium text-danger">{missing}</p>
      )}
      <div className="flex items-center justify-between">
        {backLink()}
        <Button
          onClick={() => {
            if (missing) return setDoneError(true);
            setDoneError(false);
            onDone();
          }}
        >
          {t("done")}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-tight">
      {step === "q1" && (
        <>
          {head(t("q1.title"))}
          <Option title={t("q1.showUp.title")} helper={t("q1.showUp.helper")} onClick={() => finish("BT-01", t("summary.showUp"))} />
          <Option title={t("q1.pickDate.title")} helper={t("q1.pickDate.helper")} onClick={() => setStep("q2")} />
          <Option title={t("q1.pickTime.title")} helper={t("q1.pickTime.helper")} onClick={() => setStep("q3")} />
          <Option title={t("q1.space.title")} helper={t("q1.space.helper")} onClick={() => setStep("resource")} />
          <Option title={t("q1.person.title")} helper={t("q1.person.helper")} onClick={() => setStep("provider")} />
          <Option title={t("q1.course.title")} helper={t("q1.course.helper")} onClick={() => setStep("course")} />
          <Option title={t("q1.bundle.title")} helper={t("q1.bundle.helper")} onClick={() => setStep("bundle")} />
          <Option title={t("q1.credits.title")} helper={t("q1.credits.helper")} onClick={() => setStep("credits")} />
        </>
      )}

      {/* Entry, from its chooser card: whether a date is picked at all, and
          whether a date can fill — the two questions the tree asked in two
          screens, asked in one. */}
      {step === "entry" && (
        <>
          {head(t("entry.title"))}
          <Option title={t("entry.none.title")} helper={t("entry.none.helper")} onClick={() => finish("BT-01", t("summary.showUp"))} />
          <Option title={t("entry.date.title")} helper={t("entry.date.helper")} onClick={() => finish("BT-02", t("summary.dateNoLimit"), 1)} />
          <Option title={t("entry.capped.title")} helper={t("entry.capped.helper")} onClick={() => finish("BT-06", t("summary.dateCapped"))} />
          {backLink()}
        </>
      )}

      {step === "q2" && (
        <>
          {head(t("q2.title"))}
          <Option title={t("q2.noLimit.title")} helper={t("q2.noLimit.helper")} onClick={() => finish("BT-02", t("summary.dateNoLimit"), 1)} />
          <Option title={t("q2.cap.title")} helper={t("q2.cap.helper")} onClick={() => finish("BT-06", t("summary.dateCapped"))} />
          {backLink()}
        </>
      )}

      {step === "q3" && (
        <>
          {head(t("q3.title"))}
          <Option title={t("q3.fixed.title")} helper={t("q3.fixed.helper")} onClick={() => finish("BT-03", t("summary.timed"))} />
          <Option title={t("q3.guided.title")} helper={t("q3.guided.helper")} onClick={() => finish("BT-09", t("summary.guided"))} />
          {backLink()}
        </>
      )}

      {step === "resource" && (
        <div className="flex flex-col gap-section">
          <div>
            {head(t("resource.which"))}
            <div className="flex flex-col gap-tight">
              {resources.map((r) => (
                <label key={r.id} className="flex min-h-9 cursor-pointer items-center gap-tight text-sm">
                  <input type="checkbox" checked={picked.includes(r.id)} onChange={() => setPicked((p) => toggle(p, r.id))} className="h-4 w-4 accent-ember" />
                  {r.name} <span className="text-[12px] text-muted">({r.nounSingular})</span>
                </label>
              ))}
              {onCreateResource && (
                <div className="flex flex-wrap items-end gap-tight rounded-sm border border-dashed border-line p-comfortable">
                  <FormField label={t("resource.addOne")} placeholder={t("resource.addPlaceholder", { noun: newNoun })} value={newName} onChange={(e) => setNewName(e.target.value)} />
                  <FormField label={t("resource.type")} variant="select" value={newNoun} onChange={(e) => setNewNoun(e.target.value)} options={NOUNS.map((n) => ({ value: n, label: n }))} />
                  <Button size="sm" variant="secondary" icon={<Plus size={14} strokeWidth={1.5} />} loading={adding} onClick={addResource}>{t("resource.add")}</Button>
                </div>
              )}
            </div>
          </div>
          <Radio label={t("resource.timeTitle")} value={fixed ? "fixed" : "flex"} onChange={(v) => setFixed(v === "fixed")} options={[{ value: "fixed", label: t("resource.fixed.title"), helper: t("resource.fixed.helper") }, { value: "flex", label: t("resource.flex.title"), helper: t("resource.flex.helper") }]} />
          {!fixed && (
            <div className="grid gap-section sm:grid-cols-3">
              <DurationInput label={t("resource.shortest")} value={durMin} min={5} onChange={setDurMin} chips={[30, 60]} />
              <DurationInput label={t("resource.longest")} value={durMax} min={5} onChange={setDurMax} chips={[120, 180]} />
              <DurationInput label={t("resource.steps")} value={durInc} min={5} step={5} onChange={setDurInc} chips={[15, 30, 60]} help={t("resource.stepsHelp")} />
            </div>
          )}
          <Radio label={t("resource.exclusiveTitle")} value={exclusive ? "yes" : "no"} onChange={(v) => setExclusive(v === "yes")} options={[{ value: "yes", label: t("resource.exclusive.title"), helper: t("resource.exclusive.helper") }, { value: "no", label: t("resource.shared.title"), helper: t("resource.shared.helper") }]} />
          <Radio label={t("resource.basisTitle")} value={basis} onChange={(v) => setBasis(v as "per_booking" | "per_person")} options={[{ value: "per_booking", label: t("resource.perBooking.title"), helper: t("resource.perBooking.helper") }, { value: "per_person", label: t("resource.perPerson.title"), helper: t("resource.perPerson.helper") }]} />
          <DurationInput label={t("resource.gap")} value={buffer} onChange={setBuffer} chips={[0, 10, 15, 30]} className="max-w-xs" />
          {footer(finishResource, picked.length === 0 ? t("missing.resource") : null)}
        </div>
      )}

      {step === "provider" && (
        <div className="flex flex-col gap-section">
          <FormField label={t("provider.callThem")} variant="select" value={provNoun} onChange={(e) => setProvNoun(e.target.value)} options={PROVIDER_NOUNS.map((n) => ({ value: n, label: n }))} />
          <div className="flex flex-col gap-tight">
            <Question>{t("provider.who")}</Question>
            {team.length === 0 ? <p className="text-[13px] text-muted">{t("provider.noTeam")}</p> : team.map((m) => (
              <label key={m.id} className="flex min-h-9 cursor-pointer items-center gap-tight text-sm"><input type="checkbox" checked={provIds.includes(m.id)} onChange={() => setProvIds((p) => toggle(p, m.id))} className="h-4 w-4 accent-ember" />{m.name}</label>
            ))}
          </div>
          <DurationInput label={t("provider.howLong")} value={parseInt(provDuration, 10) || 60} min={5} onChange={(n) => setProvDuration(String(n))} chips={[30, 45, 60, 90]} className="max-w-xs" />
          <FormField label={t("provider.pickable")} variant="toggle" checked={provPickable} onChange={(e) => setProvPickable((e.target as HTMLInputElement).checked)} help={t("provider.pickableHelp")} />
          {footer(finishProvider, provIds.length === 0 ? t("missing.provider") : null)}
        </div>
      )}

      {step === "course" && (
        <div className="flex flex-col gap-section">
          <div className="flex flex-col gap-tight">
            <Question>{t("course.dates")}</Question>
            {courseDates.map((d) => (
              <div key={d} className="flex items-center justify-between rounded-sm border border-line px-comfortable py-tight text-sm"><span className="text-[13px]">{formatDay(d, { weekday: true })}</span><button type="button" aria-label={t("course.remove")} onClick={() => setCourseDates((ds) => ds.filter((x) => x !== d))} className="text-muted hover:text-danger"><X size={16} strokeWidth={1.5} /></button></div>
            ))}
            <div className="flex gap-tight">
              <DateField size="form" value={courseDate} today={DEMO_TODAY} onChange={setCourseDate} labels={{ previousMonth: t("previousMonth"), nextMonth: t("nextMonth"), today: t("today"), open: t("chooseDate") }} className="flex-1" />
              <Button size="sm" variant="secondary" icon={<Plus size={14} strokeWidth={1.5} />} onClick={() => { if (courseDate && !courseDates.includes(courseDate)) { setCourseDates((d) => [...d, courseDate].sort()); setCourseDate(""); } }}>{t("course.addDate")}</Button>
            </div>
          </div>
          <FormField label={t("course.places")} variant="number" value={courseCap} onChange={(e) => setCourseCap(e.target.value)} className="max-w-xs" />
          {footer(finishCourse, courseDates.length === 0 ? t("missing.course") : null)}
        </div>
      )}

      {step === "bundle" && (
        <div className="flex flex-col gap-section">
          {head(t("bundle.title"))}
          <p className="-mt-tight text-[13px] text-muted">{t("bundle.help")}</p>
          <div className="flex flex-col gap-tight">
            {products.map((p) => (<label key={p.id} className="flex min-h-9 cursor-pointer items-center gap-tight text-sm"><input type="checkbox" checked={bundleIds.includes(p.id)} onChange={() => setBundleIds((b) => toggle(b, p.id))} className="h-4 w-4 accent-ember" />{p.name}</label>))}
          </div>
          {footer(finishBundle, bundleIds.length < 2 ? t("missing.bundle") : null)}
        </div>
      )}

      {step === "credits" && (
        <div className="flex flex-col gap-section">
          <div className="grid max-w-md grid-cols-1 gap-section sm:grid-cols-2">
            <FormField label={t("credits.count")} variant="number" value={creditCount} onChange={(e) => setCreditCount(e.target.value)} />
            <FormField label={t("credits.expiry")} variant="number" value={creditExpiry} onChange={(e) => setCreditExpiry(e.target.value)} />
          </div>
          <div className="flex flex-col gap-tight">
            <Question>{t("credits.spendable")}</Question>
            {products.map((p) => (<label key={p.id} className="flex min-h-9 cursor-pointer items-center gap-tight text-sm"><input type="checkbox" checked={creditIds.includes(p.id)} onChange={() => setCreditIds((c) => toggle(c, p.id))} className="h-4 w-4 accent-ember" />{p.name}</label>))}
          </div>
          {footer(finishCredits, creditIds.length === 0 ? t("missing.credits") : null)}
        </div>
      )}
    </div>
  );
}

/** A question put to the operator — the same size and weight wherever one is
 *  asked, and in sentence case. */
function Question({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] font-semibold tracking-tight">{children}</p>;
}

function Radio({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string; helper: string }[] }) {
  return (
    <div className="flex flex-col gap-tight">
      <Question>{label}</Question>
      <div className="grid gap-tight sm:grid-cols-2">
        {options.map((o) => {
          const selected = value === o.value;
          return (
            <button key={o.value} type="button" onClick={() => onChange(o.value)} aria-pressed={selected} className={`relative flex flex-col items-start rounded-md border p-comfortable text-left transition-all duration-quick ${selected ? "border-ember bg-ember/5" : "border-line bg-card hover:border-ember/40 hover:shadow-sm"}`}>
              {selected && <span className="absolute right-tight top-tight h-2 w-2 rounded-full bg-ember" aria-hidden />}
              <span className="text-sm font-medium">{o.label}</span>
              <span className="text-[12px] text-muted">{o.helper}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
