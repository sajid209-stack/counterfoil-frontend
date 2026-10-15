"use client";

import { useActiveLocation } from "@/lib/activeLocation";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, ArrowRight, Check, ChevronUp } from "lucide-react";
import { Button, Checkbox, FormField, Modal, Notice, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  createLocation,
  createProduct,
  createResourceRecord,
  freeSlugFor,
  type BookingTypeCode,
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
import { bookingWayOf, type BookingWay } from "@/lib/catalog";
import { formatClock, formatClockRange, formatDay, formatPriceShort } from "@/lib/format";
import { defaultPage } from "@/lib/productPage";
import { defaultSchedule, DEMO_TODAY, demoNow, isDailyCapped, isSlotBased, needsSchedule, slotTimes, usesBuffer } from "@/lib/schedule";
import { defaultPolicies } from "@/lib/tax";
import { BookingSetup, effectiveBuffer, type BookingSetupResult, type SetupStart } from "../booking/BookingSetup";
import { ImageUploadField, type FormImage } from "../booking/ImageUploadField";
import { PricingRulesField, type FormPricingRule } from "../booking/PricingRulesField";
import { ScheduleBufferField } from "../booking/ScheduleBufferField";
import { ScheduleBuilder } from "../booking/ScheduleBuilder";
import type { EventContent } from "../event/eventContent";
import { endsAtOf, shiftDay } from "../event/eventContent";
import { EventDetails } from "../event/EventDetails";
import { PageDesigner } from "../page/PageDesigner";
import { SellChannels, type OnlineChoice } from "../sell/SellChannels";
import { TicketEditor } from "../tickets/TicketEditor";
import { emptyTicket, ticketsToInputs, type TicketRow } from "../tickets/ticketRows";
import { useCatalogFormat } from "../../_lib/useCatalogFormat";
import { majorToMinor, slugIsFine } from "./draft";
import { ChannelLine, Checklist, Missing, ReviewRow, type ReadyCheck, type StepKey } from "./parts";
import { WaysToBook } from "./WaysToBook";

/** What an on-a-date booking is made of: the facts a date and a place are. The
 *  name, the line under it and the cover belong to the booking and its page. */
interface EventFacts {
  date: string;
  startTime: string;
  endDate: string;
  endTime: string;
  days: EventContent["days"];
  venueName: string;
  venueAddress: string;
}

/** The ways whose question is answered by the existing question flows. */
const SETUP_START: Partial<Record<BookingWay, SetupStart>> = {
  byhour: "resource",
  person: "provider",
  course: "course",
  pack: "credits",
  combined: "bundle",
};
/** The message that says what a question flow still needs, by the answer it sits under. */
const SETUP_MISSING: Partial<Record<BookingWay, "resource" | "provider" | "course" | "credits" | "bundle">> = {
  byhour: "resource",
  person: "provider",
  course: "course",
  pack: "credits",
  combined: "bundle",
};
/** A booking sold per lane, appointment, pack or course starts with one
 *  Standard price; one sold per person starts with an Adult ticket. */
const PER_THING: BookingWay[] = ["byhour", "person", "pack", "combined", "course"];

export interface AddWizardProps {
  locations: Location[];
  team: Staff[];
  resources: Resource[];
  products?: Product[];
  currency?: string;
}

/**
 * Add a booking (docs/catalog.md §10.3). Everything the Catalog sells is one
 * thing, a booking; it differs only in HOW people book it, which is an answer
 * inside it rather than a type on it.
 *
 * Name → When → Tickets & prices → Where it's sold → Page → Check. The Page
 * step is skipped when the booking is not sold online, because no customer will
 * see one. "When" opens with one plain question, *How do people book it?*, and
 * the details of the chosen answer open underneath it. The booking type behind
 * the answer is derived and never shown.
 *
 * Beside the form is the booking as it stands and a ready-to-sell list. No
 * button in it is ever greyed out: pressed too early, Continue and Put on sale
 * say what is missing, beside the thing that is missing, and put the cursor
 * there. A disabled button that will not say why is a dead end.
 *
 * One record is made, whichever way it is booked: a `Product`. A booking on a
 * date is one whose booking type is BT-15 (the day or days, the place); it has no
 * "kind of event" to answer. Its page starts as the default page, with no sample
 * text (§10.5).
 */
export function AddWizard({ locations: initialLocations, team, resources: initialResources, products = [], currency = "BDT" }: AddWizardProps) {
  const t = useTranslations("catalog.wizard");
  const ta = useTranslations("catalog.addFlow");
  const tw = useTranslations("catalog.ways");
  const tf = useTranslations("catalog.fields");
  const tSetup = useTranslations("catalog.setup");
  const tk = useTranslations("catalog.tickets");
  const tc = useTranslations("catalog");
  const tev = useTranslations("catalog.eventWizard");
  const te = useTranslations("events");
  const { dur: formatDuration, dayShort } = useCatalogFormat();
  const router = useRouter();
  const toast = useToast();
  const now = useMemo(() => demoNow(), []);

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  /** A step-level problem that belongs to no one field — "choose an answer". */
  const [stepError, setStepError] = useState<string | null>(null);

  // ── what it is ────────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<FormImage[]>([]);

  // ── how it is booked ──────────────────────────────────────────────────────
  const [way, setWay] = useState<BookingWay | null>(null);
  const [limitDay, setLimitDay] = useState(false);
  const [validOn, setValidOn] = useState(false);
  const [validDays, setValidDays] = useState("7");
  const [guided, setGuided] = useState(false);
  /** The result of the existing question flows (by the hour, a person, a course,
   *  a pack, a combo) — and, for the simple answers, the one derived from them. */
  const [booking, setBooking] = useState<BookingSetupResult | null>(null);
  const [schedule, setSchedule] = useState<ProductSchedule | null>(null);
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

  // ── its page ──────────────────────────────────────────────────────────────
  /* The page starts as the default for the booking. Until the designer changes
     it, it follows the way (an on-a-date booking gets its countdown). */
  const [page, setPage] = useState<ProductPage>(() => defaultPage({ bookingType: "BT-01" }));
  const [pageTouched, setPageTouched] = useState(false);

  // ── what it costs ─────────────────────────────────────────────────────────
  const [tickets, setTickets] = useState<TicketRow[]>(() => [emptyTicket(tf("tierAdult"))]);
  const [pricingRules, setPricingRules] = useState<FormPricingRule[]>([]);

  // ── where it is sold ──────────────────────────────────────────────────────
  const [resources, setResources] = useState<Resource[]>(initialResources);
  const [locations, setLocations] = useState<Location[]>(initialLocations);
  const [counter, setCounter] = useState(true);
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

  // ── the booking type, derived from the answers ────────────────────────────
  const isEvent = way === "ondate";
  const daysN = Math.max(0, parseInt(validDays, 10) || 0);
  /** The booking type the answers add up to, or null while one is still open. */
  const bookingType: BookingTypeCode | null =
    way === "anyday" ? (limitDay ? "BT-06" : validOn ? "BT-02" : "BT-01")
    : way === "settimes" ? (guided ? "BT-09" : "BT-03")
    : way === "ondate" ? "BT-15"
    : way ? (booking?.bookingType ?? null)
    : null;

  /** Take a new answer to how it is booked, and set up the schedule it needs.
   *  The schedule already made is kept when the answer only changes shape within
   *  the same kind; `fresh` starts it again (a different way altogether). */
  const applyBooking = (next: BookingSetupResult | null, fresh = false) => {
    setBooking(next);
    setStepError(null);
    setSchedule((cur) => {
      if (!next) return fresh ? null : cur;
      if (!needsSchedule(next.bookingType)) return null;
      return fresh ? defaultSchedule(next.bookingType) : (cur ?? defaultSchedule(next.bookingType));
    });
  };

  /** The answer for the ways that need no question flow. */
  const simpleResult = (w: BookingWay, o: { limit: boolean; valid: boolean; days: number; guided: boolean }, buffer?: number): BookingSetupResult | null => {
    if (w === "anyday") {
      const bt: BookingTypeCode = o.limit ? "BT-06" : o.valid ? "BT-02" : "BT-01";
      return {
        bookingType: bt,
        summary: o.limit ? tSetup("summary.dateCapped") : o.valid ? t("sumValid", { count: o.days }) : tSetup("summary.showUp"),
        validityDays: o.valid && !o.limit ? o.days : undefined,
      };
    }
    if (w === "settimes") {
      return { bookingType: o.guided ? "BT-09" : "BT-03", summary: tSetup(o.guided ? "summary.guided" : "summary.timed"), bufferMinutes: buffer };
    }
    return null;
  };

  const rename = (to: BookingWay | null) => {
    /* Only an untouched first row is renamed: a name somebody typed is theirs. */
    setTickets((rows) => {
      if (rows.length !== 1 || rows[0].price !== "" || rows[0].perks !== "") return rows;
      const was = rows[0].name;
      const adult = tf("tierAdult");
      const standard = tf("tierStandard");
      if (was !== "" && was !== adult && was !== standard) return rows;
      const want = to && PER_THING.includes(to) ? standard : adult;
      return was === want ? rows : [{ ...rows[0], name: want }];
    });
  };

  const chooseWay = (next: BookingWay) => {
    if (next === way) return;
    setWay(next);
    setErrors({});
    rename(next);
    /* Until the designer has changed it, the page follows the answer. */
    if (!pageTouched) {
      setPage((cur) => ({ ...defaultPage({ bookingType: next === "ondate" ? "BT-15" : "BT-01" }), tagline: cur.tagline }));
    }
    if (next === "anyday" || next === "settimes") {
      applyBooking(simpleResult(next, { limit: limitDay, valid: validOn, days: daysN, guided }, undefined), true);
    } else {
      applyBooking(null, true);
    }
  };

  const onAnyday = (patch: Partial<{ limit: boolean; valid: boolean; days: string }>) => {
    const o = { limit: patch.limit ?? limitDay, valid: patch.valid ?? validOn, days: patch.days ?? validDays };
    setLimitDay(o.limit);
    setValidOn(o.valid);
    setValidDays(o.days);
    applyBooking(simpleResult("anyday", { limit: o.limit, valid: o.valid, days: parseInt(o.days, 10) || 0, guided }));
  };
  const onGuided = (on: boolean) => {
    setGuided(on);
    applyBooking(simpleResult("settimes", { limit: limitDay, valid: validOn, days: daysN, guided: on }, booking?.bufferMinutes));
  };

  /** What the question flows report as they are answered. */
  const onSetup = (result: BookingSetupResult | null) => applyBooking(result);

  // ── which steps this item has ─────────────────────────────────────────────
  const hasPage = online !== "off";
  const steps: StepKey[] = ["name", "when", "price", "where", ...(hasPage ? (["page"] as const) : []), "review"];
  const [stepKey, setStepKey] = useState<StepKey>("name");
  const stepIndex = Math.max(0, steps.indexOf(stepKey));
  /* The one rule the checklist follows: nothing is ticked on the operator's
     behalf. An item is done when its step has been looked at AND what it holds
     is valid — so a default schedule is not "Days and times" until somebody
     has seen it. */
  const [seen, setSeen] = useState<Set<StepKey>>(() => new Set<StepKey>(["name"]));
  const goTo = (key: StepKey) => {
    setStepError(null);
    setSeen((cur) => (cur.has(key) ? cur : new Set(cur).add(key)));
    setStepKey(key);
  };
  const go = (i: number) => goTo(steps[Math.max(0, Math.min(steps.length - 1, i))]);

  // ── what each step needs ──────────────────────────────────────────────────
  const hasSchedule = !isEvent && !!bookingType && needsSchedule(bookingType);
  const scheduleValid =
    !hasSchedule || !schedule || !bookingType
      ? true
      : isDailyCapped(bookingType)
        ? (schedule.dailyCapacity ?? 0) > 0 && schedule.openDays.length > 0
        : schedule.openDays.length > 0 && (!isSlotBased(bookingType) || slotTimes(schedule).length > 0);
  const validDaysOk = !(way === "anyday" && validOn && !limitDay) || daysN > 0;

  const eventWhenErrors = () => {
    const e: Record<string, string> = {};
    if (!ev.date) e.date = tev("missing.date");
    if (!ev.venueName.trim()) e.venueName = te("error.venue");
    const end = endsAtOf(ev);
    if (end && ev.date && Date.parse(end) <= Date.parse(`${ev.date}T${ev.startTime}:00+06:00`)) e.ends = tev("missing.ends");
    return e;
  };
  /* A blank price is not a free ticket — it is a price nobody has set. Free is
     a 0, typed, which is what the field's placeholder says. */
  const ticketErrors = () => {
    const e: Record<string, string> = {};
    if (tickets.length === 0) e.tiers = t("missing.tiers");
    tickets.forEach((x, i) => {
      if (!x.name.trim()) e[`tiers.${i}.name`] = t("missing.tierName");
      if (x.price.trim() === "") e[`tiers.${i}.price`] = t("missing.tierPrice");
    });
    return e;
  };

  /** The one thing that stops the "When" step, said in words. */
  const whenProblem = (): string | null => {
    if (!way) return t("missing.how");
    if (way === "ondate") return null;
    if (way === "anyday" && !validDaysOk) return tw("missing.validDays");
    const flow = SETUP_MISSING[way];
    if (flow && !booking) return tSetup(`missing.${flow}`);
    if (!scheduleValid) return t("missing.when");
    return null;
  };

  const eventWhenOk = Object.keys(eventWhenErrors()).length === 0;
  const whenOk = isEvent ? eventWhenOk : whenProblem() === null;
  const priceOk = Object.keys(ticketErrors()).length === 0;
  const venuesNeeded = counter || online === "listed";
  const linkOk = online === "off" || slugIsFine(slug);
  const channelOk = (counter || online !== "off") && (!venuesNeeded || locationIds.length > 0) && linkOk;
  const unpriced = tickets.find((x) => x.name.trim() && x.price.trim() === "");

  const checks: ReadyCheck[] = [
    { key: "name", label: t("check.name"), done: seen.has("name") && name.trim().length > 0, step: "name" },
    { key: "when", label: isEvent ? ta("check.whenEvent") : t("check.when"), done: seen.has("when") && whenOk, step: "when" },
    {
      key: "price",
      label: t("check.price"),
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
    ...(hasPage ? [{ key: "page", label: tev("check.pageBooking"), done: seen.has("page"), step: "page" as StepKey }] : []),
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
    if (key === "name" && !name.trim()) e.name = t("missing.name");
    if (key === "when") {
      if (isEvent) Object.assign(e, eventWhenErrors());
      else problem = whenProblem();
    }
    if (key === "price") Object.assign(e, ticketErrors());
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
  /** The booking as one `Product` input. `preview` fills what is still empty
   *  with stand-ins, so the page never looks broken mid-wizard; a save never
   *  does. */
  const assemble = (status: Lifecycle, preview: boolean): ProductInput => {
    const channels: Channel[] = [...(counter ? (["counter"] as Channel[]) : []), ...(online !== "off" ? (["online"] as Channel[]) : [])];
    const bt: BookingTypeCode = bookingType ?? "BT-01";
    const rows = tickets
      .filter((x) => x.name.trim() || preview)
      .map((x) => (preview && !x.name.trim() ? { ...x, name: tf("tierAdult") } : x));
    const shared = {
      name: name.trim() || (preview ? ta("untitled") : ""),
      description: description.trim(),
      images: images.map(({ id, url, alt }) => ({ id, url, alt })),
      locationIds,
      channels,
      status,
      online: online === "off" ? undefined : online,
      slug: online !== "off" && slugIsFine(slug) ? slug.trim() : undefined,
      /* The default page for this booking, or what the designer made of it. */
      page,
      bookingType: bt,
      tiers: ticketsToInputs(rows),
    };
    if (isEvent) {
      return {
        ...shared,
        schedule: null,
        taxClass: "exempt",
        event: {
          startsAt,
          endsAt: endsAtOf(ev),
          days: ev.days.length > 1 ? ev.days : undefined,
          venueName: ev.venueName.trim() || (preview ? te("placeholder.venue") : ""),
          venueAddress: ev.venueAddress.trim() || undefined,
        },
      };
    }
    return {
      ...shared,
      validityDays: bt === "BT-02" ? daysN : booking?.validityDays,
      ...(bt === "BT-02" ? { windowMode: "rolling" as const } : {}),
      schedule: needsSchedule(bt) ? schedule : null,
      resourceIds: booking?.resource?.resourceIds,
      resourceExclusive: booking?.resource?.exclusive,
      bufferMinutes: booking && usesBuffer(bt) ? effectiveBuffer(booking) : undefined,
      flexibleDurations: booking?.resource?.flexibleDurations,
      pricingBasis: booking?.resource?.basis,
      // Flexible: seed the duration engine from the wizard's core; the editor
      // refines the pricing model (defaults to hourly at the first ticket price).
      durationConfig: booking?.resource?.durationCore
        ? {
            ...booking.resource.durationCore,
            pricingModel: "hourly" as const,
            hourlyRate: majorToMinor(tickets[0]?.price ?? ""),
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
      : checks.find((c) => c.key === "name" && !c.done) ?? (!whenOk ? checks.find((c) => c.key === "when") : undefined);
    if (need) {
      goTo(need.step);
      if (need.step === "where" && channelOk && !seen.has("where")) setStepError(t("missing.channelConfirm"));
      else if (need.step === "page") setStepError(null);
      else validate(need.step);
      return;
    }
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

  // ── an on-a-date booking's facts, as EventDetails reads them ──────────────
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
    setStepError(null);
    setErrors((e) => {
      const nextErrors = { ...e };
      for (const k of Object.keys(p)) delete nextErrors[k.startsWith("end") ? "ends" : k === "venueName" ? "venueName" : k];
      return nextErrors;
    });
  };

  // ── how it reads ──────────────────────────────────────────────────────────
  const priced = tickets.filter((x) => x.name.trim() && x.price.trim() !== "");
  const priceLine = priced.map((x) => `${x.name} ${formatPriceShort(majorToMinor(x.price), currency)}`).join(" · ");

  /** The schedule, in a sentence: which days, which hours, and how much. */
  const whenLine = (() => {
    if (!way) return null;
    if (isEvent) {
      if (!ev.date) return null;
      return (
        [formatDay(ev.date, { weekday: true }), ev.endTime ? formatClockRange(ev.startTime, ev.endTime) : formatClock(ev.startTime)].join(" · ") +
        (ev.days.length > 1 ? ` · ${ta("days", { count: ev.days.length })}` : ev.endDate && ev.endDate !== ev.date ? ` → ${formatDay(ev.endDate, { weekday: true })}` : "")
      );
    }
    if (!booking) return null;
    const bt = booking.bookingType;
    /* The time kept free between bookings belongs to the answer, with or
       without a schedule — an appointment has none, and lost it here. */
    const buffer = usesBuffer(bt) ? effectiveBuffer(booking) : 0;
    const bufferLine = buffer > 0 ? t("bufferLine", { time: formatDuration(buffer) }) : "";
    if (!schedule || !hasSchedule) return [booking.summary, bufferLine].filter(Boolean).join(" · ");
    const days = schedule.openDays.length === 7 ? t("everyDay") : [...schedule.openDays].sort().map((d) => dayShort(d)).join(" ");
    const hours = schedule.startTime && schedule.endTime ? formatClockRange(schedule.startTime, schedule.endTime) : "";
    const amount = isSlotBased(bt)
      ? t("sessionsPerDay", { count: slotTimes(schedule).length })
      : isDailyCapped(bt)
        ? t("perDay", { count: schedule.dailyCapacity ?? 0 })
        : "";
    const each = isSlotBased(bt) && schedule.capacityPerSession > 0 ? t("placesEach", { count: schedule.capacityPerSession }) : "";
    const rhythm = isSlotBased(bt)
      ? t(schedule.sessionMinutes > schedule.slotMinutes ? "everyEachOverlap" : "everyEach", { every: formatDuration(schedule.slotMinutes), each: formatDuration(schedule.sessionMinutes) })
      : "";
    return [days, hours, rhythm, amount, each, bufferLine].filter(Boolean).join(" · ");
  })();
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
  const wayTitle = way ? tw(`${way}.title`) : null;

  /** The schedule: days, hours and how many — under the answers that need one. */
  const scheduleArea =
    booking && schedule && hasSchedule ? (
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
    ) : null;

  /** A question flow (by the hour, a person, a course, a pack, a combo), drawn
   *  under its answer; the answer is reported as it is made. */
  const setupFlow = (w: BookingWay) => (
    <BookingSetup
      embedded
      start={SETUP_START[w]}
      value={booking && bookingWayOf(booking.bookingType) === w ? booking : null}
      onChange={onSetup}
      resources={resources}
      team={team}
      products={products}
      onCreateResource={onCreateResource}
    />
  );

  const details: Partial<Record<BookingWay, React.ReactNode>> = {
    anyday: (
      <>
        <div className="flex flex-col">
          <Checkbox checked={limitDay} onCheckedChange={(v) => onAnyday({ limit: v })} label={tw("anyday.limit.title")} description={tw("anyday.limit.helper")} />
          <Checkbox checked={validOn} onCheckedChange={(v) => onAnyday({ valid: v })} label={tw("anyday.valid.title")} description={tw("anyday.valid.helper")} />
        </div>
        {validOn && (
          <FormField
            label={tw("anyday.valid.days")}
            variant="number"
            name="wiz-valid-days"
            placeholder="7"
            value={validDays}
            error={errors.validDays}
            help={limitDay ? tw("anyday.valid.limitNote") : undefined}
            onChange={(e) => { onAnyday({ days: e.target.value }); setErrors((x) => ({ ...x, validDays: "" })); }}
            className="max-w-xs"
          />
        )}
        {limitDay && scheduleArea}
      </>
    ),
    settimes: (
      <>
        <Checkbox checked={guided} onCheckedChange={onGuided} label={tw("settimes.guided.title")} description={tw("settimes.guided.helper")} />
        {scheduleArea}
      </>
    ),
    ondate: (
      <EventDetails
        categoryId="entertainment"
        content={evContent}
        onContent={patchEvent}
        errors={errors}
        show={["when", "where"]}
        scopedTickets={tickets.filter((r) => r.dayIds.length > 0).length}
        onUntieTickets={() => setTickets((rows) => rows.map((r) => (r.dayIds.length ? { ...r, dayIds: [] } : r)))}
      />
    ),
    byhour: (
      <>
        {setupFlow("byhour")}
        {scheduleArea}
      </>
    ),
    person: setupFlow("person"),
    course: setupFlow("course"),
    pack: setupFlow("pack"),
    combined: setupFlow("combined"),
  };

  return (
    <div className="grid gap-major pb-[calc(9rem+env(safe-area-inset-bottom))] md:pb-hero lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-section">
        {/* On a phone the steps are a sentence and a bar, not six pills that
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
            <h2 className="text-md font-semibold text-fg">{ta(`title.${stepKey}`)}</h2>
            <p className="mt-inline text-sm text-muted">{ta(`help.${stepKey}`)}</p>
          </div>

          {stepError && (
            <p role="alert" tabIndex={-1} data-step-error className="mb-section flex items-start gap-tight rounded-card bg-danger-wash p-comfortable text-sm font-medium text-fg outline-none">
              <AlertTriangle size={15} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0 text-danger" />
              {stepError}
            </p>
          )}

          {stepKey === "name" && (
            <div className="grid grid-cols-1 gap-section sm:grid-cols-2">
              <FormField
                label={t("name")}
                name="wiz-name"
                required
                placeholder={t("namePlaceholderEg", { example: t("namePlaceholder") })}
                value={name}
                error={errors.name}
                onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((x) => ({ ...x, name: "" })); }}
                className="sm:col-span-2"
              />
              <FormField
                label={ta("summary")}
                name="wiz-summary"
                help={ta("summaryHelp")}
                placeholder={t("namePlaceholderEg", { example: ta("summaryExample") })}
                value={page.tagline ?? ""}
                onChange={(e) => setPage((pg) => ({ ...pg, tagline: e.target.value || undefined }))}
                className="sm:col-span-2"
              />
              <FormField label={t("description")} variant="textarea" placeholder={t("descriptionPlaceholder")} value={description} onChange={(e) => setDescription(e.target.value)} className="sm:col-span-2" />
              <div className="flex flex-col gap-inline sm:col-span-2">
                <ImageUploadField images={images} onChange={setImages} />
                <p className="text-sm text-muted">{t("photoHelp")}</p>
              </div>
            </div>
          )}

          {stepKey === "when" && (
            <WaysToBook value={way} onChange={chooseWay} details={details} invalid={!!stepError && !way} aria-label={ta("title.when")} />
          )}

          {stepKey === "price" && (
            <div className="flex flex-col gap-major">
              <TicketEditor
                rows={tickets}
                onChange={(rows) => {
                  setTickets(rows);
                  setErrors((e) => (Object.keys(e).length ? {} : e));
                }}
                errors={errors}
                currency={currency}
                days={isEvent ? ev.days : []}
                totals
              />
              {!isEvent && hasSchedule && (
                <PricingRulesField rules={pricingRules} onChange={setPricingRules} currency={currency} basePriceMajor={tickets[0]?.price ?? ""} dayStart={schedule?.startTime} dayEnd={schedule?.endTime} />
              )}
            </div>
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
            <PageDesigner
              product={draftProduct()}
              page={page}
              onPage={(p) => { setPage(p); setPageTouched(true); }}
              onEditDetails={() => goTo("name")}
              onEditTickets={() => goTo("price")}
              onDescription={setDescription}
            />
          )}

          {/* The review is the whole item, one row per step, each with the way
              back to change it — not a three-line summary that leaves the
              operator to remember what the schedule said four screens ago. */}
          {stepKey === "review" && (
            <div className="flex flex-col">
              <h3 className="mb-tight break-words text-xl font-semibold text-fg">{name || ta("untitled")}</h3>
              <ReviewRow label={ta("row.name")} onEdit={() => goTo("name")} editText={editText} editLabel={editLabel("name")}>
                {name.trim() ? (
                  <>
                    <span className="block font-medium">{name}</span>
                    {page.tagline && <span className="block text-muted">{page.tagline}</span>}
                    <span className="block text-muted">{images.length ? t("photos", { count: images.length }) : t("noPhoto")}</span>
                  </>
                ) : (
                  <Missing>{t("check.name")}</Missing>
                )}
              </ReviewRow>
              <ReviewRow label={ta("row.when")} onEdit={() => goTo("when")} editText={editText} editLabel={editLabel("when")}>
                {whenOk && wayTitle ? (
                  <>
                    <span className="block font-medium">{wayTitle}</span>
                    {guided && way === "settimes" && <span className="block text-muted">{tw("settimes.guided.title")}</span>}
                    {whenLine && <span className="block text-muted">{whenLine}</span>}
                    {isEvent && ev.venueName.trim() && <span className="block text-muted">{[ev.venueName.trim(), ev.venueAddress.trim()].filter(Boolean).join(" · ")}</span>}
                    {waitlist && !isEvent && <span className="block text-muted">{t("waitlistOn")}</span>}
                  </>
                ) : (
                  <Missing>{wayTitle ? (isEvent ? ta("check.whenEvent") : t("check.when")) : t("missing.how")}</Missing>
                )}
              </ReviewRow>
              {!isEvent && (
                <ReviewRow label={t("row.window")}>
                  <span className="block">{bookingWindow}</span>
                  <span className="block text-sm text-muted">{t("windowLater")}</span>
                </ReviewRow>
              )}
              <ReviewRow label={ta("row.price")} onEdit={() => goTo("price")} editText={editText} editLabel={editLabel("price")}>
                {priceOk && priced.length ? (
                  <span className="flex flex-col gap-0.5">
                    {priced.map((x) => (
                      <span key={x.id} className="flex items-baseline justify-between gap-section">
                        <span>
                          {x.name}
                          {x.quantity ? <span className="text-muted"> · {tk("available", { count: parseInt(x.quantity, 10) || 0 })}</span> : null}
                          {x.ageNote ? <span className="text-muted"> · {x.ageNote}</span> : null}
                        </span>
                        <span className="tabular-nums">{majorToMinor(x.price) === 0 ? tc("free") : formatPriceShort(majorToMinor(x.price), currency)}</span>
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
                    <span>{ta("review.pageStandard")}</span>
                    <span className="text-muted">{ta("review.pageSections", { count: page.sections.length })}</span>
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
      <aside className="hidden h-fit lg:sticky lg:top-section lg:block" aria-label={t("summaryTitle")}>
        <div className="card-surface flex flex-col gap-section p-card">
          <div>
            <p className="text-sm font-medium text-muted">{t("summaryTitle")}</p>
            <p className={cn("mt-inline break-words text-md font-semibold leading-snug", !name.trim() && "text-muted")}>{name.trim() || ta("untitled")}</p>
            {wayTitle && <p className="mt-0.5 text-sm text-muted">{wayTitle}</p>}
            {seen.has("when") && whenLine && <p className="mt-tight text-sm leading-snug">{whenLine}</p>}
            {isEvent && ev.venueName.trim() && <p className="text-sm text-muted">{ev.venueName.trim()}</p>}
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
