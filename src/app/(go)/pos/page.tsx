"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button, EmptyState, FormField, Modal, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { checkout, findCreditPass, getOperator, isResourceFreeFor, listCategories, listLocations, listProducts, listResources, listStaff, type CreditPass, type PaymentMethod, type Product } from "@/lib/api";
import { isResourceType, needsSchedule, slotISO, toMinutes, toTime } from "@/lib/schedule";
import { productDurationPrice } from "@/lib/duration";
import { behaviourSubtitle } from "@/lib/behaviour";
import { taxRateFor } from "@/lib/tax";
import { formatMoney } from "@/lib/format";
import { ProductSheet, type CartEntry } from "../_components/ProductSheet";

const TODAY = "2026-07-29";
// Payment methods this counter takes (would come from counter config).
const COUNTER_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bkash", label: "bKash" },
  { value: "bangla_qr", label: "QR" },
  { value: "card_terminal", label: "Card" },
];
// Mock: the signed-in staff's discount limit (roles already carry this).
const DISCOUNT_LIMIT_PCT = 10;

export default function PosPage() {
  const router = useRouter();
  const toast = useToast();
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100, filters: { status: "active" } }), []);
  const opQ = useApiQuery(() => getOperator(), []);
  const catsQ = useApiQuery(() => listCategories({ pageSize: 100 }), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 1, filters: { status: "active" } }), []);
  const teamQ = useApiQuery(() => listStaff({ pageSize: 100, filters: { status: "active" } }), []);
  const resourcesQ = useApiQuery(() => listResources({ pageSize: 100 }), []);

  const [cart, setCart] = useState<CartEntry[]>([]);
  const [sheet, setSheet] = useState<{ product: Product; initial: CartEntry | null } | null>(null);
  const [category, setCategory] = useState("all");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [discountPct, setDiscountPct] = useState(0);
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [pass, setPass] = useState<CreditPass | null>(null);
  const [passOpen, setPassOpen] = useState(false);
  const [passCode, setPassCode] = useState("");
  const [passLoading, setPassLoading] = useState(false);

  const operator = opQ.data;
  const currency = operator?.currency ?? "BDT";
  const products = productsQ.data?.data ?? [];
  const categories = catsQ.data?.data ?? [];
  const resources = resourcesQ.data?.data ?? [];
  const productById = (id: string) => products.find((p) => p.id === id);

  const shown = category === "all" ? products : products.filter((p) => p.categoryId === category);

  // Deep-link from the Schedule tab: open a product's sheet on arrival.
  useEffect(() => {
    const id = sessionStorage.getItem("pos_open_product");
    if (id && products.length) {
      sessionStorage.removeItem("pos_open_product");
      const p = products.find((x) => x.id === id);
      if (p) setSheet({ product: p, initial: null });
    }
  }, [products]);

  const entryTotal = (e: CartEntry) => (e.fixedPrice ?? 0) + e.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  // Party size = people admitted, not lines: tier admits (Family = 4) and
  // section seats count; add-ons and premiums don't.
  const entrySeats = (e: CartEntry) => {
    if (e.fixedPrice != null) return 1;
    const p = productById(e.productId);
    const seats = e.items.reduce((s, i) => {
      const tier = p?.tiers.find((t) => t.id === i.tierId);
      if (tier) return s + i.qty * (tier.admits ?? 1);
      if (p?.sections?.some((sec) => sec.id === i.tierId)) return s + i.qty;
      return s;
    }, 0);
    return seats > 0 ? seats : e.items.reduce((s, i) => s + i.qty, 0);
  };
  const entrySlotISO = (e: CartEntry) => (e.slotDate ? (e.slotTime ? slotISO(e.slotDate, e.slotTime) : slotISO(e.slotDate, "10:00")) : undefined);
  const entryTaxRate = (e: CartEntry) => { const p = productById(e.productId); return p ? taxRateFor(p, operator) : 0; };

  const seatsInCart = (productId: string, slotStart: string) =>
    cart.filter((e) => e.id !== sheet?.initial?.id && e.productId === productId && entrySlotISO(e) === slotStart).reduce((s, e) => s + entrySeats(e), 0);

  const tapProduct = (p: Product) => {
    const activeTiers = p.tiers.filter((t) => t.active);
    const needsSheet = needsSchedule(p.bookingType) || isResourceType(p.bookingType) || p.bookingType === "BT-10" || p.bookingType === "BT-13" || (p.sections?.length ?? 0) > 0 || activeTiers.length > 1;
    if (!needsSheet && activeTiers.length >= 1) {
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

  // Extend a flexible booking still in the cart by one increment: the lane
  // behind must be free (buffer included) and the new length re-prices.
  const extendEntry = (e: CartEntry) => {
    const p = productById(e.productId);
    const cfg = p?.durationConfig;
    if (!p || !cfg || !e.slotDate || !e.slotTime || !e.slotEnd || !e.resourceId || e.fixedPrice == null) return;
    const endTime = e.slotEnd.slice(11, 16);
    const current = toMinutes(endTime) - toMinutes(e.slotTime);
    const next = current + cfg.incrementMinutes;
    if (next > cfg.maxMinutes) { toast.error(`${cfg.maxMinutes / 60} hours is the maximum.`); return; }
    if (!isResourceFreeFor(e.resourceId, e.slotDate, endTime, cfg.incrementMinutes, p.bufferMinutes ?? 0)) {
      toast.error(`${e.resourceLabel ?? "The lane"} is booked right after — can't extend.`);
      return;
    }
    const base = Math.min(...p.tiers.filter((t) => t.active).map((t) => t.price));
    const price = productDurationPrice(p, e.slotDate, e.slotTime, next, base);
    const newEnd = `${e.slotDate}T${toTime(toMinutes(e.slotTime) + next)}:00+06:00`;
    setCart((c) => c.map((x) => (x.id === e.id ? { ...x, slotEnd: newEnd, fixedPrice: price } : x)));
    toast.success(`Extended to ${toTime(toMinutes(e.slotTime) + next)} · ${formatMoney(price, currency)}.`);
  };

  const addCustom = () => {
    const minor = Math.round((parseFloat(customAmount) || 0) * 100);
    if (minor <= 0) return;
    setCart((c) => [...c, { id: `entry_${globalThis.crypto.randomUUID().slice(0, 8)}`, productId: "custom", productName: customName || "Custom amount", items: [{ tierId: "custom", tierName: "Custom", unitPrice: minor, qty: 1 }] }]);
    setCustomOpen(false); setCustomName(""); setCustomAmount("");
  };

  // ── Credits pass coverage: eligible items are paid by credits, oldest cart
  //    entries first, until the pass runs out. Covered items sell at 0.
  const coverage = (() => {
    const map = new Map<string, number>(); // `${entryId}|${tierId}` → qty covered
    if (!pass) return map;
    let left = pass.remaining;
    for (const e of cart) {
      if (e.fixedPrice != null || !pass.productIds.includes(e.productId)) continue;
      for (const i of e.items) {
        if (left <= 0) break;
        if (i.unitPrice <= 0) continue;
        const c = Math.min(i.qty, left);
        map.set(`${e.id}|${i.tierId}`, c);
        left -= c;
      }
    }
    return map;
  })();
  const entryCoveredQty = (e: CartEntry) => e.items.reduce((s, i) => s + (coverage.get(`${e.id}|${i.tierId}`) ?? 0), 0);
  const entryCoveredValue = (e: CartEntry) => e.items.reduce((s, i) => s + (coverage.get(`${e.id}|${i.tierId}`) ?? 0) * i.unitPrice, 0);
  const creditsUsed = cart.reduce((s, e) => s + entryCoveredQty(e), 0);
  const creditsValue = cart.reduce((s, e) => s + entryCoveredValue(e), 0);

  const subtotal = cart.reduce((s, e) => s + entryTotal(e), 0);
  const discount = Math.round((subtotal * discountPct) / 100);
  const tax = cart.reduce((s, e) => s + Math.round(((entryTotal(e) - entryCoveredValue(e)) * entryTaxRate(e)) / 100), 0);
  const total = subtotal - discount - creditsValue + tax;
  const overLimit = discountPct > DISCOUNT_LIMIT_PCT;

  // ── Deposits: a percent-deposit policy holds part of the entry back until
  //    arrival; only the deposit is charged now.
  const entryBalance = (e: CartEntry) => {
    const pol = productById(e.productId)?.policies;
    if (pol?.deposit !== "percent" || pol.depositPct <= 0) return 0;
    const payable = entryTotal(e) - entryCoveredValue(e);
    return Math.max(0, payable - Math.round((payable * pol.depositPct) / 100));
  };
  const balance = cart.reduce((s, e) => s + entryBalance(e), 0);
  const dueNow = total - balance;

  const applyPass = async () => {
    setPassLoading(true);
    const res = await findCreditPass(passCode);
    setPassLoading(false);
    if (res.ok) { setPass(res.data); setPassOpen(false); setPassCode(""); }
    else toast.error(res.error.message);
  };

  const charge = async () => {
    const lines = cart.flatMap((e) => {
      const rate = entryTaxRate(e);
      if (e.items.length) {
        // Pass-covered quantities split off as 0-price lines (untaxed).
        return e.items.flatMap((i) => {
          const cov = coverage.get(`${e.id}|${i.tierId}`) ?? 0;
          const out = [];
          if (i.qty - cov > 0) out.push({ productId: e.productId, productName: e.productName, tierName: i.tierName, quantity: i.qty - cov, unitPrice: i.unitPrice, taxRatePct: rate });
          if (cov > 0) out.push({ productId: e.productId, productName: e.productName, tierName: `${i.tierName} · pass`, quantity: cov, unitPrice: 0, taxRatePct: 0 });
          return out;
        });
      }
      return e.fixedPrice != null
        ? [{ productId: e.productId, productName: e.productName, tierName: e.resourceLabel ?? e.slotTime ?? "Booking", quantity: 1, unitPrice: e.fixedPrice, taxRatePct: rate }]
        : [];
    });
    if (discount > 0) lines.push({ productId: "discount", productName: "Discount", tierName: `${discountPct}%`, quantity: 1, unitPrice: -discount, taxRatePct: 0 });
    const bookings = cart.filter((e) => e.slotDate).map((e) => ({ productId: e.productId, resourceId: e.resourceId ?? null, slotStart: entrySlotISO(e)!, slotEnd: e.slotEnd, partySize: entrySeats(e) }));
    const credits = pass && creditsUsed > 0 ? { ticketId: pass.ticketId, count: creditsUsed } : null;
    const payload = { total, dueNow, balance, taxPct: operator?.taxRatePct ?? 0, locationId: locationsQ.data?.data[0]?.id ?? "loc_fort", lines, bookings, method, credits };

    if (method === "cash") {
      sessionStorage.setItem("pos_cart", JSON.stringify(payload));
      router.push("/pos/payment");
      return;
    }
    // Non-cash: settle inline, no change step.
    const res = await checkout({ channel: "counter", locationId: payload.locationId, counterId: null, staffId: null, lines, bookings, taxPct: payload.taxPct, method, amountTendered: dueNow, payNow: dueNow, credits });
    if (res.ok) {
      sessionStorage.setItem("pos_complete", JSON.stringify({ code: res.data.firstTicketCode, change: 0, balance }));
      router.push("/pos/complete");
    } else toast.error(res.error.message);
  };

  const slotLabel = (e: CartEntry) => (!e.slotDate ? "" : e.slotTime ? ` · ${e.slotTime} ${e.slotDate === TODAY ? "today" : e.slotDate}` : ` · ${e.slotDate === TODAY ? "today" : e.slotDate}`);
  const methodLabel = COUNTER_METHODS.find((m) => m.value === method)?.label ?? "";

  return (
    <div className="grid h-full grid-cols-1 gap-tight p-tight lg:grid-cols-[1fr_23rem]">
      <div className="flex min-h-0 flex-col gap-tight">
        {/* Category chips */}
        <div className="flex gap-inline overflow-x-auto pb-inline">
          {[{ id: "all", name: "All" }, ...categories].map((c) => (
            <button key={c.id} type="button" onClick={() => setCategory(c.id)} className={`h-9 shrink-0 rounded-sm border px-comfortable text-sm ${category === c.id ? "border-ink bg-ink text-paper" : "border-neutral-200 bg-white"}`}>{c.name}</button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {productsQ.loading ? (
            <p className="p-section text-[13px] text-neutral-400">Loading…</p>
          ) : (
            <div className="grid grid-cols-2 gap-tight sm:grid-cols-3">
              {shown.map((p) => (
                <button key={p.id} type="button" onClick={() => tapProduct(p)} className="flex min-h-[5.5rem] flex-col justify-between rounded-sm border border-neutral-200 border-t-2 border-t-ember bg-white p-comfortable text-left active:bg-neutral-200">
                  <div>
                    <span className="text-sm font-semibold leading-tight">{p.name}</span>
                    <span className="mt-inline block font-mono text-[10px] leading-tight text-neutral-400">{behaviourSubtitle(p, { resources, team: teamQ.data?.data })}</span>
                  </div>
                  <span className="mt-tight font-mono text-[13px]">{formatMoney(Math.min(...(p.tiers.filter((t) => t.active).map((t) => t.price).concat(p.sections?.map((s) => s.price) ?? []).concat([Infinity]))), currency)}</span>
                </button>
              ))}
              <button type="button" onClick={() => setCustomOpen(true)} className="flex min-h-[5.5rem] flex-col items-center justify-center gap-inline rounded-sm border border-dashed border-neutral-200 text-neutral-400 active:bg-neutral-200">
                <Plus size={20} strokeWidth={1.5} /><span className="text-[12px]">Custom amount</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cart */}
      <div className="flex min-h-0 flex-col rounded-sm border border-neutral-200 bg-white">
        <div className="flex-1 overflow-y-auto p-comfortable">
          {cart.length === 0 ? (
            <EmptyState title="Empty cart" message="Tap a product to add it." />
          ) : (
            <div className="flex flex-col gap-tight">
              {cart.map((e) => (
                <div key={e.id} className="flex items-start gap-tight border-b border-neutral-200 pb-tight last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between text-sm font-medium"><span className="truncate">{e.productName}</span><span className="font-mono">{formatMoney(entryTotal(e), currency)}</span></div>
                    <div className="font-mono text-[11px] text-neutral-400">{[e.items.map((i) => `${i.qty} ${i.tierName}`).join(" · "), e.resourceLabel, e.providerLabel].filter(Boolean).join(" · ")}{slotLabel(e)}</div>
                    {entryCoveredQty(e) > 0 && <div className="font-mono text-[11px] text-success">{entryCoveredQty(e)} paid with pass</div>}
                    {entryBalance(e) > 0 && <div className="font-mono text-[11px] text-neutral-400">{productById(e.productId)?.policies?.depositPct}% deposit now · {formatMoney(entryBalance(e), currency)} at arrival</div>}
                  </div>
                  {productById(e.productId)?.durationConfig && e.fixedPrice != null && e.slotEnd && (
                    <button type="button" onClick={() => extendEntry(e)} className="flex h-9 items-center justify-center rounded-sm border border-neutral-200 px-tight font-mono text-[11px] active:bg-neutral-200">
                      +{productById(e.productId)!.durationConfig!.incrementMinutes}m
                    </button>
                  )}
                  {e.productId !== "custom" && <button type="button" aria-label="Edit" onClick={() => setSheet({ product: productById(e.productId)!, initial: e })} className="flex h-9 w-9 items-center justify-center rounded-sm border border-neutral-200 active:bg-neutral-200"><Pencil size={15} strokeWidth={1.5} /></button>}
                  <button type="button" aria-label="Remove" onClick={() => setCart((c) => c.filter((x) => x.id !== e.id))} className="flex h-9 w-9 items-center justify-center rounded-sm border border-neutral-200 text-danger active:bg-neutral-200"><Trash2 size={15} strokeWidth={1.5} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-neutral-200 p-comfortable">
          {/* Discount */}
          <div className="mb-tight flex items-center justify-between">
            <span className="text-[13px] text-neutral-600">Discount</span>
            <div className="flex items-center gap-inline">
              {[0, 5, 10, 15].map((d) => <button key={d} type="button" onClick={() => setDiscountPct(d)} className={`h-8 rounded-xs border px-tight font-mono text-[12px] ${discountPct === d ? "border-ink bg-ink text-paper" : "border-neutral-200"}`}>{d}%</button>)}
            </div>
          </div>
          {overLimit && <p className="mb-tight text-[12px] text-danger">Over your {DISCOUNT_LIMIT_PCT}% limit — ask a manager.</p>}

          {/* Credits pass */}
          <div className="mb-tight flex items-center justify-between">
            <span className="text-[13px] text-neutral-600">Pass</span>
            {pass ? (
              <span className="flex items-center gap-inline font-mono text-[11px]">
                <span>{pass.code} · {creditsUsed} used · {pass.remaining - creditsUsed} left</span>
                <button type="button" aria-label="Remove pass" onClick={() => setPass(null)} className="text-danger">✕</button>
              </span>
            ) : (
              <button type="button" onClick={() => setPassOpen(true)} className="h-8 rounded-xs border border-neutral-200 px-tight text-[12px]">Redeem a pass</button>
            )}
          </div>

          <div className="flex justify-between text-[13px] text-neutral-600"><span>Subtotal</span><span className="font-mono">{formatMoney(subtotal, currency)}</span></div>
          {discount > 0 && <div className="flex justify-between text-[13px] text-neutral-600"><span>Discount</span><span className="font-mono text-danger">−{formatMoney(discount, currency)}</span></div>}
          {creditsValue > 0 && <div className="flex justify-between text-[13px] text-neutral-600"><span>Pass · {creditsUsed} credits</span><span className="font-mono text-success">−{formatMoney(creditsValue, currency)}</span></div>}
          <div className="flex justify-between text-[13px] text-neutral-600"><span>VAT</span><span className="font-mono">{formatMoney(tax, currency)}</span></div>
          <div className="mt-tight flex justify-between text-lg font-medium"><span>Total</span><span className="font-mono">{formatMoney(total, currency)}</span></div>
          {balance > 0 && (
            <>
              <div className="flex justify-between text-[13px]"><span>Due now</span><span className="font-mono">{formatMoney(dueNow, currency)}</span></div>
              <div className="flex justify-between text-[13px] text-neutral-600"><span>Balance at arrival</span><span className="font-mono">{formatMoney(balance, currency)}</span></div>
            </>
          )}

          {/* Payment method selector */}
          <div className="mt-tight flex gap-inline">
            {COUNTER_METHODS.map((m) => <button key={m.value} type="button" onClick={() => setMethod(m.value)} className={`h-9 flex-1 rounded-xs border text-[12px] ${method === m.value ? "border-ink bg-ink text-paper" : "border-neutral-200"}`}>{m.label}</button>)}
          </div>

          <Button size="lg" fullWidth className="mt-tight" disabled={cart.length === 0 || overLimit} onClick={charge}>
            {cart.length > 0 ? `Charge ${formatMoney(dueNow, currency)} — ${methodLabel}` : "Charge"}
          </Button>
        </div>
      </div>

      {sheet && <ProductSheet product={sheet.product} currency={currency} initial={sheet.initial} seatsInCart={seatsInCart} onAdd={upsertEntry} onClose={() => setSheet(null)} team={teamQ.data?.data ?? []} />}

      <Modal open={customOpen} onClose={() => setCustomOpen(false)} title="Custom amount" footer={<><Button variant="secondary" onClick={() => setCustomOpen(false)}>Cancel</Button><Button onClick={addCustom} disabled={!customAmount}>Add</Button></>}>
        <div className="flex flex-col gap-section">
          <FormField label="Description" placeholder="Miscellaneous" value={customName} onChange={(e) => setCustomName(e.target.value)} />
          <FormField label={`Amount (${currency})`} variant="number" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} />
        </div>
      </Modal>

      <Modal open={passOpen} onClose={() => setPassOpen(false)} title="Redeem a pass" footer={<><Button variant="secondary" onClick={() => setPassOpen(false)}>Cancel</Button><Button onClick={applyPass} disabled={!passCode.trim()} loading={passLoading}>Apply</Button></>}>
        <div className="flex flex-col gap-section">
          <FormField label="Pass code" placeholder="CF-2026-000123-01" value={passCode} onChange={(e) => setPassCode(e.target.value)} help="The code on the customer's credits pack ticket. Eligible items in the cart are paid with credits." />
        </div>
      </Modal>
    </div>
  );
}
