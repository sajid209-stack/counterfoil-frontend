"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useTranslations } from "next-intl";
import { Checkbox, FormField, controlClass } from "@/components/ui";
import {
  createResourceRecord,
  type BookingTypeCode,
  type Channel,
  type Location,
  type Product,
  type ProductInput,
  type ProductPage,
  type ProductSchedule,
  type Resource,
  type Staff,
} from "@/lib/api";
import { defaultSchedule, isFlexibleResource, isResourceType, needsSchedule, slotTimes, usesBuffer } from "@/lib/schedule";
import { formatClock, formatDateTime } from "@/lib/format";
import { defaultDurationConfig, durationOptions } from "@/lib/duration";
import type { DurationConfig, EventDay } from "@/lib/api";
import { bookingWayOf } from "@/lib/catalog";
import { pageOf } from "@/lib/productPage";
import { slugOf } from "@/lib/api/products";
import { effectiveBuffer, type BookingSetupResult } from "./BookingSetup";
import { DurationEngineField } from "./DurationEngineField";
import { ScheduleBuilder } from "./ScheduleBuilder";
import { ScheduleBufferField } from "./ScheduleBufferField";
import { PricingRulesField, type FormPricingRule } from "./PricingRulesField";
import { PoliciesField } from "./PoliciesField";
import { AddOnsField, type FormAddOn } from "./AddOnsField";
import { ImageUploadField, type FormImage } from "./ImageUploadField";
import { EventDetails } from "../event/EventDetails";
import { endsAtOf, type EventContent } from "../event/eventContent";
import { TicketEditor } from "../tickets/TicketEditor";
import { ticketsFromTiers, ticketsToInputs, type TicketRow } from "../tickets/ticketRows";
import type { OnlineChoice } from "../sell/SellChannels";
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

/** The sentence a saved booking's kind ends its setup questions on. */
export const summaryKeyOf = summaryKey;

/**
 * Everything a booking's record page edits, as the form holds it (strings where
 * a field is typed, so a half-written "12." is not read as a number).
 *
 * Whether the booking is on sale is NOT here: the record's one primary action
 * (Put on sale / Take off sale) acts at once and has its own Undo, so a saved
 * form can never put an item back on sale the operator just took off. Where it
 * is sold and what its page looks like ARE here, because those are edited in
 * tabs of the same record and saved with the rest.
 */
/**
 * The facts of an on-a-date booking (BT-15) as a form holds them: the day it
 * starts, an optional end, the days it runs when there are several, and the
 * place. Every other booking leaves them blank and never reads them.
 */
export interface EventFacts {
  date: string;
  startTime: string;
  endDate: string;
  endTime: string;
  days: EventDay[];
  venueName: string;
  venueAddress: string;
}

export interface FormState {
  name: string;
  description: string;
  booking: BookingSetupResult;
  schedule: ProductSchedule | null;
  counter: boolean;
  /** Storefront, only by its link, or not online. */
  onlineMode: OnlineChoice;
  /** The item's own link name (the part after /b/). */
  slug: string;
  locationIds: string[];
  /** The designed page (or the default for its kind until it is changed). */
  page: ProductPage;
  maxPerOrder: string;
  minAge: string;
  /** The tickets, in the ONE ticket editor every booking uses. */
  tiers: TicketRow[];
  /** An on-a-date booking's day, hours and place. */
  ev: EventFacts;
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

/** The online answer a saved item gives: not online without the "online" channel, else listed unless said otherwise. */
export const onlineModeOf = (p: Pick<Product, "channels" | "online">): OnlineChoice =>
  !p.channels.includes("online") ? "off" : (p.online ?? "listed");

/** An on-a-date booking's facts from its record. */
export function eventFactsOf(p: Product): EventFacts {
  const e = p.event;
  return {
    date: e ? e.startsAt.slice(0, 10) : "",
    startTime: e ? e.startsAt.slice(11, 16) : "19:00",
    endDate: e?.endsAt ? e.endsAt.slice(0, 10) : "",
    endTime: e?.endsAt ? e.endsAt.slice(11, 16) : "",
    days: e?.days ?? [],
    venueName: e?.venueName ?? "",
    venueAddress: e?.venueAddress ?? "",
  };
}

/** The fields EventDetails edits, read from the form. The line under the name,
 *  the description and the cover are shared with the Page tab; they are held
 *  where the record keeps them, so the two tabs cannot disagree. */
export function contentOf(state: FormState): EventContent {
  return {
    title: state.name,
    subtitle: state.page.tagline ?? "",
    description: state.description,
    coverUrl: state.page.coverUrl ?? "",
    date: state.ev.date,
    startTime: state.ev.startTime,
    endDate: state.ev.endDate,
    endTime: state.ev.endTime,
    days: state.ev.days,
    venueName: state.ev.venueName,
    venueAddress: state.ev.venueAddress,
    videoUrl: state.page.videoUrl ?? "",
    organiserName: state.page.organiser?.name ?? "",
    organiserBlurb: state.page.organiser?.blurb ?? "",
    lineup: state.page.lineup,
    faq: state.page.faq,
  };
}

/** What EventDetails reports changing, written back to the form. */
export function applyContent(s: FormState, c: Partial<EventContent>): FormState {
  const ev = { ...s.ev };
  for (const k of ["date", "startTime", "endDate", "endTime", "venueName", "venueAddress"] as const) if (c[k] !== undefined) ev[k] = c[k] as string;
  if (c.days !== undefined) ev.days = c.days;
  let page = s.page;
  if (c.subtitle !== undefined) page = { ...page, tagline: c.subtitle.trim() ? c.subtitle : undefined };
  if (c.coverUrl !== undefined) page = { ...page, coverUrl: c.coverUrl || undefined };
  return { ...s, name: c.title ?? s.name, description: c.description ?? s.description, ev, page };
}

export function fromProduct(p: Product, summaryOf: (code: BookingTypeCode) => string): FormState {
  const mode = onlineModeOf(p);
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
    counter: p.channels.includes("counter"),
    onlineMode: mode,
    slug: p.slug ?? (mode !== "off" ? slugOf(p) : ""),
    locationIds: p.locationIds,
    page: pageOf(p),
    maxPerOrder: p.maxPerOrder != null ? String(p.maxPerOrder) : "",
    minAge: p.minAge != null ? String(p.minAge) : "",
    tiers: ticketsFromTiers(p.tiers),
    ev: eventFactsOf(p),
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

/** The channels a form answer means. */
export const channelsOf = (counter: boolean, online: OnlineChoice): Channel[] => [
  ...(counter ? (["counter"] as Channel[]) : []),
  ...(online !== "off" ? (["online"] as Channel[]) : []),
];

/**
 * The patch a save sends. `base` is the form as it was loaded: the page is only
 * sent when it changed, so saving a price never writes a whole default page the
 * operator did not design. A key is left OUT rather than set to undefined where
 * "unchanged" is meant — the store merges patches, and an undefined would wipe
 * the field.
 */
export function buildInput(state: FormState, product: Product, base: FormState): Partial<ProductInput> {
  const bt = state.booking.bookingType;
  const input: Partial<ProductInput> = {
    name: state.name,
    description: state.description,
    images: state.images.map(({ id, url, alt }) => ({ id, url, alt })),
    bookingType: state.booking.bookingType,
    /* A ticket keeps what the form cannot hold: how many had sold before
       Counterfoil recorded sales is part of the record. A ticket good for
       particular days only keeps them while the booking still runs several. */
    tiers: ticketsToInputs(state.tiers).map((t) => ({
      ...(product.tiers.find((x) => x.id === t.id) ?? {}),
      ...t,
      dayIds: state.ev.days.length > 1 ? t.dayIds : undefined,
    })),
    locationIds: state.locationIds,
    channels: channelsOf(state.counter, state.onlineMode),
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
    addOns: state.addOns.filter((a) => a.name.trim()).map((a) => ({ id: a.id ?? `add_${globalThis.crypto.randomUUID().slice(0, 8)}`, name: a.name, price: majorToMinor(a.price), perPerson: a.perPerson, itemId: a.itemId })),
  };
  /* Rules written before this booking was saved are left as they were unless
     the operator changed them: saving a title must not write a whole default
     policy the operator never saw. */
  if (product.policies || JSON.stringify(state.policies) !== JSON.stringify(base.policies)) input.policies = state.policies;
  if (bt === "BT-15" && product.event) {
    input.event = {
      ...product.event,
      startsAt: `${state.ev.date}T${state.ev.startTime}:00+06:00`,
      endsAt: endsAtOf(state.ev),
      days: state.ev.days.length > 1 ? state.ev.days : undefined,
      venueName: state.ev.venueName.trim(),
      venueAddress: state.ev.venueAddress.trim() || undefined,
    };
  }
  if (state.onlineMode !== "off") {
    input.online = state.onlineMode;
    input.slug = state.slug.trim();
  }
  if (JSON.stringify(state.page) !== JSON.stringify(base.page)) input.page = state.page;
  return input;
}

/** The booking draft: the form, what it was loaded as, and whether they differ. */
export function useProductDraft(product: Product, summaryOf: (code: BookingTypeCode) => string) {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the translator is stable for a render's locale
  const initial = useMemo(() => fromProduct(product, summaryOf), [product]);
  const [state, setState] = useState<FormState>(initial);
  const dirty = useMemo(() => JSON.stringify(state) !== JSON.stringify(initial), [state, initial]);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setState((s) => ({ ...s, [k]: v }));
  return { state, setState, set, initial, dirty };
}

/** What every tab of the booking form needs to draw and change the draft. */
export interface ProductCtx {
  product: Product;
  state: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  setState: Dispatch<SetStateAction<FormState>>;
  errors: Record<string, string>;
  team: Staff[];
  locations: Location[];
  resources: Resource[];
  /** The other bookings, for a combo to pick its parts from. */
  products: Product[];
  currency: string;
  onCreateResource: (name: string, noun: string) => Promise<Resource | null>;
  /** What each saved ticket has sold, by ticket id: the Tickets tab refuses to
   *  go below it, and a ticket that has sold cannot be removed. */
  sold: Record<string, number>;
}

/** Create a resource (a lane, a court) from inside a form, and hand it back. */
export async function createResourceFor(name: string, noun: string): Promise<Resource | null> {
  const res = await createResourceRecord({
    name, nounSingular: noun, nounPlural: noun.endsWith("s") ? noun : `${noun}s`,
    locationId: null, outOfService: false, outOfServiceReason: null, status: "active",
  });
  return res.ok ? res.data : null;
}

/** The resource pool's noun: the operator's own word when they agree on one. */
function useResourceNoun(resources: Resource[]) {
  const t = useTranslations("catalog.form");
  return resources.length && resources.every((r) => r.nounPlural === resources[0].nounPlural) ? resources[0].nounPlural : t("resourcesFallback");
}

/* ── Details: what it is ─────────────────────────────────────────────────── */
export function DetailsTab({ ctx }: { ctx: ProductCtx }) {
  const { state, set, setState, errors } = ctx;
  const tw = useTranslations("catalog.wizard");
  const ta = useTranslations("catalog.addFlow");
  return (
    <div className="flex flex-col gap-major">
      <div className="grid grid-cols-1 gap-section sm:grid-cols-2">
        <FormField label={tw("name")} required value={state.name} onChange={(e) => set("name", e.target.value)} error={errors.name} className="sm:col-span-2" />
        <FormField
          label={ta("summary")}
          help={ta("summaryHelp")}
          value={state.page.tagline ?? ""}
          onChange={(e) => set("page", { ...state.page, tagline: e.target.value || undefined })}
          className="sm:col-span-2"
        />
        <FormField label={tw("description")} variant="textarea" placeholder={tw("descriptionPlaceholder")} value={state.description} onChange={(e) => set("description", e.target.value)} className="sm:col-span-2" />
        <div className="flex flex-col gap-inline sm:col-span-2">
          <ImageUploadField images={state.images} onChange={(images) => set("images", images)} />
          <p className="text-sm text-muted">{tw("photoHelp")}</p>
        </div>
      </div>
      {/* The cover is the page's picture; the Page tab edits the same one. */}
      <EventDetails
        categoryId={ctx.product.event?.kind ?? "entertainment"}
        content={contentOf(state)}
        onContent={(c) => setState((s) => applyContent(s, c))}
        errors={errors}
        show={["cover"]}
      />
    </div>
  );
}

/* ── When: the days, hours, places and lengths it is bookable ────────────── */
export function WhenTab({ ctx }: { ctx: ProductCtx }) {
  const { product, state, set, setState, team, resources, currency, errors } = ctx;
  const t = useTranslations("catalog.form");
  const ta = useTranslations("catalog.addFlow");
  const tw = useTranslations("catalog.ways");
  const ti = useTranslations("catalog.item");
  const resourceNoun = useResourceNoun(resources);
  const pool = resources.filter((r) => (state.booking.resource?.resourceIds ?? product.resourceIds ?? []).includes(r.id));
  const way = bookingWayOf(state.booking.bookingType);
  const onDate = state.booking.bookingType === "BT-15";
  return (
    <div className="flex flex-col gap-major">
      {/* The question the wizard asked, with the answer this booking has. It is
          read here, not re-asked: how a booking is booked decides what its
          orders and availability mean, so a different answer is a new booking. */}
      <div className="flex flex-col gap-tight">
        <h3 className="text-md font-semibold text-fg">{ta("title.when")}</h3>
        <div className="rounded-inner bg-subtle p-comfortable">
          <p className="text-base font-medium text-fg">{tw(`${way}.title`)}</p>
          <p className="text-sm text-muted">{tw(`${way}.helper`)}</p>
        </div>
        <p className="text-sm text-muted">{ti("when.fixed")}</p>
      </div>
      {onDate && (
        <EventDetails
          categoryId={product.event?.kind ?? "entertainment"}
          content={contentOf(state)}
          onContent={(c) => setState((s) => applyContent(s, c))}
          errors={errors}
          show={["when", "where"]}
          scopedTickets={state.tiers.filter((r) => r.dayIds.length > 0).length}
          onUntieTickets={() => set("tiers", state.tiers.map((r) => (r.dayIds.length ? { ...r, dayIds: [] } : r)))}
        />
      )}
      {/* Which spaces this booking may use, as a plain field.
          It was only reachable inside the setup questions, and re-opening
          those to change one lane meant re-answering the lot — so in
          practice a booking's resource pool could not be edited at all.
          The questions still DERIVE the booking type; this only edits the
          pool they produced, which is the part that changes as an
          operator adds a court. */}
      {state.booking.resource && (
        <div>
          <p className="mb-tight text-md font-semibold text-fg">{resourceNoun}</p>
          <p className="text-sm text-muted">{t("resourceHelp", { noun: resourceNoun })}</p>
          <p className="mb-section text-sm text-muted">{t("resourceShared")}</p>
          {resources.length === 0 ? (
            <p className="text-sm text-muted">{t("resourceNone", { noun: resourceNoun })}</p>
          ) : (
            <div className="grid grid-cols-1 gap-tight sm:grid-cols-2">
              {resources.map((r) => {
                const on = (state.booking.resource?.resourceIds ?? []).includes(r.id);
                return (
                  <div
                    key={r.id}
                    className={`rounded-control bg-muted-wash px-comfortable transition-shadow duration-quick ${on ? "ring-2 ring-inset ring-ember-solid" : ""}`}
                  >
                    <Checkbox
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
                      label={
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{r.name}</span>
                          <span className="truncate text-xs text-muted">
                            {r.nounSingular}
                            {r.outOfService ? ` · ${t("resourceNotInUse")}` : ""}
                          </span>
                        </span>
                      }
                    />
                  </div>
                );
              })}
            </div>
          )}
          {(state.booking.resource.resourceIds ?? []).length === 0 && (
            <p className="mt-tight text-xs text-danger">{t("resourcePickOne")}</p>
          )}
        </div>
      )}
      {isFlexibleResource(state.booking.bookingType) && state.durationConfig && (
        <div>
          <p className="mb-section text-md font-semibold text-fg">{t("lengthsTitle")}</p>
          <DurationEngineField
            value={state.durationConfig}
            onChange={(cfg) => set("durationConfig", cfg)}
            currency={currency}
            resources={pool}
            pricingRules={state.pricingRules.filter((r) => r.price !== "").map((r) => ({ id: r.id ?? "preview", days: r.days, fromTime: r.fromTime, toTime: r.toTime, price: majorToMinor(r.price) }))}
          />
        </div>
      )}
      {needsSchedule(state.booking.bookingType) && state.schedule && (
        <div>
          <p className="mb-section text-md font-semibold text-fg">{t("scheduleTitle")}</p>
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
                resources={pool}
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
          resources={pool}
          fallbackNoun={product.providerNoun}
        />
      )}
      <TypeSpecificFields placement="when" state={state} set={set} team={team} providerNoun={product.providerNoun} />
      {state.booking.bookingType === "BT-03" && state.schedule && (
        <div className="flex flex-col gap-tight">
          <span className="text-sm font-medium text-muted">{t("showNames")}</span>
          <p className="text-xs text-muted">{t("showNamesHelp")}</p>
          <div className="grid grid-cols-1 gap-tight sm:grid-cols-3">
            {slotTimes(state.schedule).map((time) => (
              <div key={time} className="flex items-center gap-tight">
                <span className="w-20 shrink-0 whitespace-nowrap text-sm tabular-nums text-muted">{formatClock(time)}</span>
                <input
                  type="text"
                  value={state.sessionNames[time] ?? ""}
                  placeholder={t("showNamePlaceholder")}
                  aria-label={t("showNameFor", { time: formatClock(time) })}
                  onChange={(e) => set("sessionNames", { ...state.sessionNames, [time]: e.target.value })}
                  className={controlClass()}
                />
              </div>
            ))}
          </div>
        </div>
      )}
      {needsSchedule(state.booking.bookingType) && (
        <FormField label={t("waitlist")} variant="toggle" checked={state.waitlist} onChange={(e) => set("waitlist", (e.target as HTMLInputElement).checked)} help={state.waitlist ? t("waitlistOn") : t("waitlistOff")} />
      )}
    </div>
  );
}

/* ── Tickets & prices ────────────────────────────────────────────────────── */
export function PricesTab({ ctx }: { ctx: ProductCtx }) {
  const { product, state, set, team, errors, currency, sold } = ctx;
  const t = useTranslations("catalog.form");
  const tev = useTranslations("catalog.editEvent");
  const hasSold = Object.values(sold).some((n) => n > 0);
  // The pricing basis tells the operator what the price means; the editor is
  // the same either way.
  const basis = state.booking.resource?.basis ?? product.pricingBasis ?? (isResourceType(state.booking.bookingType) ? "per_booking" : "per_person");
  return (
    <div className="flex flex-col gap-major">
      {hasSold && <p className="text-sm text-muted">{tev("soldNote")}</p>}
      {basis === "per_booking" && <p className="text-sm text-muted">{t("perBookingHelp")}</p>}
      <TicketEditor rows={state.tiers} onChange={(rows) => set("tiers", rows)} errors={errors} currency={currency} days={state.ev.days} sold={sold} totals />
      {needsSchedule(state.booking.bookingType) && (
        <PricingRulesField rules={state.pricingRules} onChange={(r) => set("pricingRules", r)} currency={currency} basePriceMajor={state.tiers[0]?.price ?? ""} dayStart={state.schedule?.startTime} dayEnd={state.schedule?.endTime} />
      )}
      <TypeSpecificFields placement="prices" state={state} set={set} team={team} providerNoun={product.providerNoun} />
      {/* Extras sit with the prices: what else is handed over, and for how much. */}
      <AddOnsField addOns={state.addOns} onChange={(a) => set("addOns", a)} currency={currency} locationIds={state.locationIds} />
    </div>
  );
}

/* ── Rules: tax, limits and the policies ─────────────────────────────────── */
export function RulesTab({ ctx }: { ctx: ProductCtx }) {
  const { product, state, set, team } = ctx;
  const t = useTranslations("catalog.form");
  return (
    <div className="flex flex-col gap-major">
      <FormField label={t("taxLabel")} variant="select" value={state.taxClass} onChange={(e) => set("taxClass", e.target.value as TaxClass)} options={[{ value: "standard", label: t("taxStandard") }, { value: "reduced", label: t("taxReduced") }, { value: "exempt", label: t("taxExempt") }]} className="max-w-xs" help={t("taxHelp")} />
      <div className="grid grid-cols-1 gap-section sm:grid-cols-2">
        <FormField label={t("maxPerOrder")} variant="number" value={state.maxPerOrder} onChange={(e) => set("maxPerOrder", e.target.value)} help={t("noLimitHelp")} />
        <FormField label={t("minAge")} variant="number" value={state.minAge} onChange={(e) => set("minAge", e.target.value)} help={t("noLimitHelp")} />
      </div>
      <TypeSpecificFields placement="rules" state={state} set={set} team={team} providerNoun={product.providerNoun} />
      <PoliciesField value={state.policies} onChange={(p) => set("policies", p)} />
    </div>
  );
}

/* ── For support: the facts a support person asks for ────────────────────── */
export function SupportRows({ code, id, createdAt, updatedAt }: { code: string; id: string; createdAt: string; updatedAt: string }) {
  const t = useTranslations("catalog.form");
  return (
    <div className="flex flex-col gap-tight text-base">
      <p className="text-sm text-muted">{t("advancedHelp")}</p>
      <AdvancedRow label={t("advType")} value={code} mono />
      <AdvancedRow label={t("advId")} value={id} mono />
      <AdvancedRow label={t("advCreated")} value={formatDateTime(createdAt)} />
      <AdvancedRow label={t("advUpdated")} value={formatDateTime(updatedAt)} />
    </div>
  );
}

type Placement = "when" | "prices" | "rules";

/** The per-type completeness fields — each renders only for its booking type
 *  and in the tab it belongs to (how long it is valid is "when"; what a
 *  therapist costs extra is "prices"; credits and pass labels are "rules"),
 *  always with a sensible default already in place. */
function TypeSpecificFields({
  placement,
  state,
  set,
  team,
  providerNoun,
}: {
  placement: Placement;
  state: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  team: Staff[];
  providerNoun?: string;
}) {
  const t = useTranslations("catalog.form");
  const bt = state.booking.bookingType;
  const days = parseInt(state.validityDaysStr, 10);
  const hasDays = Number.isFinite(days) && days > 0;
  const here = (...codes: BookingTypeCode[]) => codes.includes(bt);

  if (placement === "when" && here("BT-01")) {
    return (
      <div className="grid grid-cols-1 gap-section sm:grid-cols-2">
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

  if (placement === "when" && here("BT-02")) {
    return (
      <div className="grid grid-cols-1 gap-section sm:grid-cols-3">
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

  if (placement === "when" && here("BT-09")) {
    return (
      <div className="grid grid-cols-1 gap-section sm:grid-cols-2">
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

  if (placement === "prices" && here("BT-10")) {
    const ids = state.booking.provider?.providerIds ?? Object.keys(state.providerExtras);
    if (ids.length === 0) return null;
    return (
      <div className="flex flex-col gap-tight">
        <span className="text-sm font-medium text-muted">{t("providerExtras", { noun: state.booking.provider?.noun ?? providerNoun ?? t("providerFallback") })}</span>
        {ids.map((id) => {
          const extra = state.providerExtras[id] ?? { premium: "", durations: "" };
          const name = team.find((m) => m.id === id)?.name ?? id;
          return (
            <div key={id} className="grid grid-cols-1 items-center gap-tight sm:grid-cols-[1fr_10rem_12rem]">
              <span className="text-base">{name}</span>
              <FormField label={t("extraCharge")} variant="number" placeholder="0" value={extra.premium} onChange={(e) => set("providerExtras", { ...state.providerExtras, [id]: { ...extra, premium: e.target.value } })} />
              <FormField label={t("lengthsMin")} placeholder={t("lengthsPlaceholder")} value={extra.durations} onChange={(e) => set("providerExtras", { ...state.providerExtras, [id]: { ...extra, durations: e.target.value } })} />
            </div>
          );
        })}
      </div>
    );
  }

  if (placement === "rules" && here("BT-12")) {
    return (
      <FormField label={t("creditsPer")} variant="number" value={state.creditsPerBooking} onChange={(e) => set("creditsPerBooking", e.target.value)} className="max-w-xs" help={t("creditsPerHelp", { count: parseInt(state.creditsPerBooking, 10) || 1 })} />
    );
  }

  if (placement === "rules" && here("BT-13")) {
    return (
      <FormField label={t("joinLate")} variant="toggle" checked={state.joinPartway} onChange={(e) => set("joinPartway", (e.target as HTMLInputElement).checked)} help={state.joinPartway ? t("joinLateOn") : t("joinLateOff")} />
    );
  }

  if (placement === "rules" && here("BT-14")) {
    return (
      <FormField label={t("passId")} value={state.passIdentifierLabel} placeholder={t("passIdPlaceholder")} onChange={(e) => set("passIdentifierLabel", e.target.value)} className="max-w-xs" help={t("passIdHelp")} />
    );
  }

  return null;
}

function AdvancedRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between border-b border-hairline py-tight last:border-0">
      <span className="text-muted">{label}</span>
      <span className={mono ? "font-mono text-xs" : "text-sm tabular-nums"}>{value}</span>
    </div>
  );
}
