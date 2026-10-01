"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, Clock, Lock, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar, BlockedNotice, Button, ChoiceCard, FormField, PlanView, ProductThumb, ResourceTimeline, useToast, DateStrip } from "@/components/ui";
import { seatMap } from "@/lib/api";
import { SessionList } from "./SessionList";
import { SlotMatrix } from "./SlotMatrix";
import { RepeatPicker } from "./RepeatPicker";
import { useApiQuery } from "@/lib/useApi";
import {
  applyResourceRate,
  blockingHold,
  CHECKOUT_HELD_FOR,
  explainUnavailable,
  firstFreeResource,
  freeGuides,
  getDailyRemaining,
  getResourceMatrix,
  getSlots,
  inventoryItem,
  isOpenOn,
  isOwnerFree,
  isSessionLocked,
  isResourceFreeFor,
  joinWaitlist,
  levelOf,
  peekHolds,
  ownerBusyDetailed,
  placeHold,
  releaseHold,
  type Product,
  type ProductSchedule,
  type Resource,
  type Staff,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import { DEMO_STAFF_ID } from "@/lib/session";
import { DEMO_TODAY, isFlexibleResource, isResourceType, isSlotBased, needsSchedule, slotISO, slotTimesOn, toMinutes, toTime } from "@/lib/schedule";
import { resolveProductPrice } from "@/lib/pricing";
import { durationOptions, formatDuration, formulaPrice, isDealDuration, priceSegments, productDurationPrice } from "@/lib/duration";
import { useBehaviourSubtitle } from "@/lib/behaviour";
import { planWeekly, type OccurrenceBlock } from "@/lib/recurrence";
import { formatClock, formatClockMin, formatClockRange, formatDay, formatMoney, formatPriceShort } from "@/lib/format";
import { ClockCell } from "./Clock";
import { ActionBar } from "./ActionBar";

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
  /** The same seats with the category that prices each one — what the SALE
   *  needs, so the order records WHICH seat went. */
  seats?: { label: string; tierId: string; tierName: string; unitPrice: number }[];
  /** Which day of a multi-day event these tickets admit ("Day 2"), for the
   *  cart line. The date itself rides on `slotDate` like everything else. */
  eventDayLabel?: string;
  partySize?: number; // group size for flat-per-booking entries ("Group of 6")
  taxRatePct?: number; // custom-amount entries carry their own rate
  /** …and their own class, so a reduced-rate bottle of water is recorded as
   *  reduced rather than as "standard at 7.5%", which is what a rate with no
   *  class reads as on a tax return. */
  taxClass?: "standard" | "reduced" | "exempt";
  lineDiscountPct?: number; // F11 line-level discount, as a percentage
  /** …or money off this line. Whichever the cashier typed; the cart resolves
   *  one into the other so only one of the two is ever set. */
  lineDiscountAmount?: number;
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
  onHold,
  holdRow,
  onBack,
}: {
  summary?: React.ReactNode;
  note?: React.ReactNode;
  disabled: boolean;
  /** `pay` = settle this now; kept for callers, the sheet no longer offers it
   *  (Take payment is one tap from the sell screen's own bar). */
  onAdd: (pay: boolean) => void;
  label: string;
  /** Kept so call sites need not change; there is no second orange button. */
  buyLabel?: string;
  /** Hold these places instead — the bar's left button, where "not now" always
   *  is on this till. Absent where there is nothing to hold. */
  onHold?: () => void;
  /** Who a hold is for, once Hold has been pressed. */
  holdRow?: React.ReactNode;
  /** The left button when there is nothing to hold: the way out, in the
   *  place the way out always is. */
  onBack?: () => void;
}) {
  const t = useTranslations("pos");
  /* The till's one bar: Hold on the left, the orange Add on the right — the
     same pair in the same places as the Schedule's bar and the cart's foot.
     Sticky, because the sheets that need it most are the long ones, where the
     total and the action would otherwise scroll away mid-decision. */
  return (
    <div className="sticky bottom-0 z-10 -mx-section mt-section">
      <ActionBar
        docked="panel"
        className="bg-surface"
        summary={
          <>
            {note}
            {summary && <div className="text-[0.8125rem]">{summary}</div>}
            {holdRow}
          </>
        }
        secondary={
          onHold
            ? { label: t("sheet.holdShort"), icon: <Lock size={20} strokeWidth={2} aria-hidden />, onClick: onHold }
            : onBack
              ? { label: t("sheet.back"), icon: <ChevronLeft size={20} strokeWidth={2} aria-hidden />, onClick: onBack }
              : null
        }
        primary={{ label, icon: disabled ? undefined : <Plus size={20} strokeWidth={2.5} aria-hidden />, onClick: () => onAdd(false), disabled }}
      />
    </div>
  );
}

export function ProductSheet({
  product,
  locationId,
  currency,
  initial,
  preset,
  seatsInCart,
  onAdd,
  onClose,
  team = [],
  resources = [],
}: {
  product: Product;
  /** The venue this till stands in, so a stock cap matches where the sale writes. */
  locationId?: string;
  currency: string;
  initial: CartEntry | null;
  /** Where to OPEN, when the sheet was reached from a slot on the Schedule.
   *  Deliberately not an `initial` cart entry: that shape means "edit this
   *  line", and reusing it would take the single-tier default quantity down
   *  to zero and hand the new line the edited line's id. */
  preset?: { date?: string; time?: string; resourceId?: string };
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
  const subtitle = useBehaviourSubtitle();
  /* Escape closes, as every other sheet in the app does. On the page, not
     the panel: the sheet does not take focus when it opens, so a key
     handler on the panel never heard the key. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const tc = useTranslations("common");
  const seatT = useTranslations("seatmaps");
  const hasLayout = !!product.layoutId;
  /* The whole room, not just the seats: before this the till printed its own
     "SCREEN" banner above a CSS grid, which is a guess about the shape of the
     room and wrong the moment it is a dining room. The scenery is now wherever
     the operator put it. */
  const [selectedSeats, setSelectedSeats] = useState<string[]>(initial?.seatLabels ?? []);
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

  const [date, setDate] = useState(initial?.slotDate ?? preset?.date ?? firstBookable);
  /* A timed sheet opens READY, on the next time that can be sold — the
     next departure with seats, or the next start a lane is free for — so the
     orange button works the moment the sheet opens, as it does for tickets.
     A different time is one tap. */
  const [slotTime, setSlotTime] = useState<string | undefined>(() => {
    const given = initial?.slotTime ?? preset?.time;
    if (given) return given;
    const d0 = initial?.slotDate ?? preset?.date ?? firstBookable;
    const notPast = (t: string) => d0 !== TODAY || toMinutes(t) >= NOW_MIN;
    if (product.layoutId || !isOpenOn(product, d0)) return undefined;
    if (isFlexibleResource(bt)) {
      const shortest = product.durationConfig ? durationOptions(product.durationConfig)[0] : 60;
      const sch = product.schedule ?? ({ ...PROVIDER_DAY, startTime: "06:00", endTime: "22:00" });
      return slotTimesOn(sch, d0).find((t) => notPast(t) && !!firstFreeResource(product, d0, t, shortest));
    }
    if (isSlotBased(bt) && !isResourceType(bt)) {
      return getSlots(product, d0).find((sl) => sl.remaining > 0 && notPast(sl.time))?.time;
    }
    return undefined;
  });
  const [resourceId, setResourceId] = useState<string | undefined>(initial?.resourceId ?? preset?.resourceId);

  /* Keyed on the performance — declared after the date it depends on. The same
     hall is sold again tomorrow, so seats taken for tonight must not be
     missing from tomorrow's map. */
  const seatsQ = useApiQuery(() => seatMap(product.id, date, slotTime), [product.id, date, slotTime]);
  const availSeats = seatsQ.data?.seats ?? [];
  const seatFixtures = seatsQ.data?.fixtures ?? [];
  /** A seat map prices itself off the seats, not off the tier steppers — those
   *  stay at zero because a seat IS the ticket here. The CTA was reading them
   *  anyway and offering "Add 2 seats — ৳0.00" on a ৳800 pair. `submitSeats`
   *  already priced the sale correctly from these same rows, so the button was
   *  the only thing lying. */
  const seatTotal = availSeats
    .filter((s) => selectedSeats.includes(s.label))
    .reduce((a, s) => a + s.price, 0);
  const [providerId, setProviderId] = useState<string | undefined>();
  const [guideId, setGuideId] = useState<string | undefined>(() =>
    slotTime && (product.schedule?.guideIds?.length ?? 0) > 0 ? freeGuides(product, date, slotTime)[0] : undefined,
  );
  // Flexible durations come from the duration engine when configured.
  const flexOptions = product.durationConfig
    ? durationOptions(product.durationConfig)
    : (product.flexibleDurations ?? [60, 90, 120]);
  const [duration, setDuration] = useState<number>(flexOptions[0] ?? 60);
  const [qty, setQty] = useState<Record<string, number>>(() => {
    const q: Record<string, number> = {};
    const list = sectioned ? (product.sections ?? []).map((s) => s.id) : activeTiers.map((t) => t.id);
    /* One of the FIRST ticket type, ready — "one, please" is the commonest
       answer at a counter, so the orange button works the moment the sheet
       opens, as it does on the Schedule's tickets sheet. The operator's first
       type, not the cheapest: the cheapest is usually a concession. */
    const first = sectioned
      ? list[0]
      : activeTiers.find((x) => !x.donation)?.id;
    list.forEach((id) => (q[id] = initial?.items.find((i) => i.tierId === id)?.qty ?? (!initial && id === first ? 1 : 0)));
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
  /* The refusal, with the mechanism behind it — a held slot carries the id of
     the hold that is holding it, so the till can offer the way past instead of
     naming a screen the cashier would have to go and find. */
  const [blocked, setBlocked] = useState<{ message: string; holdId?: string } | null>(null);
  const [releasing, setReleasing] = useState(false);
  /* Availability is derived in render from the store, so a release has to
     re-derive it. The counter is what says "ask again" — there is nothing to
     refetch, and the slot grid would otherwise keep drawing the old answer. */
  const [stamp, setStamp] = useState(0);
  /* ── holding, from the till ────────────────────────────────────────────
     The counter takes the call: "hold twenty-five for the school, they will
     pay on Thursday." It used to mean leaving the till for a register on the
     admin side, so in practice it meant a sticky note. */
  const [holdOpen, setHoldOpen] = useState(false);
  const [holdFor, setHoldFor] = useState("");
  const [holding, setHolding] = useState(false);

  /** Release the hold standing in the way, so the party it was held for can
   *  be sold to at the counter they are standing at. */
  const releaseAndSell = async (id: string) => {
    if (releasing) return;
    setReleasing(true);
    const res = await releaseHold(id);
    setReleasing(false);
    if (!res.ok) {
      setBlocked({ message: res.error.message });
      return;
    }
    setBlocked(null);
    setStamp((n) => n + 1);
  };
  const [courseDatesOpen, setCourseDatesOpen] = useState(false);
  /** BT-02 sells a pass in lengths. The first is the default because it is the
   *  cheapest and the commonest, not because it is first in the array. */
  const validityOptions = bt === "BT-02" ? (product.validityOptions ?? []) : [];
  const [validityId, setValidityId] = useState<string | undefined>(validityOptions[0]?.id);
  const validity = validityOptions.find((v) => v.id === validityId);

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
      <label className="mt-tight flex cursor-pointer items-center gap-tight rounded-go border border-line bg-card p-comfortable text-sm">
        <input type="checkbox" checked={waived} onChange={(e) => setWaived(e.target.checked)} className="h-6 w-6 shrink-0 accent-ember" />
        {t("sheet.waiverSigned")}
      </label>
    ) : null;

  const renderGroup = () =>
    flatBasis ? (
      <div className="flex items-center justify-between rounded-go border border-line bg-card p-comfortable">
        <span className="text-sm">{t("sheet.groupSize")}</span>
        <div className="flex items-center gap-tight">
          <button type="button" aria-label={t("sheet.fewer")} onClick={() => setGroup((g) => Math.max(partyMin, g - 1))} className="h-12 w-12 rounded-full border border-line text-lg active:bg-ember/10">−</button>
          <span className="w-8 text-center">{group}</span>
          <button type="button" aria-label={t("sheet.morePeople")} onClick={() => setGroup((g) => Math.min(partyMax, g + 1))} className="h-12 w-12 rounded-full border border-line text-lg active:bg-ember/10">+</button>
        </div>
      </div>
    ) : null;
  const addOnItems = () => (product.addOns ?? []).filter((a) => (addOnQty[a.id] ?? 0) > 0).map((a) => ({ tierId: a.id, tierName: a.perPerson ? t("sheet.eachSuffix", { name: a.name }) : a.name, unitPrice: a.price, qty: addOnQty[a.id] }));

  // Add-on rows — the catering pattern: a full-width row whose + becomes a
  // stepper once added. Per-person add-ons start at the group/party size and
  // multiply live.
  const headsFor = () => (flatBasis ? group : Math.max(1, Object.values(qty).reduce((s, n) => s + n, 0)));
  /** What the shelf says here.
   *
   *  Keyed on the TILL's venue, not the booking's. `recordSale` writes the
   *  movement at the till's venue, so a cap read off `product.locationIds[0]`
   *  could promise stock from a shelf the sale will never touch — the sheet
   *  and the ledger would disagree about the same tote bag. The booking's own
   *  venue is the fallback for a caller that has no till. */
  const stockFor = (itemId: string) => {
    const item = inventoryItem(itemId);
    if (!item || !item.tracked) return null;
    const where = locationId ?? product.locationIds[0];
    return { ...levelOf(itemId, where && item.locationIds.includes(where) ? where : undefined), unit: item.unit };
  };
  const renderAddOns = () =>
    (product.addOns?.length ?? 0) > 0 ? (
      <div className="mt-section flex flex-col gap-tight">
        <span className="text-[0.875rem] font-semibold text-fg">{t("sheet.addOns")}</span>
        {/* One card, divided rows — the rest of the till's drawing. */}
        <div className="go-surface divide-y divide-line overflow-hidden rounded-go">
        {(product.addOns ?? []).map((a) => {
          const n = addOnQty[a.id] ?? 0;
          /* An extra that hands over a counted thing can only sell what is on
             the shelf at THIS counter's venue. The till used to offer every
             extra without limit, so a desk could promise four tote bags it
             did not have and find out at the cupboard. */
          const stock = a.itemId ? stockFor(a.itemId) : null;
          const cap = stock ? stock.onHand : Infinity;
          const out = cap <= 0;
          return (
            <div key={a.id} className={cn("flex min-h-14 items-center gap-tight px-comfortable py-tight", out ? "bg-surface" : "bg-card")}>
              <div className="min-w-0 flex-1">
                <span className={cn("block truncate text-sm", out && "text-muted")}>{a.name}</span>
                <span className="text-[0.8125rem] text-muted">
                  {formatMoney(a.price, currency)}{a.perPerson ? t("sheet.perHead") : ""}{n > 0 ? ` × ${n} = ${formatMoney(a.price * n, currency)}` : ""}
                  {stock && (out ? ` · ${t("sheet.stockOut")}` : ` · ${t("sheet.stockLeft", { count: cap, unit: stock.unit })}`)}
                </span>
              </div>
              {n === 0 ? (
                <button type="button" disabled={out} aria-label={t("sheet.addName", { name: a.name })} onClick={() => setAddOnQty((q) => ({ ...q, [a.id]: Math.min(cap, a.perPerson ? headsFor() : 1) }))} className="h-12 w-12 shrink-0 rounded-full border border-line text-lg disabled:border-line/60 disabled:text-faint active:bg-ember/10">+</button>
              ) : (
                <div className="flex shrink-0 items-center gap-tight">
                  <button type="button" aria-label={t("sheet.less")} disabled={(addOnQty[a.id] ?? 0) === 0} onClick={() => setAddOnQty((q) => ({ ...q, [a.id]: Math.max(0, (q[a.id] ?? 0) - 1) }))} className="h-12 w-12 rounded-full border border-line text-lg disabled:border-line/60 disabled:text-faint active:bg-ember/10">−</button>
                  <span className="w-6 text-center">{n}</span>
                  <button type="button" aria-label={t("sheet.more")} disabled={n >= cap} onClick={() => setAddOnQty((q) => ({ ...q, [a.id]: Math.min(cap, (q[a.id] ?? 0) + 1) }))} className="h-12 w-12 rounded-full border border-line text-lg disabled:border-line/60 disabled:text-faint active:bg-ember/10">+</button>
                </div>
              )}
            </div>
          );
        })}
        </div>
      </div>
    ) : null;

  // Waitlist mini-form
  const [wl, setWl] = useState<{ time: string } | null>(null);
  const [wlName, setWlName] = useState("");
  const [wlPhone, setWlPhone] = useState("");

  const matrix = useMemo(() => (resourceMode && !flexible ? getResourceMatrix(product, date) : []), // eslint-disable-next-line react-hooks/exhaustive-deps -- `stamp` is the ask-again signal: availability is derived from the store, which a release changes without changing any of these.
    [product, date, resourceMode, flexible, stamp]);
  const slots = useMemo(() => (needsSchedule(bt) && !resourceMode ? getSlots(product, date) : []), // eslint-disable-next-line react-hooks/exhaustive-deps -- as above: a released hold changes what getSlots answers, not its arguments.
    [product, date, bt, resourceMode, stamp]);
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

  /** Take the chosen places off sale for a named party, from the till. */
  /** The span a field or lane hold keeps: the chosen place, from the chosen
   *  start, for the chosen length. Null when there is no place yet. */
  const resourceSpan = () => {
    if (!resourceMode || !slotTime) return null;
    const minutes = flexible ? duration : (product.schedule?.sessionMinutes ?? 60);
    const lane = resourceId
      ? getResourceMatrix(product, date).find((row) => row.resource.id === resourceId)?.resource
      : flexible
        ? firstFreeResource(product, date, slotTime, minutes)
        : undefined;
    return lane ? { lane, minutes } : null;
  };
  const doHold = async () => {
    const who = holdFor.trim();
    if (!who || holding) return;
    setHolding(true);
    const span = resourceSpan();
    const res = span
      ? await placeHold({
          productId: product.id,
          productName: product.name,
          locationId: product.locationIds[0] ?? null,
          kind: "resource",
          date,
          slotStart: slotISO(date, slotTime as string),
          slotEnd: endISO(date, slotTime as string, span.minutes),
          quantity: 1,
          resourceId: span.lane.id,
          resourceName: span.lane.name,
          heldFor: who,
          placedBy: team.find((x) => x.id === DEMO_STAFF_ID)?.name ?? t("sheet.counterActor"),
          expiresAt: null,
        })
      : await placeHold({
      productId: product.id,
      locationId: product.locationIds[0] ?? null,
      kind: "capacity",
      date,
      slotStart: slotTime ? slotISO(date, slotTime) : null,
      slotEnd: null,
      quantity: Math.max(1, partySize),
      resourceId: null,
      resourceName: null,
      heldFor: who,
      /* The person, not the till: a hold placed at the counter is somebody's
         promise, and the name is what the next shift asks about. */
      placedBy: team.find((x) => x.id === DEMO_STAFF_ID)?.name ?? t("sheet.counterActor"),
      expiresAt: null,
    });
    setHolding(false);
    if (!res.ok) {
      setBlocked({ message: res.error.message });
      return;
    }
    setHoldOpen(false);
    setHoldFor("");
    setStamp((n) => n + 1);
    toast.success(t("sheet.holdPlaced", { count: Math.max(1, partySize), heldFor: who }));
    onClose();
  };
  /** Who a hold is for — the one row every footer that offers Hold shows once
   *  Hold has been pressed. */
  const holdRowNode = holdOpen ? (
    <div className="mt-tight flex items-center gap-tight">
      <input
        value={holdFor}
        autoFocus
        onChange={(e) => setHoldFor(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") void doHold(); }}
        placeholder={t("sheet.holdFor")}
        aria-label={t("sheet.holdFor")}
        className="h-12 min-w-0 flex-1 rounded-go-sm border border-line bg-card px-comfortable text-[0.8125rem] outline-none focus:border-inverse"
      />
      {/* Secondary: the sale is what this screen is for, and
          an ember Hold beside a grey Add says the exception is
          the point. */}
      <Button variant="secondary" size="sm" shape="pill" disabled={!holdFor.trim() || holding} onClick={() => void doHold()}>
        {t("sheet.holdPlace")}
      </Button>
    </div>
  ) : null;

  const submitTiered = (onDate?: string, pay = false) => {
    const when = onDate ?? date;
    const list = sectioned ? (product.sections ?? []).map((s) => ({ id: s.id, name: s.name, price: s.price, donation: false })) : activeTiers.map((t) => ({ id: t.id, name: t.name, price: t.price, donation: !!t.donation }));
    const items = [...list.filter((x) => qty[x.id] > 0).map((x) => ({ tierId: x.id, tierName: x.name, unitPrice: x.donation ? Math.max(x.price, donationAmt[x.id] ?? x.price) : x.price, qty: qty[x.id] })), ...addOnItems()];
    // Owner of the session's capacity: the chosen guide or assigned provider.
    const owner = guided ? guides.find((g) => g.id === guideId) : assignedProvider;
    if (validity && (validity.priceDelta ?? 0) > 0) {
      const tickets = list.reduce((a, x) => a + (qty[x.id] ?? 0), 0);
      if (tickets > 0) items.push({ tierId: `val_${validity.id}`, tierName: t("sheet.passLine", { label: validity.label }), unitPrice: validity.priceDelta ?? 0, qty: tickets });
    }
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
      /* The seats themselves, and the PERFORMANCE they are for. A seat is
         claimed for a (product, date, time) — without the date every showing
         of the film shared one pool of seats. */
      seats: chosen.map((s) => ({ label: s.label, tierId: s.categoryUid, tierName: s.categoryName, unitPrice: s.price })),
      slotDate: date,
      slotTime,
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
    <div className="fixed inset-y-0 left-0 right-0 z-50 flex flex-col justify-end lg:right-[24rem]" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <div className="go-sheet-scrim absolute inset-0 bg-inverse/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative z-10 go-sheet-panel max-h-[88vh] overflow-y-auto rounded-t-go-lg bg-surface p-section pb-0">
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
            <h2 id="sheet-title" className="type-h2 break-words text-2xl">{product.name}</h2>
            <p className="mt-inline text-[0.8125rem] text-muted">{subtitle(product, { resources, team })}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("sheet.close")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-subtle text-muted transition-colors duration-quick hover:text-fg active:bg-ember/10"><X size={20} strokeWidth={1.75} /></button>
        </div>

        {/* Under two minutes it stops being information and becomes a
            deadline, so it changes register — the same threshold the rest of
            the app uses to switch a warning to a refusal. */}
        {heldUntil && holdLeft > 0 && (
          <div className={`mb-section flex items-center gap-tight rounded-full border px-comfortable py-tight text-[0.8125rem] ${holdLeft < 120 ? "border-danger/30 bg-danger/10 text-danger" : "border-warning/30 bg-warning/10 text-warning"}`}>
            <Clock size={14} strokeWidth={1.75} className="shrink-0" />
            <span>
              {t(holdLeft < 120 ? "sheet.holdExpiring" : "sheet.holdRemaining", {
                time: `${Math.floor(holdLeft / 60)}:${String(holdLeft % 60).padStart(2, "0")}`,
              })}
            </span>
          </div>
        )}

        {(needsSchedule(bt) || provider || bt === "BT-02") && !course && (
          <div className="mb-section">
            <p className="mb-tight text-[0.875rem] font-semibold text-fg">{t(bt === "BT-02" ? "sheet.whenLabel" : "sheet.dateLabel")}</p>
            {/* A wrapping grid with the calendar beneath it — never a row
                that scrolls sideways. A chip that has scrolled out of view is
                a day nobody knows is on offer, and parking the calendar at the
                end of that scroll meant passing four days you did not want to
                reach the control that offers all of them. */}
            {(() => {
              const chips: string[] = [];
              for (let i = 0; chips.length < 5 && i < 30; i++) {
                const d = new Date(Date.parse(`${TODAY}T12:00:00Z`) + i * 86400000).toISOString().slice(0, 10);
                if (isOpenOn(product, d)) chips.push(d);
              }
              return (
                <DateStrip
                  flat
                  dates={chips}
                  value={date}
                  onChange={(d) => { setDate(d); setSlotTime(undefined); setResourceId(undefined); }}
                  today={TODAY}
                  tomorrow={TOMORROW}
                  min={TODAY}
                  caption={(d) => {
                    const c = dateCap(d);
                    if (!c) return null;
                    // The app's standing low-availability rule: a fifth of
                    // capacity or less, never fewer than one.
                    return { text: t("sheet.leftCount", { count: c.left }), low: c.total > 0 && c.left <= Math.max(1, Math.floor(c.total * 0.2)) };
                  }}
                  labels={{
                    today: t("sheet.today"),
                    tomorrow: t("sheet.tomorrow"),
                    pick: t("sheet.moreDates"),
                    previousMonth: tc("previousMonth"),
                    nextMonth: tc("nextMonth"),
                  }}
                />
              );
            })()}
          </div>
        )}
        {/* How long the pass runs. The lengths come from the product, so an
            operator who sells only one length gets no picker at all rather
            than a row with a single chip in it. A length that costs more says
            so on its own chip — the duration chips do the same, and a total
            that moves with no visible cause is the thing to avoid. */}
        {validityOptions.length > 1 && (
          <div className="mb-section flex flex-col gap-tight">
            <span className="text-[0.875rem] font-semibold text-fg">{t("sheet.validFor")}</span>
            <div className="-mx-comfortable flex items-stretch gap-tight overflow-x-auto px-comfortable pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {validityOptions.map((v) => {
                const on = v.id === validityId;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setValidityId(v.id)}
                    className={`flex min-h-12 shrink-0 flex-col items-center justify-center whitespace-nowrap rounded-full border px-comfortable py-tight text-sm transition-colors duration-quick ${on ? "border-ember bg-ember/10 font-medium text-brand-foreground" : "border-line bg-card active:bg-ember/10"}`}
                  >
                    <span>{v.label}</span>
                    {(v.priceDelta ?? 0) > 0 && (
                      <span className={`text-[0.8125rem] ${on ? "opacity-80" : "text-muted"}`}>
                        +{formatMoney(v.priceDelta ?? 0, currency)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {!openToday && needsSchedule(bt) && <p className="mb-section text-[0.8125rem] text-danger">{t("sheet.closedOnDate")}</p>}

        {/* A day-capped product is run by one number, so it gets a panel rather
            than a footnote under a date chip. The allowance is the whole
            inventory here — there is no slot list to read it off. */}
        {bt === "BT-06" && (product.schedule?.dailyCapacity ?? 0) > 0 && openToday && (() => {
          const total = product.schedule?.dailyCapacity ?? 0;
          const left = getDailyRemaining(product, date);
          const low = left <= Math.max(1, Math.floor(total * 0.2));
          return (
            <div className="mb-section rounded-go border border-line bg-subtle p-comfortable">
              <div className="flex items-baseline justify-between gap-tight">
                <span className="text-[0.8125rem] text-muted">{t("sheet.dailyCapacity")}</span>
                <span className={`shrink-0 whitespace-nowrap text-[0.8125rem] font-medium ${left <= 0 ? "text-danger" : low ? "text-warning" : "text-success"}`}>
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
              <p className="mt-inline text-[0.8125rem] text-muted">{t("sheet.totalCapacity", { count: total })}</p>
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
              onBlocked={(m) => setBlocked({ message: m })}
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
              <SheetFooter onBack={onClose} disabled onAdd={() => {}} label={t("sheet.pickTime")} />
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
                  <SheetFooter onBack={onClose}
                    onHold={!holdOpen ? () => setHoldOpen(true) : undefined}
                    holdRow={holdRowNode}
                    summary={
                      <span className="flex items-baseline justify-between gap-comfortable">
                        <span className="min-w-0 flex-1 text-muted">
                          <span className="font-medium text-fg">{row?.resource.name}</span> · {formatClock(slotTime)} · {formatDuration(minutes)}
                          {flatBasis ? ` · ${t("cart.groupOf", { count: group })}` : ""}
                          {dates.length > 1 ? ` · ${t("repeat.datesCount", { count: dates.length })}` : ""}
                        </span>
                        <span className="shrink-0 font-medium tabular-nums">
                          {formatMoney(price * Math.max(1, dates.length) + addOnItems().reduce((s, i) => s + i.unitPrice * i.qty, 0), currency)}
                        </span>
                      </span>
                    }
                    disabled={!waiverOk || dates.length === 0}
                    onAdd={addAll}
                    buyLabel={t("sheet.buyNow", { amount: formatMoney(price * Math.max(1, dates.length) + addOnItems().reduce((a, i) => a + i.unitPrice * i.qty, 0), currency) })}
                    label={
                      dates.length > 1
                        ? t("repeat.addDates", { count: dates.length, amount: formatMoney(price * dates.length, currency) })
                        : t("sheet.addAmount", { amount: formatPriceShort(price, currency) })
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
              if (current) return t("sheet.inUseUntil", { time: formatClockMin(current.end), label: current.label });
            }
            return spans.length ? t("sheet.bookingsToday", { count: spans.length }) : t("sheet.free");
          };

          const pickDuration = (d: number) => {
            setDuration(d);
            // Re-filter: a start that no longer fits clears with a notice.
            if (slotTime && !startState(slotTime, d, resourceId).ok) { setSlotTime(undefined); toast.info(t("sheet.startNoLongerFits")); }
          };

          const endLabel = slotTime ? toTime(toMinutes(slotTime) + duration) : null;
          const chosenLaneFree = slotTime ? startState(slotTime, duration, resourceId).ok : false;

          return (
            <div className="mb-section flex flex-col gap-tight">

              {/* Duration is a stepper, not a wall of chips.
                  Nine buttons each carrying their own price was nine prices to
                  read before choosing one, and it grew with the range: a court
                  bookable 1–6 hours in quarter-hours would have shown twenty-
                  one. The increment is already configured, so stepping by it is
                  the operator's own rule expressed as a control — and the one
                  price that matters, the price of THIS duration, is on the
                  summary line above the button where the decision is made. */}
              <span className="text-[0.875rem] font-semibold text-fg">{t("sheet.duration")}</span>
              {(() => {
                const i = flexOptions.indexOf(duration);
                const prev = i > 0 ? flexOptions[i - 1] : null;
                const next = i >= 0 && i < flexOptions.length - 1 ? flexOptions[i + 1] : null;
                return (
                  <div className="flex items-center gap-tight">
                    <button
                      type="button"
                      aria-label={t("sheet.shorter")}
                      disabled={prev == null}
                      onClick={() => prev != null && pickDuration(prev)}
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-line text-xl disabled:opacity-40 active:bg-ember/10"
                    >
                      −
                    </button>
                    <div className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-go border border-line bg-card py-tight">
                      <span className="text-base font-medium">{formatDuration(duration)}</span>
                      {slotTime && (
                        <span className="text-[0.8125rem] tabular-nums text-muted">
                          {formatMoney(priceFor(slotTime, duration, laneOf(resourceId)), currency)}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      aria-label={t("sheet.longer")}
                      disabled={next == null}
                      onClick={() => next != null && pickDuration(next)}
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-line text-xl disabled:opacity-40 active:bg-ember/10"
                    >
                      +
                    </button>
                  </div>
                );
              })()}

              <span className="text-[0.875rem] font-semibold text-fg">{lanes[0]?.nounSingular ?? t("sheet.resource")}</span>
              {/* One card of cells, as the Schedule draws its lanes: Any, then
                  each lane with what it is doing now. Chosen is a tint with a
                  ring and a tick. */}
              <div className="go-surface overflow-hidden rounded-go">
                <div className="-mb-px -mr-px grid grid-cols-3 sm:grid-cols-5">
                  {[null, ...lanes].map((r) => {
                    const on = r ? resourceId === r.id : !resourceId;
                    return (
                      <button
                        key={r?.id ?? "any"}
                        type="button"
                        aria-pressed={on}
                        disabled={!!r?.outOfService}
                        data-focus-inset
                        onClick={() => setResourceId(r?.id)}
                        className={cn(
                          "relative flex min-h-14 flex-col items-center justify-center border-b border-r border-line px-inline py-tight text-center transition-colors duration-quick",
                          r?.outOfService ? "bg-surface text-muted line-through" : on ? "bg-ember-solid text-white" : "bg-card text-fg active:bg-ember/10",
                        )}
                      >
                        {on && <Check size={13} strokeWidth={3} className="absolute right-1.5 top-1.5" aria-hidden />}
                        <span className="w-full truncate text-[0.875rem] font-semibold">{r ? r.name : t("sheet.any")}</span>
                        {r && <span className={cn("w-full truncate text-[0.8125rem]", on ? "text-white" : "text-muted")}>{liveState(r)}</span>}
                        {r && rateLabel(r) && <span className={cn("w-full truncate text-[0.8125rem] font-semibold tabular-nums", on ? "text-white" : "text-fg")}>{rateLabel(r)}</span>}
                      </button>
                    );
                  })}
                </div>
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
                  onBlockTap={(s) => setBlocked({ message: t("sheet.blockedBooked", { start: formatClockMin(s.start), end: formatClockMin(s.end), label: s.label, noun: (lanes[0]?.nounSingular ?? t("sheet.laneWord")).toLowerCase() }) })}
                />
              )}

              {blocked && <BlockedNotice message={blocked.message} onDismiss={() => setBlocked(null)} />}

              <span className="text-[0.875rem] font-semibold text-fg">{t("sheet.startTime")}</span>
              <div className="go-surface overflow-hidden rounded-go">
                <div className="-mb-px -mr-px grid grid-cols-4 sm:grid-cols-6">
                  {flexTimes.map((tt) => {
                    const st = startState(tt, duration, resourceId);
                    if (!st.ok) {
                      return <button key={tt} type="button" data-focus-inset onClick={() => setBlocked({ message: t("sheet.unavailableStart", { time: formatClock(tt), reason: st.reason?.toLowerCase() ?? "", noun: (lanes[0]?.nounSingular ?? t("sheet.laneWord")).toLowerCase() }) })} className="flex min-h-12 items-center justify-center border-b border-r border-line bg-surface px-1 py-1 text-[0.875rem] text-muted line-through" title={st.reason}><ClockCell hhmm={tt} className="line-through" /></button>;
                    }
                    const on = slotTime === tt;
                    return (
                      <button key={tt} type="button" aria-pressed={on} data-focus-inset onClick={() => { setSlotTime(tt); setBlocked(null); }} className={cn("relative flex min-h-12 items-center justify-center border-b border-r border-line px-1 py-1 text-[0.9375rem] font-semibold tabular-nums transition-colors duration-quick", on ? "bg-ember-solid text-white" : "bg-card text-fg active:bg-ember/10")}>
                        {on && <Check size={12} strokeWidth={3} className="absolute right-1 top-1" aria-hidden />}
                        <ClockCell hhmm={tt} />
                      </button>
                    );
                  })}
                </div>
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
                // A deal duration is a price someone chose, not a sum. Printing
                // "৳1,000 × 2 hr" beside a ৳1,750 total would be arithmetic
                // that does not add up, so the deal says what it is instead —
                // and what it saves, which is the thing worth telling a guest.
                const deal = cfg ? isDealDuration(cfg, duration) : false;
                const saving = cfg && deal ? formulaPrice(cfg, duration) - total : 0;
                const math = deal
                  ? t("sheet.dealPrice", {
                      duration: formatDuration(duration),
                      amount: formatMoney(total, currency),
                    }) + (saving > 0 ? ` · ${t("sheet.dealSaves", { amount: formatMoney(saving, currency) })}` : "")
                  : segs.length === 1
                    ? `${formatMoney(segs[0].ratePerHour, currency)} × ${formatDuration(duration)} = ${formatMoney(total, currency)}`
                    : segs.length > 1
                      ? `${segs.map((s) => `${formatDuration(s.minutes)} @ ${formatMoney(s.ratePerHour, currency)}`).join(" + ")} = ${formatMoney(total, currency)}`
                      : "";
                const premium = lane?.rateOverride?.kind === "premium" ? ` (incl. ${lane.name} +${formatMoney(lane.rateOverride.amount, currency)})` : "";
                return (
                  <div className="flex flex-col gap-inline">
                    {math && <p className="text-[0.8125rem] text-muted">{math}{premium}</p>}
                    {/* The live selection summary — the CTA never enables without it. */}
                    <p className="text-[0.8125rem]">
                      <span className="font-medium">{lane?.name ?? t("sheet.anyLane")}</span> · <span className="tabular-nums">{formatClockRange(slotTime, toMinutes(slotTime) + duration)}</span> · {formatDuration(duration)}
                      {flatBasis ? ` · ${t("cart.groupOf", { count: group })}` : ""} · <span className="tabular-nums">{formatMoney(total, currency)}</span>
                      {!resourceId && lane ? <span className="text-muted">{t("sheet.bestFit")}</span> : null}
                    </p>
                  </div>
                );
              })()}
              <SheetFooter onBack={onClose}
                onHold={slotTime && chosenLaneFree && !holdOpen ? () => setHoldOpen(true) : undefined}
                holdRow={slotTime && chosenLaneFree ? holdRowNode : null}
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
                  ? t("sheet.addAmount", { amount: formatPriceShort(priceFor(slotTime, duration, laneOf(resourceId) ?? firstFreeResource(product, date, slotTime, duration)), currency) })
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
                  <ChoiceCard key={p.id} raised selected={providerId === p.id} onClick={() => setProviderId(p.id)} className="flex w-full items-center gap-tight py-comfortable pl-comfortable pr-7">
                    <Avatar name={p.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="block text-[0.8125rem] text-muted">{nextFree ? t("sheet.nextFree", { time: formatClock(nextFree) }) : t("sheet.fullyBooked")}</span>
                    </span>
                    <span className={`shrink-0 whitespace-nowrap text-[0.8125rem] ${premiumOf(p.id) > 0 ? "font-medium text-brand-foreground" : "text-muted"}`}>
                      {premiumOf(p.id) > 0 ? t("sheet.premiumAmount", { amount: formatMoney(premiumOf(p.id), currency) }) : t("sheet.standardRate")}
                    </span>
                  </ChoiceCard>
                );
              })}
              <ChoiceCard raised selected={!providerId} onClick={() => setProviderId(undefined)} className="flex w-full items-center justify-center px-7 py-comfortable text-sm">{t("sheet.firstAvailable")}</ChoiceCard>
            </div>
            <span className="mt-tight text-[0.875rem] font-semibold text-fg">{t("sheet.startTimeDuration", { minutes: providerDuration })}</span>
            <div className="flex flex-wrap gap-inline">
              {providerTimes.map((t) => {
                const free = providerTimeFree(t);
                return (
                  <button key={t} type="button" disabled={!free} onClick={() => setSlotTime(t)} className={`h-12 rounded-full border px-comfortable text-[0.8125rem] ${!free ? "border-line bg-subtle text-muted line-through" : slotTime === t ? "border-ember bg-ember/10 font-medium text-brand-foreground" : "border-line bg-card"}`}>{formatClock(t)}</button>
                );
              })}
            </div>
            {slotTime && assignedProvider && !providerId && (
              <p className="text-[0.8125rem] text-muted">{t("sheet.firstAvailableAt", { time: formatClock(slotTime), name: `${assignedProvider.name}${premiumOf(assignedProvider.id) > 0 ? ` (+${formatMoney(premiumOf(assignedProvider.id), currency)})` : ""}` })}</p>
            )}
            {slotTime && !providerTimeFree(slotTime) && (
              <p className="text-[0.8125rem] text-danger">{t("sheet.busyAtTime", { name: providers.find((p) => p.id === providerId)?.name ?? t("sheet.everyone"), time: formatClock(slotTime) })}</p>
            )}
          </div>
        )}

        {/* Course dates */}
        {/* A course has nothing to configure — it runs on fixed dates and the
            only decision left is how many places. The panel says so in the
            affirmative rather than presenting a list that looks like a choice
            the cashier still has to make. */}
        {course && (() => {
          const dates = [...(product.courseDates ?? [])].sort();
          const d = (iso: string) => new Date(`${iso}T12:00:00`);
          const fmtDay = (iso: string) => formatDay(iso, { weekday: true });
          const weekdays = [...new Set(dates.map((x) => new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(d(x))))];
          const range = dates.length
            ? `${new Intl.DateTimeFormat("en-GB", { day: "numeric" }).format(d(dates[0]))}–${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(d(dates[dates.length - 1]))}`
            : "";
          return (
            <div className="mb-section rounded-go border border-success/30 bg-success/10 p-comfortable">
              <p className="flex items-center gap-inline text-sm font-medium text-success">
                <Check size={14} strokeWidth={2.5} />
                {t("sheet.readyToAdd")}
              </p>
              {dates.length > 0 && (
                <>
                  <p className="mt-inline text-[0.8125rem]">
                    {t("sheet.courseRuns", { count: dates.length, days: weekdays.join(" & "), range })}
                  </p>
                  <button
                    type="button"
                    onClick={() => setCourseDatesOpen((v) => !v)}
                    className="mt-tight min-h-11 text-[0.8125rem] font-medium text-brand-foreground underline-offset-2 hover:underline"
                  >
                    {t(courseDatesOpen ? "sheet.courseHideAll" : "sheet.courseShowAll")}
                  </button>
                  {courseDatesOpen && (
                    <ul className="mt-tight flex flex-col gap-inline">
                      {dates.map((x) => (
                        <li key={x} className="text-[0.8125rem] tabular-nums">{fmtDay(x)}</li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          );
        })()}

        {/* A refusal from the slot grid explains itself right above the grid,
            where the tap happened — the flexible branch has its own notice
            beside the lane timeline. */}
        {blocked && !resourceMode && !flexible && (
          <div className="mb-section">
            <BlockedNotice
              message={blocked.message}
              /* The party it was held for is standing at the counter. Telling
                 a cashier to go and release it somewhere else, mid-queue, is
                 how a hold turns into a lost sale — so the refusal carries the
                 release. The hold is named in the message above it, and the
                 release is recorded against whoever placed it. */
              action={
                blocked.holdId
                  ? { label: t("sheet.releaseAndSell"), busy: releasing, onPress: () => void releaseAndSell(blocked.holdId!) }
                  : undefined
              }
              onDismiss={() => setBlocked(null)}
            />
          </div>
        )}

        {/* Fixed sessions — rows, not tiles (see SessionList). The list is
            named after what it holds: a museum picks a session, a tour picks a
            departure, and the operator's word for it is the one that should
            appear above the rows. */}
        {needsSchedule(bt) && !resourceMode && !flexible && openToday && (
          <p className="mb-tight text-[0.875rem] font-semibold text-fg">
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
              /* A session closed by a hold is not a session that sold out.
                 The row used to read "Sold out · 15/15" about fifteen places
                 nobody had bought — the refusal on tap was the only place the
                 truth appeared. Now the row says who it is held for and the
                 bar goes neutral, which is what the calendar's hatching says
                 in the same situation. */
              const lock = isSessionLocked(product.id, date, slotISO(date, s.time))
                ? blockingHold(product.id, date, slotISO(date, s.time))
                : undefined;
              const started = date === TODAY && toMinutes(s.time) < NOW_MIN;
              return {
                time: s.time,
                price: resolveProductPrice(product, date, s.time, activeTiers.find((x) => !x.donation)?.price ?? basePrice),
                capacity: s.capacity,
                left: guideless ? 0 : left,
                blockedReason: started
                  ? t("sheet.started")
                  : guideless
                  ? t("sheet.noGuideFree")
                  : lock
                    ? t("sheet.rowHeld", { name: lock.heldFor })
                    : null,
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
              setBlocked({ message: why?.message ?? reason, holdId: why?.holdId });
            }}
          />
        )}

        {/* Guided: pick who leads — busy guides (on ANY product) can't be chosen */}
        {guided && slotTime && guides.length > 0 && openToday && (
          <div className="mb-section flex flex-col gap-tight">
            <span className="text-[0.875rem] font-semibold text-fg">{t("sheet.ledBy")}</span>
            <div className="flex flex-col gap-tight">
              {guides.map((g) => {
                const free = slotGuides.includes(g.id);
                return (
                  <ChoiceCard key={g.id} raised selected={guideId === g.id} disabled={!free} onClick={() => setGuideId(g.id)} className="flex w-full items-center gap-tight py-comfortable pl-comfortable pr-7">
                    <Avatar name={g.name} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{g.name}</span>
                      <span className={`block text-[0.8125rem] ${free ? "text-success" : "text-muted"}`}>
                        {free ? t("sheet.guideAvailable") : t("sheet.guideBusy")}
                      </span>
                    </span>
                  </ChoiceCard>
                );
              })}
            </div>
          </div>
        )}

        {bt === "BT-06" && openToday && (product.schedule?.dailyCapacity ?? 0) <= 0 && <p className="mb-section text-[0.8125rem] text-muted">{t("sheet.leftToday", { count: dailyLeft, when: date === TODAY ? t("sheet.leftTodayWord") : t("sheet.leftThatDay") })}</p>}

        {/* Tier / section steppers (not for exclusive resource / flexible) */}
        {!resourceMode && (
          <>
            {hasLayout ? (
              // Visual seat picker (BT-07 seated) — tap seats to add to the sale.
              (() => {
                const cats = [...new Map(availSeats.map((s) => [s.categoryUid, s])).values()];
                return (
                  <div>
                    {/* One renderer, shared with the designer in OS — so what a
                        cashier is shown is the plan that was drawn, including
                        where the screen or the bar actually is. */}
                    <div data-seat-grid>
                      <PlanView
                        elements={availSeats.map((s) => ({
                          id: s.label,
                          name: s.label,
                          kind: s.kind,
                          posX: s.posX,
                          posY: s.posY,
                          width: s.width,
                          height: s.height,
                          shape: s.shape,
                          rotation: s.rotation,
                          capacity: s.capacity,
                          color: s.color,
                        }))}
                        fixtures={seatFixtures}
                        /* Enough height that a seat is drawn at least as large
                           as the fixed 1.6rem grid this replaced — the picker
                           is a thumb target before it is a picture. */
                        minHeight={300}
                        maxScale={30}
                        stateOf={(el) => {
                          const st = availSeats.find((x) => x.label === el.id);
                          if (!st?.available) return "taken";
                          return selectedSeats.includes(el.id) ? "selected" : "available";
                        }}
                        labelOf={(el) => {
                          const st = availSeats.find((x) => x.label === el.id);
                          if (!st) return el.name;
                          /* A refusal names its own mechanism: sold, held for a
                             named party, or taken off the plan. "Unavailable"
                             tells a cashier nothing they can act on. */
                          const why = st.available
                            ? ""
                            : st.unavailableReason === "held"
                              ? ` · ${seatT("picker.heldFor", { who: st.heldFor ?? "" })}`
                              : st.unavailableReason === "blocked"
                                ? ` · ${seatT("picker.blocked")}`
                                : ` · ${seatT("picker.sold")}`;
                          return `${st.label} · ${st.categoryName} · ${formatMoney(st.price, currency)}${why}`;
                        }}
                        onPick={(el) => {
                          const st = availSeats.find((x) => x.label === el.id);
                          if (!st?.available) return;
                          setSelectedSeats((cur) => (cur.includes(el.id) ? cur.filter((x) => x !== el.id) : [...cur, el.id]));
                        }}
                      />
                    </div>
                    <div className="mt-tight flex flex-wrap items-center justify-between gap-tight text-[0.8125rem]">
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
            <div className="flex flex-col">
              <span className="mb-tight text-[0.875rem] font-semibold text-fg">{t("sheet.pickTickets")}</span>
              {/* One panel of hairline-separated rows, not four separate cards.
                  Each row says the three things in the order they are decided:
                  what it is, who it admits, what it costs — the price on its
                  own line in the brand colour, because it is the number the
                  operator reads back to the customer. Cramming price, capacity
                  and age note into one grey run-on line buried all three. */}
              <div className="overflow-hidden rounded-go border border-line bg-card">
              {(sectioned ? (product.sections ?? []).map((s) => ({ id: s.id, name: `${s.name}`, price: s.price, cap: s.capacity, note: "", donation: false })) : activeTiers.map((tier) => ({ id: tier.id, name: tier.name, price: tier.price, cap: undefined as number | undefined, note: [(tier.admits ?? 1) > 1 ? t("sheet.admits", { count: tier.admits ?? 1 }) : "", tier.ageNote ?? ""].filter(Boolean).join(" · "), donation: !!tier.donation }))).map((row, rowIdx) => (
                <div key={row.id} className={`flex items-center justify-between gap-comfortable p-comfortable ${rowIdx > 0 ? "border-t border-line" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{row.name}</div>
                    {(row.cap != null || row.note) && (
                      <div className="mt-0.5 text-[0.8125rem] text-muted">
                        {[row.cap != null ? t("sheet.seatsCount", { count: row.cap }) : "", row.note].filter(Boolean).join(" · ")}
                      </div>
                    )}
                    <div className="mt-0.5 text-[0.875rem] font-semibold tabular-nums text-fg">
                      {row.donation ? t("sheet.donationMin", { amount: formatMoney(row.price, currency) }) : formatMoney(row.price, currency)}
                    </div>
                  </div>
                  {row.donation ? (
                    <div className="flex items-center gap-tight">
                      <span className="text-sm text-muted">{currency === "BDT" ? "৳" : ""}</span>
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
                        className="h-12 w-28 rounded-go-sm border border-line bg-card px-comfortable text-right text-sm outline-none focus:border-inverse"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-tight">
                      <button type="button" aria-label={t("sheet.less")} disabled={(qty[row.id] ?? 0) === 0} onClick={() => setQty((q) => ({ ...q, [row.id]: Math.max(0, (q[row.id] ?? 0) - 1) }))} className="h-12 w-12 rounded-full border border-line text-lg disabled:border-line/60 disabled:text-faint active:bg-ember/10">−</button>
                      <span className="w-8 text-center">{qty[row.id] ?? 0}</span>
                      <button type="button" aria-label={t("sheet.more")} onClick={() => setQty((q) => ({ ...q, [row.id]: (q[row.id] ?? 0) + 1 }))} className="h-12 w-12 rounded-full border border-line text-lg active:bg-ember/10">+</button>
                    </div>
                  )}
                </div>
              ))}
              </div>
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
            {depositPct > 0 && (
              <p className="mt-section rounded-go border border-line bg-card p-comfortable text-[0.8125rem] text-muted">
                {t.rich("sheet.depositNote", { pct: depositPct, b: (chunks) => <span className="font-medium text-fg">{chunks}</span> })}
              </p>
            )}
            <SheetFooter onBack={onClose}
              /* What will be added, beside the button that adds it: on a long
                 sheet the ticket steppers are below the fold, and "Add ৳600"
                 alone did not say what ৳600 buys. */
              summary={partySize > 0 ? (() => {
              const list = sectioned ? (product.sections ?? []) : activeTiers;
              const itemsLabel = list.filter((x) => (qty[x.id] ?? 0) > 0).map((x) => `${qty[x.id]} ${x.name}`).join(" · ");
              const owner = guided ? guides.find((g) => g.id === guideId)?.name : provider ? assignedProvider?.name : undefined;
              const prem = provider && assignedProvider ? premiumOf(assignedProvider.id) : 0;
              const tickets = list.reduce((a, x) => a + (qty[x.id] ?? 0), 0);
              const validityExtra = validity && (validity.priceDelta ?? 0) > 0 ? (validity.priceDelta ?? 0) * tickets : 0;
              const total = list.reduce((s, x) => s + (qty[x.id] ?? 0) * x.price, 0) + addOnItems().reduce((s, i) => s + i.unitPrice * i.qty, 0) + prem + validityExtra;
              // The chosen day, said the way a person says it. It printed the
              // raw ISO ("2026-08-01") for any day that was not today, which is
              // a machine's date format in a line read aloud to a customer.
              const dayWords = date === TODAY
                ? t("slotToday")
                : formatDay(date, { weekday: true });
              const when = slotTime ? `${formatClock(slotTime)} ${dayWords}` : course ? null : (needsSchedule(bt) || provider) ? dayWords : null;
              return (
                <div className="flex items-baseline justify-between gap-comfortable text-[0.8125rem]">
                  <span className="min-w-0 flex-1 text-muted">
                    {when && <><span className="tabular-nums">{when}</span> · </>}
                    {bt === "BT-02" && validity ? t("sheet.passCount", { count: tickets }) : itemsLabel}
                    {validity ? <> · <span className="font-medium text-fg">{validity.label}</span></> : null}
                    {owner ? <> · <span className="font-medium text-fg">{owner}</span>{provider ? ` · ${formatDuration(providerDuration)}` : ""}</> : null}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">{formatMoney(total, currency)}</span>
                </div>
              );
            })() : undefined}
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
              /* Offered only where there is something to hold: a number of
                 places on a dated slot. A seat map holds named seats and a
                 lane holds a span — both are the calendar's job, where the
                 whole day is on screen. */
              onHold={needsSchedule(bt) && !hasLayout && !resourceMode && partySize > 0 && (!isSlotBased(bt) || !!slotTime) && !holdOpen ? () => setHoldOpen(true) : undefined}
              holdRow={
                needsSchedule(bt) && !hasLayout && !resourceMode && partySize > 0 ? (
                  holdOpen ? (
                    <div className="mt-tight flex items-center gap-tight">
                      <input
                        value={holdFor}
                        autoFocus
                        onChange={(e) => setHoldFor(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") void doHold(); }}
                        placeholder={t("sheet.holdFor")}
                        aria-label={t("sheet.holdFor")}
                        className="h-12 min-w-0 flex-1 rounded-go-sm border border-line bg-card px-comfortable text-[0.8125rem] outline-none focus:border-inverse"
                      />
                      {/* Secondary: the sale is what this screen is for, and
                          an ember Hold beside a grey Add says the exception is
                          the point. */}
                      <Button variant="secondary" size="sm" shape="pill" disabled={!holdFor.trim() || holding} onClick={() => void doHold()}>
                        {t("sheet.holdPlace")}
                      </Button>
                    </div>
                  ) : null
                ) : undefined
              }
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
                const ticketCount = list.reduce((a, x) => a + (qty[x.id] ?? 0), 0);
                const valExtra = validity && (validity.priceDelta ?? 0) > 0 ? (validity.priceDelta ?? 0) * ticketCount : 0;
                const total = list.reduce((a, x) => a + (qty[x.id] ?? 0) * x.price, 0) + addOnItems().reduce((a, i) => a + i.unitPrice * i.qty, 0) + prem + valExtra;
                /* The whole figure without its paisa: this sits beside Hold on
                   a phone, and "৳600.00" was the part that got cut off. The
                   summary line above states it to the paisa. */
                const amount = formatPriceShort(total, currency);
                /* Say what is missing before saying what will be bought: a
                   greyed "Add 1 ticket" with no time chosen reads as broken. */
                if (isSlotBased(bt) && !resourceMode && !provider && !slotTime && openToday) return t("sheet.pickTime");
                if (provider && !assignedProvider) return t("sheet.pickProvider");
                if (hasLayout) return selectedSeats.length ? t("sheet.addAmount", { amount: formatPriceShort(seatTotal + addOnItems().reduce((a, i) => a + i.unitPrice * i.qty, 0), currency) }) : t("sheet.pickSeats");
                if (n === 0 && !course) return t("sheet.pickTickets");
                return t("sheet.addAmount", { amount });
              })()}
            />
          </>
        )}

        {/* Waitlist mini-form */}
        {wl && (
          <div className="mt-section rounded-go border border-warning bg-warning/5 p-section">
            <p className="text-sm font-medium">{t("sheet.joinWaitlistFor", { time: formatClock(wl.time) })}</p>
            <div className="mt-tight grid grid-cols-1 gap-tight sm:grid-cols-2">
              <FormField label={t("sheet.name")} value={wlName} onChange={(e) => setWlName(e.target.value)} />
              <FormField label={t("sheet.phone")} value={wlPhone} onChange={(e) => setWlPhone(e.target.value)} />
            </div>
            <div className="mt-tight flex justify-end gap-tight"><Button shape="pill" variant="secondary" onClick={() => setWl(null)}>{t("sheet.cancel")}</Button><Button shape="pill" disabled={!wlName.trim()} onClick={doWaitlist}>{t("sheet.join")}</Button></div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
