"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button, FormField, useToast } from "@/components/ui";
import {
  firstFreeResource,
  freeGuides,
  getDailyRemaining,
  getResourceMatrix,
  getSlots,
  isOpenOn,
  isOwnerFree,
  isResourceFreeFor,
  joinWaitlist,
  type Product,
  type ProductSchedule,
  type Staff,
} from "@/lib/api";
import { isFlexibleResource, isResourceType, isSlotBased, needsSchedule, slotISO, slotTimesOn, toMinutes, toTime } from "@/lib/schedule";
import { resolveProductPrice } from "@/lib/pricing";
import { durationOptions, formatDuration, productDurationPrice } from "@/lib/duration";
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
  const addOnItems = () => (product.addOns ?? []).filter((a) => (addOnQty[a.id] ?? 0) > 0).map((a) => ({ tierId: a.id, tierName: `${a.name}${a.perPerson ? " (each)" : ""}`, unitPrice: a.price, qty: addOnQty[a.id] }));

  const renderAddOns = () =>
    (product.addOns?.length ?? 0) > 0 ? (
      <div className="mt-section flex flex-col gap-tight">
        <span className="type-label text-[11px] text-neutral-400">Add-ons</span>
        {(product.addOns ?? []).map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-sm border border-neutral-200 bg-white p-comfortable">
            <div className="text-sm">{a.name} <span className="font-mono text-[12px] text-neutral-400">+{formatMoney(a.price, currency)}{a.perPerson ? " each" : ""}</span></div>
            <div className="flex items-center gap-tight">
              <button type="button" aria-label="Less" onClick={() => setAddOnQty((q) => ({ ...q, [a.id]: Math.max(0, (q[a.id] ?? 0) - 1) }))} className="h-12 w-12 rounded-sm border border-neutral-200 text-lg active:bg-neutral-200">−</button>
              <span className="w-6 text-center font-mono">{addOnQty[a.id] ?? 0}</span>
              <button type="button" aria-label="More" onClick={() => setAddOnQty((q) => ({ ...q, [a.id]: (q[a.id] ?? 0) + 1 }))} className="h-12 w-12 rounded-sm border border-neutral-200 text-lg active:bg-neutral-200">+</button>
            </div>
          </div>
        ))}
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

  const dateBtn = (value: string, label: string) => (
    <button key={value} type="button" onClick={() => { setDate(value); setSlotTime(undefined); setResourceId(undefined); }} className={`h-12 rounded-sm border px-comfortable text-sm ${date === value ? "border-ink bg-ink text-paper" : "border-neutral-200 bg-white"}`}>{label}</button>
  );

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
    // Engine price: model + time-band blending across the booked span.
    const price = productDurationPrice(product, date, slotTime, duration, basePrice);
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
    (!provider || (!!slotTime && !!assignedProvider && providerTimeFree(slotTime)));

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative z-10 max-h-[85vh] overflow-y-auto rounded-t-[12px] bg-paper p-section">
        <div className="mx-auto mb-tight h-1 w-10 rounded-full bg-neutral-200" aria-hidden />
        <div className="mb-section flex items-center justify-between">
          <h2 className="type-h2 text-lg">{product.name}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-sm active:bg-neutral-200"><X size={20} strokeWidth={1.5} /></button>
        </div>

        {(needsSchedule(bt) || provider) && !course && (
          <div className="mb-section flex flex-wrap gap-tight">
            {dateBtn(TODAY, "Today")}
            {dateBtn(TOMORROW, "Tomorrow")}
            <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setSlotTime(undefined); setResourceId(undefined); }} className="h-12 rounded-sm border border-neutral-200 bg-white px-comfortable text-sm" />
          </div>
        )}
        {!openToday && needsSchedule(bt) && <p className="mb-section text-[13px] text-danger">Closed on this date. Pick another.</p>}

        {/* Resource fixed-slot: fields × times matrix */}
        {resourceMode && !flexible && openToday && (
          <div className="mb-section overflow-x-auto">
            <table className="w-full border-collapse text-center text-[12px]">
              <thead><tr><th className="p-inline text-left font-mono text-neutral-400">{matrix[0]?.resource.nounSingular ?? ""}</th>{(matrix[0]?.slots ?? []).map((s) => <th key={s.time} className="p-inline font-mono text-neutral-400">{s.time}</th>)}</tr></thead>
              <tbody>
                {matrix.map((row) => (
                  <tr key={row.resource.id}>
                    <td className="p-inline text-left font-medium">{row.resource.name}</td>
                    {row.slots.map((s) => {
                      const price = resolveProductPrice(product, date, s.time, basePrice);
                      const selected = resourceId === row.resource.id && slotTime === s.time;
                      if (!s.available) {
                        return <td key={s.time} className="p-inline"><div className="flex h-12 items-center justify-center rounded-xs border border-neutral-200 bg-[repeating-linear-gradient(45deg,#D6D4CE,#D6D4CE_2px,transparent_2px,transparent_5px)] font-mono text-[10px] text-neutral-600">{row.resource.outOfService ? "—" : "BOOKED"}</div></td>;
                      }
                      return <td key={s.time} className="p-inline"><button type="button" onClick={() => { setResourceId(row.resource.id); setSlotTime(s.time); }} className={`flex h-12 w-full items-center justify-center rounded-xs border font-mono text-[11px] ${selected ? "border-ink bg-ink text-paper" : "border-neutral-200 bg-white"}`}>{formatMoney(price, currency)}</button></td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {resourceId && slotTime && (
              <>
                {renderAddOns()}
                <Button size="lg" fullWidth className="mt-section" onClick={() => submitResource(resourceId, matrix.find((r) => r.resource.id === resourceId)?.resource.name ?? "", slotTime, resolveProductPrice(product, date, slotTime, basePrice))}>
                  Add {matrix.find((r) => r.resource.id === resourceId)?.resource.name} · {slotTime} · {formatMoney(resolveProductPrice(product, date, slotTime, basePrice), currency)}
                </Button>
              </>
            )}
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

          const pickDuration = (d: number) => {
            setDuration(d);
            // Re-filter: a start that no longer fits clears with a notice.
            if (slotTime && !startState(slotTime, d, resourceId).ok) { setSlotTime(undefined); toast.info("That start no longer fits — pick another."); }
          };

          // Start now: round the clock per config, first free lane.
          const round = cfg?.walkInRoundMinutes || 15;
          const nowTime = toTime(Math.ceil(NOW_MIN / round) * round);
          const nowLane = date === TODAY && (!mustEnd || NOW_MIN + duration <= closeMin) ? firstFreeResource(product, date, nowTime, duration) : null;
          const nowPrice = nowLane ? productDurationPrice(product, date, nowTime, duration, basePrice) : 0;

          const endLabel = slotTime ? toTime(toMinutes(slotTime) + duration) : null;
          const chosenLaneFree = slotTime ? startState(slotTime, duration, resourceId).ok : false;

          return (
            <div className="mb-section flex flex-col gap-tight">
              {date === TODAY && (
                <button type="button" disabled={!nowLane} onClick={() => nowLane && submitResource(nowLane.id, nowLane.name, nowTime, nowPrice, duration)} className={`flex h-12 items-center justify-between rounded-sm border px-comfortable text-sm ${nowLane ? "border-ember bg-ember/10 font-medium" : "border-neutral-200 bg-neutral-50 text-neutral-400"}`}>
                  <span>Start now · {nowTime} · {formatDuration(duration)}{nowLane ? ` · ${nowLane.name}` : ""}</span>
                  <span className="font-mono">{nowLane ? formatMoney(nowPrice, currency) : "No lane free"}</span>
                </button>
              )}

              <span className="type-label text-[11px] text-neutral-400">Duration</span>
              <div className="flex flex-wrap gap-tight">{flexOptions.map((d) => <button key={d} type="button" onClick={() => pickDuration(d)} className={`h-12 flex-1 whitespace-nowrap rounded-sm border px-tight text-sm ${duration === d ? "border-ink bg-ink text-paper" : "border-neutral-200 bg-white"}`}>{formatDuration(d)}{slotTime ? <span className="ml-inline font-mono text-[11px] opacity-70">{formatMoney(productDurationPrice(product, date, slotTime, d, basePrice), currency)}</span> : null}</button>)}</div>

              <span className="type-label text-[11px] text-neutral-400">{lanes[0]?.nounSingular ?? "Resource"}</span>
              <div className="flex flex-wrap gap-tight">
                <button type="button" onClick={() => setResourceId(undefined)} className={`h-12 rounded-sm border px-comfortable text-sm ${!resourceId ? "border-ink bg-ink text-paper" : "border-neutral-200 bg-white"}`}>Any</button>
                {lanes.map((r) => (
                  <button key={r.id} type="button" disabled={r.outOfService} onClick={() => setResourceId(r.id)} className={`h-12 rounded-sm border px-comfortable text-sm ${r.outOfService ? "border-neutral-200 bg-neutral-50 text-neutral-400 line-through" : resourceId === r.id ? "border-ink bg-ink text-paper" : "border-neutral-200 bg-white"}`}>{r.name}</button>
                ))}
              </div>

              <span className="type-label text-[11px] text-neutral-400">Start time</span>
              <div className="flex flex-wrap gap-inline">
                {flexTimes.map((t) => {
                  const st = startState(t, duration, resourceId);
                  if (!st.ok) {
                    return <button key={t} type="button" onClick={() => toast.error(`${t}: ${st.reason}`)} className="h-12 rounded-sm border border-neutral-200 bg-neutral-50 px-comfortable font-mono text-[13px] text-neutral-400 line-through" title={st.reason}>{t}</button>;
                  }
                  return <button key={t} type="button" onClick={() => setSlotTime(t)} className={`h-12 rounded-sm border px-comfortable font-mono text-[13px] ${slotTime === t ? "border-ink bg-ink text-paper" : "border-neutral-200 bg-white"}`}>{t}</button>;
                })}
              </div>

              {slotTime && endLabel && (
                <p className="text-[13px] text-neutral-600">
                  {slotTime} – <span className="font-mono">{endLabel}</span>
                  {!resourceId && chosenLaneFree ? ` · ${firstFreeResource(product, date, slotTime, duration)?.name} (best fit)` : ""}
                </p>
              )}
              <Button size="lg" fullWidth className="mt-tight" disabled={!slotTime || !chosenLaneFree} onClick={submitFlexible}>
                {slotTime && chosenLaneFree ? `Add ${formatDuration(duration)} · ${slotTime}–${endLabel}` : "Add to sale"}
              </Button>
            </div>
          );
        })()}

        {/* Provider cards + appointment times (conflict-aware per provider) */}
        {provider && (
          <div className="mb-section flex flex-col gap-tight">
            <div className="flex flex-wrap gap-tight">
              {product.providerPickable && providers.map((p) => (
                <button key={p.id} type="button" onClick={() => setProviderId(p.id)} className={`rounded-sm border px-comfortable py-tight text-sm ${providerId === p.id ? "border-ink bg-ink text-paper" : "border-neutral-200 bg-white"}`}>
                  {p.name}{premiumOf(p.id) > 0 && <span className={`ml-inline font-mono text-[11px] ${providerId === p.id ? "opacity-70" : "text-neutral-400"}`}>+{formatMoney(premiumOf(p.id), currency)}</span>}
                </button>
              ))}
              <button type="button" onClick={() => setProviderId(undefined)} className={`rounded-sm border px-comfortable py-tight text-sm ${!providerId ? "border-ink bg-ink text-paper" : "border-neutral-200 bg-white"}`}>First available</button>
            </div>
            <span className="type-label mt-tight text-[11px] text-neutral-400">Start time · {providerDuration} min</span>
            <div className="flex flex-wrap gap-inline">
              {providerTimes.map((t) => {
                const free = providerTimeFree(t);
                return (
                  <button key={t} type="button" disabled={!free} onClick={() => setSlotTime(t)} className={`h-12 rounded-sm border px-comfortable font-mono text-[13px] ${!free ? "border-neutral-200 bg-neutral-50 text-neutral-400 line-through" : slotTime === t ? "border-ink bg-ink text-paper" : "border-neutral-200 bg-white"}`}>{t}</button>
                );
              })}
            </div>
            {slotTime && assignedProvider && !providerId && (
              <p className="text-[12px] text-neutral-600">First available at {slotTime}: {assignedProvider.name}{premiumOf(assignedProvider.id) > 0 ? ` (+${formatMoney(premiumOf(assignedProvider.id), currency)})` : ""}</p>
            )}
            {slotTime && !providerTimeFree(slotTime) && (
              <p className="text-[12px] text-danger">{providers.find((p) => p.id === providerId)?.name ?? "Everyone"} is busy at {slotTime} — pick another time.</p>
            )}
          </div>
        )}

        {/* Course dates */}
        {course && (
          <div className="mb-section rounded-sm border border-neutral-200 bg-white p-comfortable text-sm">
            <p className="type-label text-[11px] text-neutral-400">Course dates</p>
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
              return <button key={s.time} type="button" disabled={full} onClick={() => { setSlotTime(s.time); if (guided) setGuideId(freeGuides(product, date, s.time)[0]); }} className={`flex h-16 flex-col items-center justify-center gap-0.5 rounded-sm border text-sm ${full ? "border-neutral-200 bg-neutral-50 text-neutral-400" : slotTime === s.time ? "border-ink bg-ink text-paper" : "border-neutral-200 bg-white"}`}><span className="font-mono">{s.time}</span><span className="font-mono text-[11px]">{formatMoney(price, currency)}</span><span className="text-[10px] opacity-70">{guideless ? "No guide free" : full ? "FULL" : `${left} left`}</span></button>;
            })}
          </div>
        )}

        {/* Guided: pick who leads — busy guides (on ANY product) can't be chosen */}
        {guided && slotTime && guides.length > 0 && openToday && (
          <div className="mb-section flex flex-col gap-tight">
            <span className="type-label text-[11px] text-neutral-400">Led by</span>
            <div className="flex flex-wrap gap-tight">
              {guides.map((g) => {
                const free = slotGuides.includes(g.id);
                return (
                  <button key={g.id} type="button" disabled={!free} onClick={() => setGuideId(g.id)} className={`rounded-sm border px-comfortable py-tight text-sm ${!free ? "border-neutral-200 bg-neutral-50 text-neutral-400" : guideId === g.id ? "border-ink bg-ink text-paper" : "border-neutral-200 bg-white"}`}>
                    {g.name}{!free && <span className="ml-inline text-[11px]"> · busy</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {bt === "BT-06" && openToday && <p className="mb-section font-mono text-[13px] text-neutral-600">{dailyLeft} left {date === TODAY ? "today" : "that day"}</p>}

        {/* Tier / section steppers (not for exclusive resource / flexible) */}
        {!resourceMode && (
          <>
            <div className="flex flex-col gap-tight">
              {(sectioned ? (product.sections ?? []).map((s) => ({ id: s.id, name: `${s.name}`, price: s.price, cap: s.capacity, note: "" })) : activeTiers.map((t) => ({ id: t.id, name: t.name, price: t.price, cap: undefined, note: [(t.admits ?? 1) > 1 ? `admits ${t.admits}` : "", t.ageNote ?? ""].filter(Boolean).join(" · ") }))).map((row) => (
                <div key={row.id} className="flex items-center justify-between rounded-sm border border-neutral-200 bg-white p-comfortable">
                  <div><div className="text-sm font-medium">{row.name}</div><div className="font-mono text-[12px] text-neutral-400">{formatMoney(row.price, currency)}{row.cap != null ? ` · ${row.cap} seats` : ""}{row.note ? ` · ${row.note}` : ""}</div></div>
                  <div className="flex items-center gap-tight">
                    <button type="button" aria-label="Less" onClick={() => setQty((q) => ({ ...q, [row.id]: Math.max(0, (q[row.id] ?? 0) - 1) }))} className="h-12 w-12 rounded-sm border border-neutral-200 text-lg active:bg-neutral-200">−</button>
                    <span className="w-8 text-center font-mono">{qty[row.id] ?? 0}</span>
                    <button type="button" aria-label="More" onClick={() => setQty((q) => ({ ...q, [row.id]: (q[row.id] ?? 0) + 1 }))} className="h-12 w-12 rounded-sm border border-neutral-200 text-lg active:bg-neutral-200">+</button>
                  </div>
                </div>
              ))}
            </div>
            {renderAddOns()}
            {depositPct > 0 && (
              <p className="mt-section rounded-sm border border-neutral-200 bg-white p-comfortable text-[13px] text-neutral-600">
                Deposit: <span className="font-medium text-ink">{depositPct}% now</span>, balance at arrival.
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
  );
}
