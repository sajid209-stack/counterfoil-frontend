"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Pencil, Plus, Search, Trash2, UserRound } from "lucide-react";
import { BlockedNotice, Button, EmptyState, FormField, Modal, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { checkout, findCreditPass, getOperator, isResourceFreeFor, listCategories, listLocations, listProducts, listResources, listRoles, listStaff, logOrderAction, type CheckoutLine, type CreditPass, type PaymentMethod, type Product } from "@/lib/api";
import { buildOrderLines } from "@/lib/orderMath";
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
// The signed-in staff member (mock session): Nadia, whose role sets her limits.
const SIGNED_IN_STAFF_ID = "stf_nadia";

/** Animated money value (120ms count) — the cart total moves, staff notice. */
function AnimatedMoney({ value, currency }: { value: number; currency: string }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const from = shown;
    if (from === value) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 120);
      setShown(Math.round(from + (value - from) * p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <span className="font-mono text-2xl tabular-nums">{formatMoney(shown, currency)}</span>;
}

export default function PosPage() {
  const router = useRouter();
  const toast = useToast();
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100, filters: { status: "active" } }), []);
  const opQ = useApiQuery(() => getOperator(), []);
  const catsQ = useApiQuery(() => listCategories({ pageSize: 100 }), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 1, filters: { status: "active" } }), []);
  const teamQ = useApiQuery(() => listStaff({ pageSize: 100, filters: { status: "active" } }), []);
  const resourcesQ = useApiQuery(() => listResources({ pageSize: 100 }), []);
  const rolesQ = useApiQuery(() => listRoles({ pageSize: 100 }), []);

  // "Ask a manager" gating reads the signed-in staff's ROLE — no hardcoded cap.
  const myRole = rolesQ.data?.data.find((r) => r.id === teamQ.data?.data.find((s) => s.id === SIGNED_IN_STAFF_ID)?.roleId);
  const discountLimit = myRole?.discountLimitPct ?? Infinity;

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
  const [query, setQuery] = useState("");
  const [customTax, setCustomTax] = useState<"standard" | "reduced" | "exempt">("standard");
  const [customer, setCustomer] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerDraft, setCustomerDraft] = useState("");
  // Parked carts survive navigation within the session (sessionStorage).
  type Parked = { name: string; cart: CartEntry[]; discountPct: number; customer: string; pass: CreditPass | null };
  const [parked, setParked] = useState<Parked[]>(() => {
    try { return JSON.parse(sessionStorage.getItem("pos_parked") ?? "[]"); } catch { return []; }
  });
  const [parkOpen, setParkOpen] = useState(false);
  const [parkName, setParkName] = useState("");
  const [cartOpen, setCartOpen] = useState(false); // phone cart drawer
  const [cartNotice, setCartNotice] = useState<string | null>(null); // refusal guidance
  // Non-cash simulated flow: bKash asks for the transaction ID, QR shows the
  // code to scan. Both pass pending → confirmed | failed before the sale lands.
  const [nc, setNc] = useState<null | { method: "bkash" | "bangla_qr"; state: "pending" | "confirmed" | "failed"; txn: string }>(null);
  const persistParked = (list: Parked[]) => { setParked(list); sessionStorage.setItem("pos_parked", JSON.stringify(list)); };
  const park = () => {
    if (cart.length === 0) return;
    persistParked([...parked, { name: parkName.trim() || `Guest ${parked.length + 1}`, cart, discountPct, customer, pass }]);
    setCart([]); setDiscountPct(0); setCustomer(""); setPass(null);
    setParkOpen(false); setParkName("");
    toast.success("Cart parked.");
  };
  const resume = (i: number) => {
    const p = parked[i];
    if (!p) return;
    setCart(p.cart); setDiscountPct(p.discountPct); setCustomer(p.customer); setPass(p.pass);
    persistParked(parked.filter((_, x) => x !== i));
    setParkOpen(false);
  };

  const operator = opQ.data;
  const currency = operator?.currency ?? "BDT";
  const products = productsQ.data?.data ?? [];
  const categories = catsQ.data?.data ?? [];
  const resources = resourcesQ.data?.data ?? [];
  const productById = (id: string) => products.find((p) => p.id === id);

  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "";
  const shown = products
    .filter((p) => p.bookingType !== "BT-14") // field passes issue from Quick pass, not the grid
    .filter((p) => category === "all" || p.categoryId === category)
    .filter((p) => {
      const q = query.trim().toLowerCase();
      return !q || p.name.toLowerCase().includes(q) || catName(p.categoryId).toLowerCase().includes(q);
    });

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
    if (e.fixedPrice != null) return e.partySize ?? 1;
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
  const entryTaxRate = (e: CartEntry) => {
    if (e.taxRatePct != null) return e.taxRatePct; // custom-amount entries
    const p = productById(e.productId);
    return p ? taxRateFor(p, operator) : 0;
  };

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
    if (next > cfg.maxMinutes) { setCartNotice(`${cfg.maxMinutes / 60} hours is the maximum booking — start a second booking for longer.`); return; }
    if (!isResourceFreeFor(e.resourceId, e.slotDate, endTime, cfg.incrementMinutes, p.bufferMinutes ?? 0)) {
      setCartNotice(`Can't extend — ${e.resourceLabel ?? "the lane"} is booked right after ${endTime}. Try another lane or keep the current time.`);
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
    const rate = customTax === "exempt" ? 0 : customTax === "reduced" ? (operator?.reducedRatePct ?? 0) : (operator?.taxRatePct ?? 0);
    setCart((c) => [...c, { id: `entry_${globalThis.crypto.randomUUID().slice(0, 8)}`, productId: "custom", productName: customName || "Custom amount", taxRatePct: rate, items: [{ tierId: "custom", tierName: "Custom", unitPrice: minor, qty: 1 }] }]);
    setCustomOpen(false); setCustomName(""); setCustomAmount(""); setCustomTax("standard");
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

  // ── F11: the cart IS order lines. One inputs builder feeds the shared order
  //    engine (lib/orderMath) for both the live totals and the settle payload,
  //    so what the cart shows is exactly what the order records.
  const buildInputs = (): CheckoutLine[] => {
    const inputs: CheckoutLine[] = [];
    for (const e of cart) {
      const p = productById(e.productId);
      const rate = entryTaxRate(e) / 100;
      const taxClass = e.taxRatePct != null ? (e.taxRatePct === 0 ? "exempt" : "standard") : (p?.taxClass ?? "standard");
      const ld = e.lineDiscountPct ?? 0;
      const pctOf = (base: number) => (ld > 0 ? Math.round((base * ld) / 100) : 0);
      const addOnOf = (tierId: string) => p?.addOns?.find((a) => a.id === tierId);
      let parentIdx: number | null = null;

      if (e.fixedPrice != null) {
        // The booking line — a resource/provider span, one unit admitting the group.
        parentIdx = inputs.length;
        const dur = e.slotTime && e.slotEnd ? toMinutes(e.slotEnd.slice(11, 16)) - toMinutes(e.slotTime) : undefined;
        inputs.push({
          productId: e.productId, productName: e.productName,
          tierName: e.resourceLabel ?? e.providerLabel ?? e.slotTime ?? "Booking",
          admits: entrySeats(e), quantity: 1, unitPrice: e.fixedPrice,
          lineDiscount: pctOf(e.fixedPrice),
          taxClass, taxRate: rate,
          booking: e.slotDate ? {
            date: e.slotDate, startTime: e.slotTime, endTime: e.slotEnd?.slice(11, 16),
            resourceId: e.resourceId, resourceName: e.resourceLabel, providerName: e.providerLabel,
            guests: entrySeats(e), durationMinutes: dur && dur > 0 ? dur : undefined,
          } : undefined,
        });
      }

      // Tier / section / premium / custom items. Pass-covered quantities split
      // into their own 0-price untaxed lines. The entry's first tier line
      // carries the booking snapshot for slotted products.
      let bookingAttached = e.fixedPrice != null;
      for (const i of e.items) {
        if (addOnOf(i.tierId)) continue; // add-ons parent below
        const cov = coverage.get(`${e.id}|${i.tierId}`) ?? 0;
        const tier = p?.tiers.find((t) => t.id === i.tierId);
        const isPremium = i.tierId.startsWith("prem_");
        const mk = (qty: number, unitPrice: number, covered: boolean) => {
          const idx = inputs.length;
          const carryBooking = !isPremium && !bookingAttached && !!e.slotDate;
          if (carryBooking) bookingAttached = true;
          inputs.push({
            productId: e.productId, productName: e.productName,
            tierId: tier?.id, tierName: covered ? `${i.tierName} · pass` : i.tierName,
            admits: isPremium ? 0 : (tier?.admits ?? 1),
            quantity: qty, unitPrice,
            lineDiscount: covered ? 0 : pctOf(unitPrice * qty),
            taxClass: covered ? "exempt" : taxClass, taxRate: covered ? 0 : rate,
            parentIndex: isPremium && parentIdx != null ? parentIdx : undefined,
            booking: carryBooking ? { date: e.slotDate!, startTime: e.slotTime, guests: entrySeats(e) } : undefined,
          });
          if (parentIdx == null && !isPremium) parentIdx = idx;
        };
        if (i.qty - cov > 0) mk(i.qty - cov, i.unitPrice, false);
        if (cov > 0) mk(cov, 0, true);
      }

      // Add-ons are CHILD LINES — their own product identity, revenue and tax;
      // they render indented and refunds will cascade from the parent.
      for (const i of e.items) {
        const a = addOnOf(i.tierId);
        if (!a) continue;
        inputs.push({
          productId: `addon_${a.id}`, productName: a.name,
          tierName: i.tierName, admits: 0, quantity: i.qty, unitPrice: i.unitPrice,
          lineDiscount: pctOf(i.unitPrice * i.qty),
          taxClass, taxRate: rate,
          parentIndex: parentIdx ?? undefined,
        });
      }
    }
    return inputs;
  };

  const saleInputs = buildInputs();
  const preBase = saleInputs.reduce((s, l) => s + l.unitPrice * l.quantity - (l.lineDiscount ?? 0), 0);
  const orderDiscount = Math.round((Math.max(0, preBase) * discountPct) / 100);
  const sale = buildOrderLines(saleInputs, orderDiscount, "PREVIEW");
  const subtotal = sale.totals.subtotal;
  const lineDiscountTotal = sale.totals.lineDiscountTotal;
  const discount = sale.totals.discountTotal;
  const tax = sale.totals.taxTotal;
  const total = sale.totals.total;
  // Role limits gate the COMBINED effective discount — 5% on a line plus 5% on
  // the cart must not dodge a 5% limit.
  const effectivePct = subtotal > 0 ? (discount / subtotal) * 100 : 0;
  const overLimit = effectivePct > discountLimit + 1e-9;

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

  const buildSale = () => {
    // The SAME inputs the live totals were computed from — no drift possible.
    const lines = saleInputs;
    const bookings = cart.filter((e) => e.slotDate).map((e) => ({ productId: e.productId, resourceId: e.resourceId ?? null, slotStart: entrySlotISO(e)!, slotEnd: e.slotEnd, partySize: entrySeats(e) }));
    const credits = pass && creditsUsed > 0 ? { ticketId: pass.ticketId, count: creditsUsed } : null;
    // Receipt detail for the complete screen: lines, discounts, tax, payments.
    const receipt = {
      lines: sale.lines.map((l) => ({ name: l.tierId && l.tierName !== l.productName ? `${l.productName} · ${l.tierName}` : l.productName, qty: l.quantity, amount: l.subtotal, child: !!l.parentLineId })),
      subtotal, lineDiscountTotal, orderDiscount, tax, total,
    };
    const payload = { total, dueNow, balance, taxPct: operator?.taxRatePct ?? 0, locationId: locationsQ.data?.data[0]?.id ?? "loc_fort", lines, orderDiscount, bookings, method, credits, customerName: customer || null, receipt };
    return { lines, bookings, credits, payload, receipt };
  };

  const charge = async () => {
    const { payload } = buildSale();

    if (method === "cash") {
      sessionStorage.setItem("pos_cart", JSON.stringify(payload));
      router.push("/pos/payment");
      return;
    }
    if (method === "bkash" || method === "bangla_qr") {
      // The sale only lands once the wallet payment is confirmed.
      setNc({ method, state: "pending", txn: "" });
      return;
    }
    await settleInline();
  };

  // Non-cash settle: no change step; runs after the wallet flow confirms.
  const settleInline = async (txnNote?: string, txnRef?: string) => {
    const { lines, bookings, credits, payload, receipt } = buildSale();
    const res = await checkout({ channel: "counter", locationId: payload.locationId, counterId: null, staffId: null, customerName: customer || null, lines, orderDiscount, bookings, taxPct: payload.taxPct, method, amountTendered: dueNow, paymentReference: txnRef, payNow: dueNow, credits });
    if (res.ok) {
      if (txnNote) await logOrderAction(res.data.order.id, txnNote);
      sessionStorage.setItem("pos_complete", JSON.stringify({ code: res.data.firstTicketCode, change: 0, balance, receipt, payments: [{ method, amount: dueNow }] }));
      router.push("/pos/complete");
    } else toast.error(res.error.message);
  };

  const slotLabel = (e: CartEntry) => (!e.slotDate ? "" : e.slotTime ? ` · ${e.slotTime} ${e.slotDate === TODAY ? "today" : e.slotDate}` : ` · ${e.slotDate === TODAY ? "today" : e.slotDate}`);
  const methodLabel = COUNTER_METHODS.find((m) => m.value === method)?.label ?? "";

  return (
    <div className="grid h-full grid-cols-1 gap-tight p-tight pb-24 lg:grid-cols-[1fr_23rem] lg:pb-tight">
      <div className="flex min-h-0 flex-col gap-tight">
        {/* Header zone: counter chip · wide search · parked badge */}
        <div className="flex items-center gap-tight">
          <span className="hidden h-12 shrink-0 items-center rounded-sm border border-line bg-card px-comfortable text-[13px] text-muted sm:flex">Fort Main Gate</span>
          <div className="flex h-12 min-w-0 flex-1 items-center gap-tight rounded-sm border border-line bg-card px-comfortable focus-within:border-inverse">
            <Search size={16} strokeWidth={1.5} className="shrink-0 text-faint" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products…" className="h-full w-full bg-transparent text-sm outline-none placeholder:text-faint" />
            {query && <button type="button" onClick={() => setQuery("")} className="text-[12px] text-faint hover:text-fg">Clear</button>}
          </div>
          {parked.length > 0 && (
            <button type="button" onClick={() => setParkOpen(true)} className="flex h-12 shrink-0 items-center rounded-sm border border-ember bg-ember/10 px-comfortable font-mono text-[12px] text-ember">
              {parked.length} parked
            </button>
          )}
        </div>
        {/* Category chips */}
        <div className="flex gap-inline overflow-x-auto pb-inline">
          {[{ id: "all", name: "All" }, ...categories].map((c) => (
            <button key={c.id} type="button" onClick={() => setCategory(c.id)} className={`h-12 shrink-0 rounded-sm border px-comfortable text-sm ${category === c.id ? "border-inverse bg-inverse text-inverse-fg" : "border-line bg-card"}`}>{c.name}</button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {productsQ.loading ? (
            <div aria-busy="true" className="flex animate-pulse flex-col gap-tight p-section"><div className="h-4 w-1/3 rounded-xs bg-line" /><div className="h-4 w-2/3 rounded-xs bg-line" /><div className="h-4 w-1/2 rounded-xs bg-line" /></div>
          ) : (
            <div className="grid grid-cols-2 gap-tight sm:grid-cols-3">
              {shown.map((p) => (
                <button key={p.id} type="button" onClick={() => tapProduct(p)} className="flex min-h-[6rem] flex-col justify-between rounded-sm border border-line border-t-2 border-t-ember bg-card p-comfortable text-left transition-colors duration-quick active:bg-ember/10">
                  <div className="min-w-0">
                    <span className="line-clamp-2 block text-[16px] font-semibold leading-tight">{p.name}</span>
                    <span className="mt-inline block truncate text-[13px] leading-tight text-faint">{behaviourSubtitle(p, { resources, team: teamQ.data?.data })}</span>
                  </div>
                  <span className="mt-tight shrink-0 self-end whitespace-nowrap font-mono text-[13px] tabular-nums">{formatMoney(Math.min(...(p.tiers.filter((t) => t.active).map((t) => t.price).concat(p.sections?.map((s) => s.price) ?? []).concat([Infinity]))), currency)}</span>
                </button>
              ))}
              <button type="button" onClick={() => setCustomOpen(true)} className="flex min-h-[5.5rem] flex-col items-center justify-center gap-inline rounded-sm border border-dashed border-line text-faint active:bg-ember/10">
                <Plus size={20} strokeWidth={1.5} /><span className="text-[12px]">Custom amount</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cart — fixed right panel on tablet/desktop; bottom drawer on phones */}
      {/* Sheets cover the tab bar (z-50 over z-40) — nothing tappable behind a modal cart. */}
      <div className={`${cartOpen ? "fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] rounded-t-md pb-[env(safe-area-inset-bottom)] shadow-2xl" : "hidden"} min-h-0 flex-col border border-line bg-card lg:static lg:z-auto lg:flex lg:max-h-none lg:rounded-sm lg:pb-0 lg:shadow-none`}>
        <div className="flex items-center gap-tight border-b border-line p-tight">
          {cartOpen && (
            <button type="button" onClick={() => setCartOpen(false)} className="flex h-12 items-center rounded-sm border border-line px-tight text-[12px] text-muted lg:hidden">Close</button>
          )}
          <button type="button" onClick={() => { setCustomerDraft(customer); setCustomerOpen(true); }} className={`flex h-12 items-center gap-inline rounded-sm border px-tight text-[12px] ${customer ? "border-inverse text-fg" : "border-line text-faint"}`}>
            <UserRound size={14} strokeWidth={1.5} />{customer || "Customer"}
          </button>
          <span className="flex-1" />
          <button type="button" disabled={cart.length === 0} onClick={() => { setParkName(customer); setParkOpen(true); }} className="flex h-12 items-center gap-inline rounded-sm border border-line px-tight text-[12px] text-muted disabled:text-faint" title={cart.length === 0 ? "Nothing to park" : "Park this cart"}>
            <Archive size={14} strokeWidth={1.5} />Park
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-comfortable">
          {cart.length === 0 ? (
            <EmptyState title="Empty cart" message="Tap a product to add it." />
          ) : (
            <div className="flex flex-col gap-tight">
              {cart.map((e) => (
                <div key={e.id} className="flex items-start gap-tight border-b border-line pb-tight last:border-0">
                  <div className="min-w-0 flex-1 cursor-pointer" role="button" tabIndex={0} onClick={() => { if (e.productId !== "custom") setSheet({ product: productById(e.productId)!, initial: e }); }} onKeyDown={(k) => { if (k.key === "Enter" && e.productId !== "custom") setSheet({ product: productById(e.productId)!, initial: e }); }}>
                    <div className="flex justify-between gap-tight text-sm font-medium"><span className="min-w-0 truncate">{e.productName}</span><span className="shrink-0 whitespace-nowrap font-mono tabular-nums">{formatMoney(entryTotal(e), currency)}</span></div>
                    <div className="font-mono text-[11px] text-faint">{[e.items.map((i) => `${i.qty} ${i.tierName}`).join(" · "), e.resourceLabel, e.providerLabel, e.partySize != null ? `Group of ${e.partySize}` : ""].filter(Boolean).join(" · ")}{slotLabel(e)}</div>
                    {entryCoveredQty(e) > 0 && <div className="font-mono text-[11px] text-success">{entryCoveredQty(e)} paid with pass</div>}
                    {(e.lineDiscountPct ?? 0) > 0 && <div className="font-mono text-[11px] text-danger">−{e.lineDiscountPct}% line discount</div>}
                    {entryBalance(e) > 0 && <div className="font-mono text-[11px] text-faint">{productById(e.productId)?.policies?.depositPct}% deposit now · {formatMoney(entryBalance(e), currency)} at arrival</div>}
                  </div>
                  <button
                    type="button"
                    aria-label="Line discount"
                    onClick={() => setCart((c) => c.map((x) => (x.id === e.id ? { ...x, lineDiscountPct: ((x.lineDiscountPct ?? 0) + 5) % 20 } : x)))}
                    className={`flex h-12 w-12 items-center justify-center rounded-sm border font-mono text-[11px] active:bg-ember/10 ${(e.lineDiscountPct ?? 0) > 0 ? "border-ember text-ember" : "border-line"}`}
                  >
                    {(e.lineDiscountPct ?? 0) > 0 ? `−${e.lineDiscountPct}%` : "%"}
                  </button>
                  {productById(e.productId)?.durationConfig && e.fixedPrice != null && e.slotEnd && (
                    <button type="button" onClick={() => extendEntry(e)} className="flex h-12 items-center justify-center rounded-sm border border-line px-tight font-mono text-[11px] active:bg-ember/10">
                      +{productById(e.productId)!.durationConfig!.incrementMinutes}m
                    </button>
                  )}
                  {e.productId !== "custom" && <button type="button" aria-label="Edit" onClick={() => setSheet({ product: productById(e.productId)!, initial: e })} className="flex h-12 w-12 items-center justify-center rounded-sm border border-line active:bg-ember/10"><Pencil size={15} strokeWidth={1.5} /></button>}
                  <button type="button" aria-label="Remove" onClick={() => setCart((c) => c.filter((x) => x.id !== e.id))} className="flex h-12 w-12 items-center justify-center rounded-sm border border-line text-danger active:bg-ember/10"><Trash2 size={15} strokeWidth={1.5} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-line p-comfortable">
          {/* Discount */}
          <div className="mb-tight flex items-center justify-between">
            <span className="text-[13px] text-muted">Discount</span>
            <div className="flex items-center gap-inline">
              {[0, 5, 10, 15].map((d) => <button key={d} type="button" onClick={() => setDiscountPct(d)} className={`h-12 min-w-12 rounded-xs border px-tight font-mono text-[12px] ${discountPct === d ? "border-inverse bg-inverse text-inverse-fg" : "border-line"}`}>{d}%</button>)}
            </div>
          </div>
          {overLimit && (
            <p className="mb-tight rounded-sm border border-line border-l-[3px] border-l-ember bg-card p-tight text-[12px]">
              Combined discount ({effectivePct.toFixed(1)}%) is over your {discountLimit}% limit — ask a manager, or reduce the line/cart discounts.
            </p>
          )}
          {cartNotice && <div className="mb-tight"><BlockedNotice message={cartNotice} onDismiss={() => setCartNotice(null)} /></div>}

          {/* Credits pass */}
          <div className="mb-tight flex items-center justify-between">
            <span className="text-[13px] text-muted">Pass</span>
            {pass ? (
              <span className="flex items-center gap-inline font-mono text-[11px]">
                <span>{pass.code} · {creditsUsed} used · {pass.remaining - creditsUsed} left</span>
                <button type="button" aria-label="Remove pass" onClick={() => setPass(null)} className="text-danger">✕</button>
              </span>
            ) : (
              <button type="button" onClick={() => setPassOpen(true)} className="h-12 rounded-xs border border-line px-tight text-[12px]">Redeem a pass</button>
            )}
          </div>

          <div className="flex justify-between text-[13px] text-muted"><span>Subtotal</span><span className="font-mono">{formatMoney(subtotal, currency)}</span></div>
          {lineDiscountTotal > 0 && <div className="flex justify-between text-[13px] text-muted"><span>Line discounts</span><span className="font-mono text-danger">−{formatMoney(lineDiscountTotal, currency)}</span></div>}
          {orderDiscount > 0 && <div className="flex justify-between text-[13px] text-muted"><span>Discount {discountPct}%</span><span className="font-mono text-danger">−{formatMoney(orderDiscount, currency)}</span></div>}
          {creditsValue > 0 && <div className="flex justify-between text-[13px] text-muted"><span>Pass · {creditsUsed} credits</span><span className="font-mono text-success">−{formatMoney(creditsValue, currency)}</span></div>}
          <div className="flex justify-between text-[13px] text-muted"><span>VAT</span><span className="font-mono">{formatMoney(tax, currency)}</span></div>
          <div className="mt-tight flex items-baseline justify-between text-lg font-medium"><span>Total</span><AnimatedMoney value={total} currency={currency} /></div>
          {balance > 0 && (
            <>
              <div className="flex justify-between text-[13px]"><span>Due now</span><span className="font-mono">{formatMoney(dueNow, currency)}</span></div>
              <div className="flex justify-between text-[13px] text-muted"><span>Balance at arrival</span><span className="font-mono">{formatMoney(balance, currency)}</span></div>
            </>
          )}

          {/* Payment method — segmented control with a sliding thumb */}
          <div className="relative mt-tight grid h-12 grid-cols-4 rounded-sm bg-line/60 p-inline">
            <span
              aria-hidden
              className="absolute inset-y-inline rounded-xs bg-inverse transition-[left] duration-quick ease-counterfoil"
              style={{ width: "calc(25% - 8px)", left: `calc(${COUNTER_METHODS.findIndex((m) => m.value === method) * 25}% + 4px)` }}
            />
            {COUNTER_METHODS.map((m) => (
              <button key={m.value} type="button" onClick={() => setMethod(m.value)} className={`relative z-10 text-[13px] transition-colors duration-quick ${method === m.value ? "font-medium text-inverse-fg" : "text-muted"}`}>{m.label}</button>
            ))}
          </div>

          <Button size="lg" fullWidth className="mt-tight h-14" disabled={cart.length === 0 || overLimit} onClick={charge}>
            {cart.length > 0 ? `Charge ${formatMoney(dueNow, currency)} — ${methodLabel}` : "Charge"}
          </Button>
        </div>
      </div>

      {/* Phone summary bar — persistent door to the cart drawer */}
      {!cartOpen && (
        <button type="button" onClick={() => setCartOpen(true)} className="fixed inset-x-tight bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 flex h-14 items-center justify-between rounded-sm bg-inverse px-section text-inverse-fg shadow-lg rail:bottom-tight lg:hidden">
          <span className="text-sm">{cart.length} item{cart.length === 1 ? "" : "s"}{customer ? ` · ${customer}` : ""}</span>
          <span className="font-mono text-sm">{formatMoney(dueNow, currency)} · View cart</span>
        </button>
      )}

      {sheet && <ProductSheet product={sheet.product} currency={currency} initial={sheet.initial} seatsInCart={seatsInCart} onAdd={upsertEntry} onClose={() => setSheet(null)} team={teamQ.data?.data ?? []} />}

      <Modal open={customOpen} onClose={() => setCustomOpen(false)} title="Custom amount" footer={<><Button variant="secondary" onClick={() => setCustomOpen(false)}>Cancel</Button><Button onClick={addCustom} disabled={!customAmount}>Add</Button></>}>
        <div className="flex flex-col gap-section">
          <FormField label="Description" placeholder="Miscellaneous" value={customName} onChange={(e) => setCustomName(e.target.value)} />
          <FormField label={`Amount (${currency})`} variant="number" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} />
          <FormField label="Tax class" variant="select" value={customTax} onChange={(e) => setCustomTax(e.target.value as typeof customTax)} options={[{ value: "standard", label: "Standard (VAT)" }, { value: "reduced", label: "Reduced" }, { value: "exempt", label: "Exempt" }]} />
        </div>
      </Modal>

      <Modal open={customerOpen} onClose={() => setCustomerOpen(false)} title="Customer" footer={<><Button variant="secondary" onClick={() => { setCustomer(""); setCustomerOpen(false); }}>Remove</Button><Button onClick={() => { setCustomer(customerDraft.trim()); setCustomerOpen(false); }}>Attach</Button></>}>
        <FormField label="Name or phone" placeholder="Anika · 01711…" value={customerDraft} onChange={(e) => setCustomerDraft(e.target.value)} help="Optional — shows on the order and at Check-In." />
      </Modal>

      <Modal open={parkOpen} onClose={() => setParkOpen(false)} title="Parked carts" footer={<Button variant="secondary" onClick={() => setParkOpen(false)}>Close</Button>}>
        <div className="flex flex-col gap-section">
          {cart.length > 0 && (
            <div className="flex items-end gap-tight">
              <FormField label="Park the current cart as" placeholder="Guest in the red shirt" value={parkName} onChange={(e) => setParkName(e.target.value)} className="flex-1" />
              <Button onClick={park}>Park</Button>
            </div>
          )}
          {parked.length === 0 ? (
            <p className="text-[13px] text-faint">Nothing parked.</p>
          ) : (
            <div className="flex flex-col gap-tight">
              {parked.map((p, i) => (
                <div key={i} className="flex items-center justify-between rounded-sm border border-line p-comfortable">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="font-mono text-[12px] text-faint">{p.cart.length} line{p.cart.length === 1 ? "" : "s"} · {formatMoney(p.cart.reduce((s, e) => s + (e.fixedPrice ?? 0) + e.items.reduce((x, i2) => x + i2.unitPrice * i2.qty, 0), 0), currency)}</p>
                  </div>
                  <Button size="sm" onClick={() => resume(i)} disabled={cart.length > 0} >Resume</Button>
                </div>
              ))}
              {cart.length > 0 && <p className="text-[12px] text-faint">Park or clear the current cart before resuming another.</p>}
            </div>
          )}
        </div>
      </Modal>

      <Modal open={passOpen} onClose={() => setPassOpen(false)} title="Redeem a pass" footer={<><Button variant="secondary" onClick={() => setPassOpen(false)}>Cancel</Button><Button onClick={applyPass} disabled={!passCode.trim()} loading={passLoading}>Apply</Button></>}>
        <div className="flex flex-col gap-section">
          <FormField label="Pass code" placeholder="CF-2026-000123-01" value={passCode} onChange={(e) => setPassCode(e.target.value)} help="The code on the customer's credits pack ticket. Eligible items in the cart are paid with credits." />
        </div>
      </Modal>

      {/* Non-cash wallet flow — pending → confirmed | failed. Nothing is
          charged and no tickets exist until the payment confirms. */}
      <Modal open={!!nc} onClose={() => setNc(null)} title={nc?.method === "bkash" ? "bKash payment" : "Bangla QR payment"}>
        {nc?.state === "failed" ? (
          <div className="flex flex-col gap-section">
            <div className="rounded-sm border border-danger/40 bg-danger/10 p-comfortable text-sm text-danger">
              Payment didn&apos;t go through. Nothing was charged and no tickets were issued.
            </div>
            <div className="flex gap-tight">
              <Button variant="secondary" fullWidth onClick={() => setNc(null)}>Cancel sale</Button>
              <Button fullWidth onClick={() => setNc({ ...nc, state: "pending", txn: "" })}>Try again</Button>
            </div>
          </div>
        ) : nc?.method === "bkash" ? (
          <div className="flex flex-col gap-section">
            <p className="text-sm text-muted">Ask the guest to send <span className="font-mono font-medium text-fg">{formatMoney(dueNow, currency)}</span> to <span className="font-mono text-fg">01711-000000</span>, then enter the transaction ID from their confirmation SMS.</p>
            <FormField label="Transaction ID" placeholder="e.g. 9HX72KQML4" value={nc.txn} onChange={(e) => setNc({ ...nc, txn: e.target.value.toUpperCase() })} />
            <div className="flex gap-tight">
              <Button variant="secondary" fullWidth onClick={() => setNc({ ...nc, state: "failed" })}>It failed</Button>
              <Button fullWidth disabled={nc.txn.trim().length < 6} onClick={async () => { const txn = nc.txn.trim(); setNc({ ...nc, state: "confirmed" }); await settleInline(`bKash confirmed — txn ${txn}`, txn); setNc(null); }}>
                {nc.state === "confirmed" ? "Confirming…" : "Payment received"}
              </Button>
            </div>
          </div>
        ) : nc ? (
          <div className="flex flex-col gap-section">
            {/* Stand-in QR — a real terminal renders the payload from the PSP. */}
            <div className="mx-auto grid w-40 grid-cols-8 gap-px rounded-sm border border-line bg-card p-tight" aria-label="Payment QR code">
              {Array.from({ length: 64 }, (_, i) => (
                <span key={i} className={`aspect-square ${((i * 7 + 3) % 5 < 2 || i % 9 === 0) ? "bg-fg" : "bg-card"}`} />
              ))}
            </div>
            <p className="text-center font-mono text-lg tabular-nums">{formatMoney(dueNow, currency)}</p>
            <p className="text-center text-[13px] text-muted">Guest scans with any Bangla QR app. Confirm once their app shows success.</p>
            <div className="flex gap-tight">
              <Button variant="secondary" fullWidth onClick={() => setNc({ ...nc, state: "failed" })}>It failed</Button>
              <Button fullWidth onClick={async () => { setNc({ ...nc, state: "confirmed" }); await settleInline("Bangla QR payment confirmed"); setNc(null); }}>
                {nc.state === "confirmed" ? "Confirming…" : "Payment received"}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
