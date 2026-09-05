"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, Tabs, useToast } from "@/components/ui";
import {
  createResourceRecord,
  updateProduct,
  type BookingTypeCode,
  type Category,
  type Channel,
  type Location,
  type Product,
  type ProductInput,
  type ProductSchedule,
  type Resource,
  type Staff,
} from "@/lib/api";
import { defaultSchedule, isFlexibleResource, isResourceType, needsSchedule, slotTimes } from "@/lib/schedule";
import { defaultDurationConfig, durationOptions } from "@/lib/duration";
import type { DurationConfig } from "@/lib/api";
import { BookingSetup, type BookingSetupResult } from "./BookingSetup";
import { DurationEngineField } from "./DurationEngineField";
import { ScheduleBuilder } from "./ScheduleBuilder";
import { emptyTier, PriceTiersField, type FormTier } from "./PriceTiersField";
import { PricingRulesField, type FormPricingRule } from "./PricingRulesField";
import { PoliciesField } from "./PoliciesField";
import { AddOnsField, type FormAddOn } from "./AddOnsField";
import { ImageUploadField, type FormImage } from "./ImageUploadField";
import { defaultPolicies } from "@/lib/tax";
import type { ProductPolicies, TaxClass } from "@/lib/api";

const majorToMinor = (s: string) => { const n = parseFloat(s); return Number.isFinite(n) ? Math.round(n * 100) : 0; };
const minorToMajor = (m: number) => (m / 100).toFixed(2);
const numOrUndef = (s: string) => { const n = parseInt(s, 10); return Number.isFinite(n) ? n : undefined; };

// Plain-language summary from a stored code — the operator never sees the code.
function bookingSummary(code: BookingTypeCode): string {
  switch (code) {
    case "BT-01": return "Visitors can come any time — no date needed.";
    case "BT-02": return "Visitors pick a date. No daily limit.";
    case "BT-06": return "Visitors pick a date, capped per day. Once full, that date stops selling.";
    case "BT-03": return "Visitors pick a date and time. Runs at set start times.";
    case "BT-09": return "Visitors pick a date and time. A guide runs each departure.";
    case "BT-04": return "Visitors book a space for a fixed slot. One booking at a time.";
    case "BT-05": return "Visitors book a space — shared or flexible duration.";
    default: return "Booking setup configured.";
  }
}

interface FormState {
  name: string;
  description: string;
  categoryId: string;
  booking: BookingSetupResult;
  schedule: ProductSchedule | null;
  active: boolean;
  counter: boolean;
  online: boolean;
  locationIds: string[];
  maxPerOrder: string;
  minAge: string;
  tiers: FormTier[];
  pricingRules: FormPricingRule[];
  waitlist: boolean;
  taxClass: TaxClass;
  policies: ProductPolicies;
  addOns: FormAddOn[];
  images: FormImage[];
  // Per-type configuration (defaults apply; only the relevant ones render).
  durationConfig: DurationConfig | null;
  validityMode: "unlimited" | "days" | "same_day";
  validityDaysStr: string;
  windowMode: "rolling" | "fixed";
  windowStart: string;
  windowEnd: string;
  sessionNames: Record<string, string>;
  minPartyToRun: string;
  meetingPoint: string;
  providerExtras: Record<string, { premium: string; durations: string }>;
  creditsPerBooking: string;
  joinPartway: boolean;
  passIdentifierLabel: string;
}

function fromProduct(p: Product): FormState {
  return {
    name: p.name,
    description: p.description,
    categoryId: p.categoryId ?? "",
    booking: {
      bookingType: p.bookingType,
      summary: bookingSummary(p.bookingType),
      validityDays: p.validityDays,
      resource: isResourceType(p.bookingType)
        ? { resourceIds: p.resourceIds ?? [], exclusive: p.resourceExclusive !== false, bufferMinutes: p.bufferMinutes ?? 0, flexibleDurations: p.flexibleDurations }
        : undefined,
    },
    schedule: p.schedule ?? (needsSchedule(p.bookingType) ? defaultSchedule(p.bookingType) : null),
    active: p.status !== "inactive",
    counter: p.channels.includes("counter"),
    online: p.channels.includes("online"),
    locationIds: p.locationIds,
    maxPerOrder: p.maxPerOrder != null ? String(p.maxPerOrder) : "",
    minAge: p.minAge != null ? String(p.minAge) : "",
    tiers: p.tiers.map((t) => ({ id: t.id, name: t.name, price: minorToMajor(t.price), maxPerOrder: t.maxPerOrder != null ? String(t.maxPerOrder) : "", admits: String(t.admits ?? 1), ageNote: t.ageNote ?? "", donation: !!t.donation, active: t.active })),
    pricingRules: (p.pricingRules ?? []).map((r) => ({ id: r.id, days: r.days, fromTime: r.fromTime, toTime: r.toTime, price: minorToMajor(r.price) })),
    waitlist: !!p.waitlistEnabled,
    taxClass: p.taxClass ?? "standard",
    policies: p.policies ?? defaultPolicies(),
    addOns: (p.addOns ?? []).map((a) => ({ id: a.id, name: a.name, price: minorToMajor(a.price), perPerson: a.perPerson })),
    images: p.images.map((img) => ({ id: img.id, url: img.url, alt: img.alt })),
    durationConfig: p.durationConfig ?? (isFlexibleResource(p.bookingType)
      ? {
          ...defaultDurationConfig(p.tiers[0]?.price ?? 0),
          minMinutes: p.flexibleDurations?.[0] ?? 60,
          maxMinutes: p.flexibleDurations?.at(-1) ?? 180,
          incrementMinutes: p.flexibleDurations && p.flexibleDurations.length > 1 ? p.flexibleDurations[1] - p.flexibleDurations[0] : 30,
        }
      : null),
    validityMode: p.validityMode ?? (p.bookingType === "BT-01" ? "unlimited" : "days"),
    validityDaysStr: p.validityDays != null ? String(p.validityDays) : "",
    windowMode: p.windowMode ?? "rolling",
    windowStart: p.windowStart ?? "",
    windowEnd: p.windowEnd ?? "",
    sessionNames: p.sessionNames ?? {},
    minPartyToRun: p.minPartyToRun != null ? String(p.minPartyToRun) : "",
    meetingPoint: p.meetingPoint ?? "",
    providerExtras: Object.fromEntries((p.providerIds ?? []).map((id) => [id, {
      premium: p.providerPremiums?.[id] != null ? minorToMajor(p.providerPremiums[id]) : "",
      durations: (p.providerDurations?.[id] ?? p.flexibleDurations ?? []).join(", "),
    }])),
    creditsPerBooking: String(p.creditsPerBooking ?? 1),
    joinPartway: !!p.joinPartway,
    passIdentifierLabel: p.passIdentifierLabel ?? "",
  };
}

const TABS = [
  { value: "details", label: "Details" },
  { value: "availability", label: "Availability" },
  { value: "pricing", label: "Pricing" },
  { value: "policies", label: "Policies" },
  { value: "where", label: "Where it's sold" },
  { value: "advanced", label: "Advanced" },
];

export function ProductForm({
  product,
  categories,
  locations,
  team,
  resources: initialResources,
  products = [],
  currency = "BDT",
}: {
  product: Product;
  categories: Category[];
  locations: Location[];
  team: Staff[];
  resources: Resource[];
  products?: Product[];
  currency?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const initial = useMemo(() => fromProduct(product), [product]);
  const [resources, setResources] = useState<Resource[]>(initialResources);

  const onCreateResource = async (name: string, noun: string) => {
    const res = await createResourceRecord({
      name, nounSingular: noun, nounPlural: noun.endsWith("s") ? noun : `${noun}s`,
      locationId: null, outOfService: false, outOfServiceReason: null, status: "active",
    });
    if (res.ok) { setResources((r) => [...r, res.data]); return res.data; }
    return null;
  };
  const [state, setState] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("details");
  // The operator's own noun when they agree on one, so the field is headed
  // "Fields" or "Lanes" rather than the internal word.
  const resourceNoun =
    resources.length && resources.every((r) => r.nounPlural === resources[0].nounPlural)
      ? resources[0].nounPlural
      : "Resources";
  const resourceSingular = resources[0]?.nounSingular ?? "resource";

  const dirty = useMemo(() => JSON.stringify(state) !== JSON.stringify(initial), [state, initial]);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setState((s) => ({ ...s, [k]: v }));
  const toggleLocation = (id: string) =>
    set("locationIds", state.locationIds.includes(id) ? state.locationIds.filter((x) => x !== id) : [...state.locationIds, id]);

  const save = async () => {
    setSaving(true);
    setErrors({});
    const bt = state.booking.bookingType;
    const channels: Channel[] = [];
    if (state.counter) channels.push("counter");
    if (state.online) channels.push("online");
    const input: Partial<ProductInput> = {
      name: state.name,
      description: state.description,
      images: state.images.map(({ id, url, alt }) => ({ id, url, alt })),
      categoryId: state.categoryId || null,
      bookingType: state.booking.bookingType,
      tiers: state.tiers.map((t) => ({ id: t.id, name: t.name, price: majorToMinor(t.price), maxPerOrder: numOrUndef(t.maxPerOrder), admits: parseInt(t.admits, 10) || 1, ageNote: t.ageNote || undefined, donation: t.donation || undefined, active: t.active })),
      locationIds: state.locationIds,
      channels,
      status: state.active ? "active" : "inactive",
      maxPerOrder: numOrUndef(state.maxPerOrder),
      minAge: numOrUndef(state.minAge),
      validityMode: bt === "BT-01" ? state.validityMode : undefined,
      validityDays: bt === "BT-01"
        ? (state.validityMode === "days" ? numOrUndef(state.validityDaysStr) : undefined)
        : bt === "BT-02"
          ? (state.windowMode === "rolling" ? (numOrUndef(state.validityDaysStr) ?? state.booking.validityDays) : undefined)
          : state.booking.validityDays,
      windowMode: bt === "BT-02" ? state.windowMode : undefined,
      windowStart: bt === "BT-02" && state.windowMode === "fixed" ? state.windowStart || undefined : undefined,
      windowEnd: bt === "BT-02" && state.windowMode === "fixed" ? state.windowEnd || undefined : undefined,
      sessionNames: bt === "BT-03" ? state.sessionNames : undefined,
      minPartyToRun: bt === "BT-09" ? numOrUndef(state.minPartyToRun) : undefined,
      meetingPoint: bt === "BT-09" ? state.meetingPoint || undefined : undefined,
      creditsPerBooking: bt === "BT-12" ? (numOrUndef(state.creditsPerBooking) ?? 1) : undefined,
      joinPartway: bt === "BT-13" ? state.joinPartway : undefined,
      passIdentifierLabel: bt === "BT-14" ? state.passIdentifierLabel || undefined : undefined,
      providerPremiums: Object.keys(state.providerExtras).length
        ? Object.fromEntries(Object.entries(state.providerExtras).filter(([, v]) => v.premium !== "").map(([id, v]) => [id, majorToMinor(v.premium)]))
        : product.providerPremiums,
      providerDurations: Object.keys(state.providerExtras).length
        ? Object.fromEntries(Object.entries(state.providerExtras).map(([id, v]) => [id, v.durations.split(/[,\s]+/).map((s) => parseInt(s, 10)).filter((n) => n > 0)]))
        : product.providerDurations,
      schedule: needsSchedule(state.booking.bookingType) ? state.schedule : null,
      resourceIds: state.booking.resource?.resourceIds,
      resourceExclusive: state.booking.resource?.exclusive,
      bufferMinutes: state.booking.resource?.bufferMinutes,
      pricingBasis: state.booking.resource?.basis ?? product.pricingBasis,
      durationConfig: isFlexibleResource(bt) ? state.durationConfig : null,
      flexibleDurations: isFlexibleResource(bt) && state.durationConfig
        ? durationOptions(state.durationConfig)
        : state.booking.resource?.flexibleDurations,
      pricingRules: state.pricingRules.filter((r) => r.price !== "").map((r) => ({ id: r.id ?? `pr_${globalThis.crypto.randomUUID().slice(0, 8)}`, days: r.days, fromTime: r.fromTime, toTime: r.toTime, price: majorToMinor(r.price) })),
      // Preserve the type-specific config unless re-derived via the flow.
      providerIds: state.booking.provider?.providerIds ?? product.providerIds,
      providerNoun: state.booking.provider?.noun ?? product.providerNoun,
      providerPickable: state.booking.provider?.pickable ?? product.providerPickable,
      courseDates: state.booking.course?.dates ?? product.courseDates,
      bundleComponentIds: state.booking.bundle?.componentIds ?? product.bundleComponentIds,
      credits: state.booking.credits ?? product.credits ?? null,
      sections: product.sections,
      waitlistEnabled: state.waitlist,
      taxClass: state.taxClass,
      policies: state.policies,
      addOns: state.addOns.filter((a) => a.name.trim()).map((a) => ({ id: a.id ?? `add_${globalThis.crypto.randomUUID().slice(0, 8)}`, name: a.name, price: majorToMinor(a.price), perPerson: a.perPerson })),
    };
    const res = await updateProduct(product.id, input);
    setSaving(false);
    if (res.ok) {
      toast.success("Changes saved.");
      setState(fromProduct(res.data));
    } else if (res.error.code === "validation" && res.error.fieldErrors) {
      setErrors(res.error.fieldErrors);
      toast.error(res.error.message);
      setTab("pricing");
    } else {
      toast.error(res.error.message);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-section pb-hero">
      <Tabs items={TABS} value={tab} onChange={setTab} />

      <div className="card-surface p-major">
        {tab === "details" && (
          <div className="grid gap-section sm:grid-cols-2">
            <FormField label="Name" required value={state.name} onChange={(e) => set("name", e.target.value)} error={errors.name} className="sm:col-span-2" />
            <FormField label="Description" variant="textarea" value={state.description} onChange={(e) => set("description", e.target.value)} className="sm:col-span-2" />
            <FormField label="Category" variant="select" value={state.categoryId} onChange={(e) => set("categoryId", e.target.value)} options={[{ value: "", label: "Uncategorised" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
            <div className="sm:col-span-2"><ImageUploadField images={state.images} onChange={(images) => set("images", images)} /></div>
          </div>
        )}

        {tab === "availability" && (
          <div className="flex flex-col gap-section">
            <div>
              <p className="type-label mb-tight text-[12px] text-muted">When people can use it</p>
              <BookingSetup
                value={state.booking}
                resources={resources}
                team={team}
                products={products}
                onCreateResource={onCreateResource}
                onChange={(b) => {
                  if (!b) return;
                  setState((s) => ({
                    ...s,
                    booking: b,
                    schedule: needsSchedule(b.bookingType) ? (s.schedule ?? defaultSchedule(b.bookingType)) : null,
                    durationConfig: isFlexibleResource(b.bookingType)
                      ? { ...(s.durationConfig ?? defaultDurationConfig(majorToMinor(s.tiers[0]?.price ?? ""))), ...(b.resource?.durationCore ?? {}) }
                      : null,
                  }));
                }}
              />
            </div>
            {/* Which spaces this booking may use, as a plain field.
                It was only reachable inside the setup questions, and re-opening
                those to change one lane meant re-answering the lot — so in
                practice a booking's resource pool could not be edited at all.
                The questions still DERIVE the booking type; this only edits the
                pool they produced, which is the part that changes as an
                operator adds a court. */}
            {state.booking.resource && (
              <div>
                <p className="type-h2 mb-tight text-base">{resourceNoun}</p>
                <p className="type-body mb-section text-[13px] text-muted">
                  Which of your {resourceNoun.toLowerCase()} this booking can be sold on. Availability is worked out per {resourceSingular.toLowerCase()}, across every booking that shares it.
                </p>
                {resources.length === 0 ? (
                  <p className="text-[13px] text-faint">
                    None set up yet — add them in Settings → {resourceNoun}.
                  </p>
                ) : (
                  <div className="grid gap-tight sm:grid-cols-2">
                    {resources.map((r) => {
                      const on = (state.booking.resource?.resourceIds ?? []).includes(r.id);
                      return (
                        <label
                          key={r.id}
                          className={`flex cursor-pointer items-center gap-comfortable rounded-sm border p-comfortable transition-colors duration-quick ${on ? "border-ember bg-ember/5" : "border-line hover:bg-subtle"}`}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() =>
                              setState((st) => {
                                const cur = st.booking.resource;
                                if (!cur) return st;
                                const ids = cur.resourceIds.includes(r.id)
                                  ? cur.resourceIds.filter((x) => x !== r.id)
                                  : [...cur.resourceIds, r.id];
                                return { ...st, booking: { ...st.booking, resource: { ...cur, resourceIds: ids } } };
                              })
                            }
                            className="h-4 w-4 shrink-0 accent-ember"
                          />
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate text-sm font-medium">{r.name}</span>
                            <span className="truncate text-[12px] text-muted">
                              {r.nounSingular}
                              {r.outOfService ? " · out of service" : ""}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
                {(state.booking.resource.resourceIds ?? []).length === 0 && (
                  <p className="mt-tight text-[12px] text-danger">
                    Pick at least one — a booking with none cannot be sold.
                  </p>
                )}
              </div>
            )}
            {isFlexibleResource(state.booking.bookingType) && state.durationConfig && (
              <div>
                <p className="type-h2 mb-section text-base">Durations & pricing</p>
                <DurationEngineField
                  value={state.durationConfig}
                  onChange={(cfg) => set("durationConfig", cfg)}
                  currency={currency}
                  resources={resources.filter((r) => (state.booking.resource?.resourceIds ?? product.resourceIds ?? []).includes(r.id))}
                  pricingRules={state.pricingRules.filter((r) => r.price !== "").map((r) => ({ id: r.id ?? "preview", days: r.days, fromTime: r.fromTime, toTime: r.toTime, price: majorToMinor(r.price) }))}
                />
              </div>
            )}
            {needsSchedule(state.booking.bookingType) && state.schedule && (
              <div>
                <p className="type-h2 mb-section text-base">Schedule</p>
                <ScheduleBuilder bookingType={state.booking.bookingType} value={state.schedule} onChange={(sch) => set("schedule", sch)} team={team} />
              </div>
            )}
            <TypeSpecificFields state={state} set={set} team={team} providerNoun={product.providerNoun} />
            {state.booking.bookingType === "BT-03" && state.schedule && (
              <div className="flex flex-col gap-tight">
                <span className="type-label text-[12px] text-muted">Session names (optional)</span>
                <p className="text-[12px] text-faint">Name a session and the name shows on tickets and the schedule — &quot;Morning show&quot;.</p>
                <div className="grid gap-tight sm:grid-cols-3">
                  {slotTimes(state.schedule).map((t) => (
                    <div key={t} className="flex items-center gap-tight">
                      <span className="w-14 font-mono text-[13px] text-muted">{t}</span>
                      <input type="text" value={state.sessionNames[t] ?? ""} placeholder="—" onChange={(e) => set("sessionNames", { ...state.sessionNames, [t]: e.target.value })} className="h-10 w-full rounded-sm border border-line px-comfortable text-sm outline-none focus:border-inverse" />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="grid gap-section sm:grid-cols-2">
              <FormField label="Max per order" variant="number" value={state.maxPerOrder} onChange={(e) => set("maxPerOrder", e.target.value)} />
              <FormField label="Minimum age" variant="number" value={state.minAge} onChange={(e) => set("minAge", e.target.value)} />
              <FormField label="On sale" variant="toggle" checked={state.active} onChange={(e) => set("active", (e.target as HTMLInputElement).checked)} help="Turn off to hide from sale." />
              {needsSchedule(state.booking.bookingType) && (
                <FormField label="Waitlist when full" variant="toggle" checked={state.waitlist} onChange={(e) => set("waitlist", (e.target as HTMLInputElement).checked)} help="Let people join a waitlist." />
              )}
            </div>
          </div>
        )}

        {tab === "pricing" && (() => {
          // The pricing basis drives the tab: per-booking products show one
          // price + group limits — never tier machinery.
          const basis = state.booking.resource?.basis ?? product.pricingBasis ?? (isResourceType(state.booking.bookingType) ? "per_booking" : "per_person");
          return (
            <div className="flex flex-col gap-major">
              {basis === "per_booking" ? (
                <div className="flex flex-col gap-tight">
                  <FormField
                    label={`Price per booking (${currency})`}
                    variant="number"
                    value={state.tiers[0]?.price ?? ""}
                    onChange={(e) => set("tiers", state.tiers.length ? state.tiers.map((t, i) => (i === 0 ? { ...t, price: e.target.value } : t)) : [{ ...emptyTier(), name: "Booking", price: e.target.value }])}
                    className="max-w-xs"
                    help="One price for the whole group — group size is capped by the party limits in Policies."
                  />
                  <p className="text-[12px] text-faint">Priced per booking. Switch to per-person tiers by changing the booking setup on the Availability tab.</p>
                </div>
              ) : (
                <PriceTiersField tiers={state.tiers} onChange={(tiers) => set("tiers", tiers)} errors={errors} currency={currency} />
              )}
              {needsSchedule(state.booking.bookingType) && (
                <PricingRulesField rules={state.pricingRules} onChange={(r) => set("pricingRules", r)} currency={currency} basePriceMajor={state.tiers[0]?.price ?? ""} dayStart={state.schedule?.startTime} dayEnd={state.schedule?.endTime} />
              )}
            </div>
          );
        })()}

        {tab === "policies" && (
          <div className="flex flex-col gap-major">
            <FormField label="Tax class" variant="select" value={state.taxClass} onChange={(e) => set("taxClass", e.target.value as TaxClass)} options={[{ value: "standard", label: "Standard (VAT)" }, { value: "reduced", label: "Reduced" }, { value: "exempt", label: "Exempt" }]} className="max-w-xs" help="Rates come from Business settings." />
            <PoliciesField value={state.policies} onChange={(p) => set("policies", p)} />
            <AddOnsField addOns={state.addOns} onChange={(a) => set("addOns", a)} currency={currency} />
          </div>
        )}

        {tab === "where" && (
          <div className="grid gap-section sm:grid-cols-2">
            <div className="flex flex-col gap-tight">
              <span className="type-label text-[12px] text-muted">Where it&apos;s sold</span>
              <FormField label="At the counter" variant="toggle" checked={state.counter} onChange={(e) => set("counter", (e.target as HTMLInputElement).checked)} />
              <FormField label="Online" variant="toggle" checked={state.online} onChange={(e) => set("online", (e.target as HTMLInputElement).checked)} />
            </div>
            <div className="flex flex-col gap-tight">
              <span className="type-label text-[12px] text-muted">Locations</span>
              {locations.map((l) => (
                <label key={l.id} className="flex cursor-pointer items-center gap-tight text-sm">
                  <input type="checkbox" checked={state.locationIds.includes(l.id)} onChange={() => toggleLocation(l.id)} className="h-4 w-4 accent-ember" />
                  {l.name}
                </label>
              ))}
            </div>
          </div>
        )}

        {tab === "advanced" && (
          <div className="flex flex-col gap-tight text-sm">
            <p className="text-[13px] text-faint">Internal values for support and debugging. Read-only.</p>
            <AdvancedRow label="Booking type" value={state.booking.bookingType} />
            <AdvancedRow label="Booking ID" value={product.id} />
            <AdvancedRow label="Created" value={product.createdAt} />
            <AdvancedRow label="Updated" value={product.updatedAt} />
          </div>
        )}
      </div>

      <div className="sticky bottom-0 max-md:bottom-[calc(56px+env(safe-area-inset-bottom))] flex items-center justify-between border-t border-line bg-surface py-section">
        <span className="font-mono text-[12px] text-faint">{dirty ? "Unsaved changes" : "No changes"}</span>
        <div className="flex items-center gap-tight">
          <Button variant="secondary" onClick={() => router.push("/bookings")} disabled={saving}>Cancel</Button>
          <Button onClick={save} loading={saving} disabled={!dirty}>Save changes</Button>
        </div>
      </div>
    </div>
  );
}

/** The per-type completeness fields — each renders only for its booking type,
 *  always with a sensible default already in place. */
function TypeSpecificFields({
  state,
  set,
  team,
  providerNoun,
}: {
  state: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  team: Staff[];
  providerNoun?: string;
}) {
  const bt = state.booking.bookingType;

  if (bt === "BT-01") {
    return (
      <div className="grid gap-section sm:grid-cols-2">
        <FormField label="Valid after purchase" variant="select" value={state.validityMode} onChange={(e) => set("validityMode", e.target.value as FormState["validityMode"])} options={[{ value: "unlimited", label: "Until used — no expiry" }, { value: "days", label: "For N days" }, { value: "same_day", label: "Same day only" }]} help="When an unused ticket stops being accepted." />
        {state.validityMode === "days" && <FormField label="Valid for (days)" variant="number" value={state.validityDaysStr} onChange={(e) => set("validityDaysStr", e.target.value)} />}
      </div>
    );
  }

  if (bt === "BT-02") {
    return (
      <div className="grid gap-section sm:grid-cols-3">
        <FormField label="Window" variant="select" value={state.windowMode} onChange={(e) => set("windowMode", e.target.value as FormState["windowMode"])} options={[{ value: "rolling", label: "N days from purchase" }, { value: "fixed", label: "Fixed season dates" }]} help="Rolling: each ticket's window starts when it's bought." />
        {state.windowMode === "rolling" ? (
          <FormField label="Valid for (days)" variant="number" value={state.validityDaysStr} onChange={(e) => set("validityDaysStr", e.target.value)} />
        ) : (
          <>
            <FormField label="From" variant="date" value={state.windowStart} onChange={(e) => set("windowStart", e.target.value)} />
            <FormField label="To" variant="date" value={state.windowEnd} onChange={(e) => set("windowEnd", e.target.value)} />
          </>
        )}
      </div>
    );
  }

  if (bt === "BT-09") {
    return (
      <div className="grid gap-section sm:grid-cols-2">
        <FormField label="Minimum party to run" variant="number" value={state.minPartyToRun} onChange={(e) => set("minPartyToRun", e.target.value)} help="Departures with fewer booked can be cancelled." />
        <FormField label="Meeting point" value={state.meetingPoint} placeholder="Main gate" onChange={(e) => set("meetingPoint", e.target.value)} help="Printed on the ticket." />
      </div>
    );
  }

  if (bt === "BT-10") {
    const ids = state.booking.provider?.providerIds ?? Object.keys(state.providerExtras);
    if (ids.length === 0) return null;
    return (
      <div className="flex flex-col gap-tight">
        <span className="type-label text-[12px] text-muted">Per-{(state.booking.provider?.noun ?? providerNoun ?? "provider").toLowerCase()} price & durations</span>
        {ids.map((id) => {
          const extra = state.providerExtras[id] ?? { premium: "", durations: "" };
          const name = team.find((m) => m.id === id)?.name ?? id;
          return (
            <div key={id} className="grid items-center gap-tight sm:grid-cols-[1fr_10rem_12rem]">
              <span className="text-sm">{name}</span>
              <FormField label="Extra charge" variant="number" placeholder="0" value={extra.premium} onChange={(e) => set("providerExtras", { ...state.providerExtras, [id]: { ...extra, premium: e.target.value } })} />
              <FormField label="Durations (min)" placeholder="60, 90" value={extra.durations} onChange={(e) => set("providerExtras", { ...state.providerExtras, [id]: { ...extra, durations: e.target.value } })} />
            </div>
          );
        })}
      </div>
    );
  }

  if (bt === "BT-12") {
    return (
      <FormField label="Credits per booking" variant="number" value={state.creditsPerBooking} onChange={(e) => set("creditsPerBooking", e.target.value)} className="max-w-xs" help="What one booking costs from the pack — a 2-hour slot might cost 2." />
    );
  }

  if (bt === "BT-13") {
    return (
      <FormField label="Can join partway" variant="toggle" checked={state.joinPartway} onChange={(e) => set("joinPartway", (e.target as HTMLInputElement).checked)} help="Sell enrolment after the course has started." />
    );
  }

  if (bt === "BT-14") {
    return (
      <FormField label="Identifier asked at issue" value={state.passIdentifierLabel} placeholder="Plate number" onChange={(e) => set("passIdentifierLabel", e.target.value)} className="max-w-xs" help="What staff type in when issuing this pass." />
    );
  }

  return null;
}

function AdvancedRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-line py-tight last:border-0">
      <span className="text-muted">{label}</span>
      <span className="font-mono text-[12px]">{value}</span>
    </div>
  );
}
