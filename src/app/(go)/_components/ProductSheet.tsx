"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button, FormField, useToast } from "@/components/ui";
import {
  getDailyRemaining,
  getResourceMatrix,
  getSlots,
  isOpenOn,
  joinWaitlist,
  type Product,
  type Staff,
} from "@/lib/api";
import { isFlexibleResource, isResourceType, needsSchedule, slotISO, slotTimes } from "@/lib/schedule";
import { resolveProductPrice } from "@/lib/pricing";
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
}

const TODAY = "2026-07-29";
const TOMORROW = "2026-07-30";

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
  const course = bt === "BT-13";
  const sectioned = (product.sections?.length ?? 0) > 0 || bt === "BT-07";

  const [date, setDate] = useState(initial?.slotDate ?? TODAY);
  const [slotTime, setSlotTime] = useState<string | undefined>(initial?.slotTime);
  const [resourceId, setResourceId] = useState<string | undefined>(initial?.resourceId);
  const [providerId, setProviderId] = useState<string | undefined>();
  const [duration, setDuration] = useState<number>(product.flexibleDurations?.[0] ?? 60);
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
              <button type="button" aria-label="Less" onClick={() => setAddOnQty((q) => ({ ...q, [a.id]: Math.max(0, (q[a.id] ?? 0) - 1) }))} className="h-10 w-10 rounded-sm border border-neutral-200 text-lg active:bg-neutral-200">−</button>
              <span className="w-6 text-center font-mono">{addOnQty[a.id] ?? 0}</span>
              <button type="button" aria-label="More" onClick={() => setAddOnQty((q) => ({ ...q, [a.id]: (q[a.id] ?? 0) + 1 }))} className="h-10 w-10 rounded-sm border border-neutral-200 text-lg active:bg-neutral-200">+</button>
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
  const flexTimes = flexible ? slotTimes(product.schedule ?? ({ slotMinutes: 60, sessionMinutes: 60, startTime: "06:00", endTime: "22:00", capacityPerSession: 1, dailyCapacity: null, openDays: [0, 1, 2, 3, 4, 5, 6], guideIds: [], exceptions: [] })) : [];

  const partySize = Object.values(qty).reduce((s, n) => s + n, 0);

  const dateBtn = (value: string, label: string) => (
    <button key={value} type="button" onClick={() => { setDate(value); setSlotTime(undefined); setResourceId(undefined); }} className={`h-10 rounded-sm border px-comfortable text-sm ${date === value ? "border-ink bg-ink text-paper" : "border-neutral-200 bg-white"}`}>{label}</button>
  );

  const submitTiered = () => {
    const list = sectioned ? (product.sections ?? []).map((s) => ({ id: s.id, name: s.name, price: s.price })) : activeTiers.map((t) => ({ id: t.id, name: t.name, price: t.price }));
    onAdd({
      id: initial?.id ?? `entry_${globalThis.crypto.randomUUID().slice(0, 8)}`,
      productId: product.id, productName: product.name,
      slotDate: needsSchedule(bt) && !resourceMode ? date : provider || course ? date : undefined,
      slotTime: (!resourceMode && slotTime) || undefined,
      providerLabel: provider ? providers.find((p) => p.id === providerId)?.name : undefined,
      items: [...list.filter((x) => qty[x.id] > 0).map((x) => ({ tierId: x.id, tierName: x.name, unitPrice: x.price, qty: qty[x.id] })), ...addOnItems()],
    });
  };

  const submitResource = (rId: string, rLabel: string, time: string, price: number) => {
    onAdd({
      id: initial?.id ?? `entry_${globalThis.crypto.randomUUID().slice(0, 8)}`,
      productId: product.id, productName: product.name,
      slotDate: date, slotTime: time, resourceId: rId, resourceLabel: rLabel,
      items: addOnItems(), fixedPrice: price,
    });
  };

  const submitFlexible = () => {
    if (!resourceId || !slotTime) return;
    const r = getResourceMatrix(product, date).find((row) => row.resource.id === resourceId);
    const price = resolveProductPrice(product, date, slotTime, basePrice);
    submitResource(resourceId, r?.resource.name ?? "", slotTime, price * (duration / 60));
  };

  const doWaitlist = async () => {
    if (!wl) return;
    await joinWaitlist({ productId: product.id, slotStart: slotISO(date, wl.time), name: wlName, phone: wlPhone });
    toast.success("Added to the waitlist.");
    onClose();
  };

  const canAddTiered = partySize > 0 && openToday && (provider ? !!providerId || !product.providerPickable : true) && (course || !needsSchedule(bt) || resourceMode ? true : !!slotTime);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden />
      <div className="relative z-10 max-h-[85vh] overflow-y-auto rounded-t-lg bg-paper p-section">
        <div className="mb-section flex items-center justify-between">
          <h2 className="type-h2 text-lg">{product.name}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-sm active:bg-neutral-200"><X size={20} strokeWidth={1.5} /></button>
        </div>

        {(needsSchedule(bt) || provider) && !course && (
          <div className="mb-section flex flex-wrap gap-tight">
            {dateBtn(TODAY, "Today")}
            {dateBtn(TOMORROW, "Tomorrow")}
            <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setSlotTime(undefined); setResourceId(undefined); }} className="h-10 rounded-sm border border-neutral-200 bg-white px-comfortable text-sm" />
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

        {/* Resource flexible: pick resource + start + duration */}
        {flexible && openToday && (
          <div className="mb-section flex flex-col gap-tight">
            <div className="flex flex-wrap gap-tight">{matrix.length === 0 ? getResourceMatrix(product, date).map((r) => <button key={r.resource.id} type="button" onClick={() => setResourceId(r.resource.id)} className={`h-10 rounded-sm border px-comfortable text-sm ${resourceId === r.resource.id ? "border-ink bg-ink text-paper" : "border-neutral-200 bg-white"}`}>{r.resource.name}</button>) : matrix.map((r) => <button key={r.resource.id} type="button" onClick={() => setResourceId(r.resource.id)} className={`h-10 rounded-sm border px-comfortable text-sm ${resourceId === r.resource.id ? "border-ink bg-ink text-paper" : "border-neutral-200 bg-white"}`}>{r.resource.name}</button>)}</div>
            <span className="type-label text-[11px] text-neutral-400">Start time</span>
            <div className="flex flex-wrap gap-inline">{flexTimes.map((t) => <button key={t} type="button" onClick={() => setSlotTime(t)} className={`h-10 rounded-sm border px-comfortable font-mono text-[13px] ${slotTime === t ? "border-ink bg-ink text-paper" : "border-neutral-200 bg-white"}`}>{t}</button>)}</div>
            <span className="type-label text-[11px] text-neutral-400">Duration</span>
            <div className="flex gap-tight">{(product.flexibleDurations ?? [60, 90, 120]).map((d) => <button key={d} type="button" onClick={() => setDuration(d)} className={`h-10 flex-1 rounded-sm border text-sm ${duration === d ? "border-ink bg-ink text-paper" : "border-neutral-200 bg-white"}`}>{d} min</button>)}</div>
            <Button size="lg" fullWidth className="mt-tight" disabled={!resourceId || !slotTime} onClick={submitFlexible}>Add to sale</Button>
          </div>
        )}

        {/* Provider cards */}
        {provider && (
          <div className="mb-section flex flex-col gap-tight">
            <div className="flex flex-wrap gap-tight">
              {product.providerPickable && providers.map((p) => (
                <button key={p.id} type="button" onClick={() => setProviderId(p.id)} className={`rounded-sm border px-comfortable py-tight text-sm ${providerId === p.id ? "border-ink bg-ink text-paper" : "border-neutral-200 bg-white"}`}>{p.name}</button>
              ))}
              <button type="button" onClick={() => setProviderId(undefined)} className={`rounded-sm border px-comfortable py-tight text-sm ${!providerId ? "border-ink bg-ink text-paper" : "border-neutral-200 bg-white"}`}>First available</button>
            </div>
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
              const full = left <= 0;
              const price = resolveProductPrice(product, date, s.time, basePrice);
              if (full && product.waitlistEnabled) {
                return <button key={s.time} type="button" onClick={() => setWl({ time: s.time })} className="flex h-16 flex-col items-center justify-center rounded-sm border border-warning bg-warning/10 text-warning"><span className="font-mono">{s.time}</span><span className="text-[10px]">Join waitlist</span></button>;
              }
              return <button key={s.time} type="button" disabled={full} onClick={() => setSlotTime(s.time)} className={`flex h-16 flex-col items-center justify-center gap-0.5 rounded-sm border text-sm ${full ? "border-neutral-200 bg-neutral-50 text-neutral-400" : slotTime === s.time ? "border-ink bg-ink text-paper" : "border-neutral-200 bg-white"}`}><span className="font-mono">{s.time}</span><span className="font-mono text-[11px]">{formatMoney(price, currency)}</span><span className="text-[10px] opacity-70">{full ? "FULL" : `${left} left`}</span></button>;
            })}
          </div>
        )}

        {bt === "BT-06" && openToday && <p className="mb-section font-mono text-[13px] text-neutral-600">{dailyLeft} left {date === TODAY ? "today" : "that day"}</p>}

        {/* Tier / section steppers (not for exclusive resource / flexible) */}
        {!resourceMode && (
          <>
            <div className="flex flex-col gap-tight">
              {(sectioned ? (product.sections ?? []).map((s) => ({ id: s.id, name: `${s.name}`, price: s.price, cap: s.capacity })) : activeTiers.map((t) => ({ id: t.id, name: t.name, price: t.price, cap: undefined }))).map((row) => (
                <div key={row.id} className="flex items-center justify-between rounded-sm border border-neutral-200 bg-white p-comfortable">
                  <div><div className="text-sm font-medium">{row.name}</div><div className="font-mono text-[12px] text-neutral-400">{formatMoney(row.price, currency)}{row.cap != null ? ` · ${row.cap} seats` : ""}</div></div>
                  <div className="flex items-center gap-tight">
                    <button type="button" aria-label="Less" onClick={() => setQty((q) => ({ ...q, [row.id]: Math.max(0, (q[row.id] ?? 0) - 1) }))} className="h-11 w-11 rounded-sm border border-neutral-200 text-lg active:bg-neutral-200">−</button>
                    <span className="w-8 text-center font-mono">{qty[row.id] ?? 0}</span>
                    <button type="button" aria-label="More" onClick={() => setQty((q) => ({ ...q, [row.id]: (q[row.id] ?? 0) + 1 }))} className="h-11 w-11 rounded-sm border border-neutral-200 text-lg active:bg-neutral-200">+</button>
                  </div>
                </div>
              ))}
            </div>
            {renderAddOns()}
            <Button size="lg" fullWidth className="mt-section" disabled={!canAddTiered} onClick={submitTiered}>{course ? "Enrol" : "Add to sale"}</Button>
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
