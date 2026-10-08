"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, FormField, Tabs, useToast } from "@/components/ui";
import {
  createResourceRecord,
  updateProduct,
  type BookingTypeCode,
  type Channel,
  type Location,
  type Product,
  type ProductInput,
  type ProductSchedule,
  type Resource,
  type Staff,
} from "@/lib/api";
import { defaultSchedule, isFlexibleResource, isResourceType, needsSchedule, slotTimes, usesBuffer } from "@/lib/schedule";
import { formatClock, formatDateTime } from "@/lib/format";
import { defaultDurationConfig, durationOptions } from "@/lib/duration";
import type { DurationConfig } from "@/lib/api";
import { BookingSetup, effectiveBuffer, type BookingSetupResult } from "./BookingSetup";
import { DurationEngineField } from "./DurationEngineField";
import { ScheduleBuilder } from "./ScheduleBuilder";
import { ScheduleBufferField } from "./ScheduleBufferField";
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

// Plain-language summary from a stored code — the operator never sees the
// code. The same sentences the setup questions end on, so reopening a saved
// booking says exactly what was chosen when it was made.
function summaryKey(code: BookingTypeCode): string {
  switch (code) {
    case "BT-01": return "showUp";
    case "BT-02": return "dateNoLimit";
    case "BT-06": return "dateCapped";
    case "BT-03": return "timed";
    case "BT-09": return "guided";
    case "BT-04": return "spaceFixed";
    case "BT-05": return "spaceFlex";
    default: return "configured";
  }
}

interface FormState {
  name: string;
  description: string;
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

function fromProduct(p: Product, summaryOf: (code: BookingTypeCode) => string): FormState {
  return {
    name: p.name,
    description: p.description,
    booking: {
      bookingType: p.bookingType,
      summary: summaryOf(p.bookingType),
      validityDays: p.validityDays,
      resource: isResourceType(p.bookingType)
        ? { resourceIds: p.resourceIds ?? [], exclusive: p.resourceExclusive !== false, bufferMinutes: p.bufferMinutes ?? 0, flexibleDurations: p.flexibleDurations }
        : undefined,
      // Timed sessions, guided tours and appointments have no resource object
      // of their own to carry "time between bookings" in the editor (an
      // appointment's own provider object isn't reconstructed here, since
      // `TypeSpecificFields` already edits it straight from the product) —
      // so every kind reads/writes it here, and `ScheduleBufferField` checks
      // `resource` first so this is simply unused where that applies.
      bufferMinutes: p.bufferMinutes ?? 0,
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
    addOns: (p.addOns ?? []).map((a) => ({ id: a.id, name: a.name, price: minorToMajor(a.price), perPerson: a.perPerson, itemId: a.itemId })),
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

const TAB_KEYS = ["details", "availability", "pricing", "policies", "where", "advanced"] as const;

export function ProductForm({
  product,
  locations,
  team,
  resources: initialResources,
  products = [],
  currency = "BDT",
  onSaved,
}: {
  product: Product;
  locations: Location[];
  team: Staff[];
  resources: Resource[];
  products?: Product[];
  currency?: string;
  /** Told what was saved, so the page header can follow it. */
  onSaved?: (product: Product) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const t = useTranslations("catalog.form");
  const tw = useTranslations("catalog.wizard");
  const ts = useTranslations("catalog.setup");
  const tf = useTranslations("catalog.fields");
  const summaryOf = (code: BookingTypeCode) => ts(`summary.${summaryKey(code)}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the translator is stable for a render's locale
  const initial = useMemo(() => fromProduct(product, summaryOf), [product]);
  const tabs = TAB_KEYS.map((value) => ({ value, label: t(`tab.${value}`) }));
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
      : t("resourcesFallback");

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
      bufferMinutes: usesBuffer(bt) ? effectiveBuffer(state.booking) : undefined,
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
      addOns: state.addOns.filter((a) => a.name.trim()).map((a) => ({ id: a.id ?? `add_${globalThis.crypto.randomUUID().slice(0, 8)}`, name: a.name, price: majorToMinor(a.price), perPerson: a.perPerson, itemId: a.itemId })),
    };
    const res = await updateProduct(product.id, input);
    setSaving(false);
    if (res.ok) {
      toast.success(t("saved"));
      setState(fromProduct(res.data, summaryOf));
      onSaved?.(res.data);
    } else if (res.error.code === "validation" && res.error.fieldErrors) {
      setErrors(res.error.fieldErrors);
      toast.error(res.error.message);
      setTab("pricing");
    } else {
      toast.error(res.error.message);
    }
  };

  return (
    <div className="flex w-full flex-col gap-section pb-hero">
      <Tabs items={tabs} value={tab} onChange={setTab} />

      <div className="card-surface p-card">
        {tab === "details" && (
          <div className="grid gap-section sm:grid-cols-2">
            <FormField label={tw("name")} required value={state.name} onChange={(e) => set("name", e.target.value)} error={errors.name} className="sm:col-span-2" />
            <FormField label={tw("description")} variant="textarea" placeholder={tw("descriptionPlaceholder")} value={state.description} onChange={(e) => set("description", e.target.value)} className="sm:col-span-2" />
            <div className="sm:col-span-2"><ImageUploadField images={state.images} onChange={(images) => set("images", images)} /></div>
          </div>
        )}

        {tab === "availability" && (
          <div className="flex flex-col gap-section">
            <div>
              <p className="mb-tight text-base font-semibold text-fg">{t("howTitle")}</p>
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
                <p className="type-body text-[13px] text-muted">{t("resourceHelp", { noun: resourceNoun })}</p>
                <p className="type-body mb-section text-[13px] text-muted">{t("resourceShared")}</p>
                {resources.length === 0 ? (
                  <p className="text-[13px] text-muted">{t("resourceNone", { noun: resourceNoun })}</p>
                ) : (
                  <div className="grid gap-tight sm:grid-cols-2">
                    {resources.map((r) => {
                      const on = (state.booking.resource?.resourceIds ?? []).includes(r.id);
                      return (
                        <label
                          key={r.id}
                          className={`flex min-h-11 cursor-pointer items-center gap-comfortable rounded-sm bg-muted-wash p-comfortable transition-shadow duration-quick ${on ? "ring-2 ring-inset ring-ember" : "hover:ring-2 hover:ring-inset hover:ring-ember/30"}`}
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
                              {r.outOfService ? ` · ${t("resourceNotInUse")}` : ""}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
                {(state.booking.resource.resourceIds ?? []).length === 0 && (
                  <p className="mt-tight text-[12px] text-danger">{t("resourcePickOne")}</p>
                )}
              </div>
            )}
            {isFlexibleResource(state.booking.bookingType) && state.durationConfig && (
              <div>
                <p className="type-h2 mb-section text-base">{t("lengthsTitle")}</p>
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
                <p className="type-h2 mb-section text-base">{t("scheduleTitle")}</p>
                <ScheduleBuilder
                  bookingType={state.booking.bookingType}
                  value={state.schedule}
                  onChange={(sch) => set("schedule", sch)}
                  team={team}
                  bufferMinutes={effectiveBuffer(state.booking)}
                  bufferSlot={
                    <ScheduleBufferField
                      booking={state.booking}
                      onChange={(b) => set("booking", b)}
                      resources={resources.filter((r) => (state.booking.resource?.resourceIds ?? product.resourceIds ?? []).includes(r.id))}
                      fallbackNoun={product.providerNoun}
                    />
                  }
                />
              </div>
            )}
            {/* An appointment has no schedule above at all (availability comes
                from who is free, not a weekly pattern), so its buffer field —
                still "same tab as the schedule" — stands alone here. Every
                other kind gets it inside the schedule builder, above. */}
            {!needsSchedule(state.booking.bookingType) && usesBuffer(state.booking.bookingType) && (
              <ScheduleBufferField
                booking={state.booking}
                onChange={(b) => set("booking", b)}
                resources={resources.filter((r) => (state.booking.resource?.resourceIds ?? product.resourceIds ?? []).includes(r.id))}
                fallbackNoun={product.providerNoun}
              />
            )}
            <TypeSpecificFields state={state} set={set} team={team} providerNoun={product.providerNoun} />
            {state.booking.bookingType === "BT-03" && state.schedule && (
              <div className="flex flex-col gap-tight">
                <span className="text-[0.8125rem] font-medium text-muted">{t("showNames")}</span>
                <p className="text-[12px] text-muted">{t("showNamesHelp")}</p>
                <div className="grid gap-tight sm:grid-cols-3">
                  {slotTimes(state.schedule).map((time) => (
                    <div key={time} className="flex items-center gap-tight">
                      <span className="w-20 shrink-0 whitespace-nowrap text-[0.8125rem] tabular-nums text-muted">{formatClock(time)}</span>
                      <input
                        type="text"
                        value={state.sessionNames[time] ?? ""}
                        placeholder={t("showNamePlaceholder")}
                        aria-label={t("showNameFor", { time: formatClock(time) })}
                        onChange={(e) => set("sessionNames", { ...state.sessionNames, [time]: e.target.value })}
                        className="h-11 w-full rounded-sm border border-line bg-card px-comfortable text-sm outline-none placeholder:text-muted focus:border-inverse md:h-10"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="grid gap-section sm:grid-cols-2">
              <FormField label={t("maxPerOrder")} variant="number" value={state.maxPerOrder} onChange={(e) => set("maxPerOrder", e.target.value)} help={t("noLimitHelp")} />
              <FormField label={t("minAge")} variant="number" value={state.minAge} onChange={(e) => set("minAge", e.target.value)} help={t("noLimitHelp")} />
              <FormField label={t("onSale")} variant="toggle" checked={state.active} onChange={(e) => set("active", (e.target as HTMLInputElement).checked)} help={state.active ? t("onSaleOn") : t("onSaleOff")} />
              {needsSchedule(state.booking.bookingType) && (
                <FormField label={t("waitlist")} variant="toggle" checked={state.waitlist} onChange={(e) => set("waitlist", (e.target as HTMLInputElement).checked)} help={state.waitlist ? t("waitlistOn") : t("waitlistOff")} />
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
                    label={`${t("perBookingPrice")} (${currency === "BDT" ? "৳" : currency})`}
                    variant="number"
                    placeholder="1500"
                    value={state.tiers[0]?.price ?? ""}
                    onChange={(e) => set("tiers", state.tiers.length ? state.tiers.map((t, i) => (i === 0 ? { ...t, price: e.target.value } : t)) : [{ ...emptyTier(), name: tf("tierStandard"), price: e.target.value }])}
                    className="max-w-xs"
                    help={t("perBookingHelp")}
                  />
                  <p className="text-[12px] text-muted">{t("perBookingSwitch", { tab: t("tab.availability") })}</p>
                </div>
              ) : (
                <PriceTiersField tiers={state.tiers} onChange={(tiers) => set("tiers", tiers)} errors={errors} currency={currency} />
              )}
              {needsSchedule(state.booking.bookingType) && (
                <PricingRulesField rules={state.pricingRules} onChange={(r) => set("pricingRules", r)} currency={currency} basePriceMajor={state.tiers[0]?.price ?? ""} dayStart={state.schedule?.startTime} dayEnd={state.schedule?.endTime} />
              )}
              {/* Extras sit with the prices, not with the policies. They were
                  under Policies when an add-on was a typed name and a number;
                  now that one can hand over a counted thing from the shelf it
                  is plainly a selling decision — what else the counter offers,
                  and for how much. */}
              <AddOnsField addOns={state.addOns} onChange={(a) => set("addOns", a)} currency={currency} locationIds={state.locationIds} />
            </div>
          );
        })()}

        {tab === "policies" && (
          <div className="flex flex-col gap-major">
            <FormField label={t("taxLabel")} variant="select" value={state.taxClass} onChange={(e) => set("taxClass", e.target.value as TaxClass)} options={[{ value: "standard", label: t("taxStandard") }, { value: "reduced", label: t("taxReduced") }, { value: "exempt", label: t("taxExempt") }]} className="max-w-xs" help={t("taxHelp")} />
            <PoliciesField value={state.policies} onChange={(p) => set("policies", p)} />
          </div>
        )}

        {tab === "where" && (
          <div className="grid gap-section sm:grid-cols-2">
            <div className="flex flex-col gap-tight">
              <span className="text-[0.8125rem] font-medium text-muted">{tw("soldWhere")}</span>
              <FormField label={tw("atCounter")} variant="toggle" help={tw("atCounterHelp")} checked={state.counter} onChange={(e) => set("counter", (e.target as HTMLInputElement).checked)} />
              <FormField label={tw("online")} variant="toggle" help={tw("onlineHelp")} checked={state.online} onChange={(e) => set("online", (e.target as HTMLInputElement).checked)} />
              {!state.counter && !state.online ? (
                <p className="text-[13px] font-medium text-danger">{tw("nowhere")}</p>
              ) : !state.online ? (
                <p className="text-[13px] text-warning">{tw("notOnline")}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-tight">
              <span className="text-[0.8125rem] font-medium text-muted">{tw("locations")}</span>
              {locations.map((l) => (
                <label key={l.id} className="flex min-h-11 cursor-pointer items-center gap-tight text-sm md:min-h-9">
                  <input type="checkbox" checked={state.locationIds.includes(l.id)} onChange={() => toggleLocation(l.id)} className="h-4 w-4 accent-ember" />
                  {l.name}
                </label>
              ))}
            </div>
          </div>
        )}

        {tab === "advanced" && (
          <div className="flex flex-col gap-tight text-sm">
            <p className="text-[13px] text-muted">{t("advancedHelp")}</p>
            <AdvancedRow label={t("advType")} value={state.booking.bookingType} />
            <AdvancedRow label={t("advId")} value={product.id} />
            <AdvancedRow label={t("advCreated")} value={formatDateTime(product.createdAt)} />
            <AdvancedRow label={t("advUpdated")} value={formatDateTime(product.updatedAt)} />
          </div>
        )}
      </div>

      {/* The one save bar. On a phone the floating menu button sits at the
          bottom-left (56px, 12px in from each edge), so the bar's own words
          start to the right of it rather than under it. */}
      <div className="sticky bottom-0 flex items-center justify-between gap-tight border-t border-hairline bg-chrome py-comfortable max-md:-mx-gutter max-md:pl-[calc(4.5rem+env(safe-area-inset-left))] max-md:pr-gutter max-md:pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:bg-surface md:py-section">
        <span className="text-[0.8125rem] text-muted">{dirty ? t("unsaved") : t("noChanges")}</span>
        <div className="flex items-center gap-tight">
          <Button variant="tertiary" onClick={() => router.push("/catalog?kind=bookings")} disabled={saving}>{t("cancel")}</Button>
          <Button onClick={save} loading={saving} disabled={!dirty}>{t("save")}</Button>
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
  const t = useTranslations("catalog.form");
  const bt = state.booking.bookingType;
  const days = parseInt(state.validityDaysStr, 10);
  const hasDays = Number.isFinite(days) && days > 0;

  if (bt === "BT-01") {
    return (
      <div className="grid gap-section sm:grid-cols-2">
        <FormField
          label={t("validLabel")}
          variant="select"
          value={state.validityMode}
          onChange={(e) => set("validityMode", e.target.value as FormState["validityMode"])}
          options={[
            { value: "unlimited", label: t("validUntilUsed") },
            { value: "days", label: hasDays ? t("validDays", { count: days }) : t("validDaysBlank") },
            { value: "same_day", label: t("validSameDay") },
          ]}
          help={
            state.validityMode === "unlimited"
              ? t("validHelpUnlimited")
              : state.validityMode === "same_day"
                ? t("validHelpSameDay")
                : hasDays
                  ? t("validHelpDays", { count: days })
                  : t("validHelpDaysBlank")
          }
        />
        {state.validityMode === "days" && <FormField label={t("daysCount")} variant="number" placeholder="30" value={state.validityDaysStr} onChange={(e) => set("validityDaysStr", e.target.value)} />}
      </div>
    );
  }

  if (bt === "BT-02") {
    return (
      <div className="grid gap-section sm:grid-cols-3">
        <FormField
          label={t("windowLabel")}
          variant="select"
          value={state.windowMode}
          onChange={(e) => set("windowMode", e.target.value as FormState["windowMode"])}
          options={[
            { value: "rolling", label: hasDays ? t("windowRolling", { count: days }) : t("windowRollingBlank") },
            { value: "fixed", label: t("windowFixed") },
          ]}
          help={
            state.windowMode === "fixed"
              ? t("windowHelpFixed")
              : hasDays
                ? t("windowHelpRolling", { count: days })
                : t("windowHelpRollingBlank")
          }
        />
        {state.windowMode === "rolling" ? (
          <FormField label={t("daysCount")} variant="number" placeholder="7" value={state.validityDaysStr} onChange={(e) => set("validityDaysStr", e.target.value)} />
        ) : (
          <>
            <FormField label={t("from")} variant="date" value={state.windowStart} onChange={(e) => set("windowStart", e.target.value)} />
            <FormField label={t("to")} variant="date" value={state.windowEnd} onChange={(e) => set("windowEnd", e.target.value)} />
          </>
        )}
      </div>
    );
  }

  if (bt === "BT-09") {
    return (
      <div className="grid gap-section sm:grid-cols-2">
        <FormField
          label={t("minGroup")}
          variant="number"
          value={state.minPartyToRun}
          onChange={(e) => set("minPartyToRun", e.target.value)}
          help={parseInt(state.minPartyToRun, 10) > 0 ? t("minGroupHelp", { count: parseInt(state.minPartyToRun, 10) }) : t("minGroupHelpBlank")}
        />
        <FormField label={t("meetingPoint")} value={state.meetingPoint} placeholder={t("meetingPointPlaceholder")} onChange={(e) => set("meetingPoint", e.target.value)} help={t("meetingPointHelp")} />
      </div>
    );
  }

  if (bt === "BT-10") {
    const ids = state.booking.provider?.providerIds ?? Object.keys(state.providerExtras);
    if (ids.length === 0) return null;
    return (
      <div className="flex flex-col gap-tight">
        <span className="text-[0.8125rem] font-medium text-muted">{t("providerExtras", { noun: state.booking.provider?.noun ?? providerNoun ?? t("providerFallback") })}</span>
        {ids.map((id) => {
          const extra = state.providerExtras[id] ?? { premium: "", durations: "" };
          const name = team.find((m) => m.id === id)?.name ?? id;
          return (
            <div key={id} className="grid items-center gap-tight sm:grid-cols-[1fr_10rem_12rem]">
              <span className="text-sm">{name}</span>
              <FormField label={t("extraCharge")} variant="number" placeholder="0" value={extra.premium} onChange={(e) => set("providerExtras", { ...state.providerExtras, [id]: { ...extra, premium: e.target.value } })} />
              <FormField label={t("lengthsMin")} placeholder={t("lengthsPlaceholder")} value={extra.durations} onChange={(e) => set("providerExtras", { ...state.providerExtras, [id]: { ...extra, durations: e.target.value } })} />
            </div>
          );
        })}
      </div>
    );
  }

  if (bt === "BT-12") {
    return (
      <FormField label={t("creditsPer")} variant="number" value={state.creditsPerBooking} onChange={(e) => set("creditsPerBooking", e.target.value)} className="max-w-xs" help={t("creditsPerHelp", { count: parseInt(state.creditsPerBooking, 10) || 1 })} />
    );
  }

  if (bt === "BT-13") {
    return (
      <FormField label={t("joinLate")} variant="toggle" checked={state.joinPartway} onChange={(e) => set("joinPartway", (e.target as HTMLInputElement).checked)} help={state.joinPartway ? t("joinLateOn") : t("joinLateOff")} />
    );
  }

  if (bt === "BT-14") {
    return (
      <FormField label={t("passId")} value={state.passIdentifierLabel} placeholder={t("passIdPlaceholder")} onChange={(e) => set("passIdentifierLabel", e.target.value)} className="max-w-xs" help={t("passIdHelp")} />
    );
  }

  return null;
}

function AdvancedRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-hairline py-tight last:border-0">
      <span className="text-muted">{label}</span>
      <span className="font-mono text-[12px]">{value}</span>
    </div>
  );
}
