"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronRight, Circle, Pencil } from "lucide-react";
import { Button, FormField, Modal, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  createLocation,
  createProduct,
  createResourceRecord,
  type Category,
  type Channel,
  type Location,
  type Product,
  type ProductInput,
  type ProductSchedule,
  type Resource,
  type Staff,
} from "@/lib/api";
import { formatPriceShort } from "@/lib/format";
import { DAY_LABELS, defaultSchedule, isDailyCapped, isSlotBased, needsSchedule, slotTimes } from "@/lib/schedule";
import { defaultPolicies } from "@/lib/tax";
import { formatDuration } from "@/lib/duration";
import { bookingKindOf, type BookingKind } from "@/lib/catalog";
import { BookingSetup, type BookingSetupResult, type SetupStart } from "./BookingSetup";
import { emptyTier, PriceTiersField, type FormTier } from "./PriceTiersField";
import { PricingRulesField, type FormPricingRule } from "./PricingRulesField";
import { ImageUploadField, type FormImage } from "./ImageUploadField";
import { ScheduleBuilder } from "./ScheduleBuilder";
import { WhereSold } from "../WhereSold";

const majorToMinor = (s: string) => { const n = parseFloat(s); return Number.isFinite(n) ? Math.round(n * 100) : 0; };

type StepKey = "how" | "details" | "when" | "price" | "where" | "review";

/** Where a chooser card lands in the questions — or already answered, where
 *  the card itself was the whole answer. */
function presetFor(kind: BookingKind | null): { start: SetupStart; answer?: "BT-03" | "BT-09" } {
  switch (kind) {
    case "entry": return { start: "entry" };
    case "timed": return { start: "q3", answer: "BT-03" };
    case "tour": return { start: "q3", answer: "BT-09" };
    case "space": return { start: "resource" };
    case "appointment": return { start: "provider" };
    case "course": return { start: "course" };
    case "pass": return { start: "credits" };
    case "bundle": return { start: "bundle" };
    default: return { start: "q1" };
  }
}

/** A booking sold per person starts with an Adult ticket; one sold per lane,
 *  per appointment or per pack starts with a single Standard price. A real
 *  first row, not a placeholder that only looks like one. */
const PER_THING: (BookingKind | null)[] = ["space", "appointment", "pass", "bundle", "course"];

/**
 * Add a booking.
 *
 * The questions run in the order the thing is thought about: what it is and how
 * people book it, then what it is called, then when it runs, what it costs and
 * where it is sold. The old order asked for a name and a photo first — for a
 * thing whose shape was not yet known, so "Name" had nothing to suggest it and
 * nothing it could be checked against.
 *
 * Arriving from the chooser the first question is already half answered: a
 * "Space hire" card opens on "which fields, courts or lanes?", and a "Guided
 * tours" card has nothing left to ask there at all.
 *
 * Beside the form, the booking as it stands and a ready-to-sell list — the
 * same blockers the catalog flags, ticked off as they are met. No button in it
 * is ever greyed out: pressed too early, it says what is missing and goes to
 * it, because a disabled button that will not say why is a dead end.
 */
export function ProductWizard({
  categories,
  locations: initialLocations,
  team,
  resources: initialResources,
  products = [],
  currency = "BDT",
  kind = null,
}: {
  categories: Category[];
  locations: Location[];
  team: Staff[];
  resources: Resource[];
  products?: Product[];
  currency?: string;
  /** The chooser card this came from, if any. */
  kind?: BookingKind | null;
}) {
  const t = useTranslations("catalog.wizard");
  const tc = useTranslations("catalog");
  const tf = useTranslations("catalog.fields");
  const router = useRouter();
  const toast = useToast();
  const preset = presetFor(kind);

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  /** A step-level problem that belongs to no one field — "choose an answer". */
  const [stepError, setStepError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [images, setImages] = useState<FormImage[]>([]);
  const tSetup = useTranslations("catalog.setup");
  const [booking, setBooking] = useState<BookingSetupResult | null>(() =>
    preset.answer
      ? { bookingType: preset.answer, summary: tSetup(preset.answer === "BT-03" ? "summary.timed" : "summary.guided") }
      : null,
  );
  const [schedule, setSchedule] = useState<ProductSchedule | null>(() =>
    preset.answer ? defaultSchedule(preset.answer) : null,
  );
  const [tiers, setTiers] = useState<FormTier[]>(() => [emptyTier(tf(PER_THING.includes(kind) ? "tierStandard" : "tierAdult"))]);
  const [pricingRules, setPricingRules] = useState<FormPricingRule[]>([]);
  const [waitlist, setWaitlist] = useState(false);
  const [resources, setResources] = useState<Resource[]>(initialResources);
  const [locations, setLocations] = useState<Location[]>(initialLocations);

  const onCreateResource = async (resName: string, noun: string) => {
    const res = await createResourceRecord({
      name: resName, nounSingular: noun, nounPlural: noun.endsWith("s") ? noun : `${noun}s`,
      locationId: null, outOfService: false, outOfServiceReason: null, status: "active",
    });
    if (res.ok) { setResources((r) => [...r, res.data]); return res.data; }
    return null;
  };
  const [locationIds, setLocationIds] = useState<string[]>(initialLocations.length === 1 ? [initialLocations[0].id] : []);
  const [counter, setCounter] = useState(true);
  const [online, setOnline] = useState(false);

  // Inline location creation
  const [addLocOpen, setAddLocOpen] = useState(false);
  const [newLocName, setNewLocName] = useState("");
  const [newLocCity, setNewLocCity] = useState("");
  const [addingLoc, setAddingLoc] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);

  /* Choosing how it is booked also sets up its schedule, where it has one —
     here rather than in an effect that watched `booking`, which rendered once
     with the new answer and no schedule before correcting itself. A schedule
     already made is kept when the answer only changes shape within the kind. */
  const chooseBooking = (next: BookingSetupResult | null) => {
    setBooking(next);
    setStepError(null);
    setSchedule((cur) => (next && needsSchedule(next.bookingType) ? (cur ?? defaultSchedule(next.bookingType)) : null));
  };

  /* The steps a booking of this kind has. "When" exists only for something
     that runs on a schedule: an entry ticket or a pack of credits has no hours
     to set, and a step that says "nothing to do here" is a step too many. */
  const needsWhen = !!booking && needsSchedule(booking.bookingType);
  const steps: StepKey[] = ["how", "details", ...(needsWhen ? (["when"] as const) : []), "price", "where", "review"];
  /* A card that was the whole answer ("Timed sessions", "Guided tours") has
     nothing left to ask on the first step, so the form opens on the next one
     with the first shown done — and still reachable, to change the answer. */
  const [stepKey, setStepKey] = useState<StepKey>(preset.answer ? "details" : "how");
  const stepIndex = Math.max(0, steps.indexOf(stepKey));
  /* The one rule the checklist follows: nothing is ticked on the operator's
     behalf. An item is done when its step has been looked at AND what it holds
     is valid — so a default schedule is not "Days and times" until somebody
     has seen it, and the counter being on by default is not "Somewhere to
     sell it" until somebody has seen that online is off. */
  const [seen, setSeen] = useState<Set<StepKey>>(() => new Set<StepKey>(preset.answer ? ["how", "details"] : ["how"]));
  const goTo = (key: StepKey) => {
    setStepError(null);
    setSeen((cur) => (cur.has(key) ? cur : new Set(cur).add(key)));
    setStepKey(key);
  };
  const go = (i: number) => goTo(steps[Math.max(0, Math.min(steps.length - 1, i))]);

  const tiersValid = tiers.length > 0 && tiers.every((x) => x.name.trim() && x.price !== "");
  const scheduleValid =
    !needsWhen || !schedule
      ? true
      : isDailyCapped(booking!.bookingType)
        ? (schedule.dailyCapacity ?? 0) > 0 && schedule.openDays.length > 0
        : schedule.openDays.length > 0 && (!isSlotBased(booking!.bookingType) || slotTimes(schedule).length > 0);

  /* Ready to sell — the catalog's own blockers, as a list you work down. An
     item that is not done says what, where it can: "Child needs a price". */
  const unpriced = tiers.find((x) => x.name.trim() && x.price === "");
  const channelDone = (counter || online) && locationIds.length > 0;
  const checks: { key: string; done: boolean; step: StepKey; hint?: string }[] = [
    { key: "how", done: seen.has("how") && !!booking, step: "how" },
    { key: "name", done: seen.has("details") && name.trim().length > 0, step: "details" },
    ...(needsWhen ? [{ key: "when", done: seen.has("when") && scheduleValid, step: "when" as StepKey }] : []),
    {
      key: "price",
      done: seen.has("price") && tiersValid,
      step: "price",
      hint: seen.has("price") && !tiersValid ? (unpriced ? t("hint.needsPrice", { name: unpriced.name.trim() }) : t("hint.needsName")) : undefined,
    },
    {
      key: "channel",
      done: seen.has("where") && channelDone,
      step: "where",
      hint: seen.has("where") && (counter || online) && locationIds.length === 0 ? t("hint.needsLocation") : undefined,
    },
  ];
  const ready = checks.every((c) => c.done);

  /** Check one step. Marks what is wrong where it is, and puts the cursor on
   *  the first of it — the same thing Continue does and Put on sale does. */
  const validate = (key: StepKey): boolean => {
    const e: Record<string, string> = {};
    let problem: string | null = null;
    if (key === "how" && !booking) problem = t("missing.how");
    if (key === "details" && !name.trim()) e.name = t("missing.name");
    if (key === "when" && !scheduleValid) problem = t("missing.when");
    if (key === "price") {
      if (tiers.length === 0) e.tiers = t("missing.tiers");
      tiers.forEach((x, i) => {
        if (!x.name.trim()) e[`tiers.${i}.name`] = t("missing.tierName");
        if (x.price === "") e[`tiers.${i}.price`] = t("missing.tierPrice");
      });
    }
    if (key === "where" && !counter && !online) problem = t("nowhere");
    else if (key === "where" && locationIds.length === 0) e.locations = t("missing.location");
    setErrors(e);
    setStepError(problem);
    const ok = !problem && Object.keys(e).length === 0;
    if (!ok) {
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>('[aria-invalid="true"], [data-step-error]');
        // A group is not focusable; its first control is.
        const target = el && !el.matches("input, select, textarea, button, [tabindex]") ? (el.querySelector<HTMLElement>("input, select, textarea, button") ?? el) : el;
        target?.focus?.();
        el?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    }
    return ok;
  };
  const next = () => {
    if (!validate(stepKey)) return;
    go(stepIndex + 1);
  };

  const toggleLocation = (id: string) =>
    setLocationIds((ls) => (ls.includes(id) ? ls.filter((x) => x !== id) : [...ls, id]));

  const addLocation = async () => {
    setAddingLoc(true);
    const res = await createLocation({
      name: newLocName, addressLine1: "", city: newLocCity, country: "Bangladesh",
      timezone: "Asia/Dhaka", openingHours: [], status: "active",
    });
    setAddingLoc(false);
    if (res.ok) {
      setLocations((ls) => [...ls, res.data]);
      setLocationIds((ids) => [...ids, res.data.id]);
      setAddLocOpen(false);
      setNewLocName(""); setNewLocCity("");
      toast.success(t("locationAdded"));
    } else {
      toast.error(res.error.message);
    }
  };

  const publish = async (onSale: boolean) => {
    if (!booking) return;
    /* Put on sale is never greyed out: pressed early, it goes to the first
       thing missing and says so there. */
    if (onSale && !ready) {
      const first = checks.find((c) => !c.done)!;
      goTo(first.step);
      if (first.step === "where" && channelDone) setStepError(t("missing.channelConfirm"));
      else validate(first.step);
      return;
    }
    setSaving(true);
    setErrors({});
    const channels: Channel[] = [];
    if (counter) channels.push("counter");
    if (online) channels.push("online");
    const input: ProductInput = {
      name, description,
      images: images.map(({ id, url, alt }) => ({ id, url, alt })),
      categoryId: categoryId || null,
      bookingType: booking.bookingType,
      tiers: tiers.map((x) => ({ id: x.id, name: x.name, price: majorToMinor(x.price), maxPerOrder: x.maxPerOrder ? parseInt(x.maxPerOrder, 10) : undefined, admits: parseInt(x.admits, 10) || 1, ageNote: x.ageNote || undefined, active: x.active })),
      locationIds, channels,
      status: onSale ? "active" : "inactive",
      validityDays: booking.validityDays,
      schedule: needsSchedule(booking.bookingType) ? schedule : null,
      resourceIds: booking.resource?.resourceIds,
      resourceExclusive: booking.resource?.exclusive,
      bufferMinutes: booking.resource?.bufferMinutes,
      flexibleDurations: booking.resource?.flexibleDurations,
      pricingBasis: booking.resource?.basis,
      // Flexible: seed the duration engine from the wizard's core; the editor
      // refines the pricing model (defaults to hourly at the first tier price).
      durationConfig: booking.resource?.durationCore
        ? {
            ...booking.resource.durationCore,
            pricingModel: "hourly" as const,
            hourlyRate: majorToMinor(tiers[0]?.price ?? ""),
            mustEndByClose: true, walkInRoundMinutes: 15, leadTimeMinutes: 0,
          }
        : undefined,
      pricingRules: pricingRules.filter((r) => r.price !== "").map((r) => ({ id: r.id ?? `pr_${globalThis.crypto.randomUUID().slice(0, 8)}`, days: r.days, fromTime: r.fromTime, toTime: r.toTime, price: majorToMinor(r.price) })),
      providerIds: booking.provider?.providerIds,
      providerNoun: booking.provider?.noun,
      providerPickable: booking.provider?.pickable,
      courseDates: booking.course?.dates,
      bundleComponentIds: booking.bundle?.componentIds,
      credits: booking.credits ?? null,
      waitlistEnabled: waitlist || booking.bookingType === "BT-11" ? true : undefined,
      taxClass: "standard",
      policies: defaultPolicies(),
    };
    const res = await createProduct(input);
    setSaving(false);
    if (res.ok) {
      toast.success(onSale ? t("toastOnSale", { name: res.data.name }) : t("toastDraft", { name: res.data.name }));
      router.push(`/catalog/bookings/${res.data.id}`);
    } else if (res.error.code === "validation" && res.error.fieldErrors) {
      setErrors(res.error.fieldErrors);
      toast.error(res.error.message);
      goTo("price");
    } else {
      toast.error(res.error.message);
    }
  };

  const kindNow: BookingKind | null = booking ? bookingKindOf(booking.bookingType) : kind;
  const priced = tiers.filter((x) => x.name.trim() && x.price !== "");
  const priceLine = priced.map((x) => `${x.name} ${formatPriceShort(majorToMinor(x.price), currency)}`).join(" · ");

  /** The schedule, in a sentence: which days, which hours, and how much. */
  const whenLine = (() => {
    if (!schedule || !booking) return null;
    const days = schedule.openDays.length === 7 ? t("everyDay") : [...schedule.openDays].sort().map((d) => DAY_LABELS[d]).join(" ");
    const hours = schedule.startTime && schedule.endTime ? `${schedule.startTime}–${schedule.endTime}` : "";
    const amount = isSlotBased(booking.bookingType)
      ? t("sessionsPerDay", { count: slotTimes(schedule).length })
      : isDailyCapped(booking.bookingType)
        ? t("perDay", { count: schedule.dailyCapacity ?? 0 })
        : "";
    const each = isSlotBased(booking.bookingType) && schedule.capacityPerSession > 0 ? t("placesEach", { count: schedule.capacityPerSession }) : "";
    const rhythm = isSlotBased(booking.bookingType)
      ? t(schedule.sessionMinutes > schedule.slotMinutes ? "everyEachOverlap" : "everyEach", { every: formatDuration(schedule.slotMinutes), each: formatDuration(schedule.sessionMinutes) })
      : "";
    return [days, hours, rhythm, amount, each].filter(Boolean).join(" · ");
  })();
  const locationNames = locations.filter((l) => locationIds.includes(l.id)).map((l) => l.name);
  /* How far ahead it can be booked and when sales close — set by the
     booking's policies, which open once it is saved; stated here so nobody
     goes on sale without knowing. */
  const policies = defaultPolicies();
  const bookingWindow = t("window", {
    days: policies.salesWindowDays,
    cutoff: policies.cutoffMinutes > 0 ? t("cutoffBefore", { time: formatDuration(policies.cutoffMinutes) }) : t("cutoffAtStart"),
  });

  return (
    <div className="grid gap-major pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-hero lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-section">
        {/* What this is, and the way back to choosing something else — the
            one route back; the breadcrumb above it is the other. */}
        {kind && (
          <div className="flex flex-wrap items-center gap-tight text-[13px]">
            <span className="text-muted">{t("adding")}</span>
            <span className="rounded-full border border-line bg-card px-comfortable py-0.5 font-medium text-fg">{tc(`type.${kind}`)}</span>
            <Link href="/catalog/new" className="inline-flex min-h-11 items-center font-medium text-brand-foreground underline-offset-2 hover:underline md:min-h-0">{t("changeKind")}</Link>
          </div>
        )}

        {/* On a phone the steps are a sentence and a bar, not six pills that
            wrap onto two lines. */}
        <div className="flex flex-col gap-inline sm:hidden">
          <p className="text-[13px] text-muted">
            {t("stepOf", { n: stepIndex + 1, total: steps.length })} · <span className="font-medium text-fg">{t(`step.${stepKey}`)}</span>
          </p>
          <span className="h-1 w-full overflow-hidden rounded-full bg-line" aria-hidden>
            <span className="block h-full rounded-full bg-ember-solid transition-[width] duration-quick" style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} />
          </span>
        </div>

        {/* Completed steps are reachable, ones ahead are not — a wizard that
            will not let you go back to a decision already made is the single
            most common complaint about the pattern. */}
        <ol className="hidden flex-wrap gap-inline sm:flex" aria-label={t("progress")}>
          {steps.map((key, i) => {
            const done = i < stepIndex;
            const current = i === stepIndex;
            return (
              <li key={key}>
                <button
                  type="button"
                  disabled={i > stepIndex}
                  aria-current={current ? "step" : undefined}
                  onClick={() => go(i)}
                  className={cn(
                    "flex min-h-9 items-center gap-inline rounded-sm px-comfortable py-tight text-[12px] transition-colors duration-quick",
                    current ? "bg-inverse text-inverse-fg" : done ? "text-fg hover:bg-muted-wash" : "text-muted",
                  )}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[12px] tabular-nums">
                    {done ? <Check size={12} strokeWidth={2} /> : i + 1}
                  </span>
                  {t(`step.${key}`)}
                </button>
              </li>
            );
          })}
        </ol>

        <div className="card-surface p-card">
          <div className="mb-section">
            <h2 className="text-[17px] font-semibold tracking-tight">{t(`title.${stepKey}`)}</h2>
            <p className="mt-inline text-[13px] text-muted">{t(`help.${stepKey}`)}</p>
          </div>

          {stepError && (
            <p role="alert" tabIndex={-1} data-step-error className="mb-section flex items-start gap-tight rounded-sm border border-danger/40 bg-danger-wash px-comfortable py-tight text-[13px] font-medium text-danger outline-none">
              <AlertTriangle size={15} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0" />
              {stepError}
            </p>
          )}

          {stepKey === "how" && (
            <BookingSetup
              value={booking}
              onChange={chooseBooking}
              resources={resources}
              team={team}
              products={products}
              onCreateResource={onCreateResource}
              start={preset.start}
            />
          )}

          {stepKey === "details" && (
            <div className="grid gap-section sm:grid-cols-2">
              <FormField
                label={t("name")}
                name="wiz-name"
                required
                placeholder={t("namePlaceholderEg", {
                  example: kindNow ? tc(`chooser.booking.${kindNow}.examples`).split(",")[0].trim().replace(/^./, (c) => c.toUpperCase()) : t("namePlaceholder"),
                })}
                value={name}
                error={errors.name}
                onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((x) => ({ ...x, name: "" })); }}
                className="sm:col-span-2"
              />
              <FormField label={t("description")} variant="textarea" placeholder={t("descriptionPlaceholder")} value={description} onChange={(e) => setDescription(e.target.value)} className="sm:col-span-2" />
              <FormField label={t("category")} variant="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} options={[{ value: "", label: t("uncategorised") }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
              <div className="sm:col-span-2"><ImageUploadField images={images} onChange={setImages} /></div>
            </div>
          )}

          {stepKey === "when" && booking && schedule && (
            <div className="flex flex-col gap-major">
              <ScheduleBuilder bookingType={booking.bookingType} value={schedule} onChange={setSchedule} team={team} />
              <p className="text-[13px] text-muted">{t("windowWithLater", { window: bookingWindow })}</p>
              <FormField label={t("waitlist")} variant="toggle" checked={waitlist} onChange={(e) => setWaitlist((e.target as HTMLInputElement).checked)} />
            </div>
          )}

          {stepKey === "price" && (
            <div className="flex flex-col gap-major">
              <PriceTiersField tiers={tiers} onChange={setTiers} errors={errors} currency={currency} heading={false} />
              {needsWhen && (
                <PricingRulesField rules={pricingRules} onChange={setPricingRules} currency={currency} basePriceMajor={tiers[0]?.price ?? ""} dayStart={schedule?.startTime} dayEnd={schedule?.endTime} />
              )}
            </div>
          )}

          {stepKey === "where" && (
            <WhereSold
              counter={counter}
              online={online}
              onCounter={(v) => { setCounter(v); setStepError(null); }}
              onOnline={(v) => { setOnline(v); setStepError(null); }}
              onlineHelp={t("onlineHelp")}
              locations={locations}
              locationIds={locationIds}
              onToggleLocation={(id) => { toggleLocation(id); setStepError(null); setErrors((x) => ({ ...x, locations: "" })); }}
              onAddLocation={() => setAddLocOpen(true)}
              error={errors.locations || null}
            />
          )}

          {/* The review is the whole booking, one row per step, each with the
              way back to change it — not a three-line summary that leaves the
              operator to remember what the schedule said four screens ago. */}
          {stepKey === "review" && (
            <div className="flex flex-col">
              <h3 className="mb-tight break-words text-[20px] font-semibold tracking-tight">{name || t("untitled")}</h3>
              <ReviewRow label={t("row.how")} onEdit={() => goTo("how")} editText={t("edit")} editLabel={t("editStep", { step: t("step.how") })}>
                {booking?.summary ?? <Missing>{t("check.how")}</Missing>}
              </ReviewRow>
              <ReviewRow label={t("row.details")} onEdit={() => goTo("details")} editText={t("edit")} editLabel={t("editStep", { step: t("step.details") })}>
                {name.trim() ? (
                  <>
                    <span className="block font-medium">{name}</span>
                    <span className="block text-muted">
                      {[categories.find((c) => c.id === categoryId)?.name ?? t("uncategorised"), images.length ? t("photos", { count: images.length }) : t("noPhoto")].join(" · ")}
                    </span>
                  </>
                ) : (
                  <Missing>{t("check.name")}</Missing>
                )}
              </ReviewRow>
              {needsWhen && (
                <ReviewRow label={t("row.when")} onEdit={() => goTo("when")} editText={t("edit")} editLabel={t("editStep", { step: t("step.when") })}>
                  {scheduleValid && whenLine ? whenLine : <Missing>{t("check.when")}</Missing>}
                  {waitlist && <span className="block text-muted">{t("waitlistOn")}</span>}
                </ReviewRow>
              )}
              <ReviewRow label={t("row.window")}>
                <span className="block">{bookingWindow}</span>
                <span className="block text-[13px] text-muted">{t("windowLater")}</span>
              </ReviewRow>
              <ReviewRow label={t("row.price")} onEdit={() => goTo("price")} editText={t("edit")} editLabel={t("editStep", { step: t("step.price") })}>
                {priced.length ? (
                  <span className="flex flex-col gap-0.5">
                    {priced.map((x, i) => (
                      <span key={i} className="flex items-baseline justify-between gap-section">
                        <span>{x.name}{x.ageNote ? <span className="text-muted"> · {x.ageNote}</span> : null}</span>
                        <span className="tabular-nums">{formatPriceShort(majorToMinor(x.price), currency)}</span>
                      </span>
                    ))}
                    {pricingRules.some((r) => r.price !== "") && (
                      <span className="text-muted">{t("bandsCount", { count: pricingRules.filter((r) => r.price !== "").length })}</span>
                    )}
                  </span>
                ) : (
                  <Missing>{t("check.price")}</Missing>
                )}
              </ReviewRow>
              <ReviewRow label={t("row.where")} onEdit={() => goTo("where")} editText={t("edit")} editLabel={t("editStep", { step: t("step.where") })}>
                <span className="flex flex-col gap-0.5">
                  <Channel on={counter} label={t("atCounter")} />
                  <Channel on={online} label={t("online")} />
                  {!online && counter && <span className="text-[13px] text-warning">{t("notOnlineShort")}</span>}
                  {locationNames.length > 0 ? <span className="text-muted">{locationNames.join(" · ")}</span> : <Missing>{t("hint.needsLocation")}</Missing>}
                </span>
              </ReviewRow>
              <p className={cn("mt-section rounded-sm px-comfortable py-tight text-[13px]", ready ? "bg-success-wash text-fg" : "bg-muted-wash text-muted")}>
                {t(ready ? "reviewReady" : "reviewNotReady")}
              </p>
            </div>
          )}
        </div>

        {/* On a phone the way forward is pinned to the bottom of the screen,
            where the thumb is, with the bottom navigation stood down while a
            booking is being made. */}
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-tight border-t border-line bg-surface/95 px-gutter pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-tight backdrop-blur-xl md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
          {/* The ready-to-sell list lives beside the form from lg; below it,
              one tap from the pinned footer. */}
          <button
            type="button"
            onClick={() => setChecklistOpen(true)}
            className={cn("flex min-h-11 items-center gap-inline text-[13px] font-medium lg:hidden", ready ? "text-success" : "text-muted")}
          >
            {ready ? <Check size={15} strokeWidth={2} aria-hidden /> : null}
            {ready ? t("readyShort") : t("leftShort", { count: checks.filter((c) => !c.done).length })}
            <ChevronRight size={14} strokeWidth={1.5} aria-hidden />
          </button>
          {stepIndex > 0 && (
            <Button variant="secondary" icon={<ArrowLeft size={16} strokeWidth={1.5} />} disabled={saving} onClick={() => go(stepIndex - 1)}>{t("back")}</Button>
          )}
          <span className="flex-1" />
          {stepKey !== "review" ? (
            <Button onClick={next}>
              {t("continue")}
              <ArrowRight size={16} strokeWidth={1.5} aria-hidden />
            </Button>
          ) : (
            <>
              <Button variant="secondary" loading={saving} onClick={() => publish(false)}>{t("saveOffSale")}</Button>
              <Button loading={saving} onClick={() => publish(true)}>{t("putOnSale")}</Button>
            </>
          )}
        </div>
      </div>

      {/* The booking as it stands, and what stands between it and the till. */}
      <aside className="hidden h-fit lg:sticky lg:top-section lg:block" aria-label={t("summaryTitle")}>
        <div className="card-surface overflow-hidden">
          <div className="border-b border-hairline p-card">
            <p className="type-label text-[12px] text-muted">{t("summaryTitle")}</p>
            <p className={cn("mt-inline break-words text-[16px] font-semibold leading-snug", !name.trim() && "text-muted")}>{name.trim() || t("untitled")}</p>
            {kindNow && <p className="mt-0.5 text-[12px] text-muted">{tc(`type.${kindNow}`)}</p>}
            {booking && <p className="mt-tight text-[13px] leading-snug">{booking.summary}</p>}
            {priceLine && <p className="mt-tight text-[13px] tabular-nums">{priceLine}</p>}
          </div>
          <div className="p-card">
            <Checklist checks={checks} reachable={(step) => seen.has(step)} onGo={goTo} ready={ready} />
          </div>
        </div>
      </aside>

      <Modal open={checklistOpen} onClose={() => setChecklistOpen(false)} title={t("readyTitle")}>
        <Checklist checks={checks} reachable={(step) => seen.has(step)} onGo={(step) => { setChecklistOpen(false); goTo(step); }} ready={ready} />
      </Modal>

      <Modal
        open={addLocOpen}
        onClose={() => setAddLocOpen(false)}
        title={t("addLocation")}
        footer={<><Button variant="secondary" onClick={() => setAddLocOpen(false)}>{t("cancel")}</Button><Button loading={addingLoc} onClick={addLocation} disabled={!newLocName.trim()}>{t("addLocation")}</Button></>}
      >
        <div className="flex flex-col gap-section">
          <FormField label={t("locationName")} required placeholder={t("locationNamePlaceholder")} value={newLocName} onChange={(e) => setNewLocName(e.target.value)} />
          <FormField label={t("city")} placeholder={t("cityPlaceholder")} value={newLocCity} onChange={(e) => setNewLocCity(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}

function ReviewRow({ label, onEdit, editLabel, editText, children }: { label: string; onEdit?: () => void; editLabel?: string; editText?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-section gap-y-inline border-t border-hairline py-comfortable text-[14px] sm:grid-cols-[8rem_minmax(0,1fr)_auto]">
      <span className="col-span-2 text-[13px] font-medium text-muted sm:col-span-1">{label}</span>
      <span className="min-w-0">{children}</span>
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          aria-label={editLabel}
          className="-my-tight flex h-11 items-center gap-inline self-start rounded-sm px-tight text-[13px] font-medium text-brand-foreground hover:bg-muted-wash sm:h-9"
        >
          <Pencil size={13} strokeWidth={1.5} aria-hidden />
          <span className="max-sm:sr-only">{editText}</span>
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}

function Missing({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-inline text-warning">
      <AlertTriangle size={13} strokeWidth={2} aria-hidden />
      {children}
    </span>
  );
}

function Channel({ on, label }: { on: boolean; label: string }) {
  const t = useTranslations("catalog.wizard");
  return (
    <span className={cn("inline-flex items-center gap-inline", !on && "text-muted")}>
      {on ? <Check size={14} strokeWidth={2} aria-hidden className="text-success" /> : <Circle size={14} strokeWidth={1.5} aria-hidden />}
      {on ? label : t("channelOff", { name: label })}
    </span>
  );
}

function Checklist({
  checks,
  reachable,
  onGo,
  ready,
}: {
  checks: { key: string; done: boolean; step: StepKey; hint?: string }[];
  reachable: (step: StepKey) => boolean;
  onGo: (step: StepKey) => void;
  ready: boolean;
}) {
  const t = useTranslations("catalog.wizard");
  return (
    <div>
      <p className="type-label mb-tight text-[12px] text-muted">{t("readyTitle")}</p>
      <ul className="flex flex-col gap-0.5">
        {checks.map((c) => (
          <li key={c.key}>
            <button
              type="button"
              disabled={!reachable(c.step)}
              onClick={() => onGo(c.step)}
              className="flex min-h-11 w-full items-start gap-tight rounded-xs px-inline py-tight text-left text-[13px] transition-colors duration-quick enabled:hover:bg-muted-wash md:min-h-9"
            >
              {c.done ? (
                <Check size={16} strokeWidth={2} aria-hidden className="mt-px shrink-0 text-success" />
              ) : (
                <Circle size={16} strokeWidth={1.5} aria-hidden className="mt-px shrink-0 text-muted" />
              )}
              <span className="flex min-w-0 flex-col">
                <span className={cn(!c.done && "text-muted")}>{t(`check.${c.key}`)}</span>
                {c.hint && <span className="text-[12px] text-warning">{c.hint}</span>}
              </span>
              <span className="sr-only">{c.done ? t("checkDone") : t("checkTodo")}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className={cn("mt-tight text-[13px] font-medium", ready ? "text-success" : "text-muted")}>
        {ready ? t("readyYes") : t("readyNo", { count: checks.filter((c) => !c.done).length })}
      </p>
    </div>
  );
}
