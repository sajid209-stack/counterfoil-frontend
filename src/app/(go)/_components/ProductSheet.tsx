"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Avatar, BlockedNotice, Button, ChoiceCard, FormField, ResourceTimeline, useToast } from "@/components/ui";
import {
  applyResourceRate,
  firstFreeResource,
  freeGuides,
  getDailyRemaining,
  getResourceMatrix,
  getSlots,
  isOpenOn,
  isOwnerFree,
  isResourceFreeFor,
  joinWaitlist,
  ownerBusyDetailed,
  type Product,
  type ProductSchedule,
  type Resource,
  type Staff,
} from "@/lib/api";
import { isFlexibleResource, isResourceType, isSlotBased, needsSchedule, slotISO, slotTimesOn, toMinutes, toTime } from "@/lib/schedule";
import { resolveProductPrice } from "@/lib/pricing";
import { durationOptions, formatDuration, priceSegments, productDurationPrice } from "@/lib/duration";
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
  partySize?: number; // group size for flat-per-booking entries ("Group of 6")
  taxRatePct?: number; // custom-amount entries carry their own rate
}


const TODAY = "2026-07-29";
const TOMORROW = "2026-07-30";
const NOW_MIN = 12 * 60; // the mock clock: today, noon

// Providers without a configured schedule sell appointments on these hours.
const PROVIDER_DAY: ProductSchedule = {
  slotMinutes: 60, sessionMinutes: 60, startTime: "10:00", endTime: "19:00",
  capacityPerSession: 1, dailyCapacity: null, openDays: [0, 1, 2, 3, 4, 5, 6], guideIds: [], exceptions: [],
};

const endISO = (date: string, time: string, minutes: number) =>
  slotISO(date, toTime(toMinutes(time) + minutes));

export function ProductSheet({
  product,
  currency,
  initial,
  seatsInCart,
  onAdd,
  onClose,
  team = [],
}: {
  product: Product;
  currency: string;
  initial: CartEntry | null;
  seatsInCart: (productId: string, slotStart: string) => number;
  onAdd: (entry: CartEntry) => void;
  onClose: () => void;
  team?: Staff[];
}) {
  const toast = useToast();
  const activeTiers = product.tiers.filter((t) => t.active);
  const bt = product.bookingType;
  const resourceMode = isResourceType(bt);
  const flexible = isFlexibleResource(bt);
  const provider = bt === "BT-10";
  const guided = bt === "BT-09";
  const course = bt === "BT-13";
  const sectioned = (product.sections?.length ?? 0) > 0 || bt === "BT-07";

  const [date, setDate] = useState(initial?.slotDate ?? TODAY);
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
    list.forEach((id) => (q[id] = initial?.items.find((i) => i.tierId === id)?.qty ?? 0));
    return q;
  });

  const [addOnQty, setAddOnQty] = useState<Record<string, number>>({});
  const [group, setGroup] = useState<number>(initial?.partySize ?? 2); // flat-per-booking group size
  const [waived, setWaived] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null); // BlockedNotice message
  const [moreDates, setMoreDates] = useState(false);

  const needsWaiver = !!product.policies?.waiver;
  const waiverOk = !needsWaiver || waived;
  const flatBasis = resourceMode && product.pricingBasis !== "per_person";
  const partyMax = product.policies?.partyMax ?? 20;
  const partyMin = product.policies?.partyMin ?? 1;

  const renderWaiver = () =>
    needsWaiver ? (
      <label className="mt-tight flex cursor-pointer items-center gap-tight rounded-sm border border-line bg-card p-comfortable text-sm">
        <input type="checkbox" checked={waived} onChange={(e) => setWaived(e.target.checked)} className="h-5 w-5 accent-ember" />
        Guest has signed the waiver
      </label>
    ) : null;

  const renderGroup = () =>
    flatBasis ? (
      <div className="flex items-center justify-between rounded-sm border border-line bg-card p-comfortable">
        <span className="text-sm">Group size</span>
        <div className="flex items-center gap-tight">
          <button type="button" aria-label="Fewer" onClick={() => setGroup((g) => Math.max(partyMin, g - 1))} className="h-12 w-12 rounded-sm border border-line text-lg active:bg-ember/10">−</button>
          <span className="w-8 text-center font-mono">{group}</span>
          <button type="button" aria-label="More people" onClick={() => setGroup((g) => Math.min(partyMax, g + 1))} className="h-12 w-12 rounded-sm border border-line text-lg active:bg-ember/10">+</button>
        </div>
      </div>
    ) : null;
  const addOnItems = () => (product.addOns ?? []).filter((a) => (addOnQty[a.id] ?? 0) > 0).map((a) => ({ tierId: a.id, tierName: `${a.name}${a.perPerson ? " (each)" : ""}`, unitPrice: a.price, qty: addOnQty[a.id] }));

  // Add-on rows — the catering pattern: a full-width row whose + becomes a
  // stepper once added. Per-person add-ons start at the group/party size and
  // multiply live.
  const headsFor = () => (flatBasis ? group : Math.max(1, Object.values(qty).reduce((s, n) => s + n, 0)));
  const renderAddOns = () =>
    (product.addOns?.length ?? 0) > 0 ? (
      <div className="mt-section flex flex-col gap-tight">
        <span className="type-label text-[11px] text-faint">Add-ons</span>
        {(product.addOns ?? []).map((a) => {
          const n = addOnQty[a.id] ?? 0;
          return (
            <div key={a.id} className="flex min-h-14 items-center gap-tight rounded-sm border border-line bg-card p-comfortable">
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm">{a.name}</span>
                <span className="font-mono text-[12px] text-faint">{formatMoney(a.price, currency)}{a.perPerson ? "/head" : ""}{n > 0 ? ` × ${n} = ${formatMoney(a.price * n, currency)}` : ""}</span>
              </div>
              {n === 0 ? (
                <button type="button" aria-label={`Add ${a.name}`} onClick={() => setAddOnQty((q) => ({ ...q, [a.id]: a.perPerson ? headsFor() : 1 }))} className="h-12 w-12 shrink-0 rounded-sm border border-line text-lg active:bg-ember/10">+</button>
              ) : (
                <div className="flex shrink-0 items-center gap-tight">
                  <button type="button" aria-label="Less" onClick={() => setAddOnQty((q) => ({ ...q, [a.id]: Math.max(0, (q[a.id] ?? 0) - 1) }))} className="h-12 w-12 rounded-sm border border-line text-lg active:bg-ember/10">−</button>
                  <span className="w-6 text-center font-mono">{n}</span>
                  <button type="button" aria-label="More" onClick={() => setAddOnQty((q) => ({ ...q, [a.id]: (q[a.id] ?? 0) + 1 }))} className="h-12 w-12 rounded-sm border border-line text-lg active:bg-ember/10">+</button>
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
      return { left: getDailyRemaining(product, d), total: product.schedule.dailyCapacity };
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
      <ChoiceCard key={value} selected={date === value} onClick={() => { setDate(value); setSlotTime(undefined); setResourceId(undefined); }} className="flex min-h-14 min-w-16 flex-col items-center justify-center px-tight py-inline">
        <span className="text-[10px] uppercase tracking-wide text-faint">{label === "Today" || label === "Tomorrow" ? label : label.split(" ")[0]}</span>
        <span className="font-mono text-[13px] tabular-nums">{value.slice(8, 10)} {new Date(`${value}T12:00:00Z`).toLocaleDateString("en-GB", { month: "short" })}</span>
        {cap && <span className={`font-mono text-[10px] tabular-nums ${low ? "font-medium text-ember" : "text-faint"}`}>{cap.left} left</span>}
      </ChoiceCard>
    );
  };

  const submitTiered = () => {
    const list = sectioned ? (product.sections ?? []).map((s) => ({ id: s.id, name: s.name, price: s.price })) : activeTiers.map((t) => ({ id: t.id, name: t.name, price: t.price }));
    const items = [...list.filter((x) => qty[x.id] > 0).map((x) => ({ tierId: x.id, tierName: x.name, unitPrice: x.price, qty: qty[x.id] })), ...addOnItems()];
    // Owner of the session's capacity: the chosen guide or assigned provider.
    const owner = guided ? guides.find((g) => g.id === guideId) : assignedProvider;
    if (provider && assignedProvider && premiumOf(assignedProvider.id) > 0) {
      items.push({ tierId: `prem_${assignedProvider.id}`, tierName: `${assignedProvider.name.split(" ")[0]} premium`, unitPrice: premiumOf(assignedProvider.id), qty: 1 });
    }
    const minutes = provider ? providerDuration : (product.schedule?.sessionMinutes || product.schedule?.slotMinutes || 60);
    onAdd({
      id: initial?.id ?? `entry_${globalThis.crypto.randomUUID().slice(0, 8)}`,
      productId: product.id, productName: product.name,
      slotDate: needsSchedule(bt) && !resourceMode ? date : provider || course ? date : undefined,
      slotTime: (!resourceMode && slotTime) || undefined,
      slotEnd: (guided || provider) && slotTime ? endISO(date, slotTime, minutes) : undefined,
      resourceId: owner?.id,
      providerLabel: owner?.name,
      items,
    });
  };

  const submitResource = (rId: string, rLabel: string, time: string, price: number, minutes?: number) => {
    onAdd({
      id: initial?.id ?? `entry_${globalThis.crypto.randomUUID().slice(0, 8)}`,
      productId: product.id, productName: product.name,
      slotDate: date, slotTime: time, resourceId: rId, resourceLabel: rLabel,
      slotEnd: endISO(date, time, minutes ?? product.schedule?.sessionMinutes ?? 60),
      partySize: flatBasis ? group : undefined,
      items: addOnItems(), fixedPrice: price,
    });
  };

  const submitFlexible = () => {
    if (!slotTime) return;
    // "Any" assigns the best-fit (first free) lane at submit.
    const lane = resourceId
      ? getResourceMatrix(product, date).find((row) => row.resource.id === resourceId)?.resource
      : firstFreeResource(product, date, slotTime, duration);
    if (!lane) return;
    // Engine price (model + band blending), then the lane's own rate.
    const price = applyResourceRate(productDurationPrice(product, date, slotTime, duration, basePrice), duration, lane);
    submitResource(lane.id, lane.name, slotTime, price, duration);
  };

  const doWaitlist = async () => {
    if (!wl) return;
    await joinWaitlist({ productId: product.id, slotStart: slotISO(date, wl.time), name: wlName, phone: wlPhone });
    toast.success("Added to the waitlist.");
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
        <div className="mb-section flex items-center justify-between">
          <h2 className="type-h2 text-lg">{product.name}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-sm active:bg-ember/10"><X size={20} strokeWidth={1.5} /></button>
        </div>

        {(needsSchedule(bt) || provider) && !course && (
          <div className="mb-section flex flex-wrap items-center gap-tight">
            {/* Date chips first — the next bookable days; calendar behind "More dates". */}
            {(() => {
              const chips: string[] = [];
              for (let i = 0; chips.length < 5 && i < 30; i++) {
                const d = new Date(Date.parse(`${TODAY}T12:00:00Z`) + i * 86400000).toISOString().slice(0, 10);
                if (isOpenOn(product, d)) chips.push(d);
              }
              return chips.map((d) => {
                const label = d === TODAY ? "Today" : d === TOMORROW ? "Tomorrow"
                  : new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
                return dateBtn(d, label);
              });
            })()}
            {moreDates ? (
              <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setSlotTime(undefined); setResourceId(undefined); }} className="h-12 rounded-sm border border-line bg-card px-comfortable text-sm" />
            ) : (
              <button type="button" onClick={() => setMoreDates(true)} className="h-12 rounded-sm px-tight text-[13px] text-faint active:text-fg">More dates</button>
            )}
          </div>
        )}
        {!openToday && needsSchedule(bt) && <p className="mb-section text-[13px] text-danger">Closed on this date. Pick another.</p>}

        {/* Resource fixed-slot: fields × times matrix */}
        {resourceMode && !flexible && openToday && (
          <div className="mb-section overflow-x-auto">
            <table className="w-full border-collapse text-center text-[12px]">
              <thead><tr><th className="p-inline text-left font-mono text-faint">{matrix[0]?.resource.nounSingular ?? ""}</th>{(matrix[0]?.slots ?? []).map((s) => <th key={s.time} className="p-inline font-mono text-faint">{s.time}</th>)}</tr></thead>
              <tbody>
                {matrix.map((row) => (
                  <tr key={row.resource.id}>
                    <td className="p-inline text-left font-medium">{row.resource.name}</td>
                    {row.slots.map((s) => {
                      const price = applyResourceRate(resolveProductPrice(product, date, s.time, basePrice), product.schedule?.sessionMinutes ?? 60, row.resource);
                      const selected = resourceId === row.resource.id && slotTime === s.time;
                      if (!s.available) {
                        return <td key={s.time} className="p-inline"><div className="flex h-12 items-center justify-center rounded-xs border border-line bg-[repeating-linear-gradient(45deg,#D6D4CE,#D6D4CE_2px,transparent_2px,transparent_5px)] font-mono text-[10px] text-muted">{row.resource.outOfService ? "—" : "BOOKED"}</div></td>;
                      }
                      return <td key={s.time} className="p-inline"><button type="button" onClick={() => { setResourceId(row.resource.id); setSlotTime(s.time); }} className={`flex h-12 w-full items-center justify-center rounded-xs border font-mono text-[11px] ${selected ? "border-inverse bg-inverse text-inverse-fg" : "border-line bg-card"}`}>{formatMoney(price, currency)}</button></td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {resourceId && slotTime && (() => {
              const row = matrix.find((r) => r.resource.id === resourceId);
              const price = applyResourceRate(resolveProductPrice(product, date, slotTime, basePrice), product.schedule?.sessionMinutes ?? 60, row?.resource);
              return (
                <>
                  {renderAddOns()}
                  <div className="mt-tight flex flex-col gap-tight">{renderGroup()}{renderWaiver()}</div>
                  {/* The live selection summary. */}
                  <p className="mt-tight text-[13px]">
                    <span className="font-medium">{row?.resource.name}</span> · <span className="font-mono tabular-nums">{slotTime}</span> · {formatDuration(product.schedule?.sessionMinutes ?? 60)}
                    {flatBasis ? ` · Group of ${group}` : ""} · <span className="font-mono tabular-nums">{formatMoney(price + addOnItems().reduce((s, i) => s + i.unitPrice * i.qty, 0), currency)}</span>
                  </p>
                  <Button size="lg" fullWidth className="mt-tight" disabled={!waiverOk} onClick={() => submitResource(resourceId, row?.resource.name ?? "", slotTime, price)}>
                    Add {row?.resource.name} · {slotTime} · {formatMoney(price, currency)}
                  </Button>
                </>
              );
            })()}
          </div>
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

          const startState = (t: string, dur: number, laneId?: string): { ok: boolean; reason?: string } => {
            const start = toMinutes(t);
            if (date === TODAY && start < NOW_MIN + lead) return { ok: false, reason: lead > 0 ? `Needs ${formatDuration(lead)} notice` : "Already past" };
            if (mustEnd && start + dur > closeMin) return { ok: false, reason: "Ends after closing" };
            const free = laneId
              ? isResourceFreeFor(laneId, date, t, dur, buffer)
              : !!firstFreeResource(product, date, t, dur);
            return free ? { ok: true } : { ok: false, reason: laneId ? "Booked" : "All booked" };
          };

          const laneOf = (id?: string): Resource | undefined => lanes.find((l) => l.id === id);
          const priceFor = (t: string, dur: number, lane?: Resource | null) =>
            applyResourceRate(productDurationPrice(product, date, t, dur, basePrice), dur, lane);
          const rateLabel = (l: Resource) =>
            l.rateOverride ? (l.rateOverride.kind === "premium" ? `+${formatMoney(l.rateOverride.amount, currency)}` : `${formatMoney(l.rateOverride.amount, currency)}/hr`) : null;
          const liveState = (l: Resource): string => {
            const spans = ownerBusyDetailed(l.id, date);
            if (l.outOfService) return "Out of service";
            if (date === TODAY) {
              const current = spans.find((s) => s.start <= NOW_MIN && NOW_MIN < s.end);
              if (current) return `In use until ${toTime(current.end)} · ${current.label}`;
            }
            return spans.length ? `${spans.length} booking${spans.length === 1 ? "" : "s"} today` : "Free";
          };

          const pickDuration = (d: number) => {
            setDuration(d);
            // Re-filter: a start that no longer fits clears with a notice.
            if (slotTime && !startState(slotTime, d, resourceId).ok) { setSlotTime(undefined); toast.info("That start no longer fits — pick another."); }
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
                  <span>Start now · {nowTime} · {formatDuration(duration)}{nowLane ? ` · ${nowLane.name}` : ""}</span>
                  <span className="font-mono">{!nowLane ? "No lane free" : !waiverOk ? "Waiver first" : formatMoney(nowPrice, currency)}</span>
                </button>
              )}

              <span className="type-label text-[11px] text-faint">Duration</span>
              <div className="flex flex-wrap gap-tight">{flexOptions.map((d) => <button key={d} type="button" onClick={() => pickDuration(d)} className={`h-12 flex-1 whitespace-nowrap rounded-sm border px-tight text-sm ${duration === d ? "border-inverse bg-inverse text-inverse-fg" : "border-line bg-card"}`}>{formatDuration(d)}{slotTime ? <span className="ml-inline font-mono text-[11px] opacity-70">{formatMoney(priceFor(slotTime, d, laneOf(resourceId)), currency)}</span> : null}</button>)}</div>

              <span className="type-label text-[11px] text-faint">{lanes[0]?.nounSingular ?? "Resource"}</span>
              <div className="flex flex-wrap gap-tight">
                <ChoiceCard selected={!resourceId} onClick={() => setResourceId(undefined)} className="flex h-14 items-center px-comfortable text-sm">Any</ChoiceCard>
                {lanes.map((r) => (
                  <ChoiceCard key={r.id} selected={resourceId === r.id} disabled={r.outOfService} onClick={() => setResourceId(r.id)} className="flex min-h-14 max-w-56 flex-col items-start justify-center px-comfortable py-inline">
                    <span className="block max-w-full truncate text-sm leading-tight">{r.name}{rateLabel(r) ? <span className="ml-inline whitespace-nowrap font-mono text-[10px] text-faint">{rateLabel(r)}</span> : null}</span>
                    <span className="block max-w-full truncate font-mono text-[10px] leading-tight text-muted">{liveState(r)}</span>
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
                  onBlockTap={(s) => setBlocked(`${toTime(s.start)}–${toTime(s.end)} is booked (${s.label}). Try a start after ${toTime(s.end)}, a shorter duration, or another ${(lanes[0]?.nounSingular ?? "lane").toLowerCase()}.`)}
                />
              )}

              {blocked && <BlockedNotice message={blocked} onDismiss={() => setBlocked(null)} />}

              <div className="flex items-center justify-between">
                <span className="type-label text-[11px] text-faint">Start time</span>
                {/* Chips for speed, the stepper for precision (walk-in rounding). */}
                <div className="flex items-center gap-inline">
                  <button type="button" aria-label="Earlier" onClick={() => { const base = toMinutes(slotTime ?? flexTimes[0] ?? "12:00"); const next = Math.max(flexTimes.length ? toMinutes(flexTimes[0]) : 0, base - round); setSlotTime(toTime(next)); setBlocked(null); }} className="flex h-11 w-11 items-center justify-center rounded-sm border border-line text-lg active:bg-ember/10">−</button>
                  <span className="w-14 text-center font-mono text-[13px] tabular-nums">{slotTime ?? "—"}</span>
                  <button type="button" aria-label="Later" onClick={() => { const base = toMinutes(slotTime ?? flexTimes[0] ?? "12:00"); const cap = mustEnd ? closeMin - duration : 24 * 60 - round; const next = Math.min(cap, base + round); setSlotTime(toTime(next)); setBlocked(null); }} className="flex h-11 w-11 items-center justify-center rounded-sm border border-line text-lg active:bg-ember/10">+</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-inline">
                {flexTimes.map((t) => {
                  const st = startState(t, duration, resourceId);
                  if (!st.ok) {
                    return <button key={t} type="button" onClick={() => setBlocked(`${t} isn't available — ${st.reason?.toLowerCase()}. Try a shorter duration, another start, or a different ${(lanes[0]?.nounSingular ?? "lane").toLowerCase()}.`)} className="h-12 rounded-sm border border-line bg-subtle px-comfortable font-mono text-[13px] text-faint line-through" title={st.reason}>{t}</button>;
                  }
                  return <button key={t} type="button" onClick={() => { setSlotTime(t); setBlocked(null); }} className={`h-12 rounded-sm border px-comfortable font-mono text-[13px] ${slotTime === t ? "border-inverse bg-inverse text-inverse-fg" : "border-line bg-card"}`}>{t}</button>;
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
                    {math && <p className="font-mono text-[12px] tabular-nums text-muted">{math}{premium}</p>}
                    {/* The live selection summary — the CTA never enables without it. */}
                    <p className="text-[13px]">
                      <span className="font-medium">{lane?.name ?? "Any lane"}</span> · <span className="font-mono tabular-nums">{slotTime}–{endLabel}</span> · {formatDuration(duration)}
                      {flatBasis ? ` · Group of ${group}` : ""} · <span className="font-mono tabular-nums">{formatMoney(total, currency)}</span>
                      {!resourceId && lane ? <span className="text-faint"> (best fit)</span> : null}
                    </p>
                  </div>
                );
              })()}
              <Button size="lg" fullWidth className="mt-tight" disabled={!slotTime || !chosenLaneFree || !waiverOk} onClick={submitFlexible}>
                {slotTime && chosenLaneFree ? `Add ${formatDuration(duration)} · ${slotTime}–${endLabel} · ${formatMoney(priceFor(slotTime, duration, laneOf(resourceId) ?? firstFreeResource(product, date, slotTime, duration)), currency)}` : "Add to sale"}
              </Button>
            </div>
          );
        })()}

        {/* Provider cards + appointment times (conflict-aware per provider) */}
        {provider && (
          <div className="mb-section flex flex-col gap-tight">
            <div className="flex flex-wrap gap-tight">
              {product.providerPickable && providers.map((p) => {
                const nextFree = providerTimes.find((t) => (date !== TODAY || toMinutes(t) >= NOW_MIN) && isOwnerFree(p.id, date, t, providerDuration));
                return (
                  <ChoiceCard key={p.id} selected={providerId === p.id} onClick={() => setProviderId(p.id)} className="flex min-w-44 items-center gap-tight p-comfortable">
                    <Avatar name={p.name} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="block text-[11px] text-faint">{product.providerNoun ?? "Provider"}{premiumOf(p.id) > 0 ? ` · +${formatMoney(premiumOf(p.id), currency)}` : ""}</span>
                      <span className="block font-mono text-[11px] text-muted">{nextFree ? `next free ${nextFree}` : "fully booked"}</span>
                    </span>
                  </ChoiceCard>
                );
              })}
              <ChoiceCard selected={!providerId} onClick={() => setProviderId(undefined)} className="flex min-w-32 items-center justify-center p-comfortable text-sm">First available</ChoiceCard>
            </div>
            <span className="type-label mt-tight text-[11px] text-faint">Start time · {providerDuration} min</span>
            <div className="flex flex-wrap gap-inline">
              {providerTimes.map((t) => {
                const free = providerTimeFree(t);
                return (
                  <button key={t} type="button" disabled={!free} onClick={() => setSlotTime(t)} className={`h-12 rounded-sm border px-comfortable font-mono text-[13px] ${!free ? "border-line bg-subtle text-faint line-through" : slotTime === t ? "border-inverse bg-inverse text-inverse-fg" : "border-line bg-card"}`}>{t}</button>
                );
              })}
            </div>
            {slotTime && assignedProvider && !providerId && (
              <p className="text-[12px] text-muted">First available at {slotTime}: {assignedProvider.name}{premiumOf(assignedProvider.id) > 0 ? ` (+${formatMoney(premiumOf(assignedProvider.id), currency)})` : ""}</p>
            )}
            {slotTime && !providerTimeFree(slotTime) && (
              <p className="text-[12px] text-danger">{providers.find((p) => p.id === providerId)?.name ?? "Everyone"} is busy at {slotTime} — pick another time.</p>
            )}
          </div>
        )}

        {/* Course dates */}
        {course && (
          <div className="mb-section rounded-sm border border-line bg-card p-comfortable text-sm">
            <p className="type-label text-[11px] text-faint">Course dates</p>
            <p className="mt-inline font-mono text-[12px]">{(product.courseDates ?? []).join(" · ") || "—"}</p>
          </div>
        )}

        {/* Non-resource slot grid (planetarium/tour) */}
        {needsSchedule(bt) && !resourceMode && !flexible && openToday && (
          <div className="mb-section grid grid-cols-3 gap-tight sm:grid-cols-4">
            {slots.map((s) => {
              const left = s.remaining - seatsInCart(product.id, slotISO(date, s.time));
              // A departure needs a free guide as well as seats.
              const guideless = guided && guides.length > 0 && freeGuides(product, date, s.time).length === 0;
              const full = left <= 0 || guideless;
              const price = resolveProductPrice(product, date, s.time, basePrice);
              if (full && product.waitlistEnabled) {
                return <button key={s.time} type="button" onClick={() => setWl({ time: s.time })} className="flex h-16 flex-col items-center justify-center rounded-sm border border-warning bg-warning/10 text-warning"><span className="font-mono">{s.time}</span><span className="text-[10px]">Join waitlist</span></button>;
              }
              const low = !full && left <= Math.max(1, Math.floor(s.capacity * 0.2)); // ≤20% remaining
              return <button key={s.time} type="button" disabled={full} onClick={() => { setSlotTime(s.time); if (guided) setGuideId(freeGuides(product, date, s.time)[0]); }} className={`flex h-16 flex-col items-center justify-center gap-0.5 rounded-sm border text-sm ${full ? "border-line bg-subtle text-faint" : slotTime === s.time ? "border-inverse bg-inverse text-inverse-fg" : "border-line bg-card"}`}><span className="font-mono">{s.time}</span><span className="font-mono text-[11px]">{formatMoney(price, currency)}</span>{low && slotTime !== s.time ? <span className="rounded-lg bg-ember px-tight font-mono text-[10px] text-ink">{left} left</span> : <span className="text-[10px] opacity-70">{guideless ? "No guide free" : full ? "FULL" : `${left} left`}</span>}</button>;
            })}
          </div>
        )}

        {/* Guided: pick who leads — busy guides (on ANY product) can't be chosen */}
        {guided && slotTime && guides.length > 0 && openToday && (
          <div className="mb-section flex flex-col gap-tight">
            <span className="type-label text-[11px] text-faint">Led by</span>
            <div className="flex flex-wrap gap-tight">
              {guides.map((g) => {
                const free = slotGuides.includes(g.id);
                return (
                  <ChoiceCard key={g.id} selected={guideId === g.id} disabled={!free} onClick={() => setGuideId(g.id)} className="flex items-center gap-tight p-comfortable">
                    <Avatar name={g.name} size={32} />
                    <span className="text-sm">{g.name}{!free && <span className="ml-inline text-[11px]"> · busy</span>}</span>
                  </ChoiceCard>
                );
              })}
            </div>
          </div>
        )}

        {bt === "BT-06" && openToday && <p className="mb-section font-mono text-[13px] text-muted">{dailyLeft} left {date === TODAY ? "today" : "that day"}</p>}

        {/* Tier / section steppers (not for exclusive resource / flexible) */}
        {!resourceMode && (
          <>
            <div className="flex flex-col gap-tight">
              {(sectioned ? (product.sections ?? []).map((s) => ({ id: s.id, name: `${s.name}`, price: s.price, cap: s.capacity, note: "" })) : activeTiers.map((t) => ({ id: t.id, name: t.name, price: t.price, cap: undefined, note: [(t.admits ?? 1) > 1 ? `admits ${t.admits}` : "", t.ageNote ?? ""].filter(Boolean).join(" · ") }))).map((row) => (
                <div key={row.id} className="flex items-center justify-between rounded-sm border border-line bg-card p-comfortable">
                  <div><div className="text-sm font-medium">{row.name}</div><div className="font-mono text-[12px] text-faint">{formatMoney(row.price, currency)}{row.cap != null ? ` · ${row.cap} seats` : ""}{row.note ? ` · ${row.note}` : ""}</div></div>
                  <div className="flex items-center gap-tight">
                    <button type="button" aria-label="Less" onClick={() => setQty((q) => ({ ...q, [row.id]: Math.max(0, (q[row.id] ?? 0) - 1) }))} className="h-12 w-12 rounded-sm border border-line text-lg active:bg-ember/10">−</button>
                    <span className="w-8 text-center font-mono">{qty[row.id] ?? 0}</span>
                    <button type="button" aria-label="More" onClick={() => setQty((q) => ({ ...q, [row.id]: (q[row.id] ?? 0) + 1 }))} className="h-12 w-12 rounded-sm border border-line text-lg active:bg-ember/10">+</button>
                  </div>
                </div>
              ))}
            </div>
            {renderAddOns()}
            {renderWaiver()}
            {/* The live selection summary — plain language, mono numbers. */}
            {partySize > 0 && (() => {
              const list = sectioned ? (product.sections ?? []) : activeTiers;
              const itemsLabel = list.filter((x) => (qty[x.id] ?? 0) > 0).map((x) => `${qty[x.id]} ${x.name}`).join(" · ");
              const owner = guided ? guides.find((g) => g.id === guideId)?.name : provider ? assignedProvider?.name : undefined;
              const prem = provider && assignedProvider ? premiumOf(assignedProvider.id) : 0;
              const total = list.reduce((s, x) => s + (qty[x.id] ?? 0) * x.price, 0) + addOnItems().reduce((s, i) => s + i.unitPrice * i.qty, 0) + prem;
              const when = slotTime ? `${slotTime} ${date === TODAY ? "today" : date}` : (needsSchedule(bt) || provider || course) ? (date === TODAY ? "today" : date) : null;
              return (
                <p className="mt-tight text-[13px]">
                  {when && <><span className="font-mono tabular-nums">{when}</span> · </>}
                  {itemsLabel}
                  {owner ? <> · <span className="font-medium">{owner}</span>{provider ? ` · ${formatDuration(providerDuration)}` : ""}</> : null}
                  {" · "}<span className="font-mono tabular-nums">{formatMoney(total, currency)}</span>
                </p>
              );
            })()}
            {depositPct > 0 && (
              <p className="mt-section rounded-sm border border-line bg-card p-comfortable text-[13px] text-muted">
                Deposit: <span className="font-medium text-fg">{depositPct}% now</span>, balance at arrival.
              </p>
            )}
            <Button size="lg" fullWidth className={depositPct > 0 ? "mt-tight" : "mt-section"} disabled={!canAddTiered} onClick={submitTiered}>{course ? "Enrol" : "Add to sale"}</Button>
          </>
        )}

        {/* Waitlist mini-form */}
        {wl && (
          <div className="mt-section rounded-sm border border-warning bg-warning/5 p-section">
            <p className="text-sm font-medium">Join the waitlist for {wl.time}</p>
            <div className="mt-tight grid grid-cols-2 gap-tight">
              <FormField label="Name" value={wlName} onChange={(e) => setWlName(e.target.value)} />
              <FormField label="Phone" value={wlPhone} onChange={(e) => setWlPhone(e.target.value)} />
            </div>
            <div className="mt-tight flex justify-end gap-tight"><Button variant="secondary" onClick={() => setWl(null)}>Cancel</Button><Button disabled={!wlName.trim()} onClick={doWaitlist}>Join</Button></div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
