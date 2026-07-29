"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui";
import { getDailyRemaining, getSlots, isOpenOn, type Product } from "@/lib/api";
import { slotISO } from "@/lib/schedule";
import { isSlotBased, needsSchedule } from "@/lib/schedule";
import { resolveProductPrice } from "@/lib/pricing";
import { formatMoney } from "@/lib/format";

export interface CartEntry {
  id: string;
  productId: string;
  productName: string;
  slotDate?: string;
  slotTime?: string;
  items: { tierId: string; tierName: string; unitPrice: number; qty: number }[];
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
}: {
  product: Product;
  currency: string;
  initial: CartEntry | null;
  /** seats already in the cart for a given product + slotISO (excluding the entry being edited) */
  seatsInCart: (productId: string, slotStart: string) => number;
  onAdd: (entry: CartEntry) => void;
  onClose: () => void;
}) {
  const activeTiers = product.tiers.filter((t) => t.active);
  const slotBased = isSlotBased(product.bookingType);
  const capped = needsSchedule(product.bookingType) && !slotBased;

  const [date, setDate] = useState(initial?.slotDate ?? TODAY);
  const [slotTime, setSlotTime] = useState<string | undefined>(initial?.slotTime);
  const [qty, setQty] = useState<Record<string, number>>(() => {
    const q: Record<string, number> = {};
    activeTiers.forEach((t) => (q[t.id] = initial?.items.find((i) => i.tierId === t.id)?.qty ?? 0));
    return q;
  });

  const slots = useMemo(() => (slotBased ? getSlots(product, date) : []), [product, date, slotBased]);
  const dailyLeft = capped ? getDailyRemaining(product, date) : Infinity;
  const partySize = Object.values(qty).reduce((s, n) => s + n, 0);

  const slotRemaining = (() => {
    if (!slotBased || !slotTime) return Infinity;
    const s = slots.find((x) => x.time === slotTime);
    if (!s) return 0;
    return s.remaining - seatsInCart(product.id, slotISO(date, slotTime));
  })();

  const total = activeTiers.reduce((s, t) => s + t.price * (qty[t.id] ?? 0), 0);
  const openToday = isOpenOn(product, date);
  const canAdd =
    partySize > 0 &&
    openToday &&
    (slotBased ? !!slotTime && partySize <= slotRemaining : capped ? partySize <= dailyLeft : true);

  const submit = () => {
    onAdd({
      id: initial?.id ?? `entry_${globalThis.crypto.randomUUID().slice(0, 8)}`,
      productId: product.id,
      productName: product.name,
      slotDate: needsSchedule(product.bookingType) ? date : undefined,
      slotTime: slotBased ? slotTime : undefined,
      items: activeTiers.filter((t) => qty[t.id] > 0).map((t) => ({ tierId: t.id, tierName: t.name, unitPrice: t.price, qty: qty[t.id] })),
    });
  };

  const dateBtn = (value: string, label: string) => (
    <button type="button" onClick={() => { setDate(value); setSlotTime(undefined); }} className={`h-10 rounded-sm border px-comfortable text-sm ${date === value ? "border-ink bg-ink text-paper" : "border-neutral-200 bg-white"}`}>
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden />
      <div className="relative z-10 max-h-[85vh] overflow-y-auto rounded-t-lg bg-paper p-section">
        <div className="mb-section flex items-center justify-between">
          <h2 className="type-h2 text-lg">{product.name}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-sm active:bg-neutral-200"><X size={20} strokeWidth={1.5} /></button>
        </div>

        {needsSchedule(product.bookingType) && (
          <div className="mb-section flex flex-wrap gap-tight">
            {dateBtn(TODAY, "Today")}
            {dateBtn(TOMORROW, "Tomorrow")}
            <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setSlotTime(undefined); }} className="h-10 rounded-sm border border-neutral-200 bg-white px-comfortable text-sm" />
          </div>
        )}

        {!openToday && <p className="mb-section text-[13px] text-danger">Closed on this date. Pick another.</p>}

        {slotBased && openToday && (
          <div className="mb-section grid grid-cols-3 gap-tight sm:grid-cols-4">
            {slots.map((s) => {
              const left = s.remaining - seatsInCart(product.id, slotISO(date, s.time));
              const full = left <= 0;
              const price = resolveProductPrice(product, date, s.time, Math.min(...activeTiers.map((t) => t.price)));
              return (
                <button key={s.time} type="button" disabled={full} onClick={() => setSlotTime(s.time)} className={`flex h-16 flex-col items-center justify-center gap-0.5 rounded-sm border text-sm ${full ? "border-neutral-200 bg-neutral-50 text-neutral-400" : slotTime === s.time ? "border-ink bg-ink text-paper" : "border-neutral-200 bg-white"}`}>
                  <span className="font-mono">{s.time}</span>
                  <span className="font-mono text-[11px]">{formatMoney(price, currency)}</span>
                  <span className="text-[10px] opacity-70">{full ? "FULL" : `${left} left`}</span>
                </button>
              );
            })}
          </div>
        )}

        {capped && openToday && (
          <p className="mb-section font-mono text-[13px] text-neutral-600">{dailyLeft} left {date === TODAY ? "today" : "that day"}</p>
        )}

        {/* Tier steppers */}
        <div className="flex flex-col gap-tight">
          {activeTiers.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-sm border border-neutral-200 bg-white p-comfortable">
              <div>
                <div className="text-sm font-medium">{t.name}</div>
                <div className="font-mono text-[12px] text-neutral-400">{formatMoney(t.price, currency)}</div>
              </div>
              <div className="flex items-center gap-tight">
                <button type="button" aria-label="Less" onClick={() => setQty((q) => ({ ...q, [t.id]: Math.max(0, (q[t.id] ?? 0) - 1) }))} className="h-11 w-11 rounded-sm border border-neutral-200 text-lg active:bg-neutral-200">−</button>
                <span className="w-8 text-center font-mono">{qty[t.id] ?? 0}</span>
                <button type="button" aria-label="More" onClick={() => setQty((q) => ({ ...q, [t.id]: (q[t.id] ?? 0) + 1 }))} className="h-11 w-11 rounded-sm border border-neutral-200 text-lg active:bg-neutral-200">+</button>
              </div>
            </div>
          ))}
        </div>

        {slotBased && slotTime && partySize > slotRemaining && (
          <p className="mt-tight text-[13px] text-danger">Only {slotRemaining} seats left at {slotTime}.</p>
        )}
        {capped && partySize > dailyLeft && (
          <p className="mt-tight text-[13px] text-danger">Only {dailyLeft} left on this date.</p>
        )}

        <Button size="lg" fullWidth className="mt-section" disabled={!canAdd} onClick={submit}>
          Add to sale{total > 0 ? ` · ${formatMoney(total, currency)}` : ""}
        </Button>
      </div>
    </div>
  );
}
