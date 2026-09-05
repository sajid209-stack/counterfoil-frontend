"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clock, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar, BlockedNotice, Button, ChoiceCard, FormField, ProductThumb, ResourceTimeline, useToast } from "@/components/ui";
import { availableSeats } from "@/lib/api";
import { SessionList } from "./SessionList";
import { SlotMatrix } from "./SlotMatrix";
import { RepeatPicker } from "./RepeatPicker";
import { useApiQuery } from "@/lib/useApi";
import {
  applyResourceRate,
  CHECKOUT_HELD_FOR,
  explainUnavailable,
  firstFreeResource,
  freeGuides,
  getDailyRemaining,
  getResourceMatrix,
  getSlots,
  isOpenOn,
  isOwnerFree,
  isResourceFreeFor,
  joinWaitlist,
  peekHolds,
  ownerBusyDetailed,
  type Product,
  type ProductSchedule,
  type Resource,
  type Staff,
} from "@/lib/api";
import { DEMO_TODAY, isFlexibleResource, isResourceType, isSlotBased, needsSchedule, slotISO, slotTimesOn, toMinutes, toTime } from "@/lib/schedule";
import { resolveProductPrice } from "@/lib/pricing";
import { durationOptions, formatDuration, formatDurationShort, priceSegments, productDurationPrice } from "@/lib/duration";
import { behaviourSubtitle } from "@/lib/behaviour";
import { planWeekly, type OccurrenceBlock } from "@/lib/recurrence";
import { formatMoney } from "@/lib/format";

export interface CartEntry {
  id: string;
  productId: string;
  productName: string;
  slotDate?: string;
  slotTime?: string;
  slotEnd?: string;
  resourceId?: string;
  resourceLabel?: string;
  providerLabel?: string;
  items: { tierId: string; tierName: string; unitPrice: number; qty: number }[];
  fixedPrice?: number; // resource slot resolved price (overrides items sum)
  seatLabels?: string[]; // BT-07 seated: chosen seat labels ("A5", "A6")
  partySize?: number; // group size for flat-per-booking entries ("Group of 6")
  taxRatePct?: number; // custom-amount entries carry their own rate
  lineDiscountPct?: number; // F11 line-level discount (cycles 0/5/10/15 in the cart)
}


const TODAY = DEMO_TODAY;
const TOMORROW = "2026-07-30";
const NOW_MIN = 12 * 60; // the mock clock: today, noon

// Providers without a configured schedule sell appointments on these hours.
const PROVIDER_DAY: ProductSchedule = {
  slotMinutes: 60, sessionMinutes: 60, startTime: "10:00", endTime: "19:00",
  capacityPerSession: 1, dailyCapacity: null, openDays: [0, 1, 2, 3, 4, 5, 6], guideIds: [], exceptions: [],
};

const endISO = (date: string, time: string, minutes: number) =>
  slotISO(date, toTime(toMinutes(time) + minutes));

/** The one footer every selection pattern ends in.
 *
 *  The sheet was already a single component, but its CHROME was written three
 *  times — the resource matrix, the flexible-duration path and the tiered path
 *  each built their own summary line and their own full-width button. That is
 *  how nine configuration patterns quietly become nine visual experiences: not
 *  by anyone designing them separately, but by the shared parts being copied
 *  until they drift. There is one definition now, and a pattern supplies only
 *  its summary, its disabled rule and its verb.
 *
 *  It is sticky because the sheets that need it most are the long ones — a
 *  96-seat map, a 13-slot start-time grid — where the total and the action
 *  scrolled off the bottom exactly when the cashier was deciding. */
function SheetFooter({
  summary,
  note,
  disabled,
  onAdd,
  label,
  buyLabel,
}: {
  summary?: React.ReactNode;
  note?: React.ReactNode;
  disabled: boolean;
  /** `pay` = the cashier wants to settle this now, not build a bigger sale. */
  onAdd: (pay: boolean) => void;
  label: string;
  /** Omitted where an express sale makes no sense (nothing chosen yet). */
  buyLabel?: string;
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-section mt-section border-t border-line bg-sheet px-section pb-inline pt-comfortable">
      {note}
      {summary && <div className="mb-tight text-[13px]">{summary}</div>}
      <Button size="lg" fullWidth disabled={disabled} onClick={() => onAdd(false)}>{label}</Button>
      {/* Two exits, because a till serves two sales. Building a bigger one
          keeps the sheet's Add; the single booking someone is standing there
          to pay for takes Buy now, which adds the line AND opens the payment
          — the step they were going to reach anyway, minus the trip through a
          cart holding one thing. */}
      {buyLabel && (
        <Button
          size="lg"
          fullWidth
          variant="secondary"
          className="mt-tight"
          disabled={disabled}
          onClick={() => onAdd(true)}
        >
          {buyLabel}
        </Button>
      )}
    </div>
  );
}

export function ProductSheet({
  product,
  currency,
  initial,
  seatsInCart,
  onAdd,
  onClose,
  team = [],
  resources = [],
}: {
  product: Product;
  currency: string;
  initial: CartEntry | null;
  seatsInCart: (productId: string, slotStart: string) => number;
  onAdd: (entry: CartEntry, pay?: boolean) => void;
  onClose: () => void;
  team?: Staff[];
  /** Only for the header's behaviour line — availability still computes its
   *  own per-date matrix, which is the one that must not be stale. */
  resources?: Resource[];
}) {
  const toast = useToast();
  const t = useTranslations("pos");
  const seatT = useTranslations("seatmaps");
  const hasLayout = !!product.layoutId;
  const seatsQ = useApiQuery(() => availableSeats(product.id), [product.id]);
  const availSeats = seatsQ.data ?? [];
  const [selectedSeats, setSelectedSeats] = useState<string[]>(initial?.seatLabels ?? []);
  /** A seat map prices itself off the seats, not off the tier steppers — those
   *  stay at zero because a seat IS the ticket here. The CTA was reading them
   *  anyway and offering "Add 2 seats — ৳0.00" on a ৳800 pair. `submitSeats`
   *  already priced the sale correctly from these same rows, so the button was
   *  the only thing lying. */
  const seatTotal = availSeats
    .filter((s) => selectedSeats.includes(s.label))
    .reduce((a, s) => a + s.price, 0);
  const activeTiers = product.tiers.filter((t) => t.active);
  const bt = product.bookingType;
  const resourceMode = isResourceType(bt);
  const flexible = isFlexibleResource(bt);
  const provider = bt === "BT-10";
  const guided = bt === "BT-09";
  const course = bt === "BT-13";
  const sectioned = (product.sections?.length ?? 0) > 0 || bt === "BT-07";

  /** The first day this product actually runs. The date strip only lists open
   *  days, so defaulting to today opened a Fri–Sun tour on a Wednesday: no
   *  chip selected, no departures, and "Closed on this date" where the
   *  departure list should be. The sheet now opens on something sellable. */
  const firstBookable = (() => {
    if (!needsSchedule(bt) && !provider) return TODAY;
    for (let i = 0; i < 30; i++) {
      const d = new Date(Date.parse(`${TODAY}T12:00:00Z`) + i * 86400000).toISOString().slice(0, 10);
      if (isOpenOn(product, d)) return d;
    }
    return TODAY;
  })();

  const [date, setDate] = useState(initial?.slotDate ?? firstBookable);
  const [slotTime, setSlotTime] = useState<string | undefined>(initial?.slotTime);
  const [resourceId, setResourceId] = useState<string | undefined>(initial?.resourceId);
  const [providerId, setProviderId] = useState<string | undefined>();
  const [guideId, setGuideId] = useState<string | undefined>();
  // Flexible durations come from the duration engine when configured.
  const flexOptions = product.durationConfig
    ? durationOptions(product.durationConfig)
    : (product.flexibleDurations ?? [60, 90, 120]);
  const [duration, setDuration] = useState<number>(flexOptions[0] ?? 60);
  const [qty, setQty] = useState<Record<string, number>>(() => {
    const q: Record<string, number> = {};
    const list = sectioned ? (product.sections ?? []).map((s) => s.id) : activeTiers.map((t) => t.id);
    // Guided default: a sole tier/section starts at 1 so there's nothing to tap
    // — the common case (one ticket type) becomes pick-date → Add.
    const soleDefault = list.length === 1 && !initial ? 1 : 0;
    list.forEach((id) => (q[id] = initial?.items.find((i) => i.tierId === id)?.qty ?? soleDefault));
    return q;
  });

  const [addOnQty, setAddOnQty] = useState<Record<string, number>>({});
  // Pay-what-you-want: per-tier entered amount (minor units) for donation tiers.
  const [donationAmt, setDonationAmt] = useState<Record<string, number>>(() => {
    const d: Record<string, number> = {};
    activeTiers.filter((t) => t.donation).forEach((t) => (d[t.id] = initial?.items.find((i) => i.tierId === t.id)?.unitPrice ?? t.price));
    return d;
  });
  const [group, setGroup] = useState<number>(initial?.partySize ?? 2); // flat-per-booking group size
  const [waived, setWaived] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null); // BlockedNotice message
  const [moreDates, setMoreDates] = useState(false);

  /** Re-opening a cart line means capacity is already spoken for: adding it
   *  placed a self-releasing checkout hold. The counter needs to know how long
   *  that reservation has left, because a customer changing their mind twice
   *  can outlast it and the seats go back on sale underneath them.
   *
   *  Driven off the hold's real `expiresAt`, not a timer started when the
   *  sheet opened — a countdown that disagrees with the ledger is worse than
   *  none. A fresh selection has no hold yet, so it shows nothing rather than
   *  promising a reservation that does not exist. */
  const heldUntil = useMemo(() => {
    if (!initial) return null;
    const want = initial.slotTime ? slotISO(initial.slotDate ?? date, initial.slotTime) : null;
    const mine = peekHolds().find(
      (h) =>
        h.status === "held" &&
        h.heldFor === CHECKOUT_HELD_FOR &&
        h.productId === product.id &&
        (want == null || (h.slotStart ?? null) === want),
    );
    return mine?.expiresAt ?? null;
  }, [initial, product.id, date]);

  const [holdLeft, setHoldLeft] = useState<number>(() =>
    heldUntil ? Math.max(0, Math.round((Date.parse(heldUntil) - Date.now()) / 1000)) : 0,
  );
  useEffect(() => {
    if (!heldUntil) return;
    const tick = () => setHoldLeft(Math.max(0, Math.round((Date.parse(heldUntil) - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [heldUntil]);

  const needsWaiver = !!product.policies?.waiver;
  const waiverOk = !needsWaiver || waived;
  const flatBasis = resourceMode && product.pricingBasis !== "per_person";
  const partyMax = product.policies?.partyMax ?? 20;
  const partyMin = product.policies?.partyMin ?? 1;

  const renderWaiver = () =>
    needsWaiver ? (
      <label className="mt-tight flex cursor-pointer items-center gap-tight rounded-sm border border-line bg-card p-comfortable text-sm">
        <input type="checkbox" checked={waived} onChange={(e) => setWaived(e.target.checked)} className="h-5 w-5 accent-ember" />
        {t("sheet.waiverSigned")}
      </label>
    ) : null;

  const renderGroup = () =>
    flatBasis ? (
      <div className="flex items-center justify-between rounded-sm border border-line bg-card p-comfortable">
        <span className="text-sm">{t("sheet.groupSize")}</span>
        <div className="flex items-center gap-tight">
          <button type="button" aria-label={t("sheet.fewer")} onClick={() => setGroup((g) => Math.max(partyMin, g - 1))} className="h-12 w-12 rounded-sm border border-line text-lg active:bg-ember/10">−</button>
          <span className="w-8 text-center">{group}</span>
          <button type="button" aria-label={t("sheet.morePeople")} onClick={() => setGroup((g) => Math.min(partyMax, g + 1))} className="h-12 w-12 rounded-sm border border-line text-lg active:bg-ember/10">+</button>
        </div>
      </div>
    ) : null;
  const addOnItems = () => (product.addOns ?? []).filter((a) => (addOnQty[a.id] ?? 0) > 0).map((a) => ({ tierId: a.id, tierName: a.perPerson ? t("sheet.eachSuffix", { name: a.name }) : a.name, unitPrice: a.price, qty: addOnQty[a.id] }));

  // Add-on rows — the catering pattern: a full-width row whose + becomes a
  // stepper once added. Per-person add-ons start at the group/party size and
  // multiply live.
  const headsFor = () => (flatBasis ? group : Math.max(1, Object.values(qty).reduce((s, n) => s + n, 0)));
  const renderAddOns = () =>
    (product.addOns?.length ?? 0) > 0 ? (
      <div className="mt-section flex flex-col gap-tight">
        <span className="type-label text-[12px] text-muted">{t("sheet.addOns")}</span>
        {(product.addOns ?? []).map((a) => {
          const n = addOnQty[a.id] ?? 0;
          return (
            <div key={a.id} className="flex min-h-14 items-center gap-tight rounded-sm border border-line bg-card p-comfortable">
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm">{a.name}</span>
                <span className="text-[12px] text-faint">{formatMoney(a.price, currency)}{a.perPerson ? t("sheet.perHead") : ""}{n > 0 ? ` × ${n} = ${formatMoney(a.price * n, currency)}` : ""}</span>
              </div>
              {n === 0 ? (
                <button type="button" aria-label={t("sheet.addName", { name: a.name })} onClick={() => setAddOnQty((q) => ({ ...q, [a.id]: a.perPerson ? headsFor() : 1 }))} className="h-12 w-12 shrink-0 rounded-sm border border-line text-lg active:bg-ember/10">+</button>
              ) : (
                <div className="flex shrink-0 items-center gap-tight">
                  <button type="button" aria-label={t("sheet.less")} onClick={() => setAddOnQty((q) => ({ ...q, [a.id]: Math.max(0, (q[a.id] ?? 0) - 1) }))} className="h-12 w-12 rounded-sm border border-line text-lg active:bg-ember/10">−</button>
                  <span className="w-6 text-center">{n}</span>
                  <button type="button" aria-label={t("sheet.more")} onClick={() => setAddOnQty((q) => ({ ...q, [a.id]: (q[a.id] ?? 0) + 1 }))} className="h-12 w-12 rounded-sm border border-line text-lg active:bg-ember/10">+</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    ) : null;

  // Waitlist mini-form
  const [wl, setWl] = useState<{ time: string } | null>(null);
  const [wlName, setWlName] = useState("");
  const [wlPhone, setWlPhone] = useState("");

  const matrix = useMemo(() => (resourceMode && !flexible ? getResourceMatrix(product, date) : []), [product, date, resourceMode, flexible]);
  const slots = useMemo(() => (needsSchedule(bt) && !resourceMode ? getSlots(product, date) : []), [product, date, bt, resourceMode]);
  const dailyLeft = bt === "BT-06" ? getDailyRemaining(product, date) : Infinity;
  const openToday = isOpenOn(product, date);
  const basePrice = activeTiers.length ? Math.min(...activeTiers.map((t) => t.price)) : 0;

  const providers = team.filter((m) => (product.providerIds ?? []).includes(m.id));
  const flexTimes = flexible ? slotTimesOn(product.schedule ?? ({ ...PROVIDER_DAY, startTime: "06:00", endTime: "22:00" }), date) : [];

  const partySize = Object.values(qty).reduce((s, n) => s + n, 0);

  // ── Guided (BT-09): guides are capacity owners, shared across products ─────
  const guides = guided ? team.filter((m) => (product.schedule?.guideIds ?? []).includes(m.id)) : [];
  const slotGuides = guided && slotTime ? freeGuides(product, date, slotTime) : [];

  // ── Provider (BT-10): appointment times + per-provider conflict/premium ────
  const premiumOf = (id: string) => product.providerPremiums?.[id] ?? 0;
  // Session length follows the chosen tier ("90 min" tier → 90), else the first
  // configured duration.
  const providerDuration = (() => {
    const durs = product.flexibleDurations ?? [60];
    const chosen = activeTiers.filter((t) => (qty[t.id] ?? 0) > 0);
    const match = durs.filter((d) => chosen.some((t) => t.name.includes(String(d))));
    return match.length ? Math.max(...match) : (durs[0] ?? 60);
  })();
  const providerTimes = provider ? slotTimesOn(product.schedule ?? PROVIDER_DAY, date) : [];
  const freeProvidersAt = (time: string) =>
    providers
      .filter((p) => isOwnerFree(p.id, date, time, providerDuration))
      .sort((a, b) => premiumOf(a.id) - premiumOf(b.id));
  const providerTimeFree = (time: string) =>
    providerId ? isOwnerFree(providerId, date, time, providerDuration) : freeProvidersAt(time).length > 0;
  // The provider who will actually take the appointment (chosen or cheapest free).
  const assignedProvider = provider && slotTime
    ? (providerId ? providers.find((p) => p.id === providerId) : freeProvidersAt(slotTime)[0])
    : undefined;

  const depositPct = product.policies?.deposit === "percent" ? product.policies.depositPct : 0;

  // Capacity under a date chip: daily-capped remaining, or seats across the
  // day's departures. Ember when ≤20% remains.
  const dateCap = (d: string): { left: number; total: number } | null => {
    if (bt === "BT-06" && product.schedule?.dailyCapacity) {
      // The capacity panel below states the day's allowance in full, and it
      // follows the selected date — so the chips do not carry it at all.
      // Showing it on the unselected chips only would leave the strip ragged,
      // with the chosen pill a line shorter than its neighbours.
      return null;
    }
    if (guided || bt === "BT-03") {
      const ss = getSlots(product, d);
      if (!ss.length) return null;
      return { left: ss.reduce((s, x) => s + x.remaining, 0), total: ss.reduce((s, x) => s + x.capacity, 0) };
    }
    return null;
  };

  // Date strip chips — the selectable-card pattern in miniature.
  const dateBtn = (value: string, label: string) => {
    const cap = dateCap(value);
    const low = cap && cap.total > 0 && cap.left <= Math.max(1, Math.floor(cap.total * 0.2));
    return (
      <ChoiceCard key={value} selected={date === value} hideCheck onClick={() => { setDate(value); setSlotTime(undefined); setResourceId(undefined); }}
        // No corner glyph here: at ~96px the check landed on the day label
        // ("TODAY" once rendered as "TODA✓") and the strip is where that has
        // bitten most. Selection is carried by the doubled ember edge, the
        // wash, and both lines going ember — which is three signals, all of
        // which survive grayscale.
        className="flex min-h-[62px] min-w-[92px] shrink-0 flex-col items-center justify-center gap-0.5 px-comfortable py-tight">
        {/* Two lines, not three. The day is what a person scans the strip by
            and the date confirms it; running DAY / 29 / Jul down three lines
            made an 84px card that wrapped the strip onto a second row and
            stranded "More dates" beside the orphan. */}
        <span className={`whitespace-nowrap text-[13px] font-medium leading-tight ${date === value ? "text-ember" : ""}`}>{label === t("sheet.today") || label === t("sheet.tomorrow") ? label : label.split(" ")[0]}</span>
        <span className={`whitespace-nowrap text-[12px] leading-tight ${date === value ? "text-ember/70" : "text-muted"}`}>{value.slice(8, 10)} {new Date(`${value}T12:00:00Z`).toLocaleDateString("en-GB", { month: "short" })}</span>
        {cap && <span className={`whitespace-nowrap text-[12px] leading-tight ${low ? "font-medium text-ember" : date === value ? "text-ember/70" : "text-muted"}`}>{cap.left} left</span>}
      </ChoiceCard>
    );
  };

  const submitTiered = (onDate?: string, pay = false) => {
    const when = onDate ?? date;
    const list = sectioned ? (product.sections ?? []).map((s) => ({ id: s.id, name: s.name, price: s.price, donation: false })) : activeTiers.map((t) => ({ id: t.id, name: t.name, price: t.price, donation: !!t.donation }));
    const items = [...list.filter((x) => qty[x.id] > 0).map((x) => ({ tierId: x.id, tierName: x.name, unitPrice: x.donation ? Math.max(x.price, donationAmt[x.id] ?? x.price) : x.price, qty: qty[x.id] })), ...addOnItems()];
    // Owner of the session's capacity: the chosen guide or assigned provider.
    const owner = guided ? guides.find((g) => g.id === guideId) : assignedProvider;
    if (provider && assignedProvider && premiumOf(assignedProvider.id) > 0) {
      items.push({ tierId: `prem_${assignedProvider.id}`, tierName: t("sheet.premium", { name: assignedProvider.name.split(" ")[0] }), unitPrice: premiumOf(assignedProvider.id), qty: 1 });
    }
    const minutes = provider ? providerDuration : (product.schedule?.sessionMinutes || product.schedule?.slotMinutes || 60);
    onAdd({
      id: !onDate || onDate === date ? (initial?.id ?? newEntryId()) : newEntryId(),
      productId: product.id, productName: product.name,
      slotDate: needsSchedule(bt) && !resourceMode ? when : provider || course ? when : undefined,
      slotTime: (!resourceMode && slotTime) || undefined,
      slotEnd: (guided || provider) && slotTime ? endISO(when, slotTime, minutes) : undefined,
      resourceId: owner?.id,
      providerLabel: owner?.name,
      items,
    }, pay);
  };

  const submitSeats = (pay = false) => {
    const chosen = availSeats.filter((s) => selectedSeats.includes(s.label));
    const byCat = new Map<string, { name: string; price: number; qty: number }>();
    for (const s of chosen) {
      const g = byCat.get(s.categoryUid) ?? { name: s.categoryName, price: s.price, qty: 0 };
      g.qty += 1;
      byCat.set(s.categoryUid, g);
    }
    const items = [
      ...Array.from(byCat, ([uid, g]) => ({ tierId: uid, tierName: g.name, unitPrice: g.price, qty: g.qty })),
      ...addOnItems(),
    ];
    onAdd({
      id: initial?.id ?? `entry_${globalThis.crypto.randomUUID().slice(0, 8)}`,
      productId: product.id, productName: product.name,
      items,
      seatLabels: selectedSeats,
    }, pay);
  };

  const submitResource = (rId: string, rLabel: string, time: string, price: number, minutes?: number, onDate?: string, pay = false) => {
    const when = onDate ?? date;
    onAdd({
      // Only the first date of a series can inherit an edited entry's id; the
      // rest are new lines and must not collide with it.
      id: !onDate || onDate === date ? (initial?.id ?? newEntryId()) : newEntryId(),
      productId: product.id, productName: product.name,
      slotDate: when, slotTime: time, resourceId: rId, resourceLabel: rLabel,
      slotEnd: endISO(when, time, minutes ?? product.schedule?.sessionMinutes ?? 60),
      partySize: flatBasis ? group : undefined,
      items: addOnItems(), fixedPrice: price,
    }, pay);
  };

  /* ── repeat weekly ────────────────────────────────────────────────────────
     "I want the next 7 Wednesdays at 6" is the commonest standing sale a turf
     or a court takes, and it used to mean walking this sheet seven times.

     The honest part is the check: some of those Wednesdays will already be
     gone, and the cashier has to be able to say WHICH before taking money.
     So every date is tested against the same availability engine the grid
     uses, unavailable ones are listed with their reason and skipped, and the
     CTA counts only what will actually be sold. */
  // A new selection is a new question; carrying a count of 7 over to it would
  // silently sell seven of something the cashier only picked once. Reset by
  // storing the selection the count belongs to and comparing during render —
  // an effect that setStates would cost a cascading render, which is the rule
  // the rest of this codebase already follows.
  const repeatKey = `${product.id}|${date}`;
  const [repeatState, setRepeatState] = useState({ key: repeatKey, count: 1 });
  const repeatCount = repeatState.key === repeatKey ? repeatState.count : 1;
  const setRepeatCount = (n: number) => setRepeatState({ key: repeatKey, count: n });

  const checkResourceDate = (rId: string, time: string, minutes: number) => (d: string): OccurrenceBlock | null => {
    if (d < TODAY) return "past";
    if (!isOpenOn(product, d)) return "closed";
    return isResourceFreeFor(rId, d, time, minutes, product.bufferMinutes ?? 0) ? null : "taken";
  };

  const checkSlotDate = (time: string, seats: number) => (d: string): OccurrenceBlock | null => {
    if (d < TODAY) return "past";
    if (!isOpenOn(product, d)) return "closed";
    const slot = getSlots(product, d).find((sl) => sl.time === time);
    if (!slot) return "closed";
    return slot.remaining >= Math.max(1, seats) ? null : "full";
  };

  const newEntryId = () => `entry_${globalThis.crypto.randomUUID().slice(0, 8)}`;

  const submitFlexible = (pay = false) => {
    if (!slotTime) return;
    // "Any" assigns the best-fit (first free) lane at submit.
    const lane = resourceId
      ? getResourceMatrix(product, date).find((row) => row.resource.id === resourceId)?.resource
      : firstFreeResource(product, date, slotTime, duration);
    if (!lane) return;
    // Engine price (model + band blending), then the lane's own rate.
    const price = applyResourceRate(productDurationPrice(product, date, slotTime, duration, basePrice), duration, lane);
    submitResource(lane.id, lane.name, slotTime, price, duration, undefined, pay);
  };

  const doWaitlist = async () => {
    if (!wl) return;
    await joinWaitlist({ productId: product.id, slotStart: slotISO(date, wl.time), name: wlName, phone: wlPhone });
    toast.success(t("sheet.addedToWaitlist"));
    onClose();
  };

  const canAddTiered =
    partySize > 0 && openToday &&
    // A time is only demanded where there ARE times: slot grids (BT-03/09).
    // Daily-capped (BT-06) and courses sell on the date alone.
    (!isSlotBased(bt) || resourceMode ? true : !!slotTime) &&
    (!guided || guides.length === 0 || (!!guideId && slotGuides.includes(guideId))) &&
    (!provider || (!!slotTime && !!assignedProvider && providerTimeFree(slotTime))) &&
    waiverOk;

  return (
    <div className="fixed inset-y-0 left-0 right-0 z-50 flex flex-col justify-end lg:right-[24rem]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-inverse/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative z-10 max-h-[85vh] overflow-y-auto rounded-t-md bg-sheet p-section" style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}>
        <div className="mx-auto w-full max-w-[680px]">
        <div className="mx-auto mb-tight h-1 w-10 rounded-full bg-line" aria-hidden />
        {/* The reference leads with the product: a real thumbnail rather than a
            40px chip, the name at display size, and one line saying what this
            sheet is going to ask for. The subtitle is the SAME derived
            behaviour line the till tile shows, so the sheet opens on the words
            the operator just tapped rather than restating the name alone. */}
        <div className="mb-section flex items-start gap-comfortable">
          <ProductThumb images={product.images} name={product.name} bookingType={product.bookingType} size="thumb" />
          <div className="min-w-0 flex-1">
            <h2 className="type-h2 break-words text-2xl">{product.name}</h2>
            <p className="mt-inline text-[13px] text-muted">{behaviourSubtitle(product, { resources, team })}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("sheet.close")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted transition-colors duration-quick hover:bg-subtle hover:text-fg active:bg-ember/10"><X size={20} strokeWidth={1.75} /></button>
        </div>

        {/* Under two minutes it stops being information and becomes a
            deadline, so it changes register — the same threshold the rest of
            the app uses to switch a warning to a refusal. */}
        {heldUntil && holdLeft > 0 && (
          <div className={`mb-section flex items-center gap-tight rounded-sm border px-comfortable py-tight text-[13px] ${holdLeft < 120 ? "border-danger/30 bg-danger/10 text-danger" : "border-warning/30 bg-warning/10 text-warning"}`}>
            <Clock size={14} strokeWidth={1.75} className="shrink-0" />
            <span>
              {t(holdLeft < 120 ? "sheet.holdExpiring" : "sheet.holdRemaining", {
                time: `${Math.floor(holdLeft / 60)}:${String(holdLeft % 60).padStart(2, "0")}`,
              })}
            </span>
          </div>
        )}

        {(needsSchedule(bt) || provider) && !course && (
          <div className="mb-section">
            <p className="mb-tight text-[12px] font-medium uppercase tracking-wide text-muted">{t("sheet.dateLabel")}</p>
            {/* One row that scrolls, never a grid that wraps. Five chips plus
                the calendar cannot fit a phone's width, and wrapping put a
                lone card on a second row with "More dates" stranded next to
                it in dead space. */}
            <div className="-mx-comfortable flex items-stretch gap-tight overflow-x-auto px-comfortable pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {/* Date chips first — the next bookable days; calendar behind "More dates". */}
            {(() => {
              const chips: string[] = [];
              for (let i = 0; chips.length < 5 && i < 30; i++) {
                const d = new Date(Date.parse(`${TODAY}T12:00:00Z`) + i * 86400000).toISOString().slice(0, 10);
                if (isOpenOn(product, d)) chips.push(d);
              }
              return chips.map((d) => {
                const label = d === TODAY ? t("sheet.today") : d === TOMORROW ? t("sheet.tomorrow")
                  : new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
                return dateBtn(d, label);
              });
            })()}
            {moreDates ? (
              <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setSlotTime(undefined); setResourceId(undefined); }} className="h-auto shrink-0 self-stretch rounded-sm border border-line bg-card px-comfortable text-sm" />
            ) : (
              <button type="button" onClick={() => setMoreDates(true)} className="shrink-0 self-stretch whitespace-nowrap rounded-sm px-tight text-[13px] text-faint active:text-fg">{t("sheet.moreDates")}</button>
            )}
            </div>
          </div>
        )}
        {!openToday && needsSchedule(bt) && <p className="mb-section text-[13px] text-danger">{t("sheet.closedOnDate")}</p>}

        {/* A day-capped product is run by one number, so it gets a panel rather
            than a footnote under a date chip. The allowance is the whole
            inventory here — there is no slot list to read it off. */}
        {bt === "BT-06" && (product.schedule?.dailyCapacity ?? 0) > 0 && openToday && (() => {
          const total = product.schedule?.dailyCapacity ?? 0;
          const left = getDailyRemaining(product, date);
          const low = left <= Math.max(1, Math.floor(total * 0.2));
          return (
            <div className="mb-section rounded-sm border border-line bg-subtle p-comfortable">
              <div className="flex items-baseline justify-between gap-tight">
                <span className="text-[13px] text-muted">{t("sheet.dailyCapacity")}</span>
                <span className={`shrink-0 whitespace-nowrap text-[13px] font-medium ${left <= 0 ? "text-danger" : low ? "text-warning" : "text-success"}`}>
                  {t("sheet.remainingCount", { count: left })}
                </span>
              </div>
              <div className="mt-tight flex h-1.5 w-full overflow-hidden rounded-full bg-line" aria-hidden>
                <div
                  className={`h-full rounded-full ${left <= 0 ? "bg-danger" : low ? "bg-warning" : "bg-success"}`}
                  // Fills to show what is LEFT, because that is what the figure
                  // beside it says. A bar that grows as the allowance is spent
                  // would run opposite to its own label.
                  style={{ width: `${Math.min(100, Math.max(0, (left / total) * 100))}%` }}
                />
              </div>
              <p className="mt-inline text-[12px] text-muted">{t("sheet.totalCapacity", { count: total })}</p>
            </div>
          );
        })()}

        {/* Resource fixed-slot: resources × times (see SlotMatrix) */}
        {resourceMode && !flexible && openToday && (
          <>
            <SlotMatrix
              currency={currency}
              resourceNoun={matrix[0]?.resource.nounSingular ?? t("sheet.resource")}
              selectedResourceId={resourceId}
              selectedTime={slotTime}
              onSelect={(rid, time) => { setResourceId(rid); setSlotTime(time); setBlocked(null); }}
              onBlocked={setBlocked}
              rows={matrix.map((row) => ({
                id: row.resource.id,
                name: row.resource.name,
                outOfService: row.resource.outOfService,
                cells: row.slots.map((sl) => ({
                  time: sl.time,
                  available: sl.available,
                  price: applyResourceRate(
                    resolveProductPrice(product, date, sl.time, basePrice),
                    product.schedule?.sessionMinutes ?? 60,
                    row.resource,
                  ),
                })),
              }))}
            />
            {/* Every other pattern opens with a disabled CTA naming what is
                missing; the matrix opened with nothing at all, which is the one
                place a cashier cannot tell "not ready" from "broken". */}
            {!(resourceId && slotTime) && (
              <SheetFooter disabled onAdd={() => {}} label={t("sheet.pickTime")} />
            )}
            {resourceId && slotTime && (() => {
              const row = matrix.find((r) => r.resource.id === resourceId);
              const minutes = product.schedule?.sessionMinutes ?? 60;
              const price = applyResourceRate(resolveProductPrice(product, date, slotTime, basePrice), minutes, row?.resource);
              const plan = planWeekly(date, repeatCount, checkResourceDate(resourceId, slotTime, minutes));
              const dates = plan.filter((o) => o.ok).map((o) => o.date);
              const addAll = (pay = false) => {
                for (const [i, d] of dates.entries()) {
                  // Re-price per date: a band or a day override can move the
                  // rate even at the same clock time.
                  const p = applyResourceRate(resolveProductPrice(product, d, slotTime, basePrice), minutes, row?.resource);
                  // Only the last one asks to pay: a seven-week series is one
                  // sale, and opening the tender seven times is not express.
                  submitResource(resourceId, row?.resource.name ?? "", slotTime, p, minutes, d, pay && i === dates.length - 1);
                }
              };
              return (
                <>
                  <RepeatPicker
                    count={repeatCount}
                    onCount={setRepeatCount}
                    plan={plan}
                    time={slotTime}
                    unitPrice={price}
                    currency={currency}
                  />
                  {renderAddOns()}
                  <div className="mt-tight flex flex-col gap-tight">{renderGroup()}{renderWaiver()}</div>
                  <SheetFooter
                    summary={<>
                      <span className="font-medium">{row?.resource.name}</span> · <span>{slotTime}</span> · {formatDuration(minutes)}
                      {flatBasis ? ` · ${t("cart.groupOf", { count: group })}` : ""}
                      {dates.length > 1 ? ` · ${t("repeat.datesCount", { count: dates.length })}` : ""}
                      {" · "}
                      <span>{formatMoney(price * Math.max(1, dates.length) + addOnItems().reduce((s, i) => s + i.unitPrice * i.qty, 0), currency)}</span>
                    </>}
                    disabled={!waiverOk || dates.length === 0}
                    onAdd={addAll}
                    buyLabel={t("sheet.buyNow", { amount: formatMoney(price * Math.max(1, dates.length) + addOnItems().reduce((a, i) => a + i.unitPrice * i.qty, 0), currency) })}
                    label={
                      dates.length > 1
                        ? t("repeat.addDates", { count: dates.length, amount: formatMoney(price * dates.length, currency) })
                        : t("sheet.addSelection", { name: row?.resource.name ?? "", time: slotTime, amount: formatMoney(price, currency) })
                    }
                  />
                </>
              );
            })()}
          </>
        )}

        {/* Resource flexible: duration + lane (Any = best fit) + only-valid starts */}
        {flexible && openToday && (() => {
          const sch = product.schedule;
          const cfg = product.durationConfig;
          const buffer = product.bufferMinutes ?? 0;
          const override = sch?.dayOverrides?.[new Date(`${date}T12:00:00Z`).getUTCDay()];
          // Closing = one session length after the last bookable start.
          const closeMin = sch ? toMinutes(override?.endTime ?? sch.endTime) + (sch.sessionMinutes || 60) : Infinity;
          const lanes = getResourceMatrix(product, date).map((r) => r.resource);
          const mustEnd = cfg?.mustEndByClose ?? true;
          const lead = cfg?.leadTimeMinutes ?? 0;

          const startState = (tm: string, dur: number, laneId?: string): { ok: boolean; reason?: string } => {
            const start = toMinutes(tm);
            if (date === TODAY && start < NOW_MIN + lead) return { ok: false, reason: lead > 0 ? t("sheet.needsNotice", { duration: formatDuration(lead) }) : t("sheet.alreadyPast") };
            if (mustEnd && start + dur > closeMin) return { ok: false, reason: t("sheet.endsAfterClosing") };
            const free = laneId
              ? isResourceFreeFor(laneId, date, tm, dur, buffer)
              : !!firstFreeResource(product, date, tm, dur);
            return free ? { ok: true } : { ok: false, reason: laneId ? t("sheet.bookedShort") : t("sheet.allBooked") };
          };

          const laneOf = (id?: string): Resource | undefined => lanes.find((l) => l.id === id);
          const priceFor = (t: string, dur: number, lane?: Resource | null) =>
            applyResourceRate(productDurationPrice(product, date, t, dur, basePrice), dur, lane);
          const rateLabel = (l: Resource) =>
            l.rateOverride ? (l.rateOverride.kind === "premium" ? `+${formatMoney(l.rateOverride.amount, currency)}` : `${formatMoney(l.rateOverride.amount, currency)}/hr`) : null;
          const liveState = (l: Resource): string => {
            const spans = ownerBusyDetailed(l.id, date);
            if (l.outOfService) return t("sheet.outOfService");
            if (date === TODAY) {
              const current = spans.find((s) => s.start <= NOW_MIN && NOW_MIN < s.end);
              if (current) return t("sheet.inUseUntil", { time: toTime(current.end), label: current.label });
            }
            return spans.length ? t("sheet.bookingsToday", { count: spans.length }) : t("sheet.free");
          };

          const pickDuration = (d: number) => {
            setDuration(d);
            // Re-filter: a start that no longer fits clears with a notice.
            if (slotTime && !startState(slotTime, d, resourceId).ok) { setSlotTime(undefined); toast.info(t("sheet.startNoLongerFits")); }
          };

          // Start now: round the clock per config, first free lane.
          const round = cfg?.walkInRoundMinutes || 15;
          const nowTime = toTime(Math.ceil(NOW_MIN / round) * round);
          const nowLane = date === TODAY && (!mustEnd || NOW_MIN + duration <= closeMin) ? firstFreeResource(product, date, nowTime, duration) : null;
          const nowPrice = nowLane ? priceFor(nowTime, duration, nowLane) : 0;

          const endLabel = slotTime ? toTime(toMinutes(slotTime) + duration) : null;
          const chosenLaneFree = slotTime ? startState(slotTime, duration, resourceId).ok : false;

          return (
            <div className="mb-section flex flex-col gap-tight">
              {date === TODAY && (
                <button type="button" disabled={!nowLane || !waiverOk} onClick={() => nowLane && submitResource(nowLane.id, nowLane.name, nowTime, nowPrice, duration)} className={`flex h-12 items-center justify-between rounded-sm border px-comfortable text-sm ${nowLane && waiverOk ? "border-ember bg-ember/10 font-medium" : "border-line bg-subtle text-faint"}`}>
                  <span>{t("sheet.startNow", { time: nowTime, duration: formatDuration(duration), lane: nowLane ? ` · ${nowLane.name}` : "" })}</span>
                  <span>{!nowLane ? t("sheet.noLaneFree") : !waiverOk ? t("sheet.waiverFirst") : formatMoney(nowPrice, currency)}</span>
                </button>
              )}

              <span className="type-label text-[12px] text-muted">{t("sheet.duration")}</span>
              <div className="flex flex-wrap gap-tight">{flexOptions.map((d) => <button key={d} type="button" onClick={() => pickDuration(d)} className={`h-12 flex-1 whitespace-nowrap rounded-sm border px-tight text-sm ${duration === d ? "border-ember bg-ember/10 font-medium text-ember" : "border-line bg-card"}`}>{formatDurationShort(d)}{slotTime ? <span className="ml-inline text-[12px] opacity-70">{formatMoney(priceFor(slotTime, d, laneOf(resourceId)), currency)}</span> : null}</button>)}</div>

              <span className="type-label text-[12px] text-muted">{lanes[0]?.nounSingular ?? t("sheet.resource")}</span>
              <div className="-mx-comfortable flex items-stretch gap-tight overflow-x-auto px-comfortable pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <ChoiceCard selected={!resourceId} onClick={() => setResourceId(undefined)} className="flex h-14 items-center pl-comfortable pr-7 text-sm">{t("sheet.any")}</ChoiceCard>
                {lanes.map((r) => (
                  <ChoiceCard key={r.id} selected={resourceId === r.id} disabled={r.outOfService} onClick={() => setResourceId(r.id)} className="flex min-h-14 max-w-56 flex-col items-start justify-center py-inline pl-comfortable pr-7">
                    <span className="block max-w-full truncate text-sm leading-tight">{r.name}{rateLabel(r) ? <span className="ml-inline whitespace-nowrap text-[12px] text-faint">{rateLabel(r)}</span> : null}</span>
                    <span className="block max-w-full truncate text-[12px] leading-tight text-muted">{liveState(r)}</span>
                  </ChoiceCard>
                ))}
              </div>

              {/* The lane's day at a glance — selection drawn live on the strip;
                  tapping an occupied block explains, never a dead tap. */}
              {resourceId && (
                <ResourceTimeline
                  spans={ownerBusyDetailed(resourceId, date)}
                  openMin={flexTimes.length ? toMinutes(flexTimes[0]) : 0}
                  closeMin={closeMin}
                  sel={slotTime ? { start: toMinutes(slotTime), end: toMinutes(slotTime) + duration } : null}
                  hatched={laneOf(resourceId)?.outOfService}
                  onBlockTap={(s) => setBlocked(t("sheet.blockedBooked", { start: toTime(s.start), end: toTime(s.end), label: s.label, noun: (lanes[0]?.nounSingular ?? t("sheet.laneWord")).toLowerCase() }))}
                />
              )}

              {blocked && <BlockedNotice message={blocked} onDismiss={() => setBlocked(null)} />}

              <div className="flex items-center justify-between">
                <span className="type-label text-[12px] text-muted">{t("sheet.startTime")}</span>
                {/* Chips for speed, the stepper for precision (walk-in rounding). */}
                <div className="flex items-center gap-inline">
                  <button type="button" aria-label={t("sheet.earlier")} onClick={() => { const base = toMinutes(slotTime ?? flexTimes[0] ?? "12:00"); const next = Math.max(flexTimes.length ? toMinutes(flexTimes[0]) : 0, base - round); setSlotTime(toTime(next)); setBlocked(null); }} className="flex h-11 w-11 items-center justify-center rounded-sm border border-line text-lg active:bg-ember/10">−</button>
                  <span className="w-14 text-center text-[13px]">{slotTime ?? "—"}</span>
                  <button type="button" aria-label={t("sheet.later")} onClick={() => { const base = toMinutes(slotTime ?? flexTimes[0] ?? "12:00"); const cap = mustEnd ? closeMin - duration : 24 * 60 - round; const next = Math.min(cap, base + round); setSlotTime(toTime(next)); setBlocked(null); }} className="flex h-11 w-11 items-center justify-center rounded-sm border border-line text-lg active:bg-ember/10">+</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-inline">
                {flexTimes.map((tt) => {
                  const st = startState(tt, duration, resourceId);
                  if (!st.ok) {
                    return <button key={tt} type="button" onClick={() => setBlocked(t("sheet.unavailableStart", { time: tt, reason: st.reason?.toLowerCase() ?? "", noun: (lanes[0]?.nounSingular ?? t("sheet.laneWord")).toLowerCase() }))} className="h-12 rounded-sm border border-line bg-subtle px-comfortable text-[13px] text-faint line-through" title={st.reason}>{tt}</button>;
                  }
                  return <button key={tt} type="button" onClick={() => { setSlotTime(tt); setBlocked(null); }} className={`h-12 rounded-sm border px-comfortable text-[13px] ${slotTime === tt ? "border-ember bg-ember/10 font-medium text-ember" : "border-line bg-card"}`}>{tt}</button>;
                })}
              </div>

              {renderGroup()}
              {renderWaiver()}

              {slotTime && endLabel && (() => {
                const lane = laneOf(resourceId) ?? (chosenLaneFree ? firstFreeResource(product, date, slotTime, duration) : null);
                const total = priceFor(slotTime, duration, lane);
                // The price math — staff can answer "why is it this price".
                const segs = lane?.rateOverride?.kind === "replace"
                  ? [{ minutes: duration, ratePerHour: lane.rateOverride.amount }]
                  : cfg
                    ? priceSegments(cfg, product.pricingRules ?? [], date, slotTime, duration)
                    : [];
                const math = segs.length === 1
                  ? `${formatMoney(segs[0].ratePerHour, currency)} × ${formatDuration(duration)} = ${formatMoney(total, currency)}`
                  : segs.length > 1
                    ? `${segs.map((s) => `${formatDuration(s.minutes)} @ ${formatMoney(s.ratePerHour, currency)}`).join(" + ")} = ${formatMoney(total, currency)}`
                    : "";
                const premium = lane?.rateOverride?.kind === "premium" ? ` (incl. ${lane.name} +${formatMoney(lane.rateOverride.amount, currency)})` : "";
                return (
                  <div className="flex flex-col gap-inline">
                    {math && <p className="text-[12px] text-muted">{math}{premium}</p>}
                    {/* The live selection summary — the CTA never enables without it. */}
                    <p className="text-[13px]">
                      <span className="font-medium">{lane?.name ?? t("sheet.anyLane")}</span> · <span className="tabular-nums">{slotTime}–{endLabel}</span> · {formatDuration(duration)}
                      {flatBasis ? ` · ${t("cart.groupOf", { count: group })}` : ""} · <span className="tabular-nums">{formatMoney(total, currency)}</span>
                      {!resourceId && lane ? <span className="text-faint">{t("sheet.bestFit")}</span> : null}
                    </p>
                  </div>
                );
              })()}
              <SheetFooter
                disabled={!slotTime || !chosenLaneFree || !waiverOk}
                onAdd={submitFlexible}
                buyLabel={
                  slotTime && chosenLaneFree
                    ? t("sheet.buyNow", {
                        amount: formatMoney(
                          priceFor(slotTime, duration, laneOf(resourceId) ?? firstFreeResource(product, date, slotTime, duration)) +
                            addOnItems().reduce((a, i) => a + i.unitPrice * i.qty, 0),
                          currency,
                        ),
                      })
                    : undefined
                }
                label={slotTime && chosenLaneFree
                  ? t("sheet.addFlexible", { duration: formatDuration(duration), start: slotTime, end: endLabel ?? "", amount: formatMoney(priceFor(slotTime, duration, laneOf(resourceId) ?? firstFreeResource(product, date, slotTime, duration)), currency) })
                  // Says what is missing rather than sitting dead — the spec's
                  // "always show why", applied to the button itself.
                  : !slotTime ? t("sheet.pickStart") : !chosenLaneFree ? t("sheet.pickFreeLane") : t("sheet.addToSale")}
              />
            </div>
          );
        })()}

        {/* Provider cards + appointment times (conflict-aware per provider) */}
        {provider && (
          <div className="mb-section flex flex-col gap-tight">
            {/* Stacked full-width rows, not a wrap grid: each row carries a
                name, when they are next free and what they cost, and those
                three want a consistent left edge to be comparable. */}
            <div className="flex flex-col gap-tight">
              {product.providerPickable && providers.map((p) => {
                const nextFree = providerTimes.find((t) => (date !== TODAY || toMinutes(t) >= NOW_MIN) && isOwnerFree(p.id, date, t, providerDuration));
                return (
                  <ChoiceCard key={p.id} selected={providerId === p.id} onClick={() => setProviderId(p.id)} className="flex w-full items-center gap-tight py-comfortable pl-comfortable pr-7">
                    <Avatar name={p.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="block text-[12px] text-muted">{nextFree ? t("sheet.nextFree", { time: nextFree }) : t("sheet.fullyBooked")}</span>
                    </span>
                    <span className={`shrink-0 whitespace-nowrap text-[12px] ${premiumOf(p.id) > 0 ? "font-medium text-ember" : "text-muted"}`}>
                      {premiumOf(p.id) > 0 ? t("sheet.premiumAmount", { amount: formatMoney(premiumOf(p.id), currency) }) : t("sheet.standardRate")}
                    </span>
                  </ChoiceCard>
                );
              })}
              <ChoiceCard selected={!providerId} onClick={() => setProviderId(undefined)} className="flex w-full items-center justify-center px-7 py-comfortable text-sm">{t("sheet.firstAvailable")}</ChoiceCard>
            </div>
            <span className="type-label mt-tight text-[12px] text-faint">{t("sheet.startTimeDuration", { minutes: providerDuration })}</span>
            <div className="flex flex-wrap gap-inline">
              {providerTimes.map((t) => {
                const free = providerTimeFree(t);
                return (
                  <button key={t} type="button" disabled={!free} onClick={() => setSlotTime(t)} className={`h-12 rounded-sm border px-comfortable text-[13px] ${!free ? "border-line bg-subtle text-faint line-through" : slotTime === t ? "border-ember bg-ember/10 font-medium text-ember" : "border-line bg-card"}`}>{t}</button>
                );
              })}
            </div>
            {slotTime && assignedProvider && !providerId && (
              <p className="text-[12px] text-muted">{t("sheet.firstAvailableAt", { time: slotTime, name: `${assignedProvider.name}${premiumOf(assignedProvider.id) > 0 ? ` (+${formatMoney(premiumOf(assignedProvider.id), currency)})` : ""}` })}</p>
            )}
            {slotTime && !providerTimeFree(slotTime) && (
              <p className="text-[12px] text-danger">{t("sheet.busyAtTime", { name: providers.find((p) => p.id === providerId)?.name ?? t("sheet.everyone"), time: slotTime })}</p>
            )}
          </div>
        )}

        {/* Course dates */}
        {/* A course has nothing to configure — it runs on fixed dates and the
            only decision left is how many places. The panel says so in the
            affirmative rather than presenting a list that looks like a choice
            the cashier still has to make. */}
        {course && (
          <div className="mb-section rounded-sm border border-success/30 bg-success/10 p-comfortable">
            <p className="flex items-center gap-inline text-sm font-medium text-success">
              <Check size={14} strokeWidth={2.5} />
              {t("sheet.readyToAdd")}
            </p>
            <p className="mt-inline text-[12px] text-muted">{t("sheet.courseDates")}</p>
            <p className="text-[12px]">{(product.courseDates ?? []).join(" · ") || "—"}</p>
          </div>
        )}

        {/* A refusal from the slot grid explains itself right above the grid,
            where the tap happened — the flexible branch has its own notice
            beside the lane timeline. */}
        {blocked && !resourceMode && !flexible && (
          <div className="mb-section">
            <BlockedNotice message={blocked} onDismiss={() => setBlocked(null)} />
          </div>
        )}

        {/* Fixed sessions — rows, not tiles (see SessionList). The list is
            named after what it holds: a museum picks a session, a tour picks a
            departure, and the operator's word for it is the one that should
            appear above the rows. */}
        {needsSchedule(bt) && !resourceMode && !flexible && openToday && (
          <p className="mb-tight text-[12px] font-medium uppercase tracking-wide text-muted">
            {t(guided ? "sheet.departureLabel" : "sheet.sessionLabel")}
          </p>
        )}
        {needsSchedule(bt) && !resourceMode && !flexible && openToday && (
          <SessionList
            currency={currency}
            selected={slotTime}
            sessions={slots.map((s) => {
              const left = s.remaining - seatsInCart(product.id, slotISO(date, s.time));
              // A departure needs a free guide as well as seats.
              const guideless = guided && guides.length > 0 && freeGuides(product, date, s.time).length === 0;
              const free = guided ? freeGuides(product, date, s.time) : [];
              return {
                time: s.time,
                price: resolveProductPrice(product, date, s.time, basePrice),
                capacity: s.capacity,
                left: guideless ? 0 : left,
                blockedReason: guideless ? t("sheet.noGuideFree") : null,
                meta: guided && free.length
                  ? t("sheet.ledByName", { name: team.find((x) => x.id === free[0])?.name ?? "" })
                  : null,
                waitlist: !!product.waitlistEnabled,
              };
            })}
            onSelect={(time) => {
              setSlotTime(time);
              if (guided) setGuideId(freeGuides(product, date, time)[0]);
            }}
            onWaitlist={(time) => setWl({ time })}
            onBlocked={(time, reason) => {
              // Explain the slot that was TAPPED, not whatever happens to be
              // selected — otherwise the reason describes a different session.
              const why = explainUnavailable({
                product,
                date,
                slotStart: slotISO(date, time),
                remaining: 0,
                wanted: 1,
              });
              setBlocked(why?.message ?? reason);
            }}
          />
        )}

        {/* Guided: pick who leads — busy guides (on ANY product) can't be chosen */}
        {guided && slotTime && guides.length > 0 && openToday && (
          <div className="mb-section flex flex-col gap-tight">
            <span className="type-label text-[12px] text-muted">{t("sheet.ledBy")}</span>
            <div className="flex flex-col gap-tight">
              {guides.map((g) => {
                const free = slotGuides.includes(g.id);
                return (
                  <ChoiceCard key={g.id} selected={guideId === g.id} disabled={!free} onClick={() => setGuideId(g.id)} className="flex w-full items-center gap-tight py-comfortable pl-comfortable pr-7">
                    <Avatar name={g.name} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{g.name}</span>
                      <span className={`block text-[12px] ${free ? "text-success" : "text-muted"}`}>
                        {free ? t("sheet.guideAvailable") : t("sheet.guideBusy")}
                      </span>
                    </span>
                  </ChoiceCard>
                );
              })}
            </div>
          </div>
        )}

        {bt === "BT-06" && openToday && (product.schedule?.dailyCapacity ?? 0) <= 0 && <p className="mb-section text-[13px] text-muted">{t("sheet.leftToday", { count: dailyLeft, when: date === TODAY ? t("sheet.leftTodayWord") : t("sheet.leftThatDay") })}</p>}

        {/* Tier / section steppers (not for exclusive resource / flexible) */}
        {!resourceMode && (
          <>
            {hasLayout ? (
              // Visual seat picker (BT-07 seated) — tap seats to add to the sale.
              (() => {
                const maxCol = Math.max(1, ...availSeats.map((s) => s.posX + 1));
                const cats = [...new Map(availSeats.map((s) => [s.categoryUid, s])).values()];
                return (
                  <div>
                    <div className="mb-tight rounded-xs bg-subtle py-inline text-center text-[12px] tracking-widest text-faint">{seatT("picker.screen")}</div>
                    <div className="overflow-x-auto">
                      <div data-seat-grid className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${maxCol}, 1.6rem)` }}>
                        {availSeats.map((s) => {
                          const sel = selectedSeats.includes(s.label);
                          return (
                            <button
                              key={s.label}
                              type="button"
                              disabled={!s.available}
                              onClick={() => setSelectedSeats((cur) => (cur.includes(s.label) ? cur.filter((x) => x !== s.label) : [...cur, s.label]))}
                              title={`${s.label} · ${s.categoryName} · ${formatMoney(s.price, currency)}`}
                              style={{ gridColumnStart: s.posX + 1, gridRowStart: s.posY + 1, ...(s.available && !sel ? { background: `${s.color}33`, color: s.color, borderColor: s.color } : {}) }}
                              className={`h-7 rounded-[3px] border text-[9px] leading-none ${!s.available ? "cursor-not-allowed border-line bg-line text-faint line-through" : sel ? "border-ember bg-ember font-medium text-white" : ""}`}
                            >
                              {s.label.replace(/^[A-Za-z]+/, "")}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mt-tight flex flex-wrap items-center justify-between gap-tight text-[12px]">
                      <div className="flex flex-wrap gap-major text-muted">
                        {cats.map((s) => (
                          // The swatch is drawn the way an AVAILABLE seat of
                          // that category is drawn — tinted, with its own
                          // border. A solid swatch collided with the solid
                          // ember "Selected" chip whenever a category happened
                          // to be orange, which Stalls is.
                          <span key={s.categoryUid} className="flex items-center gap-inline"><span className="h-3 w-3 rounded-[2px] border" style={{ background: `${s.color}33`, borderColor: s.color }} />{s.categoryName} · <span>{formatMoney(s.price, currency)}</span></span>
                        ))}
                        <span className="flex items-center gap-inline"><span className="h-3 w-3 rounded-[2px] bg-ember" />{t("sheet.seatSelected")}</span>
                        <span className="flex items-center gap-inline"><span className="h-3 w-3 rounded-[2px] bg-line" />{seatT("picker.sold")}</span>
                      </div>
                      <span>{seatT("picker.selected", { count: selectedSeats.length })}</span>
                    </div>
                  </div>
                );
              })()
            ) : (
            <div className="flex flex-col gap-tight">
              {(sectioned ? (product.sections ?? []).map((s) => ({ id: s.id, name: `${s.name}`, price: s.price, cap: s.capacity, note: "", donation: false })) : activeTiers.map((tier) => ({ id: tier.id, name: tier.name, price: tier.price, cap: undefined as number | undefined, note: [(tier.admits ?? 1) > 1 ? t("sheet.admits", { count: tier.admits ?? 1 }) : "", tier.ageNote ?? ""].filter(Boolean).join(" · "), donation: !!tier.donation }))).map((row) => (
                <div key={row.id} className="flex items-center justify-between rounded-sm border border-line bg-card p-comfortable">
                  <div className="min-w-0"><div className="text-sm font-medium">{row.name}</div><div className="text-[12px] text-faint">{row.donation ? t("sheet.donationMin", { amount: formatMoney(row.price, currency) }) : formatMoney(row.price, currency)}{row.cap != null ? ` · ${t("sheet.seatsCount", { count: row.cap })}` : ""}{row.note ? ` · ${row.note}` : ""}</div></div>
                  {row.donation ? (
                    <div className="flex items-center gap-tight">
                      <span className="text-sm text-faint">{currency === "BDT" ? "৳" : ""}</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        aria-label={row.name}
                        value={(donationAmt[row.id] ?? row.price) / 100}
                        onChange={(e) => {
                          const minor = Math.round((parseFloat(e.target.value) || 0) * 100);
                          setDonationAmt((d) => ({ ...d, [row.id]: minor }));
                          setQty((q) => ({ ...q, [row.id]: minor >= row.price && minor > 0 ? 1 : 0 }));
                        }}
                        className="h-12 w-28 rounded-sm border border-line bg-card px-comfortable text-right text-sm outline-none focus:border-inverse"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-tight">
                      <button type="button" aria-label={t("sheet.less")} onClick={() => setQty((q) => ({ ...q, [row.id]: Math.max(0, (q[row.id] ?? 0) - 1) }))} className="h-12 w-12 rounded-sm border border-line text-lg active:bg-ember/10">−</button>
                      <span className="w-8 text-center">{qty[row.id] ?? 0}</span>
                      <button type="button" aria-label={t("sheet.more")} onClick={() => setQty((q) => ({ ...q, [row.id]: (q[row.id] ?? 0) + 1 }))} className="h-12 w-12 rounded-sm border border-line text-lg active:bg-ember/10">+</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            )}
            {(() => {
              const repeatable =
                needsSchedule(bt) && !resourceMode && !provider && !course && !hasLayout && !guided && !sectioned && !!slotTime;
              if (!repeatable || !slotTime) return null;
              const seats = partySize || 1;
              const plan = planWeekly(date, repeatCount, checkSlotDate(slotTime, seats));
              const unit =
                activeTiers.reduce((a, x) => a + (qty[x.id] ?? 0) * x.price, 0) +
                addOnItems().reduce((a, i) => a + i.unitPrice * i.qty, 0);
              return (
                <RepeatPicker
                  count={repeatCount}
                  onCount={setRepeatCount}
                  plan={plan}
                  time={slotTime}
                  unitPrice={unit}
                  currency={currency}
                />
              );
            })()}
            {renderAddOns()}
            {renderWaiver()}
            {/* The live selection summary — plain language, mono numbers. */}
            {partySize > 0 && (() => {
              const list = sectioned ? (product.sections ?? []) : activeTiers;
              const itemsLabel = list.filter((x) => (qty[x.id] ?? 0) > 0).map((x) => `${qty[x.id]} ${x.name}`).join(" · ");
              const owner = guided ? guides.find((g) => g.id === guideId)?.name : provider ? assignedProvider?.name : undefined;
              const prem = provider && assignedProvider ? premiumOf(assignedProvider.id) : 0;
              const total = list.reduce((s, x) => s + (qty[x.id] ?? 0) * x.price, 0) + addOnItems().reduce((s, i) => s + i.unitPrice * i.qty, 0) + prem;
              const when = slotTime ? `${slotTime} ${date === TODAY ? t("slotToday") : date}` : (needsSchedule(bt) || provider || course) ? (date === TODAY ? t("slotToday") : date) : null;
              return (
                <p className="mt-tight text-[13px]">
                  {when && <><span className="tabular-nums">{when}</span> · </>}
                  {itemsLabel}
                  {owner ? <> · <span className="font-medium">{owner}</span>{provider ? ` · ${formatDuration(providerDuration)}` : ""}</> : null}
                  {" · "}<span className="tabular-nums">{formatMoney(total, currency)}</span>
                </p>
              );
            })()}
            {depositPct > 0 && (
              <p className="mt-section rounded-sm border border-line bg-card p-comfortable text-[13px] text-muted">
                {t.rich("sheet.depositNote", { pct: depositPct, b: (chunks) => <span className="font-medium text-fg">{chunks}</span> })}
              </p>
            )}
            <SheetFooter
              disabled={hasLayout ? selectedSeats.length === 0 || !waiverOk : !canAddTiered}
              // Offered only once the sheet has something to sell — a Buy now
              // on an empty selection is a button that can only disappoint.
              buyLabel={(() => {
                const ready = hasLayout ? selectedSeats.length > 0 && waiverOk : canAddTiered;
                if (!ready) return undefined;
                const list = sectioned ? (product.sections ?? []) : activeTiers;
                const prem = provider && assignedProvider ? premiumOf(assignedProvider.id) : 0;
                const base = hasLayout
                  ? seatTotal
                  : list.reduce((a, x) => a + (qty[x.id] ?? 0) * x.price, 0);
                const total = base + addOnItems().reduce((a, i) => a + i.unitPrice * i.qty, 0) + prem;
                return t("sheet.buyNow", { amount: formatMoney(total, currency) });
              })()}
              onAdd={(pay) => {
                if (hasLayout) return submitSeats(pay);
                const repeatable =
                  needsSchedule(bt) && !resourceMode && !provider && !course && !guided && !sectioned && !!slotTime;
                if (!repeatable || repeatCount <= 1 || !slotTime) return submitTiered(undefined, pay);
                const days = planWeekly(date, repeatCount, checkSlotDate(slotTime, partySize || 1))
                  .filter((o) => o.ok)
                  .map((o) => o.date);
                days.forEach((d, i) => submitTiered(d, pay && i === days.length - 1));
              }}
              // The verb names the thing being bought, and carries its total.
              // "Add to sale" told a cashier nothing they could check against.
              label={(() => {
                const list = sectioned ? (product.sections ?? []) : activeTiers;
                const n = list.reduce((a, x) => a + (qty[x.id] ?? 0), 0);
                const prem = provider && assignedProvider ? premiumOf(assignedProvider.id) : 0;
                const total = list.reduce((a, x) => a + (qty[x.id] ?? 0) * x.price, 0) + addOnItems().reduce((a, i) => a + i.unitPrice * i.qty, 0) + prem;
                const amount = formatMoney(total, currency);
                if (course) return t("sheet.enrolAmount", { amount });
                if (provider) return assignedProvider ? t("sheet.addAppointment", { amount }) : t("sheet.pickProvider");
                if (hasLayout) return selectedSeats.length ? t("sheet.addSeats", { count: selectedSeats.length, amount: formatMoney(seatTotal + addOnItems().reduce((a, i) => a + i.unitPrice * i.qty, 0), currency) }) : t("sheet.pickSeats");
                if (n === 0) return t("sheet.pickTickets");
                return t("sheet.addTickets", { count: n, amount });
              })()}
            />
          </>
        )}

        {/* Waitlist mini-form */}
        {wl && (
          <div className="mt-section rounded-sm border border-warning bg-warning/5 p-section">
            <p className="text-sm font-medium">{t("sheet.joinWaitlistFor", { time: wl.time })}</p>
            <div className="mt-tight grid grid-cols-1 gap-tight sm:grid-cols-2">
              <FormField label={t("sheet.name")} value={wlName} onChange={(e) => setWlName(e.target.value)} />
              <FormField label={t("sheet.phone")} value={wlPhone} onChange={(e) => setWlPhone(e.target.value)} />
            </div>
            <div className="mt-tight flex justify-end gap-tight"><Button variant="secondary" onClick={() => setWl(null)}>{t("sheet.cancel")}</Button><Button disabled={!wlName.trim()} onClick={doWaitlist}>{t("sheet.join")}</Button></div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
