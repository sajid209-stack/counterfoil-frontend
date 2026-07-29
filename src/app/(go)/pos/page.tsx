"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getOperator, listLocations, listProducts, listStaff, type Product } from "@/lib/api";
import { isResourceType, isSlotBased, needsSchedule, slotISO } from "@/lib/schedule";
import { formatMoney } from "@/lib/format";
import { ProductSheet, type CartEntry } from "../_components/ProductSheet";

const TODAY = "2026-07-29";

export default function PosPage() {
  const router = useRouter();
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100, filters: { status: "active" } }), []);
  const opQ = useApiQuery(() => getOperator(), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 1, filters: { status: "active" } }), []);
  const teamQ = useApiQuery(() => listStaff({ pageSize: 100, filters: { status: "active" } }), []);
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [sheet, setSheet] = useState<{ product: Product; initial: CartEntry | null } | null>(null);

  const currency = opQ.data?.currency ?? "BDT";
  const taxPct = opQ.data?.taxRatePct ?? 0;
  const products = productsQ.data?.data ?? [];

  const entryTotal = (e: CartEntry) => (e.fixedPrice != null ? e.fixedPrice : e.items.reduce((s, i) => s + i.unitPrice * i.qty, 0));
  const entrySeats = (e: CartEntry) => (e.fixedPrice != null ? 1 : e.items.reduce((s, i) => s + i.qty, 0));
  const entrySlotISO = (e: CartEntry) =>
    e.slotDate ? (e.slotTime ? slotISO(e.slotDate, e.slotTime) : slotISO(e.slotDate, "10:00")) : undefined;

  const seatsInCart = (productId: string, slotStart: string) =>
    cart
      .filter((e) => e.id !== sheet?.initial?.id && e.productId === productId && entrySlotISO(e) === slotStart)
      .reduce((s, e) => s + entrySeats(e), 0);

  const tapProduct = (p: Product) => {
    const activeTiers = p.tiers.filter((t) => t.active);
    const needsSheet =
      needsSchedule(p.bookingType) || isResourceType(p.bookingType) ||
      p.bookingType === "BT-10" || p.bookingType === "BT-13" ||
      (p.sections?.length ?? 0) > 0 || activeTiers.length > 1;
    if (!needsSheet && activeTiers.length >= 1) {
      // Zero-friction: straight to cart (open/date-range/bundle/credits, single tier).
      const t = activeTiers[0];
      setCart((c) => [...c, { id: `entry_${globalThis.crypto.randomUUID().slice(0, 8)}`, productId: p.id, productName: p.name, items: [{ tierId: t.id, tierName: t.name, unitPrice: t.price, qty: 1 }] }]);
      return;
    }
    setSheet({ product: p, initial: null });
  };

  const upsertEntry = (entry: CartEntry) => {
    setCart((c) => (c.some((e) => e.id === entry.id) ? c.map((e) => (e.id === entry.id ? entry : e)) : [...c, entry]));
    setSheet(null);
  };

  const subtotal = cart.reduce((s, e) => s + entryTotal(e), 0);
  const tax = Math.round((subtotal * taxPct) / 100);
  const total = subtotal + tax;

  const charge = () => {
    const lines = cart.flatMap((e) =>
      e.items.length
        ? e.items.map((i) => ({ productId: e.productId, productName: e.productName, tierName: i.tierName, quantity: i.qty, unitPrice: i.unitPrice }))
        : e.fixedPrice != null
          ? [{ productId: e.productId, productName: e.productName, tierName: e.resourceLabel ?? e.slotTime ?? "Booking", quantity: 1, unitPrice: e.fixedPrice }]
          : [],
    );
    const bookings = cart
      .filter((e) => e.slotDate)
      .map((e) => ({ productId: e.productId, resourceId: e.resourceId ?? null, slotStart: entrySlotISO(e)!, partySize: entrySeats(e) }));
    sessionStorage.setItem("pos_cart", JSON.stringify({ total, taxPct, locationId: locationsQ.data?.data[0]?.id ?? "loc_fort", lines, bookings }));
    router.push("/pos/payment");
  };

  const slotLabel = (e: CartEntry) => {
    if (!e.slotDate) return "";
    const when = e.slotDate === TODAY ? "today" : e.slotDate;
    return e.slotTime ? ` · ${e.slotTime} ${when}` : ` · ${when}`;
  };

  return (
    <div className="grid h-full grid-cols-1 gap-tight p-tight lg:grid-cols-[1fr_22rem]">
      <div className="overflow-y-auto">
        {productsQ.loading ? (
          <p className="p-section text-[13px] text-neutral-400">Loading…</p>
        ) : (
          <div className="grid grid-cols-2 gap-tight sm:grid-cols-3">
            {products.map((p) => (
              <button key={p.id} type="button" onClick={() => tapProduct(p)} className="flex min-h-[5rem] flex-col justify-between rounded-sm border border-neutral-200 bg-white p-comfortable text-left active:bg-neutral-200">
                <span className="text-sm font-medium leading-tight">{p.name}</span>
                <span className="mt-tight flex items-center justify-between">
                  <span className="font-mono text-[11px] text-neutral-400">{isSlotBased(p.bookingType) ? "Pick a time" : needsSchedule(p.bookingType) ? "Pick a date" : p.tiers.filter((t) => t.active).length > 1 ? "Choose" : ""}</span>
                  <span className="font-mono text-[13px]">{formatMoney(Math.min(...p.tiers.filter((t) => t.active).map((t) => t.price)), currency)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col rounded-sm border border-neutral-200 bg-white">
        <div className="flex-1 overflow-y-auto p-comfortable">
          {cart.length === 0 ? (
            <EmptyState title="Empty cart" message="Tap a product to add it." />
          ) : (
            <div className="flex flex-col gap-tight">
              {cart.map((e) => (
                <div key={e.id} className="flex items-start gap-tight border-b border-neutral-200 pb-tight last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between text-sm font-medium"><span className="truncate">{e.productName}</span><span className="font-mono">{formatMoney(entryTotal(e), currency)}</span></div>
                    <div className="font-mono text-[11px] text-neutral-400">
                      {[e.items.map((i) => `${i.qty} ${i.tierName}`).join(" · "), e.resourceLabel, e.providerLabel].filter(Boolean).join(" · ")}{slotLabel(e)}
                    </div>
                  </div>
                  <button type="button" aria-label="Edit" onClick={() => setSheet({ product: products.find((p) => p.id === e.productId)!, initial: e })} className="flex h-9 w-9 items-center justify-center rounded-sm border border-neutral-200 active:bg-neutral-200"><Pencil size={15} strokeWidth={1.5} /></button>
                  <button type="button" aria-label="Remove" onClick={() => setCart((c) => c.filter((x) => x.id !== e.id))} className="flex h-9 w-9 items-center justify-center rounded-sm border border-neutral-200 text-danger active:bg-neutral-200"><Trash2 size={15} strokeWidth={1.5} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-neutral-200 p-comfortable">
          <div className="flex justify-between text-[13px] text-neutral-600"><span>Subtotal</span><span className="font-mono">{formatMoney(subtotal, currency)}</span></div>
          <div className="flex justify-between text-[13px] text-neutral-600"><span>Tax ({taxPct}%)</span><span className="font-mono">{formatMoney(tax, currency)}</span></div>
          <div className="mt-tight flex justify-between text-lg font-medium"><span>Total</span><span className="font-mono">{formatMoney(total, currency)}</span></div>
          <Button size="lg" fullWidth className="mt-tight" disabled={cart.length === 0} onClick={charge}>
            Charge {cart.length > 0 ? formatMoney(total, currency) : ""}
          </Button>
        </div>
      </div>

      {sheet && (
        <ProductSheet
          product={sheet.product}
          currency={currency}
          initial={sheet.initial}
          seatsInCart={seatsInCart}
          onAdd={upsertEntry}
          onClose={() => setSheet(null)}
          team={teamQ.data?.data ?? []}
        />
      )}
    </div>
  );
}
