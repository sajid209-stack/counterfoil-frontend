"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEnumLabels } from "@/lib/labels";
import { AlertTriangle, Archive, ChevronRight, Pencil, Percent, Plus, Search, TicketPercent, Trash2, UserRound, Wallet, X, type LucideIcon } from "lucide-react";
import { BlockedNotice, Button, DiscountInput, EmptyState, FormField, Modal, ProductThumb, useToast, type DiscountMode } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { addOrderPayment, advanceMinimum, checkout, getAdvancePolicy, earnPoints, findCreditPass, findOrderByReference, getLoyaltyAccount, getLoyaltyProgram, getManualDiscountPolicy, getMemberBenefit, getOperator, isResourceFreeFor, listCategories, listLocations, listPaymentAccounts, listProducts, listResources, listRoles, listStaff, logOrderAction, placeCheckoutHold, quoteCart, releaseCheckoutHolds, spendPoints, issueMembership, type AppliedPromotion, type CheckoutLine, type CreditPass, type MembershipTier, type Order, type PaymentMethod, type Product, type QuoteLine } from "@/lib/api";
import { buildOrderLines } from "@/lib/orderMath";
import { DEMO_TODAY, isResourceType, needsSchedule, slotISO, toMinutes, toTime } from "@/lib/schedule";
import { productDurationPrice } from "@/lib/duration";
import { behaviourSubtitle } from "@/lib/behaviour";
import { posLiveState } from "@/lib/posState";
import { taxRateFor } from "@/lib/tax";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";
import { CustomerPicker, type AttachedCustomer } from "./CustomerPicker";
import { MembershipSheet, PointsSheet } from "./MemberSheets";
import { ProductSheet, type CartEntry } from "../_components/ProductSheet";
import { Keypad } from "../_components/Keypad";

const TODAY = DEMO_TODAY;
// Payment methods this counter takes (would come from counter config).
const COUNTER_METHODS: { value: PaymentMethod }[] = [
  { value: "cash" },
  { value: "bkash" },
  { value: "bangla_qr" },
  { value: "card_terminal" },
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
  return <span className="text-2xl">{formatMoney(shown, currency)}</span>;
}

/** A cart action, stated as a row rather than a wall of controls.
 *
 *  Discount, coupon and passes each spent a permanent block of the cart on
 *  controls that are used on a minority of sales — four discount chips, a
 *  coupon input with its own Apply button, and four more buttons for passes and
 *  membership. The cart is a third of the till and most of it was options
 *  nobody had asked for yet.
 *
 *  Each is now a row saying what it currently IS — "5%", "WELCOME10", "Add" —
 *  that opens its controls in place. In place, not in a modal: the selection
 *  sheet is already a modal, and stacking a second one over the cart is the
 *  over-modalising the brief warns about. */
function CartRow({
  icon: Icon,
  label,
  value,
  open,
  onToggle,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center gap-tight py-tight text-left"
      >
        <Icon size={16} strokeWidth={1.5} className="shrink-0 text-muted" />
        <span className="min-w-0 flex-1 truncate text-[13px]">{label}</span>
        <span className="shrink-0 text-[13px] text-muted">{value}</span>
        <ChevronRight size={15} strokeWidth={1.5} className={`shrink-0 text-faint transition-transform duration-quick ${open ? "rotate-90" : ""}`} />
      </button>
      {open && <div className="pb-tight">{children}</div>}
    </div>
  );
}

export default function PosPage() {
  const router = useRouter();
  const toast = useToast();
  const t = useTranslations("pos");
  const pt = useTranslations("promotions");
  const enumL = useEnumLabels();
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100, filters: { status: "active" } }), []);
  const opQ = useApiQuery(() => getOperator(), []);
  const catsQ = useApiQuery(() => listCategories({ pageSize: 100 }), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 1, filters: { status: "active" } }), []);
  const teamQ = useApiQuery(() => listStaff({ pageSize: 100, filters: { status: "active" } }), []);
  const resourcesQ = useApiQuery(() => listResources({ pageSize: 100 }), []);
  const rolesQ = useApiQuery(() => listRoles({ pageSize: 100 }), []);
  const payAcctsQ = useApiQuery(() => listPaymentAccounts({ pageSize: 100 }), []);
  const policyQ = useApiQuery(() => getManualDiscountPolicy(), []);
  const advanceQ = useApiQuery(() => getAdvancePolicy(), []);
  // Non-cash tender needs a live PSP account (charges enabled). Cash always works.
  const nonCashOk = (payAcctsQ.data?.data ?? []).some((a) => a.status === "active" && a.chargesEnabled);
  const availableMethods = COUNTER_METHODS.filter((m) => m.value === "cash" || nonCashOk);

  // "Ask a manager" gating reads the signed-in staff's ROLE — no hardcoded cap.
  const myRole = rolesQ.data?.data.find((r) => r.id === teamQ.data?.data.find((s) => s.id === SIGNED_IN_STAFF_ID)?.roleId);
  const discountLimit = myRole?.discountLimitPct ?? Infinity;

  const [cart, setCart] = useState<CartEntry[]>([]);
  const [sheet, setSheet] = useState<{ product: Product; initial: CartEntry | null } | null>(null);
  const [category, setCategory] = useState("all");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [payInFull, setPayInFull] = useState(false);
  /** Minor amount the customer is paying up front, when the cashier sets one. */
  const [advance, setAdvance] = useState<number | null>(null);
  const [discountPct, setDiscountPct] = useState(0);
  /** A manager says "ten percent" or "take two hundred off" — both are real,
   *  and only one used to be expressible. The engine has always taken an
   *  absolute amount, so this is a question of what the cashier types. */
  const [discountMode, setDiscountMode] = useState<DiscountMode>("percent");
  const [discountAmt, setDiscountAmt] = useState(0);
  const [discountReason, setDiscountReason] = useState("");
  const [couponInput, setCouponInput] = useState("");
  /** Which cart action is expanded. One at a time — the cart is narrow and
   *  three open blocks is the wall this replaced. */
  type CartRowKey = "discount" | "coupon" | "passes" | "advance";
  const [cartRow, setCartRow] = useState<CartRowKey | null>(null);
  const toggleRow = (r: CartRowKey) => setCartRow((c) => (c === r ? null : r));
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedPromotion | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [pass, setPass] = useState<CreditPass | null>(null);
  const [passOpen, setPassOpen] = useState(false);

  // Settle a booking — look up an existing order by reference and take its
  // outstanding balance right at the till (completes a partly-paid booking).
  const [settleOpen, setSettleOpen] = useState(false);
  const [settleRef, setSettleRef] = useState("");
  const [settleOrder, setSettleOrder] = useState<Order | null>(null);
  const [settleLoading, setSettleLoading] = useState(false);
  const [settling, setSettling] = useState(false);
  const [settleMethod, setSettleMethod] = useState<PaymentMethod>("cash");
  const settlePaid = settleOrder ? settleOrder.payments.reduce((s, p) => s + p.amount, 0) : 0;
  const settleOutstanding = settleOrder ? Math.max(0, settleOrder.total - settlePaid) : 0;
  const closeSettle = () => { setSettleOpen(false); setSettleOrder(null); setSettleRef(""); };
  const findBooking = async () => {
    setSettleLoading(true);
    const res = await findOrderByReference(settleRef);
    setSettleLoading(false);
    if (res.ok) setSettleOrder(res.data);
    else { setSettleOrder(null); toast.error(t("settle.notFound")); }
  };
  const takeSettle = async () => {
    if (!settleOrder || settleOutstanding <= 0) return;
    setSettling(true);
    const res = await addOrderPayment(settleOrder.id, settleMethod, settleOutstanding);
    setSettling(false);
    if (res.ok) { setSettleOrder(res.data); toast.success(t("settle.settled", { amount: formatMoney(settleOutstanding, currency) })); }
    else toast.error(res.error.message);
  };
  const [passCode, setPassCode] = useState("");
  const [passLoading, setPassLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [customTax, setCustomTax] = useState<"standard" | "reduced" | "exempt">("standard");
  // The attached customer RECORD (Milestone 2). `customer` stays as the name
  // snapshot the cart and receipt read, so nothing downstream had to change.
  const [attached, setAttached] = useState<AttachedCustomer | null>(null);
  /** Which cart line has its discount open for editing. Tapping % used to
   *  CYCLE 0→5→10→15→0, so reaching 12 was impossible and reaching 5 from 15
   *  meant three more taps. It opens a field now. */
  const [lineDiscEdit, setLineDiscEdit] = useState<string | null>(null);
  const customer = attached?.name ?? "";
  const [customerOpen, setCustomerOpen] = useState(false);

  // ── Membership + points (Milestone 2). Both hang off the ATTACHED customer,
  //    so removing the customer removes the benefit — no stale member price.
  const benefitQ = useApiQuery(() => getMemberBenefit(attached?.id ?? null), [attached?.id]);
  const benefit = attached?.id ? (benefitQ.data ?? null) : null;
  const pointsQ = useApiQuery(
    () =>
      attached?.id
        ? getLoyaltyAccount(attached.id)
        : Promise.resolve({ ok: true as const, data: null }),
    [attached?.id],
  );
  const pointsAccount = attached?.id ? (pointsQ.data ?? null) : null;
  const programQ = useApiQuery(() => getLoyaltyProgram(), []);
  const program = programQ.data;
  const [pointsToSpend, setPointsToSpend] = useState(0);
  const [pointsOpen, setPointsOpen] = useState(false);
  const [membershipOpen, setMembershipOpen] = useState(false);

  // Parked carts survive navigation within the session (sessionStorage).
  type Parked = { name: string; cart: CartEntry[]; discountPct: number; customer: string; customerRecord?: AttachedCustomer | null; pass: CreditPass | null };
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
  // Inline cash checkout — replaces the /pos/payment page navigation.
  const [cashOpen, setCashOpen] = useState(false);
  const [tenderTaka, setTenderTaka] = useState("");
  const [cashSaving, setCashSaving] = useState(false);
  const persistParked = (list: Parked[]) => { setParked(list); sessionStorage.setItem("pos_parked", JSON.stringify(list)); };
  const park = () => {
    if (cart.length === 0) return;
    persistParked([...parked, { name: parkName.trim() || t("parked.guestName", { number: parked.length + 1 }), cart, discountPct, customer, customerRecord: attached, pass }]);
    setCart([]);
    setAdvance(null);
    setDiscountPct(0);
    setDiscountAmt(0); setDiscountPct(0); setAttached(null); setPass(null); setAppliedCoupon(null); setDiscountReason(""); setPointsToSpend(0); void releaseCheckoutHolds(TILL_ID);
    setParkOpen(false); setParkName("");
    toast.success(t("cartParked"));
  };
  const resume = (i: number) => {
    const p = parked[i];
    if (!p) return;
    setCart(p.cart); setDiscountPct(p.discountPct); setAttached(p.customerRecord ?? (p.customer ? { id: null, name: p.customer } : null)); setPass(p.pass);
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
  /** Everything this till can actually sell, before the cashier narrows it.
   *  The chip row is built from THIS rather than from the filtered grid, so
   *  chips do not disappear from under the finger as someone types. */
  const sellable = products.filter((p) => p.bookingType !== "BT-14");
  /** Only groups that are switched on AND have something in them. An empty
   *  chip is a control that filters the grid to nothing and tells the cashier
   *  they have made a mistake — the seeded "Add-ons" group did exactly that. */
  const chipCategories = categories
    .filter((c) => c.active !== false && sellable.some((p) => p.categoryId === c.id))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const shown = products
    .filter((p) => p.bookingType !== "BT-14") // field passes issue from Quick pass, not the grid
    .filter((p) => category === "all" || p.categoryId === category)
    .filter((p) => {
      const q = query.trim().toLowerCase();
      return !q || p.name.toLowerCase().includes(q) || catName(p.categoryId).toLowerCase().includes(q);
    });

  // If non-cash becomes unavailable (no live PSP account), fall back to cash.
  useEffect(() => {
    if (!nonCashOk && method !== "cash") setMethod("cash");
  }, [nonCashOk, method]);

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
    const needsSheet = needsSchedule(p.bookingType) || isResourceType(p.bookingType) || p.bookingType === "BT-10" || p.bookingType === "BT-13" || (p.sections?.length ?? 0) > 0 || !!p.layoutId || activeTiers.some((t) => t.donation) || activeTiers.length > 1;
    if (!needsSheet && activeTiers.length >= 1) {
      const tier = activeTiers[0];
      setCart((c) => [...c, { id: `entry_${globalThis.crypto.randomUUID().slice(0, 8)}`, productId: p.id, productName: p.name, items: [{ tierId: tier.id, tierName: tier.name, unitPrice: tier.price, qty: 1 }] }]);
      toast.success(t("added", { name: p.name }));
      return;
    }
    setSheet({ product: p, initial: null });
  };

  // The till identifies itself so its own holds can be found and released
  // again. A real device id lands with the backend; the counter is enough here.
  const TILL_ID = "till_fort_main";

  /** `pay` comes from the sheet's Buy now: this sale is done, so land on the
   *  cart instead of going back to the grid for another item. */
  const upsertEntry = (entry: CartEntry, pay = false) => {
    setCart((c) => (c.some((e) => e.id === entry.id) ? c.map((e) => (e.id === entry.id ? entry : e)) : [...c, entry]));
    setSheet(null);
    // §61.11 — hold the places while this cart is open, so a second till
    // cannot sell the same seats out from under it. The hold carries its own
    // expiry, so an abandoned cart gives them back without anyone noticing.
    if (entry.slotDate) {
      const seats = entry.items.reduce((sum, i) => sum + i.qty, 0);
      if (seats > 0) {
        void placeCheckoutHold({
          productId: entry.productId,
          productName: entry.productName,
          locationId: locationsQ.data?.data[0]?.id ?? null,
          date: entry.slotDate,
          slotStart: entrySlotISO(entry) ?? null,
          quantity: seats,
          placedBy: TILL_ID,
        });
      }
    }

    // Buy now: this sale is finished, so show the cart rather than the list.
    // Charge is then one tap away, and it stays the cashier's tap — the till
    // never moves someone's money for them.
    if (pay) setCartOpen(true);
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
    if (next > cfg.maxMinutes) { setCartNotice(t("maxBooking", { hours: cfg.maxMinutes / 60 })); return; }
    if (!isResourceFreeFor(e.resourceId, e.slotDate, endTime, cfg.incrementMinutes, p.bufferMinutes ?? 0)) {
      setCartNotice(t("cantExtend", { lane: e.resourceLabel ?? t("theLane"), time: endTime }));
      return;
    }
    const base = Math.min(...p.tiers.filter((t) => t.active).map((t) => t.price));
    const price = productDurationPrice(p, e.slotDate, e.slotTime, next, base);
    const newEnd = `${e.slotDate}T${toTime(toMinutes(e.slotTime) + next)}:00+06:00`;
    setCart((c) => c.map((x) => (x.id === e.id ? { ...x, slotEnd: newEnd, fixedPrice: price } : x)));
    toast.success(t("extendedTo", { time: toTime(toMinutes(e.slotTime) + next), amount: formatMoney(price, currency) }));
  };

  const addCustom = () => {
    const minor = Math.round((parseFloat(customAmount) || 0) * 100);
    if (minor <= 0) return;
    const rate = customTax === "exempt" ? 0 : customTax === "reduced" ? (operator?.reducedRatePct ?? 0) : (operator?.taxRatePct ?? 0);
    setCart((c) => [...c, { id: `entry_${globalThis.crypto.randomUUID().slice(0, 8)}`, productId: "custom", productName: customName || t("customEntryName"), taxRatePct: rate, items: [{ tierId: "custom", tierName: t("customTierName"), unitPrice: minor, qty: 1 }] }]);
    setCustomOpen(false); setCustomName(""); setCustomAmount(""); setCustomTax("standard");
  };

  // A membership sells as its own cart line. It is not a catalogue product, so
  // it carries its own tax rate exactly as the custom-amount entry does; the
  // membership itself is issued once the sale actually completes.
  const addMembershipToCart = (tier: MembershipTier) => {
    setCart((c) => [
      ...c,
      {
        id: `entry_${globalThis.crypto.randomUUID().slice(0, 8)}`,
        productId: `membership_${tier.id}`,
        productName: tier.name,
        taxRatePct: operator?.taxRatePct ?? 0,
        items: [
          { tierId: "membership", tierName: t("membership.lineLabel"), unitPrice: tier.price, qty: 1 },
        ],
      },
    ]);
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
      // A flat amount is resolved against the entry's own total, so it lands
      // pro rata across the entry's sub-lines (a booking and its add-ons) the
      // same way a percentage does.
      const entryBase = entryTotal(e);
      const ld = e.lineDiscountAmount != null && entryBase > 0
        ? Math.min(100, (Math.min(e.lineDiscountAmount, entryBase) / entryBase) * 100)
        : (e.lineDiscountPct ?? 0);
      const pctOf = (base: number) => (ld > 0 ? Math.round((base * ld) / 100) : 0);
      const addOnOf = (tierId: string) => p?.addOns?.find((a) => a.id === tierId);
      let parentIdx: number | null = null;

      if (e.fixedPrice != null) {
        // The booking line — a resource/provider span, one unit admitting the group.
        parentIdx = inputs.length;
        const dur = e.slotTime && e.slotEnd ? toMinutes(e.slotEnd.slice(11, 16)) - toMinutes(e.slotTime) : undefined;
        inputs.push({
          productId: e.productId, productName: e.productName,
          tierName: e.resourceLabel ?? e.providerLabel ?? e.slotTime ?? t("bookingLine"),
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
            tierId: tier?.id, tierName: covered ? t("passLineSuffix", { tier: i.tierName }) : i.tierName,
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
  // Manual (cashier) discount + a coupon-applied promotion, combined into the
  // one order discount the math engine takes. The manual portion is what the
  // cashier policy caps; the coupon is pre-authorised.
  const manualDiscount =
    discountMode === "percent"
      ? Math.round((Math.max(0, preBase) * discountPct) / 100)
      : Math.min(Math.max(0, preBase), discountAmt);
  const couponDiscount = Math.min(appliedCoupon?.discount ?? 0, Math.max(0, preBase - manualDiscount));

  // ── The member price (§16.9). Applied only to what the tier actually covers,
  //    and never to the sale of a membership itself. Like the coupon, this is
  //    an entitlement, NOT a cashier discount — so it must not count toward
  //    the manual-discount cap.
  const memberCovers = (productId: string) => {
    if (!benefit || productId.startsWith("membership_")) return false;
    if (benefit.productIds === null && benefit.categoryIds.length === 0) return true;
    if (benefit.productIds?.includes(productId)) return true;
    const cat = productById(productId)?.categoryId;
    return !!cat && benefit.categoryIds.includes(cat);
  };
  const memberEligibleBase = benefit
    ? saleInputs
        .filter((l) => memberCovers(l.productId))
        .reduce((sum, l) => sum + l.unitPrice * l.quantity - (l.lineDiscount ?? 0), 0)
    : 0;
  const memberDiscount = benefit
    ? Math.round((Math.max(0, memberEligibleBase) * benefit.discountBps) / 10000)
    : 0;

  // ── Points spent against this sale (§17.7). Bounded by what is left to pay
  //    after everything else, so points can never create change owed.
  const beforePoints = Math.max(0, preBase - manualDiscount - couponDiscount - memberDiscount);
  const pointsDiscount = program?.enabled
    ? Math.min(pointsToSpend * program.pointValue, beforePoints)
    : 0;

  const orderDiscount = manualDiscount + couponDiscount + memberDiscount + pointsDiscount;
  const sale = buildOrderLines(saleInputs, orderDiscount, "PREVIEW");
  const subtotal = sale.totals.subtotal;
  const lineDiscountTotal = sale.totals.lineDiscountTotal;
  const discount = sale.totals.discountTotal;
  const tax = sale.totals.taxTotal;
  const total = sale.totals.total;
  // The manual-discount POLICY caps ad-hoc cashier discounts (line + cart manual
  // %, not the coupon). Falls back to the role limit if no policy is set.
  const manualCapPct = policyQ.data ? policyQ.data.maxPercentBps / 100 : discountLimit;
  const manualEffectivePct = subtotal > 0 ? ((lineDiscountTotal + manualDiscount) / subtotal) * 100 : 0;
  const overLimit = manualEffectivePct > manualCapPct + 1e-9;
  // A reason is required (by policy) whenever a manual discount is applied.
  const reasonNeeded = manualDiscount > 0 && !!policyQ.data?.requireReason && !discountReason.trim();

  const quoteLines = (): QuoteLine[] =>
    cart.flatMap((e) => {
      const cat = productById(e.productId)?.categoryId ?? null;
      return e.items.filter((i) => i.unitPrice > 0).map((i) => ({ lineId: `${e.id}|${i.tierId}`, quantity: i.qty, unitAmount: i.unitPrice, categoryId: cat }));
    });

  const applyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;
    setCouponError(null);
    const res = await quoteCart({ channel: "counter", lines: quoteLines(), couponCodes: [code] });
    if (res.ok && res.data.applied.length > 0) {
      setAppliedCoupon(res.data.applied[0]);
      setCouponInput("");
    } else {
      const reason = res.ok ? (res.data.rejected[0]?.reason ?? "not_found") : "not_found";
      setAppliedCoupon(null);
      setCouponError(reason);
    }
  };

  // ── Deposits: a percent-deposit policy holds part of the entry back until
  //    arrival; only the minimum deposit is charged now — unless the cashier
  //    chooses to take the balance in full (payInFull).
  const entryBalance = (e: CartEntry) => {
    const pol = productById(e.productId)?.policies;
    if (pol?.deposit !== "percent" || pol.depositPct <= 0) return 0;
    const payable = entryTotal(e) - entryCoveredValue(e);
    return Math.max(0, payable - Math.round((payable * pol.depositPct) / 100));
  };
  const depositBalance = cart.reduce((s, e) => s + entryBalance(e), 0);

  /* ── Advance ───────────────────────────────────────────────────────────────
     A booking taken over the phone is usually held on a bKash transfer of
     whatever the customer sends, which is not a percentage of anything. So
     the cashier can type the amount, bounded below by the business rule and
     above by the total. This sits on top of any per-booking deposit policy:
     the deposit says what a BOOKING requires, the advance says what this
     CUSTOMER actually handed over. */
  const advanceRule = advanceQ.data?.counter;
  const advanceAllowed = !!advanceRule?.enabled && cart.length > 0 && total > 0;
  const advanceMin = advanceRule ? advanceMinimum(advanceRule, total) : total;
  const advanceValid = advance != null && advance >= advanceMin && advance < total;

  const balance = advanceValid ? total - advance : payInFull ? 0 : depositBalance;
  const dueNow = total - balance;

  // The most points that can usefully go on THIS sale: bounded by the balance,
  // the programme minimum, and what is left to pay once points are excluded.
  const maxPointsForSale = (() => {
    if (!pointsAccount || !program?.enabled || program.pointValue <= 0) return 0;
    if (pointsAccount.balance < program.minRedeemPoints) return 0;
    const payable = Math.max(0, beforePoints);
    return Math.min(pointsAccount.balance, Math.floor(payable / program.pointValue));
  })();

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
    const payload = { total, dueNow, balance, taxPct: operator?.taxRatePct ?? 0, locationId: locationsQ.data?.data[0]?.id ?? "loc_fort", lines, orderDiscount, bookings, method, credits, customerName: customer || null, customerId: attached?.id ?? null, receipt };
    return { lines, bookings, credits, payload, receipt };
  };

  const charge = async () => {
    const { payload } = buildSale();

    if (method === "cash") {
      // Inline tender step — no page navigation (keeps the cart in view).
      setTenderTaka("");
      setCashOpen(true);
      return;
    }
    if (method === "bkash" || method === "bangla_qr") {
      // The sale only lands once the wallet payment is confirmed.
      setNc({ method, state: "pending", txn: "" });
      return;
    }
    await settleInline();
  };

  /**
   * Everything that has to happen once a sale actually lands: issue any
   * membership that was in the cart, deduct the points that were spent, and
   * credit the points the sale earned.
   *
   * These run AFTER checkout succeeds, never before — a membership issued
   * against a sale that then failed would be a membership nobody paid for.
   * Points are earned on what was actually paid, not on the list price.
   */
  const settleMemberEffects = async (orderId: string, paidAmount: number) => {
    // The sale is real now, so the provisional hold is redundant — the booking
    // itself takes the capacity.
    await releaseCheckoutHolds(TILL_ID);

    const customerId = attached?.id;
    if (!customerId) return;

    for (const entry of cart) {
      if (!entry.productId.startsWith("membership_")) continue;
      const tierId = entry.productId.slice("membership_".length);
      const issued = await issueMembership({ customerId, tierId, orderId });
      if (issued.ok) toast.success(t("membership.issued", { code: issued.data.code }));
      else toast.error(issued.error.message);
    }

    if (pointsToSpend > 0) await spendPoints(customerId, pointsToSpend, orderId);
    await earnPoints(customerId, paidAmount, orderId);
  };

  // Non-cash settle: no change step; runs after the wallet flow confirms.
  const settleInline = async (txnNote?: string, txnRef?: string) => {
    const { lines, bookings, credits, payload, receipt } = buildSale();
    const res = await checkout({ channel: "counter", locationId: payload.locationId, counterId: null, staffId: null, customerName: customer || null, customerId: attached?.id ?? null, lines, orderDiscount, bookings, taxPct: payload.taxPct, method, amountTendered: dueNow, paymentReference: txnRef, payNow: dueNow, credits });
    if (res.ok) {
      if (txnNote) await logOrderAction(res.data.order.id, txnNote);
      await settleMemberEffects(res.data.order.id, dueNow);
      sessionStorage.setItem("pos_complete", JSON.stringify({ orderId: res.data.order.id, code: res.data.firstTicketCode, change: 0, balance, receipt, payments: [{ method, amount: dueNow }] }));
      router.push("/pos/complete");
    } else toast.error(res.error.message);
  };

  // Inline cash: collect tender, run checkout, go to the completion screen.
  const completeCash = async (tenderedMinor: number, changeMinor: number) => {
    const { lines, bookings, credits, payload, receipt } = buildSale();
    setCashSaving(true);
    const res = await checkout({ channel: "counter", locationId: payload.locationId, counterId: null, staffId: null, customerName: customer || null, customerId: attached?.id ?? null, lines, orderDiscount, bookings, taxPct: payload.taxPct, method: "cash", amountTendered: tenderedMinor, payNow: dueNow, credits });
    setCashSaving(false);
    if (res.ok) {
      await settleMemberEffects(res.data.order.id, dueNow);
      sessionStorage.setItem("pos_complete", JSON.stringify({ orderId: res.data.order.id, code: res.data.firstTicketCode, change: changeMinor, balance, receipt, payments: [{ method: "cash", amount: dueNow, tendered: tenderedMinor, change: changeMinor }] }));
      setCashOpen(false);
      router.push("/pos/complete");
    } else toast.error(res.error.message);
  };

  const slotLabel = (e: CartEntry) => (!e.slotDate ? "" : e.slotTime ? ` · ${e.slotTime} ${e.slotDate === TODAY ? t("slotToday") : e.slotDate}` : ` · ${e.slotDate === TODAY ? t("slotToday") : e.slotDate}`);

  /** The till's clock, in minutes — the demo clock, same as everywhere else. */
  const nowMinutes = 12 * 60;
  /** Phrasing for the live-state line. The deriver picks WHICH question to
   *  answer; these translate the answer. */
  const liveWords = useMemo(() => ({
    soldOutToday: t("live.soldOutToday"),
    noneLeftToday: t("live.noneLeftToday"),
    busyNow: t("live.busyNow"),
    leftOfTotal: (left: number, total: number) => t("live.leftOfTotal", { left, total }),
    nextAt: (time: string, left: number) => t("live.nextAt", { time, left }),
    freeOfTotal: (free: number, total: number) => t("live.freeOfTotal", { free, total }),
    startsOn: (d: string) => t("live.startsOn", { date: d }),
    providersFree: (free: number, total: number) => t("live.providersFree", { free, total }),
  }), [t]);
  const methodLabel = enumL.method(method);

  return (
    <div className="grid h-full grid-cols-1 gap-tight p-tight pb-24 lg:grid-cols-[1fr_23rem] lg:pb-tight">
      {/* The Go chrome names this screen visually; the heading exists so a
          screen reader lands on a named page rather than an unlabelled grid. */}
      <h1 className="sr-only">{t("posTitle")}</h1>
      <div className="flex min-h-0 flex-col gap-tight">
        {/* Header zone: counter chip · wide search · parked badge */}
        <div className="flex items-center gap-tight">
          <span className="hidden h-12 shrink-0 items-center rounded-sm border border-line bg-card px-comfortable text-[13px] text-muted sm:flex">{t("counter")}</span>
          <div className="flex h-12 min-w-0 flex-1 items-center gap-tight rounded-sm border border-line bg-card px-comfortable focus-within:border-inverse">
            <Search size={16} strokeWidth={1.5} className="shrink-0 text-faint" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search.placeholder")} className="h-full w-full bg-transparent text-sm outline-none placeholder:text-faint" />
            {query && <button type="button" onClick={() => setQuery("")} className="text-[12px] text-faint hover:text-fg">{t("search.clear")}</button>}
          </div>
          {parked.length > 0 && (
            <button type="button" onClick={() => setParkOpen(true)} className="flex h-12 shrink-0 items-center rounded-sm border border-ember bg-ember/10 px-comfortable text-[12px] text-brand-foreground">
              {t("parkedBadge", { count: parked.length })}
            </button>
          )}
        </div>
        {/* Category chips */}
        {/* Full-bleed and snapping. The row already scrolled, but the last chip
            was cut off INSIDE the page padding, which reads as a clipped
            container rather than as "there is more this way". Bleeding it to
            the screen edge puts the cut on the edge itself, which is the
            affordance everyone already knows. */}
        <div className="-mx-tight flex snap-x snap-mandatory gap-inline overflow-x-auto px-tight pb-inline [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[{ id: "all", name: t("categoryAll") }, ...chipCategories].map((c) => (
            <button key={c.id} type="button" onClick={() => setCategory(c.id)} className={`h-12 min-w-12 shrink-0 snap-start rounded-sm border px-comfortable text-sm ${category === c.id ? "border-ember bg-ember text-ink" : "border-line bg-card"}`}>{c.name}</button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {productsQ.loading ? (
            <div aria-busy="true" className="flex animate-pulse flex-col gap-tight p-section"><div className="h-4 w-1/3 rounded-xs bg-line" /><div className="h-4 w-2/3 rounded-xs bg-line" /><div className="h-4 w-1/2 rounded-xs bg-line" /></div>
          ) : (
            /* Rows, not photo tiles. The 4:3 band pushed the name, subtitle and
               price into a strip under 250px of picture and left room for only
               three products on a wide till. The photo is a 72px square now:
               it still helps recognition, it just stopped being the card. */
            <div className="grid grid-cols-1 gap-tight md:grid-cols-2 2xl:grid-cols-3">
              {shown.map((p) => (
                /* The price used to sit beside the text column, so at two
                   columns on a 1024 till the name had ~96px to live in and
                   wrapped to two lines while the subtitle truncated to
                   "Open entry · no …". Moving it onto the subtitle's row gives
                   the name the full width beside the thumbnail. */
                <div key={p.id} className="card-surface flex items-center overflow-hidden transition-colors duration-quick hover:bg-subtle">
                <button type="button" onClick={() => tapProduct(p)} className="flex min-w-0 flex-1 items-center gap-comfortable p-tight text-left active:bg-ember/10">
                  <ProductThumb images={p.images} name={p.name} bookingType={p.bookingType} size="thumb" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="line-clamp-2 text-[15px] font-semibold leading-tight">{p.name}</span>
                    <span className="mt-inline flex items-baseline gap-tight">
                      <span className="min-w-0 flex-1 truncate text-[12px] leading-tight text-muted">{behaviourSubtitle(p, { resources, team: teamQ.data?.data })}</span>
                      <span className="shrink-0 whitespace-nowrap text-[13px] font-medium">{formatMoney(Math.min(...(p.tiers.filter((t) => t.active).map((t) => t.price).concat(p.sections?.map((s) => s.price) ?? []).concat([Infinity]))), currency)}</span>
                    </span>
                    {/* What this product is doing RIGHT NOW, stated per booking
                        type — the next departure and its seats, how many lanes
                        are free, how much of today's allowance is left. The
                        till had all of it behind a tap; the counterfoil-pos
                        reference puts it on the list, because it is what the
                        counter is actually asked. */}
                    {(() => {
                      const live = posLiveState(p, DEMO_TODAY, nowMinutes, liveWords);
                      if (!live) return null;
                      return (
                        <span className={`mt-inline flex items-center gap-inline text-[12px] leading-tight ${live.tone === "none" ? "text-danger" : live.tone === "low" ? "font-medium text-brand-foreground" : "text-success"}`}>
                          {/* A dot ahead of the words. At a glance across a
                              wall of products the eye reads the colour before
                              it reads anything, which is the point of putting
                              the state on the tile — and the words carry it
                              anyway, so the dot is never the only signal. */}
                          <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden />
                          <span className="min-w-0 truncate">{live.text}</span>
                        </span>
                      );
                    })()}
                  </span>
                </button>
                </div>
              ))}
              <button type="button" onClick={() => setCustomOpen(true)} className="flex min-h-[88px] items-center justify-center gap-tight rounded-sm border border-dashed border-line text-muted transition-colors duration-quick hover:bg-subtle active:bg-ember/10">
                <Plus size={20} strokeWidth={1.5} /><span className="text-[13px]">{t("customAmount")}</span>
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
            <button type="button" onClick={() => setCartOpen(false)} className="flex h-12 items-center rounded-sm border border-line px-tight text-[12px] text-muted lg:hidden">{t("cart.close")}</button>
          )}
          <span className="flex-1" />
          <button type="button" disabled={cart.length === 0} onClick={() => { setParkName(customer); setParkOpen(true); }} className="flex h-12 items-center gap-inline rounded-sm border border-line px-tight text-[12px] text-muted disabled:text-faint" title={cart.length === 0 ? t("cart.parkNothing") : t("cart.parkThis")}>
            <Archive size={14} strokeWidth={1.5} />{t("cart.park")}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setCustomerOpen(true)}
          className={`flex min-h-14 w-full items-center gap-comfortable border-b border-line px-comfortable py-tight text-left transition-colors duration-quick active:bg-ember/10 ${attached ? "bg-subtle/60" : ""}`}
        >
          <UserRound size={18} strokeWidth={1.5} className={attached ? "shrink-0 text-fg" : "shrink-0 text-faint"} />
          <span className="flex min-w-0 flex-1 flex-col">
            {attached ? (
              <>
                <span className="truncate text-sm font-medium">{attached.name}</span>
                {(attached.phone || attached.email) && (
                  <span className="truncate font-mono text-[12px] text-muted">{attached.phone || attached.email}</span>
                )}
              </>
            ) : (
              <span className="text-sm text-muted">{t("cart.customer")}</span>
            )}
          </span>
          <span className="shrink-0 text-[13px] text-muted">{attached ? t("cart.customerChange") : t("cart.customerAdd")}</span>
          <ChevronRight size={16} strokeWidth={1.5} className="shrink-0 text-faint" />
        </button>

        {attached?.flagReason && (
          <div className="flex items-start gap-tight border-b border-line bg-warning/10 px-comfortable py-tight">
            <AlertTriangle size={14} strokeWidth={1.5} className="mt-px shrink-0 text-warning" />
            <p className="min-w-0 break-words text-[12px] text-warning">
              <span className="font-medium">{t("customerModal.flagged")}: </span>
              {attached.flagReason}
            </p>
          </div>
        )}
        {/* One scrolling region for the sale itself — the lines AND the rows
            that modify them. They used to be separate: the lines were flex-1
            between a header that grew (the customer row) and a footer that was
            never allowed to shrink (four rows, the totals, the methods and the
            charge bar). On a phone that arithmetic left the lines about thirty
            pixels, so the one thing a cart exists to show was the one thing you
            could not read. Only the payment controls are pinned now. */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="p-comfortable">
          {cart.length === 0 ? (
            <EmptyState title={t("cart.empty")} message={t("cart.emptyHint")} />
          ) : (
            <div className="flex flex-col gap-tight">
              {cart.map((e) => (
                <div key={e.id} className="border-b border-line pb-tight last:border-0">
                <div className="flex items-start gap-tight">
                  <div className="flex min-h-11 min-w-0 flex-1 cursor-pointer flex-col justify-center" role="button" tabIndex={0} onClick={() => { if (e.productId !== "custom") setSheet({ product: productById(e.productId)!, initial: e }); }} onKeyDown={(k) => { if (k.key === "Enter" && e.productId !== "custom") setSheet({ product: productById(e.productId)!, initial: e }); }}>
                    <div className="flex justify-between gap-tight text-sm font-medium"><span className="min-w-0 truncate">{e.productName}</span><span className="shrink-0 whitespace-nowrap">{formatMoney(entryTotal(e), currency)}</span></div>
                    <div className="text-[12px] text-muted">{[e.items.map((i) => `${i.qty} ${i.tierName}`).join(" · "), e.seatLabels?.length ? e.seatLabels.join(", ") : "", e.resourceLabel, e.providerLabel, e.partySize != null ? t("cart.groupOf", { count: e.partySize }) : ""].filter(Boolean).join(" · ")}{slotLabel(e)}</div>
                    {entryCoveredQty(e) > 0 && <div className="text-[12px] text-success">{t("cart.paidWithPass", { count: entryCoveredQty(e) })}</div>}
                    {e.lineDiscountAmount ? (
                      <div className="text-[12px] text-danger">−{formatMoney(e.lineDiscountAmount, currency)}</div>
                    ) : (e.lineDiscountPct ?? 0) > 0 ? (
                      <div className="text-[12px] text-danger">{t("cart.lineDiscount", { pct: e.lineDiscountPct ?? 0 })}</div>
                    ) : null}
                    {entryBalance(e) > 0 && <div className="text-[12px] text-muted">{t("cart.depositNow", { pct: productById(e.productId)?.policies?.depositPct ?? 0, balance: formatMoney(entryBalance(e), currency) })}</div>}
                  </div>
                  <button
                    type="button"
                    aria-label={t("cart.lineDiscountLabel")}
                    onClick={() => setLineDiscEdit((cur) => (cur === e.id ? null : e.id))}
                    className={`flex h-12 w-12 items-center justify-center rounded-sm border text-[12px] active:bg-ember/10 ${(e.lineDiscountPct ?? 0) > 0 || e.lineDiscountAmount ? "border-ember text-brand-foreground" : "border-line"}`}
                  >
                    {e.lineDiscountAmount ? "৳" : (e.lineDiscountPct ?? 0) > 0 ? `−${e.lineDiscountPct}%` : "%"}
                  </button>
                  {productById(e.productId)?.durationConfig && e.fixedPrice != null && e.slotEnd && (
                    <button type="button" onClick={() => extendEntry(e)} className="flex h-12 items-center justify-center rounded-sm border border-line px-tight text-[12px] active:bg-ember/10">
                      +{productById(e.productId)!.durationConfig!.incrementMinutes}m
                    </button>
                  )}
                  {e.productId !== "custom" && <button type="button" aria-label={t("cart.edit")} onClick={() => setSheet({ product: productById(e.productId)!, initial: e })} className="flex h-12 w-12 items-center justify-center rounded-sm border border-line active:bg-ember/10"><Pencil size={15} strokeWidth={1.5} /></button>}
                  <button type="button" aria-label={t("cart.remove")} onClick={() => setCart((c) => c.filter((x) => x.id !== e.id))} className="flex h-12 w-12 items-center justify-center rounded-sm border border-line text-danger active:bg-ember/10"><Trash2 size={15} strokeWidth={1.5} /></button>
                </div>
                {lineDiscEdit === e.id && (
                  <div className="mt-tight rounded-sm border border-line bg-subtle/50 p-tight">
                    <DiscountInput
                      compact
                      label={t("cart.lineDiscountLabel")}
                      mode={e.lineDiscountAmount != null ? "amount" : "percent"}
                      onMode={(m) =>
                        setCart((c) =>
                          c.map((x) =>
                            x.id === e.id
                              ? m === "amount"
                                ? { ...x, lineDiscountAmount: x.lineDiscountAmount ?? 0, lineDiscountPct: undefined }
                                : { ...x, lineDiscountPct: x.lineDiscountPct ?? 0, lineDiscountAmount: undefined }
                              : x,
                          ),
                        )
                      }
                      value={e.lineDiscountAmount != null ? e.lineDiscountAmount : (e.lineDiscountPct ?? 0)}
                      base={entryTotal(e)}
                      currency={currency}
                      onChange={(v) =>
                        setCart((c) =>
                          c.map((x) =>
                            x.id === e.id
                              ? x.lineDiscountAmount != null
                                ? { ...x, lineDiscountAmount: v }
                                : { ...x, lineDiscountPct: v }
                              : x,
                          ),
                        )
                      }
                    />
                  </div>
                )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-line p-comfortable">
          <CartRow icon={Percent} label={t("summary.discount")} value={manualDiscount > 0 ? (discountMode === "percent" ? `${discountPct}%` : formatMoney(manualDiscount, currency)) : t("summary.none")} open={cartRow === "discount"} onToggle={() => toggleRow("discount")}>
            {/* Four buttons meant a manager who agreed 12% had no way to say
                so and the till decided it was 10. The chips still fill the
                field; they just stopped being the whole menu — and money off
                is now as sayable as a percentage. */}
            <DiscountInput
              mode={discountMode}
              onMode={setDiscountMode}
              value={discountMode === "percent" ? discountPct : discountAmt}
              onChange={(v) => (discountMode === "percent" ? setDiscountPct(v) : setDiscountAmt(v))}
              base={Math.max(0, preBase)}
              currency={currency}
              className="mb-tight"
            />
          {overLimit && (
            <p className="mb-tight rounded-sm border border-line border-l-[3px] border-l-ember bg-card p-tight text-[12px]">
              {pt("pos.overPolicy", { limit: manualCapPct })}
            </p>
          )}
          {/* A manual discount needs a reason when the policy requires one. */}
          {discountPct > 0 && policyQ.data?.requireReason && (
            <input
              value={discountReason}
              onChange={(e) => setDiscountReason(e.target.value)}
              placeholder={pt("pos.reasonPlaceholder")}
              className={`mt-tight h-11 w-full rounded-sm border bg-card px-comfortable text-sm outline-none placeholder:text-faint ${reasonNeeded ? "border-danger" : "border-line focus:border-inverse"}`}
            />
          )}
          </CartRow>

          {/* An advance. Offered only where the business allows one, because a
              control that always refuses is worse than no control. */}
          {advanceAllowed && (
            <CartRow
              icon={Wallet}
              label={t("advance.label")}
              value={advanceValid ? t("advance.summary", { now: formatMoney(advance!, currency), later: formatMoney(total - advance!, currency) }) : t("advance.full")}
              open={cartRow === "advance"}
              onToggle={() => toggleRow("advance")}
            >
              <div className="flex flex-col gap-tight">
                <div className="flex items-center gap-tight">
                  <input
                    inputMode="decimal"
                    placeholder={t("advance.placeholder")}
                    aria-label={t("advance.label")}
                    value={advance == null ? "" : String(advance / 100)}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      if (!raw) return setAdvance(null);
                      const n = parseFloat(raw);
                      setAdvance(Number.isFinite(n) ? Math.max(0, Math.round(n * 100)) : null);
                    }}
                    className="h-12 min-w-0 flex-1 rounded-sm border border-line bg-card px-comfortable text-right font-mono text-sm outline-none focus:border-ember"
                  />
                  <button
                    type="button"
                    onClick={() => setAdvance(null)}
                    className={`h-12 shrink-0 rounded-sm border px-comfortable text-[13px] ${advance == null ? "border-ember bg-ember/10 text-brand-foreground" : "border-line"}`}
                  >
                    {t("advance.full")}
                  </button>
                </div>
                <div className="flex flex-wrap gap-tight">
                  {[advanceMin, Math.round(total / 2), total].map((amt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setAdvance(amt >= total ? null : amt)}
                      className="h-12 flex-1 rounded-sm border border-line bg-card px-tight text-[13px] active:bg-ember/10"
                    >
                      {i === 0 ? t("advance.minimum", { amount: formatMoney(amt, currency) }) : i === 1 ? t("advance.half") : t("advance.full")}
                    </button>
                  ))}
                </div>
                {advance != null && advance < advanceMin && (
                  <p className="text-[12px] text-danger">
                    {t("advance.belowMin", { amount: formatMoney(advanceMin, currency) })}
                  </p>
                )}
                {advanceValid && (
                  <p className="text-[12px] text-muted">
                    {t("advance.explain", { now: formatMoney(advance!, currency), later: formatMoney(total - advance!, currency) })}
                  </p>
                )}
              </div>
            </CartRow>
          )}

          <CartRow icon={TicketPercent} label={pt("list.coupon")} value={appliedCoupon ? (appliedCoupon.code ?? appliedCoupon.name) : t("summary.applyCoupon")} open={cartRow === "coupon"} onToggle={() => toggleRow("coupon")}>
          <div className="flex items-center justify-between gap-tight">
            <span className="shrink-0 text-[13px] text-muted">{pt("list.coupon")}</span>
            {appliedCoupon ? (
              <span className="flex min-w-0 items-center gap-inline text-[12px] text-success">
                <span className="truncate">{appliedCoupon.code ?? appliedCoupon.name}</span>
                <button type="button" aria-label={pt("pos.remove")} onClick={() => { setAppliedCoupon(null); setCouponError(null); }} className="text-danger">✕</button>
              </span>
            ) : (
              <span className="flex min-w-0 items-center gap-inline">
                <input value={couponInput} onChange={(e) => { setCouponInput(e.target.value); setCouponError(null); }} placeholder={pt("pos.couponPlaceholder")} className="h-11 w-28 rounded-sm border border-line bg-card px-tight text-sm uppercase outline-none placeholder:text-faint placeholder:normal-case focus:border-inverse" />
                <button type="button" onClick={applyCoupon} disabled={!couponInput.trim()} className="h-11 shrink-0 rounded-sm border border-inverse bg-inverse px-comfortable text-[12px] text-inverse-fg disabled:opacity-40">{pt("pos.apply")}</button>
              </span>
            )}
          </div>
          {couponError && (
            <p className="mb-tight text-[12px] text-danger">{pt(`pos.rejected.${couponError}` as never)}</p>
          )}
          {cartNotice && <div className="mb-tight"><BlockedNotice message={cartNotice} onDismiss={() => setCartNotice(null)} /></div>}

          {/* Credits pass */}
          </CartRow>

          <CartRow icon={Wallet} label={t("summary.passesMembership")} value={pass ? pass.code : t("summary.add")} open={cartRow === "passes"} onToggle={() => toggleRow("passes")}>
          <div className="mb-tight flex flex-wrap items-center justify-between gap-tight">
            <span className="text-[13px] text-muted">{t("summary.pass")}</span>
            {pass ? (
              <span className="flex items-center gap-inline text-[12px]">
                <span>{t("summary.passUsage", { code: pass.code, used: creditsUsed, left: pass.remaining - creditsUsed })}</span>
                <button type="button" aria-label={t("summary.removePass")} onClick={() => setPass(null)} className="text-danger">✕</button>
              </span>
            ) : (
              <button type="button" onClick={() => setPassOpen(true)} className="h-12 rounded-xs border border-line px-tight text-[12px]">{t("summary.redeemPass")}</button>
            )}
            <button type="button" onClick={() => setSettleOpen(true)} className="h-12 rounded-xs border border-line px-tight text-[12px]">{t("summary.settleBooking")}</button>
          </div>

          {/* Membership + points. Both need a customer attached, so the row
              says so rather than offering a control that cannot work. */}
          <div className="mb-tight flex flex-wrap items-center gap-tight">
            <button type="button" onClick={() => setMembershipOpen(true)} className="h-12 rounded-xs border border-line px-tight text-[12px]">{t("summary.sellMembership")}</button>
            {pointsAccount && program?.enabled && (
              <button type="button" onClick={() => setPointsOpen(true)} className="h-12 min-w-0 rounded-xs border border-line px-tight text-[12px]">
                <span className="truncate">{pointsToSpend > 0 ? t("summary.pointsApplied", { count: pointsToSpend }) : t("summary.spendPoints", { count: pointsAccount.balance })}</span>
              </button>
            )}
          </div>
          </CartRow>

          {/* The member price is an entitlement, so say whose it is. */}
          {benefit && (
            <div className="mb-tight rounded-sm border-l-2 border-ember bg-ember/5 px-comfortable py-tight">
              <p className="min-w-0 break-words text-[12px]">
                <span className="font-medium">{benefit.tierName}</span>
                {" · "}
                {t("summary.memberRate", { pct: benefit.discountBps / 100 })}
                {benefit.visitsLeft != null && ` · ${t("summary.memberVisits", { count: benefit.visitsLeft })}`}
              </p>
            </div>
          )}

          <div className="flex justify-between text-[13px] text-muted"><span>{t("summary.subtotal")}</span><span className="">{formatMoney(subtotal, currency)}</span></div>
          {lineDiscountTotal > 0 && <div className="flex justify-between text-[13px] text-muted"><span>{t("summary.lineDiscounts")}</span><span className="text-danger">−{formatMoney(lineDiscountTotal, currency)}</span></div>}
          {manualDiscount > 0 && <div className="flex justify-between text-[13px] text-muted"><span>{discountMode === "percent" ? t("summary.discountPct", { pct: discountPct }) : t("summary.discountFlat")}</span><span className="text-danger">−{formatMoney(manualDiscount, currency)}</span></div>}
          {couponDiscount > 0 && <div className="flex justify-between text-[13px] text-muted"><span>{appliedCoupon?.code ?? appliedCoupon?.name}</span><span className="text-danger">−{formatMoney(couponDiscount, currency)}</span></div>}
          {memberDiscount > 0 && <div className="flex justify-between text-[13px] text-muted"><span className="min-w-0 truncate">{t("summary.memberDiscount", { tier: benefit?.tierName ?? "" })}</span><span className="shrink-0 text-danger">−{formatMoney(memberDiscount, currency)}</span></div>}
          {pointsDiscount > 0 && <div className="flex justify-between text-[13px] text-muted"><span>{t("summary.pointsSpent", { count: pointsToSpend })}</span><span className="text-danger">−{formatMoney(pointsDiscount, currency)}</span></div>}
          {creditsValue > 0 && <div className="flex justify-between text-[13px] text-muted"><span>{t("summary.passCredits", { count: creditsUsed })}</span><span className="text-success">−{formatMoney(creditsValue, currency)}</span></div>}
          <div className="flex justify-between text-[13px] text-muted"><span>{t("summary.vat")}</span><span className="">{formatMoney(tax, currency)}</span></div>
          <div className="mt-tight flex items-baseline justify-between text-lg font-medium"><span>{t("summary.total")}</span><AnimatedMoney value={total} currency={currency} /></div>
          {depositBalance > 0 && (
            <>
              <button type="button" onClick={() => setPayInFull((v) => !v)} className="mt-tight flex w-full items-center justify-between text-[13px]">
                <span className="text-muted">{t("summary.payInFull")}</span>
                <span className={cn("flex h-6 w-10 shrink-0 items-center rounded-full px-0.5 transition-colors duration-quick", payInFull ? "bg-ember" : "bg-strong")}>
                  <span className={cn("h-5 w-5 rounded-full bg-card transition-transform duration-quick", payInFull && "translate-x-4")} />
                </span>
              </button>
              {balance > 0 && (
                <>
                  <div className="flex justify-between text-[13px]"><span>{t("summary.dueNow")}</span><span className="">{formatMoney(dueNow, currency)}</span></div>
                  <div className="flex justify-between text-[13px] text-muted"><span>{t("summary.balanceAtArrival")}</span><span className="">{formatMoney(balance, currency)}</span></div>
                </>
              )}
            </>
          )}

        </div>
        </div>

        <div className="border-t border-line p-comfortable">
          {/* Payment method — segmented control with a sliding thumb. Non-cash
              methods only appear when a live PSP account is connected. */}
          {(() => {
            const n = availableMethods.length;
            const pct = 100 / n;
            const idx = Math.max(0, availableMethods.findIndex((m) => m.value === method));
            return (
              <div className="relative mt-tight grid h-14 rounded-sm bg-line/60 p-inline" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
                {n > 1 && (
                  <span
                    aria-hidden
                    className="absolute inset-y-inline rounded-xs bg-ember transition-[left] duration-quick ease-counterfoil"
                    style={{ width: `calc(${pct}% - 8px)`, left: `calc(${idx * pct}% + 4px)` }}
                  />
                )}
                {availableMethods.map((m) => (
                  <button key={m.value} type="button" onClick={() => setMethod(m.value)} className={`relative z-10 text-[13px] transition-colors duration-quick ${method === m.value ? "font-medium text-ink" : "text-muted"}`}>{enumL.method(m.value)}</button>
                ))}
              </div>
            );
          })()}

          <Button size="lg" fullWidth className="mt-tight h-14" disabled={cart.length === 0 || overLimit || reasonNeeded} onClick={charge}>
            {/* The amount never wraps; the method gives way first on narrow screens. */}
            <span className="min-w-0 truncate">{cart.length > 0 ? t("chargeAmount", { amount: formatMoney(dueNow, currency), method: methodLabel }) : t("charge")}</span>
          </Button>
        </div>
      </div>

      {/* Phone summary bar — persistent door to the cart drawer */}
      {!cartOpen && (
        <button type="button" onClick={() => setCartOpen(true)} className="fixed inset-x-tight bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 flex h-14 items-center justify-between rounded-sm bg-inverse px-section text-inverse-fg shadow-lg rail:bottom-tight lg:hidden">
          <span className="text-sm">{customer ? t("phoneSummaryCustomer", { count: cart.length, customer }) : t("phoneSummary", { count: cart.length })}</span>
          <span className="text-sm">{t("viewCart", { amount: formatMoney(dueNow, currency) })}</span>
        </button>
      )}

      {sheet && <ProductSheet product={sheet.product} currency={currency} initial={sheet.initial} seatsInCart={seatsInCart} onAdd={upsertEntry} onClose={() => setSheet(null)} team={teamQ.data?.data ?? []} resources={resources} />}

      {/* Inline cash tender — a bottom sheet over the cart, no page navigation. */}
      {cashOpen && (() => {
        const tenderedMinor = (parseInt(tenderTaka || "0", 10) || 0) * 100;
        const changeMinor = tenderedMinor - dueNow;
        const enough = tenderedMinor >= dueNow;
        return (
          <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-inverse/40 backdrop-blur-sm" onClick={() => !cashSaving && setCashOpen(false)} aria-hidden />
            <div className="relative z-10 max-h-[90vh] overflow-y-auto rounded-t-md bg-sheet p-section" style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}>
              <div className="mx-auto w-full max-w-[520px]">
                <div className="mx-auto mb-tight h-1 w-10 rounded-full bg-line" aria-hidden />
                <div className="mb-section flex items-center justify-between">
                  <div>
                    <p className="type-label text-[13px] text-brand-foreground">{t("cash.label")}</p>
                    <h2 className="type-h2 text-lg">{balance > 0 ? t("cash.depositDue") : t("cash.amountDue")}</h2>
                  </div>
                  <button type="button" onClick={() => setCashOpen(false)} aria-label={t("cash.close")} className="flex h-10 w-10 items-center justify-center rounded-sm active:bg-ember/10"><X size={20} strokeWidth={1.5} /></button>
                </div>

                <div className="card-surface p-section">
                  <div className="flex justify-between text-muted"><span>{balance > 0 ? t("cash.depositDue") : t("cash.amountDue")}</span><span className="text-lg">{formatMoney(dueNow, currency)}</span></div>
                  {balance > 0 && <div className="mt-tight flex justify-between text-[13px] text-muted"><span>{t("summary.balanceAtArrival")}</span><span className="">{formatMoney(balance, currency)}</span></div>}
                  <div className="mt-tight flex justify-between"><span>{t("cash.tendered")}</span><span className="text-lg">{formatMoney(tenderedMinor, currency)}</span></div>
                  <div className={`mt-tight flex items-baseline justify-between font-medium ${enough ? "text-success" : "text-faint"}`}>
                    <span className="text-xl">{t("cash.change")}</span>
                    <span className="text-5xl">{enough ? formatMoney(changeMinor, currency) : "—"}</span>
                  </div>
                </div>

                {/* Quick chips: exact, then the common notes in the drawer. */}
                <div className="mt-section flex gap-tight">
                  <button type="button" onClick={() => setTenderTaka(String(Math.ceil(dueNow / 100)))} className="h-12 flex-1 rounded-sm border border-inverse bg-card text-sm active:bg-ember/10">{t("cash.exact")}</button>
                  {[500, 1000, 2000].map((amt) => (
                    <button key={amt} type="button" onClick={() => setTenderTaka(String(amt))} className="h-12 flex-1 rounded-sm border border-line bg-card text-sm active:bg-ember/10">৳{amt}</button>
                  ))}
                </div>

                <div className="mt-section">
                  <Keypad onKey={(d) => setTenderTaka((t) => (t + d).slice(0, 7))} onBackspace={() => setTenderTaka((t) => t.slice(0, -1))} />
                </div>

                <Button size="lg" fullWidth className="mt-section h-14" disabled={!enough} loading={cashSaving} onClick={() => completeCash(tenderedMinor, changeMinor)}>{t("cash.completeSale")}</Button>
              </div>
            </div>
          </div>
        );
      })()}

      <Modal open={customOpen} onClose={() => setCustomOpen(false)} title={t("custom.title")} footer={<><Button variant="secondary" onClick={() => setCustomOpen(false)}>{t("custom.cancel")}</Button><Button onClick={addCustom} disabled={!customAmount}>{t("custom.add")}</Button></>}>
        <div className="flex flex-col gap-section">
          <FormField label={t("custom.description")} placeholder={t("custom.descriptionPlaceholder")} value={customName} onChange={(e) => setCustomName(e.target.value)} />
          <FormField label={t("custom.amountLabel", { currency })} variant="number" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} />
          <FormField label={t("custom.taxClass")} variant="select" value={customTax} onChange={(e) => setCustomTax(e.target.value as typeof customTax)} options={[{ value: "standard", label: enumL.tax("standard") }, { value: "reduced", label: enumL.tax("reduced") }, { value: "exempt", label: enumL.tax("exempt") }]} />
        </div>
      </Modal>

      <CustomerPicker open={customerOpen} onClose={() => setCustomerOpen(false)} attached={attached} onAttach={setAttached} />

      <MembershipSheet
        open={membershipOpen}
        onClose={() => setMembershipOpen(false)}
        hasCustomer={!!attached?.id}
        onPick={(tier) => {
          addMembershipToCart(tier);
          setMembershipOpen(false);
        }}
      />
      <PointsSheet
        open={pointsOpen}
        onClose={() => setPointsOpen(false)}
        account={pointsAccount}
        program={program}
        maxPoints={maxPointsForSale}
        current={pointsToSpend}
        onApply={setPointsToSpend}
      />

      <Modal open={parkOpen} onClose={() => setParkOpen(false)} title={t("parked.title")} footer={<Button variant="secondary" onClick={() => setParkOpen(false)}>{t("parked.close")}</Button>}>
        <div className="flex flex-col gap-section">
          {cart.length > 0 && (
            <div className="flex items-end gap-tight">
              <FormField label={t("parked.parkAs")} placeholder={t("parked.parkAsPlaceholder")} value={parkName} onChange={(e) => setParkName(e.target.value)} className="flex-1" />
              <Button onClick={park}>{t("parked.park")}</Button>
            </div>
          )}
          {parked.length === 0 ? (
            <p className="text-[13px] text-muted">{t("parked.nothing")}</p>
          ) : (
            <div className="flex flex-col gap-tight">
              {parked.map((p, i) => (
                <div key={i} className="flex items-center justify-between rounded-sm border border-line p-comfortable">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-[12px] text-faint">{t("parked.lines", { count: p.cart.length, amount: formatMoney(p.cart.reduce((s, e) => s + (e.fixedPrice ?? 0) + e.items.reduce((x, i2) => x + i2.unitPrice * i2.qty, 0), 0), currency) })}</p>
                  </div>
                  <Button size="sm" onClick={() => resume(i)} disabled={cart.length > 0} >{t("parked.resume")}</Button>
                </div>
              ))}
              {cart.length > 0 && <p className="text-[12px] text-faint">{t("parked.parkFirst")}</p>}
            </div>
          )}
        </div>
      </Modal>

      <Modal open={settleOpen} onClose={closeSettle} title={t("settle.title")}>
        {!settleOrder ? (
          <div className="flex flex-col gap-section">
            <p className="text-[13px] text-muted">{t("settle.help")}</p>
            <FormField label={t("settle.refLabel")} value={settleRef} onChange={(e) => setSettleRef(e.target.value)} placeholder={t("settle.refPlaceholder")} />
            <Button onClick={findBooking} loading={settleLoading} disabled={!settleRef.trim()}>{t("settle.find")}</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-section">
            <div className="rounded-sm bg-subtle p-comfortable text-sm">
              <div className="flex items-center justify-between">
                <span className="font-mono">{settleOrder.reference}</span>
                <span className="text-[12px] text-muted">{enumL.status(settleOrder.status)}</span>
              </div>
              {settleOrder.customerName && <p className="mt-inline text-muted">{settleOrder.customerName}</p>}
              <div className="mt-tight flex justify-between"><span className="text-muted">{t("settle.total")}</span><span className="tabular-nums">{formatMoney(settleOrder.total, currency)}</span></div>
              <div className="flex justify-between"><span className="text-muted">{t("settle.paid")}</span><span className="tabular-nums">{formatMoney(settlePaid, currency)}</span></div>
              <div className="flex justify-between font-medium"><span>{t("settle.outstanding")}</span><span className="tabular-nums text-warning">{formatMoney(settleOutstanding, currency)}</span></div>
            </div>
            {settleOutstanding > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-tight">
                  {(["cash", "bkash", "card_terminal", "bangla_qr"] as PaymentMethod[]).map((m) => (
                    <Button key={m} variant={settleMethod === m ? "primary" : "secondary"} className="h-12" onClick={() => setSettleMethod(m)}>{enumL.method(m)}</Button>
                  ))}
                </div>
                <Button onClick={takeSettle} loading={settling}>{t("settle.take", { amount: formatMoney(settleOutstanding, currency) })}</Button>
              </>
            ) : (
              <p className="rounded-sm bg-success/10 py-tight text-center text-sm font-medium text-success">{t("settle.fullyPaid")}</p>
            )}
            <button type="button" onClick={() => { setSettleOrder(null); setSettleRef(""); }} className="text-center text-[13px] text-faint hover:text-fg">{t("settle.lookupAnother")}</button>
          </div>
        )}
      </Modal>

      <Modal open={passOpen} onClose={() => setPassOpen(false)} title={t("pass.title")} footer={<><Button variant="secondary" onClick={() => setPassOpen(false)}>{t("pass.cancel")}</Button><Button onClick={applyPass} disabled={!passCode.trim()} loading={passLoading}>{t("pass.apply")}</Button></>}>
        <div className="flex flex-col gap-section">
          <FormField label={t("pass.codeLabel")} placeholder={t("pass.codePlaceholder")} value={passCode} onChange={(e) => setPassCode(e.target.value)} help={t("pass.help")} />
        </div>
      </Modal>

      {/* Non-cash wallet flow — pending → confirmed | failed. Nothing is
          charged and no tickets exist until the payment confirms. */}
      <Modal open={!!nc} onClose={() => setNc(null)} title={nc?.method === "bkash" ? t("wallet.bkashTitle") : t("wallet.qrTitle")}>
        {nc?.state === "failed" ? (
          <div className="flex flex-col gap-section">
            <div className="rounded-sm border border-danger/40 bg-danger/10 p-comfortable text-sm text-danger">
              {t("wallet.failed")}
            </div>
            <div className="flex gap-tight">
              <Button variant="secondary" fullWidth onClick={() => setNc(null)}>{t("wallet.cancelSale")}</Button>
              <Button fullWidth onClick={() => setNc({ ...nc, state: "pending", txn: "" })}>{t("wallet.tryAgain")}</Button>
            </div>
          </div>
        ) : nc?.method === "bkash" ? (
          <div className="flex flex-col gap-section">
            <p className="text-sm text-muted">{t("wallet.bkashInstruction", { amount: formatMoney(dueNow, currency), number: "01711-000000" })}</p>
            <FormField label={t("wallet.txnLabel")} placeholder={t("wallet.txnPlaceholder")} value={nc.txn} onChange={(e) => setNc({ ...nc, txn: e.target.value.toUpperCase() })} />
            <div className="flex gap-tight">
              <Button variant="secondary" fullWidth onClick={() => setNc({ ...nc, state: "failed" })}>{t("wallet.itFailed")}</Button>
              <Button fullWidth disabled={nc.txn.trim().length < 6} onClick={async () => { const txn = nc.txn.trim(); setNc({ ...nc, state: "confirmed" }); await settleInline(t("wallet.bkashConfirmedNote", { txn }), txn); setNc(null); }}>
                {nc.state === "confirmed" ? t("wallet.confirming") : t("wallet.paymentReceived")}
              </Button>
            </div>
          </div>
        ) : nc ? (
          <div className="flex flex-col gap-section">
            {/* Stand-in QR — a real terminal renders the payload from the PSP. */}
            <div className="mx-auto grid w-40 grid-cols-8 gap-px rounded-sm border border-line bg-card p-tight" aria-label={t("wallet.qrAlt")}>
              {Array.from({ length: 64 }, (_, i) => (
                <span key={i} className={`aspect-square ${((i * 7 + 3) % 5 < 2 || i % 9 === 0) ? "bg-fg" : "bg-card"}`} />
              ))}
            </div>
            <p className="text-center text-lg">{formatMoney(dueNow, currency)}</p>
            <p className="text-center text-[13px] text-muted">{t("wallet.qrInstruction")}</p>
            <div className="flex gap-tight">
              <Button variant="secondary" fullWidth onClick={() => setNc({ ...nc, state: "failed" })}>{t("wallet.itFailed")}</Button>
              <Button fullWidth onClick={async () => { setNc({ ...nc, state: "confirmed" }); await settleInline(t("wallet.qrConfirmedNote")); setNc(null); }}>
                {nc.state === "confirmed" ? t("wallet.confirming") : t("wallet.paymentReceived")}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
