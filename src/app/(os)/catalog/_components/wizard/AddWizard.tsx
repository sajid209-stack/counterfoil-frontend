"use client";

import { useActiveLocation } from "@/lib/activeLocation";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, ArrowRight, Check, ChevronUp } from "lucide-react";
import { Button, FormField, Modal, Notice, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  createLocation,
  createProduct,
  createResourceRecord,
  freeSlugFor,
  tierToPrice,
  type Channel,
  type Lifecycle,
  type Location,
  type Product,
  type ProductInput,
  type ProductSchedule,
  type Resource,
  type Staff,
} from "@/lib/api";
import type { PriceTier, ProductPage } from "@/lib/api/types";
import { bookingKindOf, type BookingKind } from "@/lib/catalog";
import { formatClock, formatClockRange, formatDay, formatPriceShort } from "@/lib/format";
import { categoryById, type CategoryId } from "@/lib/events/catalog";
import { defaultPage } from "@/lib/productPage";
import { defaultSchedule, DEMO_TODAY, demoNow, isDailyCapped, isSlotBased, needsSchedule, slotTimes, usesBuffer } from "@/lib/schedule";
import { defaultPolicies } from "@/lib/tax";
import { BookingSetup, effectiveBuffer, type BookingSetupResult } from "../booking/BookingSetup";
import { ImageUploadField, type FormImage } from "../booking/ImageUploadField";
import { emptyTier, PriceTiersField, type FormTier } from "../booking/PriceTiersField";
import { PricingRulesField, type FormPricingRule } from "../booking/PricingRulesField";
import { ScheduleBufferField } from "../booking/ScheduleBufferField";
import { ScheduleBuilder } from "../booking/ScheduleBuilder";
import type { EventContent } from "../event/eventContent";
import { endsAtOf, shiftDay } from "../event/eventContent";
import { EventDetails } from "../event/EventDetails";
import { emptyTier as emptyEventTier, TicketTiers, toTiers, type FormTier as EventFormTier } from "../event/TicketTiers";
import { PageDesigner } from "../page/PageDesigner";
import { SellChannels, type OnlineChoice } from "../sell/SellChannels";
import { useCatalogFormat } from "../../_lib/useCatalogFormat";
import { seedEventPage, slugIsFine, unresolvedSamples, majorToMinor } from "./draft";
import { PER_THING, presetFor, type WizardKind } from "./kinds";
import { ChannelLine, Checklist, Missing, ReviewRow, type ReadyCheck, type StepKey } from "./parts";

/** What the event steps hold: the facts a date and a place are made of. The
 *  name, the line under it and the cover belong to the item and its page. */
interface EventFacts {
  date: string;
  startTime: string;
  endDate: string;
  endTime: string;
  days: EventContent["days"];
  venueName: string;
  venueAddress: string;
}

export interface AddWizardProps {
  /** The chooser card this came from. `booking` is "Not sure?": no kind yet. */
  kind: WizardKind;
  /** For an event: the kind of event the card chose. */
  eventType?: CategoryId | null;
  locations: Location[];
  team: Staff[];
  resources: Resource[];
  products?: Product[];
  currency?: string;
}

/**
 * Add anything to the catalog: one wizard for every kind, events included
 * (docs/catalog.md §5).
 *
 * The steps run in the order the thing is thought about: how it is booked,
 * what it is called, when it runs, what it costs, where it is sold, how its
 * page looks, and a last look at all of it. A step exists only where it means
 * something — an entry ticket has no schedule, an appointment already says how
 * it is booked, and an item that is not sold online has no page.
 *
 * Beside the form is the item as it stands and a ready-to-sell list. No button
 * in it is ever greyed out: pressed too early, Continue and Put on sale say what
 * is missing, beside the thing that is missing, and put the cursor there. A
 * disabled button that will not say why is a dead end.
 *
 * One record is made, whichever kind: a `Product`. An event is a product whose
 * booking type is BT-15 (when it is, who plays, which days a ticket admits); its
 * page starts from its kind's designed look, with the kind's sample content
 * marked so it must be edited, hidden or kept before the event can go on sale.
 */
export function AddWizard({ kind, eventType = null, locations: initialLocations, team, resources: initialResources, products = [], currency = "BDT" }: AddWizardProps) {
  const t = useTranslations("catalog.wizard");
  const ta = useTranslations("catalog.addFlow");
  const tw = useTranslations("catalog.eventWizard");
  const te = useTranslations("events");
  const tc = useTranslations("catalog");
  const tf = useTranslations("catalog.fields");
  const tSetup = useTranslations("catalog.setup");
  const td = useTranslations("catalog.eventDetails");
  const { dur: formatDuration, dayShort } = useCatalogFormat();
  const router = useRouter();
  const toast = useToast();
  const isEvent = kind === "event";
  const preset = presetFor(kind);
  const now = useMemo(() => demoNow(), []);

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  /** A step-level problem that belongs to no one field — "choose an answer". */
  const [stepError, setStepError] = useState<string | null>(null);
  /** Put on sale was refused for sample text: the one notice on the Page step turns red. */
  const [samplesRefused, setSamplesRefused] = useState(false);

  // ── what it is ────────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<FormImage[]>([]);
  const [booking, setBooking] = useState<BookingSetupResult | null>(() =>
    preset.answer
      ? { bookingType: preset.answer, summary: tSetup(preset.answer === "BT-03" ? "summary.timed" : "summary.guided") }
      : null,
  );
  const evType: CategoryId = eventType ?? "entertainment";
  const [subtype, setSubtype] = useState("");

  // ── its page, from the start: the line under the name lives in it ────────
  const [page, setPage] = useState<ProductPage>(() =>
    isEvent ? seedEventPage(eventType ?? "entertainment", te) : defaultPage({ bookingType: preset.answer ?? "BT-01" }),
  );

  // ── when ──────────────────────────────────────────────────────────────────
  const [schedule, setSchedule] = useState<ProductSchedule | null>(() => (preset.answer ? defaultSchedule(preset.answer) : null));
  const [waitlist, setWaitlist] = useState(false);
  const [ev, setEv] = useState<EventFacts>({
    /* The date is prefilled, not blank. The page preview has to draw SOME day —
       one with no date and a countdown to nothing looks broken — and a preview
       stating a date beside a field reading "Pick a date" is the screen
       contradicting itself about the one fact a guest acts on. */
    date: shiftDay(DEMO_TODAY, 14),
    startTime: "19:00",
    endDate: "",
    endTime: "",
    days: [],
    venueName: "",
    venueAddress: "",
  });

  // ── what it costs ─────────────────────────────────────────────────────────
  const [tiers, setTiers] = useState<FormTier[]>(() => [emptyTier(tf(PER_THING.includes(kind) ? "tierStandard" : "tierAdult"))]);
  const [evTiers, setEvTiers] = useState<EventFormTier[]>(() => [emptyEventTier(te("tickets.namePlaceholder"))]);
  const [pricingRules, setPricingRules] = useState<FormPricingRule[]>([]);

  // ── where it is sold ──────────────────────────────────────────────────────
  const [resources, setResources] = useState<Resource[]>(initialResources);
  const [locations, setLocations] = useState<Location[]>(initialLocations);
  const [counter, setCounter] = useState(!isEvent);
  const [online, setOnline] = useState<OnlineChoice>("listed");
  const [typedSlug, setTypedSlug] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[] | null>(null);
  /* The venue chosen in the top bar is ticked to begin with; the operator can
     untick it. */
  const active = useActiveLocation(locations);
  const locationIds = picked ?? (active.id ? [active.id] : []);
  const toggleLocation = (id: string) => setPicked(locationIds.includes(id) ? locationIds.filter((x) => x !== id) : [...locationIds, id]);
  const slug = typedSlug ?? freeSlugFor(name);

  const [addLocOpen, setAddLocOpen] = useState(false);
  const [newLocName, setNewLocName] = useState("");
  const [newLocCity, setNewLocCity] = useState("");
  const [addingLoc, setAddingLoc] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);

  const onCreateResource = async (resName: string, noun: string) => {
    const res = await createResourceRecord({
      name: resName, nounSingular: noun, nounPlural: noun.endsWith("s") ? noun : `${noun}s`,
      locationId: null, outOfService: false, outOfServiceReason: null, status: "active",
    });
    if (res.ok) { setResources((r) => [...r, res.data]); return res.data; }
    return null;
  };

  /* Choosing how it is booked also sets up its schedule, where it has one —
     here rather than in an effect that watched `booking`, which rendered once
     with the new answer and no schedule before correcting itself. A schedule
     already made is kept when the answer only changes shape within the kind. */
  const chooseBooking = (next: BookingSetupResult | null) => {
    setBooking(next);
    setStepError(null);
    setSchedule((cur) => (next && needsSchedule(next.bookingType) ? (cur ?? defaultSchedule(next.bookingType)) : null));
  };

  // ── which steps this item has ─────────────────────────────────────────────
  const showHow = !isEvent && !preset.answer;
  const needsWhen = isEvent || (!!booking && needsSchedule(booking.bookingType));
  const hasPage = online !== "off";
  const steps: StepKey[] = [
    ...(showHow ? (["how"] as const) : []),
    "name",
    ...(needsWhen ? (["when"] as const) : []),
    "price",
    "where",
    ...(hasPage ? (["page"] as const) : []),
    "review",
  ];
  const [stepKey, setStepKey] = useState<StepKey>(showHow ? "how" : "name");
  const stepIndex = Math.max(0, steps.indexOf(stepKey));
  /* The one rule the checklist follows: nothing is ticked on the operator's
     behalf. An item is done when its step has been looked at AND what it holds
     is valid — so a default schedule is not "Days and times" until somebody
     has seen it. */
  const [seen, setSeen] = useState<Set<StepKey>>(() => new Set<StepKey>(showHow ? ["how"] : ["name"]));
  const goTo = (key: StepKey) => {
    setStepError(null);
    setSamplesRefused(false);
    setSeen((cur) => (cur.has(key) ? cur : new Set(cur).add(key)));
    setStepKey(key);
  };
  const go = (i: number) => goTo(steps[Math.max(0, Math.min(steps.length - 1, i))]);

  // ── what each step needs ──────────────────────────────────────────────────
  const scheduleValid =
    isEvent || !needsWhen || !schedule || !booking
      ? true
      : isDailyCapped(booking.bookingType)
        ? (schedule.dailyCapacity ?? 0) > 0 && schedule.openDays.length > 0
        : schedule.openDays.length > 0 && (!isSlotBased(booking.bookingType) || slotTimes(schedule).length > 0);

  const eventWhenErrors = () => {
    const e: Record<string, string> = {};
    if (!ev.date) e.date = tw("missing.date");
    if (!ev.venueName.trim()) e.venueName = te("error.venue");
    const end = endsAtOf(ev);
    if (end && ev.date && Date.parse(end) <= Date.parse(`${ev.date}T${ev.startTime}:00+06:00`)) e.ends = tw("missing.ends");
    return e;
  };
  /* A blank price is not a free ticket — it is a price nobody has set. Free is
     a 0, typed, which is what the field's placeholder says. */
  const eventTicketErrors = () => {
    const e: Record<string, string> = {};
    evTiers.forEach((r, i) => {
      if (!r.name.trim()) e[i === 0 ? "tierName" : `tiers.${i}.name`] = te("error.tierName");
      if (r.price.trim() === "") e[`tiers.${i}.price`] = t("missing.tierPrice");
      if (!r.quantity.trim()) e[i === 0 ? "tierQuantity" : `tiers.${i}.quantity`] = te("error.tierQuantity");
    });
    return e;
  };
  const bookingTierErrors = () => {
    const e: Record<string, string> = {};
    if (tiers.length === 0) e.tiers = t("missing.tiers");
    tiers.forEach((x, i) => {
      if (!x.name.trim()) e[`tiers.${i}.name`] = t("missing.tierName");
      if (x.price === "") e[`tiers.${i}.price`] = t("missing.tierPrice");
    });
    return e;
  };

  const eventWhenOk = Object.keys(eventWhenErrors()).length === 0;
  const priceOk = isEvent ? Object.keys(eventTicketErrors()).length === 0 : Object.keys(bookingTierErrors()).length === 0;
  const venuesNeeded = counter || online === "listed";
  const linkOk = online === "off" || slugIsFine(slug);
  const channelOk = (counter || online !== "off") && (!venuesNeeded || locationIds.length > 0) && linkOk;
  const samples = isEvent ? unresolvedSamples(page) : [];

  const unpriced = isEvent ? evTiers.find((r) => r.name.trim() && r.price.trim() === "") : tiers.find((x) => x.name.trim() && x.price === "");

  const checks: ReadyCheck[] = [
    ...(showHow ? [{ key: "how", label: t("check.how"), done: seen.has("how") && !!booking, step: "how" as StepKey }] : []),
    { key: "name", label: t("check.name"), done: seen.has("name") && name.trim().length > 0, step: "name" },
    ...(needsWhen
      ? [{
          key: "when",
          label: isEvent ? ta("check.whenEvent") : t("check.when"),
          done: seen.has("when") && (isEvent ? eventWhenOk : scheduleValid),
          step: "when" as StepKey,
        }]
      : []),
    {
      key: "price",
      label: isEvent ? tw("check.tickets") : t("check.price"),
      done: seen.has("price") && priceOk,
      step: "price",
      hint: seen.has("price") && !priceOk ? (unpriced ? t("hint.needsPrice", { name: unpriced.name.trim() }) : t("hint.needsName")) : undefined,
    },
    {
      key: "channel",
      label: t("check.channel"),
      done: seen.has("where") && channelOk,
      step: "where",
      hint:
        seen.has("where") && !channelOk
          ? !counter && online === "off"
            ? t("nowhere")
            : venuesNeeded && locationIds.length === 0
              ? t("hint.needsLocation")
              : ta("hint.link")
          : undefined,
    },
    ...(hasPage
      ? [{
          key: "page",
          label: isEvent ? tw("check.page") : tw("check.pageBooking"),
          done: samples.length === 0,
          step: "page" as StepKey,
          hint: samples.length > 0 ? tw("hint.samples", { count: samples.length }) : undefined,
        }]
      : []),
  ];
  const ready = checks.every((c) => c.done);

  /** Mark what is wrong where it is, and put the cursor on the first of it. */
  const focusFirstProblem = () => {
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid] button, [data-invalid] input, [data-step-error]');
      // A group is not focusable; its first control is.
      const target = el && !el.matches("input, select, textarea, button, [tabindex]") ? (el.querySelector<HTMLElement>("input, select, textarea, button") ?? el) : el;
      target?.focus?.();
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  };

  /** Check one step. Says what is wrong where it is, and puts the cursor on it —
   *  the same thing Continue does and Put on sale does. */
  const validate = (key: StepKey): boolean => {
    const e: Record<string, string> = {};
    let problem: string | null = null;
    if (key === "how" && !booking) problem = t("missing.how");
    if (key === "name" && !name.trim()) e.name = t("missing.name");
    if (key === "when") {
      if (isEvent) Object.assign(e, eventWhenErrors());
      else if (!scheduleValid) problem = t("missing.when");
    }
    if (key === "price") Object.assign(e, isEvent ? eventTicketErrors() : bookingTierErrors());
    if (key === "where") {
      if (!counter && online === "off") problem = t("nowhere");
      else if (venuesNeeded && locationIds.length === 0) e.locations = t("missing.location");
      else if (!linkOk) problem = ta("missing.link");
    }
    setErrors(e);
    setStepError(problem);
    const ok = !problem && Object.keys(e).length === 0;
    if (!ok) focusFirstProblem();
    return ok;
  };
  const next = () => {
    if (!validate(stepKey)) return;
    go(stepIndex + 1);
  };

  const addLocation = async () => {
    setAddingLoc(true);
    const res = await createLocation({
      name: newLocName, addressLine1: "", city: newLocCity, country: "Bangladesh",
      timezone: "Asia/Dhaka", openingHours: [], status: "active",
    });
    setAddingLoc(false);
    if (res.ok) {
      setLocations((ls) => [...ls, res.data]);
      setPicked([...locationIds, res.data.id]);
      setAddLocOpen(false);
      setNewLocName(""); setNewLocCity("");
      toast.success(t("locationAdded"));
    } else {
      toast.error(res.error.message);
    }
  };

  // ── the record ────────────────────────────────────────────────────────────
  const startsAt = `${ev.date}T${ev.startTime}:00+06:00`;
  /** The item as one `Product` input. `preview` fills what is still empty with
   *  stand-ins, so the page never looks broken mid-wizard; a save never does. */
  const assemble = (status: Lifecycle, preview: boolean): ProductInput => {
    const channels: Channel[] = [...(counter ? (["counter"] as Channel[]) : []), ...(online !== "off" ? (["online"] as Channel[]) : [])];
    const shared = {
      name: name.trim() || (preview ? ta("untitled") : ""),
      description: description.trim() || (preview && isEvent ? te("placeholder.description") : ""),
      locationIds,
      channels,
      status,
      online: online === "off" ? undefined : online,
      slug: online !== "off" && slugIsFine(slug) ? slug.trim() : undefined,
      page,
    };
    if (isEvent) {
      const rows = toTiers(evTiers).map((x) => (preview ? { ...x, name: x.name || te("placeholder.tier"), quantity: x.quantity || 100 } : x));
      return {
        ...shared,
        images: [],
        bookingType: "BT-15",
        tiers: rows.map(tierToPrice),
        taxClass: "exempt",
        event: {
          kind: evType,
          subtype,
          startsAt,
          endsAt: endsAtOf(ev),
          days: ev.days.length > 1 ? ev.days : undefined,
          venueName: ev.venueName.trim() || (preview ? te("placeholder.venue") : ""),
          venueAddress: ev.venueAddress.trim() || undefined,
        },
      };
    }
    const bt = booking?.bookingType ?? preset.answer ?? "BT-01";
    return {
      ...shared,
      images: images.map(({ id, url, alt }) => ({ id, url, alt })),
      bookingType: bt,
      tiers: tiers
        .filter((x) => x.name.trim() || preview)
        .map((x) => ({ id: x.id, name: x.name, price: majorToMinor(x.price), maxPerOrder: x.maxPerOrder ? parseInt(x.maxPerOrder, 10) : undefined, admits: parseInt(x.admits, 10) || 1, ageNote: x.ageNote || undefined, active: x.active })),
      validityDays: booking?.validityDays,
      schedule: needsSchedule(bt) ? schedule : null,
      resourceIds: booking?.resource?.resourceIds,
      resourceExclusive: booking?.resource?.exclusive,
      bufferMinutes: booking && usesBuffer(bt) ? effectiveBuffer(booking) : undefined,
      flexibleDurations: booking?.resource?.flexibleDurations,
      pricingBasis: booking?.resource?.basis,
      // Flexible: seed the duration engine from the wizard's core; the editor
      // refines the pricing model (defaults to hourly at the first tier price).
      durationConfig: booking?.resource?.durationCore
        ? {
            ...booking.resource.durationCore,
            pricingModel: "hourly" as const,
            hourlyRate: majorToMinor(tiers[0]?.price ?? ""),
            mustEndByClose: true, walkInRoundMinutes: 15, leadTimeMinutes: 0,
          }
        : undefined,
      pricingRules: pricingRules.filter((r) => r.price !== "").map((r) => ({ id: r.id ?? `pr_${globalThis.crypto.randomUUID().slice(0, 8)}`, days: r.days, fromTime: r.fromTime, toTime: r.toTime, price: majorToMinor(r.price) })),
      providerIds: booking?.provider?.providerIds,
      providerNoun: booking?.provider?.noun,
      providerPickable: booking?.provider?.pickable,
      courseDates: booking?.course?.dates,
      bundleComponentIds: booking?.bundle?.componentIds,
      credits: booking?.credits ?? null,
      waitlistEnabled: waitlist || bt === "BT-11" ? true : undefined,
      taxClass: "standard",
      policies: defaultPolicies(),
    };
  };

  /** The draft as the page designer draws it. */
  const draftProduct = (): Product => {
    const input = assemble("inactive", true);
    return {
      ...input,
      tiers: input.tiers.map((x, i) => ({ ...x, id: x.id ?? `draft_t${i}` })) as PriceTier[],
      id: "draft",
      archivedAt: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  };

  const publish = async (onSale: boolean) => {
    /* Put on sale is never greyed out: pressed early, it goes to the first
       thing missing and says so there. Saving off sale only needs the facts a
       record cannot exist without. */
    const need: ReadyCheck | undefined = onSale
      ? checks.find((c) => !c.done)
      : checks.find((c) => ["how", "name"].includes(c.key) && !c.done) ??
        (isEvent && !eventWhenOk ? checks.find((c) => c.key === "when") : undefined);
    if (need) {
      goTo(need.step);
      if (need.step === "page") {
        /* One notice, not two: the one already there turns red, takes focus,
           and the first sample is brought into view. */
        setSamplesRefused(true);
        requestAnimationFrame(() => {
          document.querySelector<HTMLElement>("[data-samples-notice]")?.focus({ preventScroll: true });
          const first = samples[0] ? document.querySelector<HTMLElement>(`[data-section="${samples[0]}"]`) : null;
          (first ?? document.querySelector<HTMLElement>("[data-samples-notice]"))?.scrollIntoView({ block: "center", behavior: "smooth" });
        });
      }
      else if (need.step === "where" && channelOk && !seen.has("where")) setStepError(t("missing.channelConfirm"));
      else validate(need.step);
      return;
    }
    if (!onSale && !isEvent && !booking) { goTo("how"); validate("how"); return; }
    setSaving(true);
    const res = await createProduct(assemble(onSale ? "active" : "inactive", false));
    setSaving(false);
    if (res.ok) {
      toast.success(onSale ? t("toastOnSale", { name: res.data.name }) : t("toastDraft", { name: res.data.name }));
      // To the thing just made, not back to a list to find it in.
      router.push(`/catalog/${res.data.id}`);
    } else if (res.error.code === "validation" && res.error.fieldErrors) {
      setErrors(res.error.fieldErrors);
      toast.error(res.error.message);
      goTo(res.error.fieldErrors.name ? "name" : "price");
    } else {
      toast.error(res.error.message);
    }
  };

  // ── the event's facts, as EventDetails and TicketTiers read them ─────────
  const evContent: EventContent = {
    title: name,
    subtitle: page.tagline ?? "",
    description,
    coverUrl: page.coverUrl ?? "",
    date: ev.date,
    startTime: ev.startTime,
    endDate: ev.endDate,
    endTime: ev.endTime,
    days: ev.days,
    venueName: ev.venueName,
    venueAddress: ev.venueAddress,
    videoUrl: page.videoUrl ?? "",
    organiserName: page.organiser?.name ?? "",
    organiserBlurb: page.organiser?.blurb ?? "",
    lineup: page.lineup,
    faq: page.faq,
  };
  const patchEvent = (p: Partial<EventContent>) => {
    if (p.title !== undefined) setName(p.title);
    if (p.subtitle !== undefined) setPage((pg) => ({ ...pg, tagline: p.subtitle || undefined }));
    if (p.coverUrl !== undefined) setPage((pg) => ({ ...pg, coverUrl: p.coverUrl || undefined }));
    setEv((cur) => ({
      ...cur,
      ...(p.date !== undefined ? { date: p.date } : {}),
      ...(p.startTime !== undefined ? { startTime: p.startTime } : {}),
      ...(p.endDate !== undefined ? { endDate: p.endDate } : {}),
      ...(p.endTime !== undefined ? { endTime: p.endTime } : {}),
      ...(p.days !== undefined ? { days: p.days } : {}),
      ...(p.venueName !== undefined ? { venueName: p.venueName } : {}),
      ...(p.venueAddress !== undefined ? { venueAddress: p.venueAddress } : {}),
    }));
    setErrors((e) => {
      const nextErrors = { ...e };
      for (const k of Object.keys(p)) delete nextErrors[k.startsWith("end") ? "ends" : k];
      return nextErrors;
    });
  };

  // ── how it reads ──────────────────────────────────────────────────────────
  const kindNow: BookingKind | null = booking ? bookingKindOf(booking.bookingType) : kind === "booking" || isEvent ? null : kind;
  const kindLabel = isEvent ? te(`category.${categoryById(evType).key}`) : kindNow ? tc(`type.${kindNow}`) : null;
  const priced = tiers.filter((x) => x.name.trim() && x.price !== "");
  const priceLine = isEvent
    ? (() => {
        const rows = toTiers(evTiers.filter((r) => r.name.trim() && r.price.trim() !== ""));
        const cap = toTiers(evTiers).filter((x) => x.name).reduce((n, x) => n + x.quantity, 0);
        if (!rows.length) return "";
        const from = Math.min(...rows.map((x) => x.price));
        return cap > 0 ? tw("fromAndCap", { price: from === 0 ? te("free") : formatPriceShort(from), count: cap.toLocaleString() }) : "";
      })()
    : priced.map((x) => `${x.name} ${formatPriceShort(majorToMinor(x.price), currency)}`).join(" · ");

  /** The schedule, in a sentence: which days, which hours, and how much. */
  const whenLine = (() => {
    if (isEvent) {
      if (!ev.date) return null;
      return (
        [formatDay(ev.date, { weekday: true }), ev.endTime ? formatClockRange(ev.startTime, ev.endTime) : formatClock(ev.startTime)].join(" · ") +
        (ev.days.length > 1 ? ` · ${ta("days", { count: ev.days.length })}` : ev.endDate && ev.endDate !== ev.date ? ` → ${formatDay(ev.endDate, { weekday: true })}` : "")
      );
    }
    if (!schedule || !booking) return null;
    const days = schedule.openDays.length === 7 ? t("everyDay") : [...schedule.openDays].sort().map((d) => dayShort(d)).join(" ");
    const hours = schedule.startTime && schedule.endTime ? formatClockRange(schedule.startTime, schedule.endTime) : "";
    const amount = isSlotBased(booking.bookingType)
      ? t("sessionsPerDay", { count: slotTimes(schedule).length })
      : isDailyCapped(booking.bookingType)
        ? t("perDay", { count: schedule.dailyCapacity ?? 0 })
        : "";
    const each = isSlotBased(booking.bookingType) && schedule.capacityPerSession > 0 ? t("placesEach", { count: schedule.capacityPerSession }) : "";
    const rhythm = isSlotBased(booking.bookingType)
      ? t(schedule.sessionMinutes > schedule.slotMinutes ? "everyEachOverlap" : "everyEach", { every: formatDuration(schedule.slotMinutes), each: formatDuration(schedule.sessionMinutes) })
      : "";
    const buffer = usesBuffer(booking.bookingType) ? effectiveBuffer(booking) : 0;
    const bufferLine = buffer > 0 ? t("bufferLine", { time: formatDuration(buffer) }) : "";
    return [days, hours, rhythm, amount, each, bufferLine].filter(Boolean).join(" · ");
  })();
  // Appointments (BT-10) have no "when" row at all — their buffer is shown
  // beside the "how it's booked" summary instead, where it was set.
  const bufferMinutes = booking ? effectiveBuffer(booking) : 0;
  const locationNames = locations.filter((l) => locationIds.includes(l.id)).map((l) => l.name);
  /* How far ahead it can be booked and when sales close — set by the booking's
     policies, which open once it is saved; stated here so nobody goes on sale
     without knowing. */
  const policies = defaultPolicies();
  const bookingWindow = t("window", {
    days: policies.salesWindowDays,
    cutoff: policies.cutoffMinutes > 0 ? t("cutoffBefore", { time: formatDuration(policies.cutoffMinutes) }) : t("cutoffAtStart"),
  });

  const editText = t("edit");
  const editLabel = (key: StepKey) => t("editStep", { step: ta(`step.${key}`) });
  const pageLine = !hasPage ? null : isEvent ? te(`category.${categoryById(page.look === "standard" ? evType : page.look).key}`) : ta("review.pageStandard");

  return (
    <div className="grid gap-major pb-[calc(9rem+env(safe-area-inset-bottom))] md:pb-hero lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-section">
        {/* What this is, and the way back to choosing something else — the one
            route back; the breadcrumb above it is the other. */}
        {(kindLabel || kind === "booking") && (
          <div className="flex flex-wrap items-center gap-tight text-sm">
            <span className="text-muted">{t("adding")}</span>
            <span className="rounded-full bg-muted-wash px-comfortable py-0.5 font-medium text-fg">{kindLabel ?? ta("notSure")}</span>
            <Link href="/catalog/new" className="inline-flex min-h-11 items-center font-medium text-brand-foreground underline-offset-2 hover:underline md:min-h-0">{t("changeKind")}</Link>
          </div>
        )}

        {/* On a phone the steps are a sentence and a bar, not seven pills that
            wrap onto two lines. */}
        <div className="flex flex-col gap-inline sm:hidden">
          <p className="text-sm text-muted">
            {t("stepOf", { n: stepIndex + 1, total: steps.length })} · <span className="font-medium text-fg">{ta(`step.${stepKey}`)}</span>
          </p>
          <span className="h-1 w-full overflow-hidden rounded-full bg-line" aria-hidden>
            <span className="block h-full rounded-full bg-ember-solid transition-[width] duration-quick" style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} />
          </span>
        </div>

        {/* Completed steps are reachable, ones ahead are not — a wizard that
            will not let you go back to a decision already made is the single
            most common complaint about the pattern. Only the steps this item
            has are drawn. */}
        <ol className="hidden flex-wrap gap-inline sm:flex" aria-label={t("progress")}>
          {steps.map((key, i) => {
            const done = i < stepIndex;
            const current = i === stepIndex;
            return (
              <li key={key}>
                <button
                  type="button"
                  disabled={i > stepIndex && !seen.has(key)}
                  aria-current={current ? "step" : undefined}
                  onClick={() => go(i)}
                  className={cn(
                    "flex min-h-9 items-center gap-inline rounded-control px-comfortable py-tight text-xs transition-colors duration-quick",
                    current ? "bg-inverse text-inverse-fg" : done || seen.has(key) ? "text-fg hover:bg-muted-wash" : "text-muted",
                  )}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-xs tabular-nums">
                    {done ? <Check size={12} strokeWidth={2} /> : i + 1}
                  </span>
                  {ta(`step.${key}`)}
                </button>
              </li>
            );
          })}
        </ol>

        {/* The page is drawn by the designer, which brings its own cards; every
            other step is one card with its question on top. */}
        <div className={cn(stepKey !== "page" && "card-surface p-card")}>
          <div className="mb-section">
            <h2 className="text-md font-semibold text-fg">{ta(stepKey === "when" && isEvent ? "title.whenEvent" : stepKey === "price" && isEvent ? "title.priceEvent" : `title.${stepKey}`)}</h2>
            <p className="mt-inline text-sm text-muted">{ta(stepKey === "when" && isEvent ? "help.whenEvent" : stepKey === "price" && isEvent ? "help.priceEvent" : `help.${stepKey}`)}</p>
          </div>

          {stepError && (
            <p role="alert" tabIndex={-1} data-step-error className="mb-section flex items-start gap-tight rounded-card bg-danger-wash p-comfortable text-sm font-medium text-fg outline-none">
              <AlertTriangle size={15} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0 text-danger" />
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

          {stepKey === "name" && (
            <div className="grid gap-section sm:grid-cols-2">
              <FormField
                label={t("name")}
                name="wiz-name"
                required
                placeholder={t("namePlaceholderEg", {
                  example: isEvent
                    ? td(`example.${categoryById(evType).key}`)
                    : kindNow
                      ? tc(`chooser.booking.${kindNow}.examples`).split(",")[0].trim().replace(/^./, (c) => c.toUpperCase())
                      : t("namePlaceholder"),
                })}
                value={name}
                error={errors.name}
                onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((x) => ({ ...x, name: "" })); }}
                className="sm:col-span-2"
              />
              <FormField
                label={ta("summary")}
                name="wiz-summary"
                help={ta("summaryHelp")}
                placeholder={t("namePlaceholderEg", { example: isEvent ? td("subtitleExample") : ta("summaryExample") })}
                value={page.tagline ?? ""}
                onChange={(e) => setPage((pg) => ({ ...pg, tagline: e.target.value || undefined }))}
                className="sm:col-span-2"
              />
              {isEvent && (
                <>
                  <FormField
                    label={td("kind")}
                    variant="select"
                    help={td("kindHelp")}
                    value={subtype}
                    onChange={(e) => setSubtype(e.target.value)}
                    options={[{ value: "", label: td("kindNone") }, ...categoryById(evType).subtypes.map((s) => ({ value: s, label: te(`subtype.${s}`) }))]}
                  />
                </>
              )}
              <FormField label={t("description")} variant="textarea" placeholder={t("descriptionPlaceholder")} value={description} onChange={(e) => setDescription(e.target.value)} className="sm:col-span-2" />
              <div className="sm:col-span-2">
                {isEvent ? (
                  <EventDetails categoryId={evType} content={evContent} onContent={patchEvent} errors={errors} show={["cover"]} />
                ) : (
                  <ImageUploadField images={images} onChange={setImages} />
                )}
              </div>
            </div>
          )}

          {stepKey === "when" && isEvent && (
            <EventDetails
              categoryId={evType}
              content={evContent}
              onContent={patchEvent}
              errors={errors}
              show={["when", "where"]}
              scopedTickets={evTiers.filter((r) => r.dayIds.length > 0).length}
              onUntieTickets={() => setEvTiers((rows) => rows.map((r) => (r.dayIds.length ? { ...r, dayIds: [] } : r)))}
            />
          )}

          {stepKey === "when" && !isEvent && booking && schedule && (
            <div className="flex flex-col gap-major">
              <ScheduleBuilder
                bookingType={booking.bookingType}
                value={schedule}
                onChange={setSchedule}
                team={team}
                bufferMinutes={effectiveBuffer(booking)}
                bufferSlot={<ScheduleBufferField booking={booking} onChange={setBooking} resources={resources} />}
              />
              <p className="text-sm text-muted">{t("windowWithLater", { window: bookingWindow })}</p>
              <FormField label={t("waitlist")} variant="toggle" checked={waitlist} onChange={(e) => setWaitlist((e.target as HTMLInputElement).checked)} />
            </div>
          )}

          {stepKey === "price" && (
            isEvent ? (
              <TicketTiers rows={evTiers} onChange={setEvTiers} errors={errors} days={ev.days} />
            ) : (
              <div className="flex flex-col gap-major">
                <PriceTiersField tiers={tiers} onChange={setTiers} errors={errors} currency={currency} heading={false} />
                {needsWhen && (
                  <PricingRulesField rules={pricingRules} onChange={setPricingRules} currency={currency} basePriceMajor={tiers[0]?.price ?? ""} dayStart={schedule?.startTime} dayEnd={schedule?.endTime} />
                )}
              </div>
            )
          )}

          {stepKey === "where" && (
            <SellChannels
              counter={counter}
              onCounter={(v) => { setCounter(v); setStepError(null); }}
              online={online}
              onOnline={(v) => { setOnline(v); setStepError(null); }}
              slug={slug}
              onSlug={(s) => { setTypedSlug(s); setStepError(null); }}
              name={name}
              locations={locations}
              locationIds={locationIds}
              onToggleLocation={(id) => { toggleLocation(id); setStepError(null); setErrors((x) => ({ ...x, locations: "" })); }}
              onAddLocation={() => setAddLocOpen(true)}
              error={errors.locations || null}
              compact
            />
          )}

          {stepKey === "page" && (
            <div className="flex flex-col gap-section">
              {samples.length > 0 && (
                <div data-samples-notice tabIndex={-1} className="outline-none">
                  <Notice tone={samplesRefused ? "danger" : "warning"} size="sm">
                    {tw("hint.samples", { count: samples.length })}
                  </Notice>
                </div>
              )}
              <PageDesigner
                product={draftProduct()}
                page={page}
                onPage={setPage}
                onEditDetails={() => goTo("name")}
                onEditTickets={() => goTo("price")}
                onDescription={setDescription}
              />
            </div>
          )}

          {/* The review is the whole item, one row per step, each with the way
              back to change it — not a three-line summary that leaves the
              operator to remember what the schedule said four screens ago. */}
          {stepKey === "review" && (
            <div className="flex flex-col">
              <h3 className="mb-tight break-words text-xl font-semibold text-fg">{name || ta("untitled")}</h3>
              {showHow && (
                <ReviewRow label={ta("row.how")} onEdit={() => goTo("how")} editText={editText} editLabel={editLabel("how")}>
                  {booking?.summary ?? <Missing>{t("check.how")}</Missing>}
                  {/* A kind with no "when" step (an appointment) still shows its
                      buffer — it was set here, so it reads here too. */}
                  {!needsWhen && bufferMinutes > 0 && <span className="block text-muted">{t("bufferLine", { time: formatDuration(bufferMinutes) })}</span>}
                </ReviewRow>
              )}
              <ReviewRow label={ta("row.name")} onEdit={() => goTo("name")} editText={editText} editLabel={editLabel("name")}>
                {name.trim() ? (
                  <>
                    <span className="block font-medium">{name}</span>
                    {page.tagline && <span className="block text-muted">{page.tagline}</span>}
                    <span className="block text-muted">
                      {isEvent ? (page.coverUrl ? ta("review.cover") : ta("review.noCover")) : images.length ? t("photos", { count: images.length }) : t("noPhoto")}
                    </span>
                  </>
                ) : (
                  <Missing>{t("check.name")}</Missing>
                )}
              </ReviewRow>
              {needsWhen && (
                <ReviewRow label={ta("row.when")} onEdit={() => goTo("when")} editText={editText} editLabel={editLabel("when")}>
                  {isEvent ? (
                    eventWhenOk && whenLine ? (
                      <>
                        <span className="block">{whenLine}</span>
                        <span className="block text-muted">{[ev.venueName.trim(), ev.venueAddress.trim()].filter(Boolean).join(" · ")}</span>
                      </>
                    ) : (
                      <Missing>{ta("check.whenEvent")}</Missing>
                    )
                  ) : scheduleValid && whenLine ? (
                    whenLine
                  ) : (
                    <Missing>{t("check.when")}</Missing>
                  )}
                  {!isEvent && waitlist && <span className="block text-muted">{t("waitlistOn")}</span>}
                </ReviewRow>
              )}
              {!isEvent && (
                <ReviewRow label={t("row.window")}>
                  <span className="block">{bookingWindow}</span>
                  <span className="block text-sm text-muted">{t("windowLater")}</span>
                </ReviewRow>
              )}
              <ReviewRow label={ta("row.price")} onEdit={() => goTo("price")} editText={editText} editLabel={editLabel("price")}>
                {isEvent ? (
                  priceOk ? (
                    <span className="flex flex-col gap-0.5">
                      {toTiers(evTiers).map((x, i) => (
                        <span key={i} className="flex items-baseline justify-between gap-section">
                          <span>{x.name}<span className="text-muted"> · {tw("qty", { count: x.quantity })}</span></span>
                          <span className="tabular-nums">{x.price === 0 ? te("free") : formatPriceShort(x.price)}</span>
                        </span>
                      ))}
                    </span>
                  ) : (
                    <Missing>{tw("check.tickets")}</Missing>
                  )
                ) : priced.length ? (
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
              <ReviewRow label={ta("row.where")} onEdit={() => goTo("where")} editText={editText} editLabel={editLabel("where")}>
                <span className="flex flex-col gap-0.5">
                  <ChannelLine on={counter} label={t("atCounter")} />
                  <ChannelLine on={online !== "off"} label={online === "link" ? ta("review.onlineLink") : t("online")} />
                  {online === "off" && counter && <span className="text-sm text-warning">{t("notOnlineShort")}</span>}
                  {online !== "off" && linkOk && <span className="font-mono text-sm text-muted">/b/{slug.trim()}</span>}
                  {locationNames.length > 0 ? <span className="text-muted">{locationNames.join(" · ")}</span> : venuesNeeded ? <Missing>{t("hint.needsLocation")}</Missing> : null}
                </span>
              </ReviewRow>
              <ReviewRow label={ta("row.page")} onEdit={hasPage ? () => goTo("page") : undefined} editText={editText} editLabel={editLabel("page")}>
                {hasPage ? (
                  <span className="flex flex-col gap-0.5">
                    <span>{pageLine}</span>
                    {isEvent && samples.length > 0 ? <Missing>{tw("hint.samples", { count: samples.length })}</Missing> : <span className="text-muted">{ta("review.pageSections", { count: page.sections.length })}</span>}
                  </span>
                ) : (
                  <span className="text-muted">{ta("rail.noPage")}</span>
                )}
              </ReviewRow>
              <Notice tone={ready ? "success" : "neutral"} size="sm" icon={null} className="mt-section">
                {ready ? t("reviewReady") : t("reviewNotReady")}
              </Notice>
            </div>
          )}
        </div>

        {/* On a phone the way forward is pinned to the bottom of the screen,
            where the thumb is. The shell stands its floating menu button down
            while something is being made, so the bar has the whole width.
            "What's left" folds out above the buttons rather than sitting
            beside the form (the ready list lives beside the form from lg). */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-chrome pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:static md:z-auto md:border-0 md:bg-transparent md:pb-0">
          {checklistOpen && (
            <div className="max-h-[45vh] overflow-y-auto px-gutter pt-tight lg:hidden">
              <Checklist checks={checks} reachable={(step) => seen.has(step)} onGo={(step) => { setChecklistOpen(false); goTo(step); }} ready={ready} noPage={!hasPage} bare />
            </div>
          )}
          <button
            type="button"
            onClick={() => setChecklistOpen((v) => !v)}
            aria-expanded={checklistOpen}
            className="flex min-h-11 w-full items-center gap-tight px-gutter text-left text-sm lg:hidden"
          >
            <span className="font-medium text-fg">{t("whatsLeft")}</span>
            <span className={cn("flex-1", ready ? "text-success" : "text-muted")}>
              {ready ? <Check size={14} strokeWidth={2} aria-hidden className="mr-1 inline" /> : null}
              {ready ? t("readyShort") : t("leftShort", { count: checks.filter((c) => !c.done).length })}
            </span>
            <ChevronUp size={16} strokeWidth={1.5} aria-hidden className={cn("text-muted transition-transform duration-quick", !checklistOpen && "rotate-180")} />
          </button>
          <div className="flex items-center gap-tight px-gutter pt-tight md:p-0">
            {stepIndex > 0 && (
              <Button variant="tertiary" disabled={saving} onClick={() => go(stepIndex - 1)}>{t("back")}</Button>
            )}
            <span className="flex-1" />
            {stepKey !== "review" ? (
              <Button onClick={next}>
                {stepKey === "page" ? ta("usePage") : t("continue")}
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
      </div>

      {/* The item as it stands, and what stands between it and the counter. */}
      <aside className="hidden h-fit lg:sticky lg:top-section lg:block" aria-label={isEvent ? tw("summaryTitle") : t("summaryTitle")}>
        <div className="card-surface flex flex-col gap-section p-card">
          <div>
            <p className="text-sm font-medium text-muted">{isEvent ? tw("summaryTitle") : t("summaryTitle")}</p>
            <p className={cn("mt-inline break-words text-md font-semibold leading-snug", !name.trim() && "text-muted")}>{name.trim() || ta("untitled")}</p>
            {kindLabel && <p className="mt-0.5 text-sm text-muted">{kindLabel}</p>}
            {!isEvent && booking && <p className="mt-tight text-sm leading-snug">{booking.summary}</p>}
            {isEvent && seen.has("when") && whenLine && <p className="mt-tight text-sm">{whenLine}</p>}
            {isEvent && ev.venueName.trim() && <p className="text-sm text-muted">{ev.venueName.trim()}</p>}
            {!isEvent && bufferMinutes > 0 && <p className="mt-tight text-sm text-muted">{t("bufferLine", { time: formatDuration(bufferMinutes) })}</p>}
            {priceLine && <p className="mt-tight text-sm tabular-nums">{priceLine}</p>}
          </div>
          <Checklist checks={checks} reachable={(step) => seen.has(step)} onGo={goTo} ready={ready} noPage={!hasPage} />
        </div>
      </aside>

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
