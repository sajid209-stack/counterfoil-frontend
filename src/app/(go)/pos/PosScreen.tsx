"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEnumLabels } from "@/lib/labels";
import { Archive, Banknote, Check, CupSoda, Sparkles, ShoppingBag, Wrench, ChevronLeft, CreditCard, QrCode, Send, Percent, Plus, Search, Ticket, Trash2, Wallet, X, type LucideIcon } from "lucide-react";
import { BlockedNotice, Button, DiscountInput, FormField, Modal, ProductThumb, useToast, type DiscountMode } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { counterEvents, counterItems, inventoryItem, inventoryLineId, levelOf, peekTicketCodeSettings, tillMethods, advanceMinimum, checkout, getAdvancePolicy, earnPoints, getLoyaltyAccount, getLoyaltyProgram, getManualDiscountPolicy, getMemberBenefit, getOperator, isOpenOn, isResourceFreeFor, listLocations, listPaymentAccounts, listProducts, listResources, listRoles, listStaff, logOrderAction, placeCheckoutHold, quoteCart, releaseCheckoutHolds, spendPoints, issueMembership, type AppliedPromotion, type CheckoutLine, type MembershipTier, type PaymentMethod, type Product, type QuoteLine, type InventoryItemView, type EventRecord } from "@/lib/api";
import { buildOrderLines } from "@/lib/orderMath";
import { DEMO_TILL_ID } from "@/lib/session";
import { useActiveCounterNow } from "@/lib/activeCounter";
import { DEMO_NOW_MINUTES, DEMO_TODAY, isFlexibleResource, isResourceType, needsSchedule, slotISO, toMinutes, toTime } from "@/lib/schedule";
import { flexDurations } from "@/lib/sale/selection";
import { resolveProductPrice } from "@/lib/pricing";
import { productDurationPrice } from "@/lib/duration";
import { useBehaviourSubtitle } from "@/lib/behaviour";
import { posLiveState } from "@/lib/posState";
import { taxRateFor } from "@/lib/tax";
import { FEATURES } from "@/lib/features";
import { formatClock, formatDay, formatMoney, formatPriceShort } from "@/lib/format";
import { cn } from "@/lib/cn";
import { CustomerPicker, type AttachedCustomer } from "./CustomerPicker";
import { CustomerRow, HowMuchNow, PromoCodeRow, SaleRow, type PayChoice } from "./CheckoutParts";
import { SellDateBar } from "./SellDate";
import { MembershipSheet, PointsSheet } from "./MemberSheets";
import { ProductSheet, type CartEntry } from "../_components/ProductSheet";
import { WALL_CARD, WallHeading, WallTile } from "../_components/WallTile";
import { ActionBar } from "../_components/ActionBar";
import { EventSheet } from "../_components/EventSheet";
import { Keypad } from "../_components/Keypad";
import { Pencil } from "lucide-react";
import { usePrefs } from "@/lib/prefs";
import { ticketSnapshot } from "./_lib/handover";
import { clearLiveSale, readLiveSale, takeReturnTo, writeLiveSale, writeUndoSnapshot, type LiveSale } from "./_lib/liveSale";

const TODAY = DEMO_TODAY;
// Payment methods this counter takes (would come from counter config).
// The signed-in staff member (mock session): Nadia, whose role sets her limits.
/** A method is recognised at the counter as an object, not a word: cash is a
 *  note, bKash is a send, the QR is a code, the terminal is a card. */
const METHOD_ICON: Partial<Record<PaymentMethod, LucideIcon>> = {
  cash: Banknote,
  bkash: Send,
  bangla_qr: QrCode,
  card_terminal: CreditCard,
};
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

/** The till. Rendered from the /pos LAYOUT rather than from a page file, so
 *  that /pos and /pos/cart are real routes without the sale having to move.
 *  A Next layout stays mounted while you navigate between its child routes; a
 *  page does not. The sale — lines, customer, discount, promo code, points,
 *  what is paid now and the slots this till is holding — is ~700 lines of state,
 *  derivation and the checkout path living in one component, and lifting all
 *  of that into a provider is a refactor of the money path, not a routing
 *  change. Mounting once at the layout buys the real URLs today and leaves
 *  that refactor free to happen later without moving them again. */
/** What kind of thing it is, at a glance. An item has no photograph — and a
 *  wall of identical boxes is harder to scan than four shapes. */
function ShopGlyph({ kind }: { kind: "merch" | "food" | "equipment" | "service" }) {
  const Icon = kind === "food" ? CupSoda : kind === "equipment" ? Wrench : kind === "service" ? Sparkles : ShoppingBag;
  return <Icon size={20} strokeWidth={1.5} aria-hidden />;
}

/** A booking with a day to choose — the ones the wall's date applies to.
 *  The same condition the booking sheet draws its date strip under. */
const isDatedProduct = (p: Product) =>
  needsSchedule(p.bookingType) || p.bookingType === "BT-10" || p.bookingType === "BT-02";

export default function PosScreen({ view }: { view: "grid" | "cart" }) {
  const router = useRouter();
  const toast = useToast();
  const t = useTranslations("pos");
  const subtitle = useBehaviourSubtitle();
  const pt = useTranslations("promotions");
  const enumL = useEnumLabels();
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100, filters: { status: "active" } }), []);
  const opQ = useApiQuery(() => getOperator(), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 1, filters: { status: "active" } }), []);
  const teamQ = useApiQuery(() => listStaff({ pageSize: 100, filters: { status: "active" } }), []);
  const resourcesQ = useApiQuery(() => listResources({ pageSize: 100 }), []);
  const rolesQ = useApiQuery(() => listRoles({ pageSize: 100 }), []);
  const payAcctsQ = useApiQuery(() => listPaymentAccounts({ pageSize: 100 }), []);
  const policyQ = useApiQuery(() => getManualDiscountPolicy(), []);
  const advanceQ = useApiQuery(() => getAdvancePolicy(), []);
  // Non-cash tender needs a live PSP account (charges enabled). Cash always works.
  const nonCashOk = (payAcctsQ.data?.data ?? []).some((a) => a.status === "active" && a.chargesEnabled);
  // Which buttons, and in what order, is the business's call — Settings → Payments.
  const availableMethods = tillMethods(nonCashOk).map((value) => ({ value }));

  // "Ask a manager" gating reads the signed-in staff's ROLE — no hardcoded cap.
  const myRole = rolesQ.data?.data.find((r) => r.id === teamQ.data?.data.find((s) => s.id === SIGNED_IN_STAFF_ID)?.roleId);
  const discountLimit = myRole?.discountLimitPct ?? Infinity;

  /* The sale in progress survives a tab change. `PosScreen` is mounted by the
     layout only on /pos and /pos/cart, so tapping Schedule unmounts it — and
     before this, the sale silently went with it. Read through lazy
     initialisers rather than an effect: restoring is what this state IS on
     mount, not something that happens to it afterwards. */
  /* Held in state, not a ref: the React Compiler forbids reading a ref during
     render, and every initialiser below reads this one. A lazy useState runs
     the read exactly once, on mount, which is when restoring means anything. */
  const [restored] = useState(readLiveSale);
  const [cart, setCart] = useState<CartEntry[]>(restored?.cart ?? []);
  const [sheet, setSheet] = useState<{ product: Product; initial: CartEntry | null; preset?: { date?: string; time?: string; resourceId?: string } } | null>(null);
  const [category, setCategory] = useState("all");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  /** How much of the total is paid now, chosen in the payment step. null is
   *  the default: all of it — or the booking's own advance, where it needs one.
   *  Held as the CHOICE rather than an amount, so Half stays half when a
   *  discount or a code changes the total. */
  const [payChoice, setPayChoice] = useState<PayChoice | null>(restored?.payChoice ?? null);
  /** The day the wall is selling for. Today unless the cashier picks another;
   *  part of the live sale, so a trip to the Schedule does not lose it. */
  const [sellDate, setSellDate] = useState<string>(restored?.sellDate ?? TODAY);
  /** Whether the payment step's discount row is open. */
  const [discOpen, setDiscOpen] = useState(false);
  const [discountPct, setDiscountPct] = useState(restored?.discountPct ?? 0);
  /** A manager says "ten percent" or "take two hundred off" — both are real,
   *  and only one used to be expressible. The engine has always taken an
   *  absolute amount, so this is a question of what the cashier types. */
  const [discountMode, setDiscountMode] = useState<DiscountMode>(restored?.discountMode ?? "percent");
  const [discountAmt, setDiscountAmt] = useState(restored?.discountAmt ?? 0);
  const [discountReason, setDiscountReason] = useState(restored?.discountReason ?? "");
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedPromotion | null>(restored?.coupon ?? null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [query, setQuery] = useState("");
  const [customTax, setCustomTax] = useState<"standard" | "reduced" | "exempt">("standard");
  // The attached customer RECORD (Milestone 2). `customer` stays as the name
  // snapshot the cart and receipt read, so nothing downstream had to change.
  const [attached, setAttached] = useState<AttachedCustomer | null>(restored?.attached ?? null);
  /** Which cart line has its discount open for editing. Tapping % used to
   *  CYCLE 0→5→10→15→0, so reaching 12 was impossible and reaching 5 from 15
   *  meant three more taps. It opens a field now. */
  const [lineDiscEdit, setLineDiscEdit] = useState<string | null>(null);
  const customer = attached?.name ?? "";
  const [customerOpen, setCustomerOpen] = useState(false);

  // ── Membership + points (Milestone 2). Both hang off the ATTACHED customer,
  //    so removing the customer removes the benefit — no stale member price.
  const benefitQ = useApiQuery(() => getMemberBenefit(attached?.id ?? null), [attached?.id]);
  // Gated at the source: with no benefit, no account and no programme, every
  // downstream sum and every control that reads them goes quiet at once —
  // rather than nine separate places each remembering to check a flag.
  const benefit = FEATURES.memberships && attached?.id ? (benefitQ.data ?? null) : null;
  const pointsQ = useApiQuery(
    () =>
      attached?.id
        ? getLoyaltyAccount(attached.id)
        : Promise.resolve({ ok: true as const, data: null }),
    [attached?.id],
  );
  const pointsAccount = FEATURES.loyalty && attached?.id ? (pointsQ.data ?? null) : null;
  const programQ = useApiQuery(() => getLoyaltyProgram(), []);
  const program = FEATURES.loyalty ? programQ.data : null;
  const [pointsToSpend, setPointsToSpend] = useState(restored?.pointsToSpend ?? 0);
  const [pointsOpen, setPointsOpen] = useState(false);
  const [membershipOpen, setMembershipOpen] = useState(false);

  // Parked carts survive navigation within the session (sessionStorage).
  type Parked = { name: string; cart: CartEntry[]; discountPct: number; customer: string; customerRecord?: AttachedCustomer | null };
  const [parked, setParked] = useState<Parked[]>(() => {
    try { return JSON.parse(sessionStorage.getItem("pos_parked") ?? "[]"); } catch { return []; }
  });
  const [parkOpen, setParkOpen] = useState(false);
  const [parkName, setParkName] = useState("");
  /* The cart is a route, so "is it open" is a question about the URL. */
  const cartOpen = view === "cart";

  /* The cart is a destination, so it behaves like one: opening it pushes a
     history entry and the system back button closes it. Without this, "Back"
     in its header would be a label on a dismiss, and a cashier pressing the
     phone's own back would leave the till mid-sale instead of returning to the
     grid — which is exactly the predictable-back rule this reads against.
     pushState rather than the router: the cart's whole state lives in this
     component, and a real navigation would unmount it. */
  const openCart = () => router.push("/pos/cart");
  /* back(), not push("/pos"): pushing would grow the history so the phone's
     own back button returned to the cart a cashier had just left. */
  const closeCart = () => router.back();
  const [cartNotice, setCartNotice] = useState<string | null>(null); // refusal guidance
  // Non-cash simulated flow: bKash asks for the transaction ID, QR shows the
  // code to scan. Both pass pending → confirmed | failed before the sale lands.
  const [nc, setNc] = useState<null | { method: "bkash" | "bangla_qr"; state: "pending" | "confirmed" | "failed"; txn: string }>(null);
  // Inline cash checkout — replaces the /pos/payment page navigation.
  const [clearOpen, setClearOpen] = useState(false);
  /* Whether this till draws the number pad, and the way past it for one sale.
     `padOpen` resets with the screen, so turning it off is still off next
     time — a preference a stray tender could silently undo would not be one. */
  const prefs = usePrefs();
  const [padOpen, setPadOpen] = useState(false);
  const [cashOpen, setCashOpen] = useState(false);
  /* What the cashier says they were handed. **Empty means the exact amount**,
     which is what every serious POS defaults to — Shopify POS pre-fills "the
     correct amount of the order" and offers suggestions under it. It saves a
     tap on every exact cash sale, which at a Bangladeshi counter is most of
     them, and WCAG 2.2's `redundant-entry` is the principle: do not ask for
     information the system already has.

     Derived rather than set once, so it cannot go stale if the sale changes
     under it, and so clearing the pad returns to the default instead of to
     zero — a till that reads "received ৳0" is a till that refuses to complete. */
  const [tenderTaka, setTenderTaka] = useState("");
  const [cashSaving, setCashSaving] = useState(false);
  /* Hold the sale. sessionStorage is an external store, so writing to it is
     what an effect is for — and it is a write, never a setState. */
  useEffect(() => {
    writeLiveSale({ cart, discountMode, discountPct, discountAmt, discountReason, attached, coupon: appliedCoupon, payChoice: payChoice ?? undefined, sellDate, pointsToSpend });
  }, [cart, discountMode, discountPct, discountAmt, discountReason, attached, appliedCoupon, payChoice, sellDate, pointsToSpend]);

  /** Everything about a sale other than its lines: who it is for, what was
   *  taken off, how much is paid now, and the day the wall was set to. A
   *  paused or cleared sale takes all of it with it, so the next customer does
   *  not inherit the last one's discount or their Friday. */
  const resetSaleOptions = () => {
    setPayChoice(null);
    setSellDate(TODAY);
    setDiscOpen(false);
    setDiscountMode("percent"); setDiscountAmt(0); setDiscountPct(0); setDiscountReason("");
    setAttached(null);
    setAppliedCoupon(null); setCouponInput(""); setCouponError(null);
    setPointsToSpend(0);
  };
  const persistParked = (list: Parked[]) => { setParked(list); sessionStorage.setItem("pos_parked", JSON.stringify(list)); };
  const park = () => {
    if (cart.length === 0) return;
    persistParked([...parked, { name: parkName.trim() || t("parked.guestName", { number: parked.length + 1 }), cart, discountPct, customer, customerRecord: attached }]);
    setCart([]);
    resetSaleOptions();
    void releaseCheckoutHolds(TILL_ID);
    clearLiveSale();
    /* A paused or cleared sale forgets where it came from, so the next,
       unrelated sale does not finish on the Schedule. */
    takeReturnTo();
    setParkOpen(false); setParkName("");
    toast.success(t("cartParked"));
  };
  /** Everything `park` does except keeping the sale. Holds go back on public
   *  sale, which is why this asks first and does not offer Undo. */
  const clearSale = () => {
    setCart([]);
    resetSaleOptions();
    void releaseCheckoutHolds(TILL_ID);
    clearLiveSale();
    takeReturnTo();
    setClearOpen(false);
    toast.success(t("cart.cleared"));
  };
  const resume = (i: number) => {
    const p = parked[i];
    if (!p) return;
    setCart(p.cart); setDiscountPct(p.discountPct); setAttached(p.customerRecord ?? (p.customer ? { id: null, name: p.customer } : null));
    persistParked(parked.filter((_, x) => x !== i));
    setParkOpen(false);
  };

  const operator = opQ.data;
  const currency = operator?.currency ?? "BDT";
  /* The venue this counter stands in — not the first location by name, which
     is what the till used and which filed every sale at the wrong museum. It
     decides where the money is recorded AND which shelf the stock comes off,
     and those two must be the same place. */
  const activeCounter = useActiveCounterNow();
  const tillLocationId = activeCounter.locationId || (locationsQ.data?.data[0]?.id ?? "loc_fort");
  const allowedHere = activeCounter.counter?.allowedProductIds ?? "all";
  /* The wall is this venue's catalogue, and what this counter is set up to
     sell (Settings, Counters). A product kept at the fort is not on the
     museum's wall. */
  const products = useMemo(
    () => (productsQ.data?.data ?? []).filter((p) => p.locationIds.includes(tillLocationId) && (allowedHere === "all" || allowedHere.includes(p.id))),
    [productsQ.data, tillLocationId, allowedHere],
  );
  const resources = resourcesQ.data?.data ?? [];
  const productById = (id: string) => products.find((p) => p.id === id);

  /** Everything this till can actually sell, before the cashier narrows it.
   *  The chip row is built from THIS rather than from the filtered grid, so
   *  chips do not disappear from under the finger as someone types. */
  const sellable = products.filter((p) => p.bookingType !== "BT-14");
  /** Whether anything on the wall has a day to choose. A shop-only venue has
   *  none, and a date control there would be furniture. */
  const anyDated = sellable.some(isDatedProduct);

  /* The shelf, as tiles.
     A booking opens a sheet because there is something to decide — a date, a
     lane, how many of which ticket. A tote bag has none of that, so it goes
     straight into the sale on one tap, which is what every retail till does
     with an item that has no variations. Kept out of the catalogue's chips
     because these are not bookings: one chip of their own, and only when this
     counter's venue actually keeps something. */
  const shopItems = useMemo(
    () => counterItems(tillLocationId),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- derived from the store; the cart changing is when it can have moved
    [tillLocationId, cart],
  );
  const SHOP = "shop";
  /* Events at the counter. Like the shelf, one chip of their own rather than a
     category: an event is not a booking — it has days and ticket types, no
     schedule and no resources — and filing it under the catalogue's groups
     would put it behind a chip that means something else. Only events this
     counter's venue actually sells. */
  const eventsForSale = useMemo(
    () => counterEvents(tillLocationId),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- derived from the store; the cart changing is when it can have moved
    [tillLocationId, cart],
  );
  const EVENTS = "events";
  const [eventSheet, setEventSheet] = useState<EventRecord | null>(null);
  /** The cheapest ticket somebody could still buy — what a tile leads with,
   *  the same "from" price the event's own page states. */
  const eventFromPrice = (e: EventRecord) => {
    const open = e.tiers.filter((t) => t.sold < t.quantity);
    return open.length ? Math.min(...open.map((t) => t.price)) : Math.min(...e.tiers.map((t) => t.price), 0);
  };
  /** Places left across the whole event, so a tile can say it is nearly gone. */
  const eventPlacesLeft = (e: EventRecord) =>
    e.tiers.reduce((n, t) => n + Math.max(0, t.quantity - t.sold), 0);
/** Units that count rather than name. A tile says "sold by the bottle" and
 *  stays quiet about "each", which tells a cashier nothing they cannot see. */
const GENERIC_UNITS = new Set(["each", "unit", "units", "item", "items", "pc", "pcs", "piece", "pieces"]);
  /* The wall shows what is sold, filtered by KIND — bookings, the shelf, event
     tickets — and by the search box. Catalogue groups are gone: they were a
     taxonomy somebody had to maintain, and the search already spans every
     name. */
  const shown = products
    .filter((p) => p.bookingType !== "BT-14") // field passes issue from Quick pass, not the grid
    /* A kind chip that is not "all" empties the wall of bookings on its own and
       the shelf or the events below take over. */
    .filter(() => category === "all")
    .filter((p) => {
      const q = query.trim().toLowerCase();
      return !q || p.name.toLowerCase().includes(q);
    });
  /* The shelf answers the same search box — a cashier typing "water" means
     the bottle, and having to know which chip it lives under first is the
     kind of thing that makes a queue. */
  /* A heading is worth drawing only when both kinds are on screen; with one
     of them it would name the only thing there. */
  const shownItems = shopItems.filter((i) => {
    if (category !== "all" && category !== SHOP) return false;
    const q = query.trim().toLowerCase();
    return !q || i.name.toLowerCase().includes(q) || (i.sku ?? "").toLowerCase().includes(q);
  });
  const shelfHeading = shownItems.length > 0 && shown.length > 0;
  const shownEvents = eventsForSale.filter((e) => {
    if (category !== "all" && category !== EVENTS) return false;
    const q = query.trim().toLowerCase();
    return !q || e.title.toLowerCase().includes(q) || e.venueName.toLowerCase().includes(q);
  });
  const customTile = (
    <button type="button" data-wall-tile data-focus-inset onClick={() => setCustomOpen(true)} className={cn(WALL_CARD, "min-h-[9.5rem] items-center justify-center gap-tight text-center text-muted hover:bg-muted-wash/60 active:bg-ember/10 sm:min-h-[10.5rem]")}>
      <span className="flex size-11 items-center justify-center rounded-full border-2 border-dashed border-strong"><Plus size={20} strokeWidth={2} aria-hidden /></span>
      <span className="text-[0.875rem] font-medium">{t("customAmount")}</span>
    </button>
  );
  /* What to show. Three at most, each a KIND of thing rather than a group
     somebody named, and each only when there is something in it. */
  const wallGroups = [
    { id: "all", name: t("categoryAll") },
    ...(shopItems.length > 0 ? [{ id: SHOP, name: t("shop.chip") }] : []),
    ...(eventsForSale.length > 0 ? [{ id: EVENTS, name: t("event.chip") }] : []),
  ];
  /** The price a tile quotes: what one tap on it sells, now. Not the
   *  cheapest ticket (General Admission read ৳300 — the child ticket — and its
   *  sheet opened on Adult at ৳500), and not a list price no hour charges
   *  (bowling read ৳800 while every lane sold at ৳1,000 at noon). A cashier
   *  reads this number out to a customer, so it has to be the one the sale
   *  will actually carry. */
  const tilePrice = (p: Product) => {
    const tiers = p.tiers.filter((x) => x.active && !x.donation);
    const base = tiers.length ? Math.min(...tiers.map((x) => x.price)) : 0;
    /* Noon on a day that has not started; the next hour on today. */
    const noon = toTime(Math.max(12 * 60, Math.ceil(nowMinutes / 60) * 60));
    if (isFlexibleResource(p.bookingType)) {
      const d = flexDurations(p)[0] ?? 60;
      return productDurationPrice(p, sellDate, noon, d, base);
    }
    if (isResourceType(p.bookingType)) return resolveProductPrice(p, sellDate, noon, base);
    if (p.sections?.length && !tiers.length) return Math.min(...p.sections.map((x) => x.price));
    return tiers[0]?.price ?? base;
  };
  /** How many THINGS are in the sale, as the tiles count them — two waters and
   *  a tote bag are three, not "2 items". A booking that is one thing (a field
   *  hour, a lane) counts once; add-ons and premiums are not things. */
  const unitCount = cart.reduce((n, e) => {
    if (e.fixedPrice != null || e.seatLabels?.length) return n + Math.max(1, e.seatLabels?.length ?? 1);
    const tiers = new Set([...(productById(e.productId)?.tiers.map((x) => x.id) ?? []), ...(productById(e.productId)?.sections?.map((x) => x.id) ?? [])]);
    const q = e.items.filter((i) => tiers.has(i.tierId) || e.productId.startsWith("inv_") || e.productId === "custom").reduce((a, i) => a + i.qty, 0);
    return n + Math.max(1, q);
  }, 0);
  /** How many of a booking are already in this sale: its tickets, or its
   *  lines where a line is one booking (a field hour, a lane). */
  const inSale = (productId: string) =>
    cart
      .filter((e) => e.productId === productId)
      .reduce((n, e) => {
        if (e.fixedPrice != null || e.seatLabels?.length) return n + Math.max(1, e.seatLabels?.length ?? 1);
        const tiers = new Set(productById(productId)?.tiers.map((x) => x.id) ?? []);
        const q = e.items.filter((i) => tiers.has(i.tierId)).reduce((a, i) => a + i.qty, 0);
        return n + Math.max(1, q);
      }, 0);

  // If non-cash becomes unavailable (no live PSP account), fall back to cash.
  useEffect(() => {
    if (!nonCashOk && method !== "cash") setMethod("cash");
  }, [nonCashOk, method]);

  // Deep-link from the Schedule tab: open a product's sheet on arrival, on the
  // slot that was tapped. A schedule whose rows are a time and a field, landing
  // on a sheet set to some other time, makes the cashier choose it twice.
  useEffect(() => {
    const id = sessionStorage.getItem("pos_open_product");
    if (id && products.length) {
      const raw = sessionStorage.getItem("pos_open_slot");
      sessionStorage.removeItem("pos_open_product");
      sessionStorage.removeItem("pos_open_slot");
      const p = products.find((x) => x.id === id);
      let preset: { date?: string; time?: string; resourceId?: string } | undefined;
      try {
        preset = raw ? JSON.parse(raw) : undefined;
      } catch {
        preset = undefined;
      }
      if (p) setSheet({ product: p, initial: null, preset });
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

  /**
   * Selling something off the shelf: one tap, and a second tap is one more.
   *
   * No sheet, because there is nothing in an item to configure — the same rule
   * `tapProduct` already applies to a single-tier booking. An item with none
   * left stays tappable and says why rather than being a dead square: this
   * app's own rule, from the slot grid, is that a refusal names its mechanism.
   */
  const tapItem = (i: InventoryItemView) => {
    const lineId = inventoryLineId(i.id);
    const have = cart.find((e) => e.productId === lineId)?.items[0]?.qty ?? 0;
    if (i.tracked && have >= i.onHand) {
      toast.error(i.onHand <= 0 ? t("shop.none", { name: i.name }) : t("shop.allOfIt", { count: i.onHand, unit: i.unit, name: i.name }));
      return;
    }
    if (have > 0) {
      setCart((c) => c.map((e) => (e.productId === lineId ? { ...e, items: [{ ...e.items[0], qty: e.items[0].qty + 1 }] } : e)));
      return;
    }
    setCart((c) => [
      ...c,
      {
        id: `entry_${globalThis.crypto.randomUUID().slice(0, 8)}`,
        productId: lineId,
        productName: i.name,
        /* Its own rate AND its own class: an item carries the tax it is sold
           at, rather than inheriting a booking's. */
        taxRatePct: i.taxClass === "exempt" ? 0 : i.taxClass === "reduced" ? (operator?.reducedRatePct ?? 0) : (operator?.taxRatePct ?? 0),
        taxClass: i.taxClass,
        items: [{ tierId: i.id, tierName: i.unit, unitPrice: i.price, qty: 1 }],
      },
    ]);
    /* No toast: the tile's own count and the bar's total change under the
       finger, and a toast per tap stacked over the top of the screen during
       exactly the fast run of taps a queue produces. */
  };


  /* ── the scanner the venue already owns ───────────────────────────────────
     A barcode scanner is a keyboard that types very fast and presses Enter.
     There is no API to ask for one, so it is recognised by its cadence: a
     person cannot hold 120ms a character for a whole code.

     Two deliberate limits. It listens only when the operator has switched it
     on in Settings — a till that grabs keystrokes nobody asked it to grab is
     a till that eats a cashier's typing. And it stands down whenever
     something is being typed into: a cashier in the search box is searching,
     and the same scan filters the wall to the item, because the search
     already matches a SKU. Both paths end at the item; neither surprises.

     The handler lives in a ref because it closes over the cart and the
     shelf, and re-subscribing on every keystroke of a sale is how a listener
     misses the one it was attached for. */
  const scanBuf = useRef("");
  const scanAt = useRef(0);
  const onScan = useRef<(e: KeyboardEvent) => void>(() => {});
  /* Assigned in an effect rather than during render — writing a ref while
     rendering is what the React Compiler forbids, and this is the shape the
     OS calendar's keyboard shortcuts already use. */
  useEffect(() => {
    onScan.current = (e: KeyboardEvent) => {
      if (!peekTicketCodeSettings().scanToSell) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      const now = Date.now();
      if (now - scanAt.current > 120) scanBuf.current = "";
      scanAt.current = now;
      if (e.key === "Enter") {
        const code = scanBuf.current.trim();
        scanBuf.current = "";
        if (code.length < 3) return;
        const hit = shopItems.find((x) => (x.sku ?? "").trim().toUpperCase() === code.toUpperCase());
        if (!hit) {
          toast.error(t("shop.noCode", { code }));
          return;
        }
        tapItem(hit);
        return;
      }
      if (e.key.length === 1) scanBuf.current += e.key;
    };
  });
  useEffect(() => {
    const fn = (e: KeyboardEvent) => onScan.current(e);
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  /** Where a booking sheet opens when the wall is selling for another day.
   *  Only bookings that have a day to choose take it: a tote bag, an event
   *  ticket and a custom amount do not, and open entry has no date. Where the
   *  booking does not run on that day the sheet opens on the first day on or
   *  after it that it does — the sheet's own rule, so a Fri–Sun tour does not
   *  open on a Wednesday with nothing to choose. */
  const sellPreset = (p: Product): { date: string } | undefined => {
    if (sellDate === TODAY || !isDatedProduct(p)) return undefined;
    if (needsSchedule(p.bookingType) || p.bookingType === "BT-10") {
      for (let i = 0; i < 30; i++) {
        const d = new Date(Date.parse(`${sellDate}T12:00:00Z`) + i * 86400000).toISOString().slice(0, 10);
        if (isOpenOn(p, d)) return { date: d };
      }
    }
    return { date: sellDate };
  };

  const tapProduct = (p: Product) => {
    const activeTiers = p.tiers.filter((t) => t.active);
    const needsSheet = needsSchedule(p.bookingType) || isResourceType(p.bookingType) || p.bookingType === "BT-10" || p.bookingType === "BT-13" || (p.sections?.length ?? 0) > 0 || !!p.layoutId || activeTiers.some((t) => t.donation) || activeTiers.length > 1;
    if (!needsSheet && activeTiers.length >= 1) {
      const tier = activeTiers[0];
      setCart((c) => [...c, { id: `entry_${globalThis.crypto.randomUUID().slice(0, 8)}`, productId: p.id, productName: p.name, items: [{ tierId: tier.id, tierName: tier.name, unitPrice: tier.price, qty: 1 }] }]);
      /* No toast — the tile's count says it landed (see tapItem). */
      return;
    }
    setSheet({ product: p, initial: null, preset: sellPreset(p) });
  };

  // The till identifies itself so its own holds can be found and released
  // again. A real device id lands with the backend; the counter is enough here.
  const TILL_ID = DEMO_TILL_ID;

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
          locationId: tillLocationId,
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
    if (pay) openCart();
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
      setCartNotice(t("cantExtend", { lane: e.resourceLabel ?? t("theLane"), time: formatClock(endTime) }));
      return;
    }
    const base = Math.min(...p.tiers.filter((t) => t.active).map((t) => t.price));
    const price = productDurationPrice(p, e.slotDate, e.slotTime, next, base);
    const newEnd = `${e.slotDate}T${toTime(toMinutes(e.slotTime) + next)}:00+06:00`;
    setCart((c) => c.map((x) => (x.id === e.id ? { ...x, slotEnd: newEnd, fixedPrice: price } : x)));
    toast.success(t("extendedTo", { time: formatClock(toTime(toMinutes(e.slotTime) + next)), amount: formatMoney(price, currency) }));
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


  // ── F11: the cart IS order lines. One inputs builder feeds the shared order
  //    engine (lib/orderMath) for both the live totals and the settle payload,
  //    so what the cart shows is exactly what the order records.
  const buildInputs = (): CheckoutLine[] => {
    const inputs: CheckoutLine[] = [];
    for (const e of cart) {
      const p = productById(e.productId);
      const rate = entryTaxRate(e) / 100;
      /* The entry's own class wins where it has one: a reduced-rate bottle of
         water recorded as "standard at 7.5%" is a wrong line on a tax return,
         and the rate alone cannot say which it is. */
      const taxClass = e.taxClass ?? (e.taxRatePct != null ? (e.taxRatePct === 0 ? "exempt" : "standard") : (p?.taxClass ?? "standard"));
      /* Something off the shelf admits nobody. Without this a tote bag minted
         a ticket, because a line with no tier falls back to admitting one. */
      const fromShelf = e.productId.startsWith("inv_");
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
          tierName: e.resourceLabel ?? e.providerLabel ?? (e.slotTime ? formatClock(e.slotTime) : undefined) ?? t("bookingLine"),
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

      /* A seated performance sells one line per SEAT, so the order records
         WHICH seat went — the ticket can then print it and the next till is
         refused it. Grouping them into one line per category recorded that two
         Stalls tickets went and not which two, so a seat could never be
         claimed and two tills could sell A5 twice.

         This mirrors `lib/sale/saleMath`, which the scrolling till uses. The
         two builders are the documented duplication between the variants —
         a change to one is a change to both, and this is the drift. */
      if (e.seats?.length) {
        for (const st of e.seats) {
          inputs.push({
            productId: e.productId, productName: e.productName,
            tierId: st.tierId, tierName: st.tierName,
            admits: 1, quantity: 1, unitPrice: st.unitPrice,
            lineDiscount: pctOf(st.unitPrice),
            taxClass, taxRate: rate,
            booking: { date: e.slotDate ?? "", startTime: e.slotTime, guests: 1, seatLabel: st.label },
          });
        }
      }

      // Tier / section / premium / custom items. The entry's first tier line
      // carries the booking snapshot for slotted products.
      let bookingAttached = e.fixedPrice != null;
      for (const i of e.items) {
        if (addOnOf(i.tierId)) continue; // add-ons parent below
        /* The seat lines above already sold these; the category rows are only
           how the sheet grouped them for its own steppers. */
        if (e.seats?.length) continue;
        if (i.qty <= 0) continue;
        const tier = p?.tiers.find((t) => t.id === i.tierId);
        const isPremium = i.tierId.startsWith("prem_");
        const idx = inputs.length;
        const carryBooking = !isPremium && !bookingAttached && !!e.slotDate;
        if (carryBooking) bookingAttached = true;
        inputs.push({
          productId: e.productId, productName: e.productName,
          tierId: tier?.id, tierName: i.tierName,
          admits: isPremium || fromShelf ? 0 : (tier?.admits ?? 1),
          quantity: i.qty, unitPrice: i.unitPrice,
          lineDiscount: pctOf(i.unitPrice * i.qty),
          taxClass, taxRate: rate,
          parentIndex: isPremium && parentIdx != null ? parentIdx : undefined,
          booking: carryBooking ? { date: e.slotDate!, startTime: e.slotTime, guests: entrySeats(e) } : undefined,
        });
        if (parentIdx == null && !isPremium) parentIdx = idx;
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
  /* Code entry is at checkout whether or not the Promotions SCREENS are shown
     (FEATURES.promotions hides those): the owner asked for it there, and a code
     that is accepted and then not taken off would be the worst of both. */
  const couponDiscount = Math.min(appliedCoupon?.discount ?? 0, Math.max(0, preBase - manualDiscount));

  // ── The member price (§16.9). Applied only to what the tier actually covers,
  //    and never to the sale of a membership itself. Like the coupon, this is
  //    an entitlement, NOT a cashier discount — so it must not count toward
  //    the manual-discount cap.
  const memberCovers = (productId: string) => {
    if (!benefit || productId.startsWith("membership_")) return false;
    /* null means everything; a list means those things. */
    if (benefit.productIds === null) return true;
    return benefit.productIds.includes(productId);
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

  /** What a promo code is asked about. A booking that sells as one priced span
   *  (a lane, a field hour, an appointment) has no tier rows, so it goes in as
   *  its own line — otherwise a percentage code would find nothing to take
   *  off a sale made of nothing else. */
  const quoteLines = (): QuoteLine[] =>
    cart.flatMap((e) => [
      ...(e.fixedPrice != null && e.fixedPrice > 0 ? [{ lineId: `${e.id}|booking`, quantity: 1, unitAmount: e.fixedPrice }] : []),
      ...e.items.filter((i) => i.unitPrice > 0).map((i) => ({ lineId: `${e.id}|${i.tierId}`, quantity: i.qty, unitAmount: i.unitPrice })),
    ]);

  /** Ask the promotions engine about one code. Only a promotion that came in
   *  BY that code counts: an automatic offer that happens to apply is not what
   *  the cashier typed, and must not be shown as though it were. */
  const quoteCode = async (code: string): Promise<{ applied: AppliedPromotion } | { error: string }> => {
    const res = await quoteCart({ channel: "counter", lines: quoteLines(), couponCodes: [code] });
    if (!res.ok) return { error: "not_found" };
    const hit = res.data.applied.find((a) => a.source === "coupon");
    if (hit) return { applied: hit };
    const why = res.data.rejected.find((r) => r.code.toLowerCase() === code.toLowerCase())?.reason;
    return { error: why ?? "not_found" };
  };

  const applyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;
    setCouponError(null);
    const r = await quoteCode(code);
    if ("applied" in r) {
      setAppliedCoupon(r.applied);
      setCouponInput("");
    } else {
      setAppliedCoupon(null);
      setCouponError(r.error);
    }
  };

  // ── Deposits: a percent-deposit policy holds part of the entry back until
  //    arrival, so a booking that needs one is not paid in full by default.
  const entryBalance = (e: CartEntry) => {
    const pol = productById(e.productId)?.policies;
    if (pol?.deposit !== "percent" || pol.depositPct <= 0) return 0;
    const payable = entryTotal(e);
    return Math.max(0, payable - Math.round((payable * pol.depositPct) / 100));
  };
  const depositBalance = cart.reduce((s, e) => s + entryBalance(e), 0);

  /* ── How much is paid now ──────────────────────────────────────────────────
     A booking taken over the phone is usually held on a bKash transfer of
     part of the money, so the payment step offers Full, Half and Minimum — and
     only where the business allows paying part now: an advance rule at the
     counter, or a booking whose own policy asks for a deposit.

     Minimum is what the business requires: the advance rule's least, or the
     booking's deposit if that asks for more. Half is half the total, offered
     only where it is not below that. Full is the whole total and is where
     everything starts, unless a booking needs a deposit, in which case Minimum
     is. The choice is stored, not the amount, so Half stays half when a
     discount or a code moves the total. */
  const advanceRule = advanceQ.data?.counter;
  const advanceAllowed = !!advanceRule?.enabled && cart.length > 0 && total > 0;
  const advanceMin = advanceRule ? advanceMinimum(advanceRule, total) : total;
  /* Paying part now and the rest at arrival only means something when the
     guest arrives LATER: a booking dated after today, or later today than the
     demo clock. Shop items, custom amounts, event tickets, undated entry
     tickets and anything starting now never offer it. */
  const hasLater = cart.some((e) => !!e.slotDate && (e.slotDate > TODAY || (e.slotDate === TODAY && !!e.slotTime && toMinutes(e.slotTime) > DEMO_NOW_MINUTES)));
  const partAllowed = total > 0 && hasLater && (advanceAllowed || depositBalance > 0);
  const requiredNow = depositBalance > 0 ? total - depositBalance : 0;
  const minNow = advanceAllowed ? Math.max(advanceMin, requiredNow) : requiredNow;
  const minShown = partAllowed && minNow > 0 && minNow < total;
  const halfNow = Math.round(total / 2);
  const halfShown = partAllowed && halfNow < total && halfNow > (minShown ? minNow : 0);
  const choice: PayChoice =
    payChoice === "half" && halfShown ? "half"
    : payChoice === "minimum" && minShown ? "minimum"
    : payChoice == null && depositBalance > 0 && minShown ? "minimum"
    : "full";
  const dueNow = !partAllowed ? total : choice === "half" ? halfNow : choice === "minimum" ? minNow : total;
  const balance = total - dueNow;
  const payOptions: { id: PayChoice; label: string; amount: number }[] = [
    { id: "full", label: t("pay.full"), amount: total },
    ...(halfShown ? [{ id: "half" as const, label: t("pay.half"), amount: halfNow }] : []),
    ...(minShown ? [{ id: "minimum" as const, label: t("pay.minimum"), amount: minNow }] : []),
  ];

  // The most points that can usefully go on THIS sale: bounded by the balance,
  // the programme minimum, and what is left to pay once points are excluded.
  const maxPointsForSale = (() => {
    if (!pointsAccount || !program?.enabled || program.pointValue <= 0) return 0;
    if (pointsAccount.balance < program.minRedeemPoints) return 0;
    const payable = Math.max(0, beforePoints);
    return Math.min(pointsAccount.balance, Math.floor(payable / program.pointValue));
  })();

  /** The sale exactly as it stands right now, in the shape the live sale is
   *  held in — taken just before checkout, for the completion screen's
   *  5-second Undo to hand back if the cashier changes their mind. */
  const snapshotForUndo = (): LiveSale => ({ cart, discountMode, discountPct, discountAmt, discountReason, attached, coupon: appliedCoupon, payChoice: payChoice ?? undefined, sellDate, pointsToSpend });

  const buildSale = () => {
    // The SAME inputs the live totals were computed from — no drift possible.
    const lines = saleInputs;
    const bookings = cart.filter((e) => e.slotDate).map((e) => ({ productId: e.productId, resourceId: e.resourceId ?? null, slotStart: entrySlotISO(e)!, slotEnd: e.slotEnd, partySize: entrySeats(e) }));
    // Receipt detail for the complete screen: lines, discounts, tax, payments.
    const receipt = {
      lines: sale.lines.map((l) => ({ name: l.tierId && l.tierName !== l.productName ? `${l.productName} · ${l.tierName}` : l.productName, qty: l.quantity, amount: l.subtotal, child: !!l.parentLineId })),
      subtotal, lineDiscountTotal, orderDiscount, tax, total,
    };
    const payload = { total, dueNow, balance, taxPct: operator?.taxRatePct ?? 0, locationId: tillLocationId, lines, orderDiscount, bookings, method, customerName: customer || null, customerId: attached?.id ?? null, receipt };
    return { lines, bookings, payload, receipt };
  };

  /* Take payment opens ONE payment sheet, from the sell screen and from the
     cart alike, and how the customer pays is chosen there — the way Square and
     Shopify ask "how are they paying?" at the moment of paying. It used to be
     four tiles in the cart above the button, which a phone could only reach by
     opening the cart first. The sheet opens on the exact amount in cash, so the
     commonest sale finishes with one more tap on the same orange button. */
  const charge = async () => {
    /* No row, no choice: a stale Half must not outlive the booking that earned it. */
    if (!partAllowed) setPayChoice(null);
    setTenderTaka("");
    setPadOpen(false);
    setCashOpen(true);
    /* A code taken off before the cart changed was quoted against the OLD
       cart, so what it took off is asked again as the step opens. A code that
       no longer applies is dropped, with the reason, rather than quietly
       taking off a figure it would not give now. */
    if (appliedCoupon?.code) {
      const r = await quoteCode(appliedCoupon.code);
      if ("applied" in r) setAppliedCoupon(r.applied);
      else { setAppliedCoupon(null); setCouponError(r.error); }
    }
  };

  /** Notes a customer hands over for this amount: the next round hundred,
   *  five hundred and thousand above it, never one that is too small. A
   *  fixed ৳500 against ৳582 due was a button that greyed out Complete. */
  const quickNotes = (dueMinor: number) => {
    const due = Math.ceil(dueMinor / 100);
    const out: number[] = [];
    for (const step of [100, 500, 1000, 2000, 5000]) {
      const n = Math.ceil(due / step) * step;
      if (n > due && !out.includes(n)) out.push(n);
      if (out.length === 3) break;
    }
    return out;
  };

  /** What the orange button in the payment sheet does, by method. */
  const finishPayment = async (tenderedMinor: number, changeMinor: number) => {
    if (method === "cash") return completeCash(tenderedMinor, changeMinor);
    if (method === "bkash" || method === "bangla_qr") {
      // The sale only lands once the wallet payment is confirmed.
      setCashOpen(false);
      setNc({ method, state: "pending", txn: "" });
      return;
    }
    setCashSaving(true);
    await settleInline();
    setCashSaving(false);
    setCashOpen(false);
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
      if (!FEATURES.memberships) break;
      if (!entry.productId.startsWith("membership_")) continue;
      const tierId = entry.productId.slice("membership_".length);
      const issued = await issueMembership({ customerId, tierId, orderId });
      if (issued.ok) toast.success(t("membership.issued", { code: issued.data.code }));
      else toast.error(issued.error.message);
    }

    if (!FEATURES.loyalty) return;
    if (pointsToSpend > 0) await spendPoints(customerId, pointsToSpend, orderId);
    await earnPoints(customerId, paidAmount, orderId);
  };

  /** Who the sale was for, carried to the completion screen so its SMS and email go to
   *  the attached guest's number and address without the cashier typing them again. */
  const completedCustomer = () =>
    attached
      ? { name: attached.name, phone: attached.phone ?? null, email: attached.email ?? null }
      : customer
        ? { name: customer, phone: null, email: null }
        : null;

  // Non-cash settle: no change step; runs after the wallet flow confirms.
  const settleInline = async (txnNote?: string, txnRef?: string) => {
    const { lines, bookings, payload, receipt } = buildSale();
    const res = await checkout({ channel: "counter", locationId: payload.locationId, counterId: activeCounter.counter?.id ?? null, staffId: null, customerName: customer || null, customerId: attached?.id ?? null, lines, orderDiscount, bookings, taxPct: payload.taxPct, method, amountTendered: dueNow, paymentReference: txnRef, payNow: dueNow });
    if (res.ok) {
      if (txnNote) await logOrderAction(res.data.order.id, txnNote);
      sayIfStockRefused(res.data.stockRefused);
      await settleMemberEffects(res.data.order.id, dueNow);
      sessionStorage.setItem("pos_complete", JSON.stringify({ orderId: res.data.order.id, reference: res.data.order.reference, code: res.data.firstTicketCode, tickets: ticketSnapshot(res.data.order, res.data.tickets), change: 0, balance, receipt, payments: [{ method, amount: dueNow }], customer: completedCustomer(), completedAt: new Date().toISOString() }));
      /* The sale just before checkout, kept only for the completion screen's
         5-second Undo — written before the live sale is cleared, so Undo has
         something to hand back. */
      writeUndoSnapshot(snapshotForUndo());
      /* Before navigating: the completion screen unmounts this component, and
         a sold sale that came back on the next mount would be a second charge
         waiting to happen. */
      clearLiveSale();
      router.push("/pos/complete");
    } else toast.error(res.error.message);
  };

  /* A line that was charged for but could not leave a shelf is not a silent
     event: the guest is still at the counter and somebody has to hand them
     something. Said once, from both completion paths. */
  const sayIfStockRefused = (refused: { name: string; reason: string }[] | undefined) => {
    for (const r of refused ?? []) toast.error(t("sheet.stockRefused", { name: r.name }));
  };

  // Inline cash: collect tender, run checkout, go to the completion screen.
  const completeCash = async (tenderedMinor: number, changeMinor: number) => {
    const { lines, bookings, payload, receipt } = buildSale();
    setCashSaving(true);
    const res = await checkout({ channel: "counter", locationId: payload.locationId, counterId: activeCounter.counter?.id ?? null, staffId: null, customerName: customer || null, customerId: attached?.id ?? null, lines, orderDiscount, bookings, taxPct: payload.taxPct, method: "cash", amountTendered: tenderedMinor, payNow: dueNow });
    setCashSaving(false);
    if (res.ok) {
      sayIfStockRefused(res.data.stockRefused);
      await settleMemberEffects(res.data.order.id, dueNow);
      sessionStorage.setItem("pos_complete", JSON.stringify({ orderId: res.data.order.id, reference: res.data.order.reference, code: res.data.firstTicketCode, tickets: ticketSnapshot(res.data.order, res.data.tickets), change: changeMinor, balance, receipt, payments: [{ method: "cash", amount: dueNow, tendered: tenderedMinor, change: changeMinor }], customer: completedCustomer(), completedAt: new Date().toISOString() }));
      writeUndoSnapshot(snapshotForUndo());
      clearLiveSale();
      setCashOpen(false);
      router.push("/pos/complete");
    } else toast.error(res.error.message);
  };

  /* A cart line names its day the way a cashier reads it out. It used to
     print the raw `2026-08-01`, which is a different sentence from "Sat 1 Aug"
     to everyone except a database. */
  /** A line whose quantity is just a number: one tier, nothing reserved.
   *  A booking is not that — a lane at 12:00 or seat A5 is one thing, and a
   *  stepper on it would be a control with nothing to count. So the stepper
   *  appears exactly where it means something and the sheet still owns every
   *  other kind of change. */
  const simpleQty = (e: CartEntry) =>
    e.productId !== "custom" &&
    e.items.length === 1 &&
    !e.slotTime && !e.resourceId && !e.providerLabel &&
    !e.seatLabels?.length && e.partySize == null && e.fixedPrice == null;

  const bumpQty = (id: string, delta: number) =>
    setCart((c) => c.map((x) => {
      if (x.id !== id) return x;
      /* A shelf line cannot climb past the shelf. The + on the tile already
         refuses; the + in the cart is the same promise from the other end. */
      const item = x.productId.startsWith("inv_") ? inventoryItem(x.productId.slice(4)) : undefined;
      const cap = item?.tracked ? levelOf(item.id, tillLocationId).onHand : Infinity;
      return { ...x, items: [{ ...x.items[0], qty: Math.min(cap, Math.max(1, x.items[0].qty + delta)) }] };
    }));

  /** The rate, but only when every taxed line shares one. The catalogue has
   *  standard, reduced and exempt classes, so a mixed sale has no single rate
   *  and printing one would be a number the receipt never used. */
  const vatRatePct = (() => {
    const rates = [...new Set(sale.lines.filter((l) => l.taxAmount > 0).map((l) => l.taxRate))];
    return rates.length === 1 ? Math.round(rates[0] * 1000) / 10 : null;
  })();

  const slotLabel = (e: CartEntry) => {
    if (!e.slotDate) return "";
    const day = e.slotDate === TODAY ? t("slotToday") : formatDay(e.slotDate, { weekday: true });
    return e.slotTime ? ` · ${formatClock(e.slotTime)} ${day}` : ` · ${day}`;
  };

  /** The till's clock, in minutes — the demo clock, same as everywhere else.
   *  A day that has not started has none of it behind it: nothing "already
   *  went" on Friday. */
  const nowMinutes = sellDate === TODAY ? 12 * 60 : 0;
  /** Phrasing for the live-state line. The deriver picks WHICH question to
   *  answer; these translate the answer. */
  /* "Today" and "now" are only true of today: a tile describing Friday says
     "that day", or it tells a cashier a show is sold out today when it is
     Friday that is full. */
  const onToday = sellDate === TODAY;
  const liveWords = useMemo(() => ({
    soldOutToday: t(onToday ? "live.soldOutToday" : "live.soldOutDay"),
    noneLeftToday: t(onToday ? "live.noneLeftToday" : "live.noneLeftDay"),
    busyNow: t(onToday ? "live.busyNow" : "live.busyDay"),
    leftOfTotal: (left: number, total: number) => t(onToday ? "live.leftOfTotal" : "live.leftOfTotalDay", { left, total }),
    nextAt: (time: string, left: number) => t("live.nextAt", { time, left }),
    freeOfTotal: (free: number, total: number) => t("live.freeOfTotal", { free, total }),
    startsOn: (d: string) => t("live.startsOn", { date: formatDay(d) }),
    nextDay: (d: string, time: string) => t("live.nextDay", { day: formatDay(d, { weekday: true }), time }),
    providersFree: (free: number, total: number) => t("live.providersFree", { free, total }),
  }), [t, onToday]);

  return (
    <div className={cn("grid h-full grid-cols-1 gap-comfortable p-comfortable lg:grid-cols-[1fr_23rem] lg:pb-comfortable", "pb-[72px]")}>
      {/* The Go chrome names this screen visually; the heading exists so a
          screen reader lands on a named page rather than an unlabelled grid. */}
      <h1 className="sr-only">{t("posTitle")}</h1>
      {/* min-w-0, or this column sizes to its own min-content and the page
          scrolls sideways. The category strip is the culprit: it is an
          overflow-x-auto row whose min-content is the SUM of every chip, so at
          1024 the column blew out to 1332 and the document to 1812. Pre-existing
          (identical on production before this grid), and the same mechanism the
          dashboard was fixed with. */}
      <div className="flex min-h-0 min-w-0 flex-col gap-comfortable">
        {/* Header zone: counter chip · wide search · parked badge */}
        <div className="flex flex-wrap items-center gap-tight">
          {/* The day the wall is selling for: a quiet pill reading "Today · Wed
              29 Jul", and across the wall in orange once it is anything else.
              Only where something on the wall has a day to choose — a
              shop-only venue has no use for it. */}
          {anyDated && <SellDateBar value={sellDate} today={TODAY} onChange={setSellDate} />}
          {/* The counter is named once, in the context bar. This chip repeated
              it 40px away at the same breakpoint — the same words twice, and a
              bite out of the search field to say them. */}
          {/* The focus ring belongs to the PILL, not to the bare input inside it:
              an outline on the input is a rectangle drawn inside a round
              control, which is what it looked like. The container carries the
              same 2px ember indicator the rest of the app uses, and it follows
              the radius. */}
          <div data-focus-host className="go-surface flex h-11 min-w-[8rem] flex-1 items-center gap-tight rounded-full px-comfortable focus-within:ring-2 focus-within:ring-inset focus-within:ring-ember">
            <Search size={18} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t("search.placeholder")} placeholder={t("search.placeholder")} className="-my-px h-11 w-full min-w-0 text-ellipsis bg-transparent text-sm outline-none focus-visible:outline-none placeholder:text-muted" />
            {query && <button type="button" onClick={() => setQuery("")} className="-mr-2 flex h-11 shrink-0 items-center px-tight text-[0.8125rem] text-muted hover:text-fg">{t("search.clear")}</button>}
          </div>
          {parked.length > 0 && (
            <button type="button" onClick={() => setParkOpen(true)} className="flex h-11 shrink-0 items-center rounded-full bg-ember/15 px-section text-[0.8125rem] font-medium text-brand-foreground">
              {t("parkedBadge", { count: parked.length })}
            </button>
          )}
        </div>
        {/* What to show — one segmented row, the Schedule's own control, and
            only when there is a choice to make: everything, the shelf, event
            tickets. Each appears only when there is something in it. */}
        {wallGroups.length > 1 && (
          <div
            role="tablist"
            aria-label={t("categoryLabel")}
            className="go-surface grid gap-1 rounded-go p-1"
            style={{ gridTemplateColumns: `repeat(${wallGroups.length}, minmax(0, 1fr))` }}
          >
            {wallGroups.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={category === c.id}
                data-chip={c.id}
                onClick={() => setCategory(c.id)}
                className={cn(
                  "flex min-h-11 items-center justify-center rounded-go-sm px-1 text-center text-[0.875rem] font-semibold leading-tight transition-colors duration-quick",
                  category === c.id ? "bg-ember-solid text-white" : "text-fg hover:bg-muted-wash",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {productsQ.loading ? (
            <div aria-busy="true" className="go-surface flex animate-pulse flex-col gap-tight rounded-go p-section"><div className="h-4 w-1/3 rounded-go-sm bg-line" /><div className="h-4 w-2/3 rounded-go-sm bg-line" /><div className="h-4 w-1/2 rounded-go-sm bg-line" /></div>
          ) : (
            /* A card per item with a gap between. Grid rows stretch, so a row of
               cards matches height; a name that tells two bookings apart gets
               two lines, and the sheet behind the card carries the rest. Two
               columns on a phone, more as the width allows. */
            <div>
              <div className="grid grid-cols-2 gap-tight sm:grid-cols-3 sm:gap-comfortable xl:grid-cols-4">
                {shown.map((p) => {
                  const live = posLiveState(p, sellDate, nowMinutes, liveWords);
                  const n = inSale(p.id);
                  return (
                    <WallTile
                      key={p.id}
                      onClick={() => tapProduct(p)}
                      ariaLabel={n > 0 ? t("wall.inSaleAria", { name: p.name, count: n }) : undefined}
                      thumb={<ProductThumb images={p.images} name={p.name} bookingType={p.bookingType} size="card" />}
                      name={p.name}
                      price={formatPriceShort(tilePrice(p), currency)}
                      meta={subtitle(p, { resources, team: teamQ.data?.data })}
                      live={live}
                      count={n}
                      flag={live && live.tone === "low" ? t("live.limited") : undefined}
                      soldOut={!!live && live.tone === "none"}
                      soldOutLabel={t("sheet.soldOut")}
                    />
                  );
                })}
                {/* Events: a different kind of thing from a booking, so they
                    group under their own heading. A tap opens its own sheet —
                    there is something to decide: which day, which ticket. */}
                {shownEvents.length > 0 && <WallHeading icon={<Ticket size={16} strokeWidth={1.75} aria-hidden />}>{t("event.chip")}</WallHeading>}
                {shownEvents.map((e) => {
                  const left = eventPlacesLeft(e);
                  const gone = left <= 0;
                  return (
                    <WallTile
                      key={e.id}
                      onClick={() => setEventSheet(e)}
                      disabled={gone}
                      thumb={<span className="flex size-11 shrink-0 items-center justify-center rounded-go-sm bg-subtle text-muted"><Ticket size={20} strokeWidth={1.5} aria-hidden /></span>}
                      name={e.title}
                      price={eventFromPrice(e) === 0 ? t("event.free") : formatPriceShort(eventFromPrice(e), currency)}
                      meta={`${formatDay(e.startsAt.slice(0, 10), { weekday: true })} · ${e.venueName}`}
                      live={!gone && left <= 20 ? { tone: "low", text: t("event.left", { count: left }) } : null}
                      soldOut={gone}
                      soldOutLabel={t("event.soldOut")}
                    />
                  );
                })}
                {/* Not a shelf item, so it goes ABOVE the shop heading rather
                    than under it — a catch-all charge filed under Shop would
                    say the till had counted stock it never touched. */}
                {shelfHeading && customTile}
                {shelfHeading && <WallHeading icon={<ShoppingBag size={16} strokeWidth={1.75} aria-hidden />}>{t("shop.chip")}</WallHeading>}
                {/* The shelf. One tap sells it — there is nothing to decide.
                    Stock is silent when fine, says the number when low, and
                    the tile moves to the page colour when it is gone. */}
                {shownItems.map((i) => {
                  const gone = i.tracked && i.onHand <= 0;
                  const low = i.tracked && !gone && i.onHand <= i.lowAt;
                  const inCart = cart.find((e) => e.productId === inventoryLineId(i.id))?.items[0]?.qty ?? 0;
                  return (
                    <WallTile
                      key={i.id}
                      onClick={() => tapItem(i)}
                      ariaLabel={inCart > 0 ? t("wall.inSaleAria", { name: i.name, count: inCart }) : undefined}
                      thumb={<span className="flex size-11 shrink-0 items-center justify-center rounded-go-sm bg-subtle text-muted"><ShopGlyph kind={i.kind} /></span>}
                      name={i.name}
                      price={formatPriceShort(i.price, currency)}
                      meta={
                        GENERIC_UNITS.has(i.unit.trim().toLowerCase())
                          ? i.kind === "merch"
                            ? null
                            : t(`shop.kind.${i.kind}`)
                          : t("shop.per", { unit: i.unit })
                      }
                      live={low ? { tone: "low", text: t("shop.left", { count: i.onHand, unit: i.unit }) } : null}
                      count={inCart}
                      soldOut={gone}
                      soldOutLabel={t("sheet.soldOut")}
                    />
                  );
                })}
                {!shelfHeading && customTile}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cart — fixed right panel on tablet/desktop; bottom drawer on phones */}
      {/* Sheets cover the tab bar (z-50 over z-40) — nothing tappable behind a modal cart. */}
      <div className={`${cartOpen ? "fixed inset-0 z-50 flex pb-[env(safe-area-inset-bottom)] lg:inset-auto lg:pb-0" : "hidden"} min-h-0 flex-col bg-surface lg:z-auto lg:flex lg:rounded-go lg:pb-0 lg:shadow-go lg:sticky lg:top-comfortable lg:h-[calc(100dvh-88px)] lg:max-h-none lg:self-start`}>
        <div className="flex items-center gap-tight border-b border-line p-comfortable">
          {cartOpen && (
            <button type="button" onClick={closeCart} className="flex h-11 shrink-0 items-center gap-inline rounded-full bg-subtle pl-tight pr-comfortable text-sm font-medium text-fg dark:border dark:border-line dark:bg-transparent lg:hidden">
              <ChevronLeft size={18} strokeWidth={2} />{t("cart.back")}
            </button>
          )}
          {/* The count changes as lines come and go, so it is announced as one
              atomic status — "2 items in cart" — rather than a bare number that
              a screen reader reads out of context. */}
          <p role="status" aria-atomic="true" className="min-w-0 flex-1 truncate text-center text-[0.9375rem] font-semibold">
            {t("phoneSummary", { count: unitCount })}
          </p>
          {/* Paused sales come back from here; pausing this one is the
              foot's left button, beside Take payment. */}
          {parked.length > 0 ? (
            <button type="button" onClick={() => setParkOpen(true)} className="flex h-11 shrink-0 items-center gap-inline rounded-full bg-ember/15 px-comfortable text-[0.8125rem] font-medium text-brand-foreground">
              {t("parkedBadge", { count: parked.length })}
            </button>
          ) : cartOpen ? (
            <span className="w-[5.5rem] shrink-0 lg:hidden" aria-hidden />
          ) : null}
        </div>
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
            /* Nothing yet: said once, plainly, on the same card the lines will
               sit on. */
            <div className="go-surface flex flex-col items-center gap-tight rounded-go px-section py-section text-center">
              <ShoppingBag size={28} strokeWidth={1.5} className="text-muted" aria-hidden />
              <p className="text-[1rem] font-semibold text-fg">{t("cart.empty")}</p>
              <p className="text-[0.875rem] text-muted">{t("cart.emptyHint")}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-tight">
              {/* The lines on ONE card, divided by hairlines — the Schedule's
                  drawing. Each line reads the same way: picture, what it is,
                  the money on the right; under it, what can be done to it,
                  quiet until it is wanted. Tapping the words opens the line in
                  its sheet to change it. */}
              <div className="go-surface divide-y divide-line overflow-hidden rounded-go">
              {cart.map((e) => (
                <div key={e.id} className="px-comfortable py-comfortable">
                  <div className="flex items-start gap-comfortable">
                    {productById(e.productId) && (
                      <ProductThumb images={productById(e.productId)!.images} name={e.productName} bookingType={productById(e.productId)!.bookingType} size="chip" className="h-10 w-10" />
                    )}
                    <div
                      className="flex min-h-11 min-w-0 flex-1 cursor-pointer flex-col justify-center"
                      role="button"
                      tabIndex={0}
                      /* Guarded on the PRODUCT: a custom amount and something off
                         the shelf have no booking behind them. */
                      onClick={() => { const prod = productById(e.productId); if (prod) setSheet({ product: prod, initial: e }); }}
                      onKeyDown={(k) => { const prod = productById(e.productId); if (k.key === "Enter" && prod) setSheet({ product: prod, initial: e }); }}
                    >
                      <div className="flex items-start justify-between gap-tight">
                        <span className="min-w-0 flex-1 break-words text-[0.9375rem] font-semibold leading-snug">{e.productName}</span>
                        <span className="shrink-0 text-right">
                          <span className="block whitespace-nowrap text-[0.9375rem] font-semibold tabular-nums">{formatMoney(entryTotal(e), currency)}</span>
                          {e.items.length === 1 && e.fixedPrice == null && e.items[0].qty > 1 && (
                            <span className="block whitespace-nowrap text-[0.8125rem] text-muted">
                              {e.items[0].qty} × {formatMoney(e.items[0].unitPrice, currency)}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="text-[0.8125rem] text-muted">{[/* The stepper already says how many of a plain line. */ simpleQty(e) ? "" : e.items.map((i) => `${i.qty} ${i.tierName}`).join(" · "), e.seatLabels?.length ? e.seatLabels.join(", ") : "", e.eventDayLabel, e.resourceLabel, e.providerLabel, e.partySize != null ? t("cart.groupOf", { count: e.partySize }) : ""].filter(Boolean).join(" · ")}{slotLabel(e)}</div>
                      {e.lineDiscountAmount ? (
                        <div className="text-[0.8125rem] text-danger">−{formatMoney(e.lineDiscountAmount, currency)}</div>
                      ) : (e.lineDiscountPct ?? 0) > 0 ? (
                        <div className="text-[0.8125rem] text-danger">{t("cart.lineDiscount", { pct: e.lineDiscountPct ?? 0 })}</div>
                      ) : null}
                      {entryBalance(e) > 0 && <div className="text-[0.8125rem] text-muted">{t("cart.depositNow", { pct: productById(e.productId)?.policies?.depositPct ?? 0, balance: formatMoney(entryBalance(e), currency) })}</div>}
                    </div>
                  </div>
                  {/* What can be done to the line: a stepper where the quantity
                      is just a number, then quiet word-and-picture buttons. */}
                  <div className="mt-tight flex flex-wrap items-center gap-x-inline gap-y-tight">
                    {simpleQty(e) && (
                      <span className="mr-auto flex w-fit items-center rounded-full border border-line">
                        <button type="button" aria-label={t("sheet.fewer")} disabled={e.items[0].qty <= 1} onClick={() => bumpQty(e.id, -1)} className="flex h-11 w-11 items-center justify-center rounded-full text-lg disabled:text-faint active:bg-ember/10">−</button>
                        <span className="min-w-6 text-center text-[0.9375rem] font-semibold tabular-nums">{e.items[0].qty}</span>
                        <button type="button" aria-label={t("sheet.more")} onClick={() => bumpQty(e.id, 1)} className="flex h-11 w-11 items-center justify-center rounded-full text-lg active:bg-ember/10">+</button>
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label={t("cart.lineDiscountLabel")}
                      aria-expanded={lineDiscEdit === e.id}
                      onClick={() => setLineDiscEdit((cur) => (cur === e.id ? null : e.id))}
                      className={cn(
                        "flex h-11 items-center gap-inline rounded-full px-tight text-[0.8125rem] font-medium active:bg-ember/10",
                        !simpleQty(e) && "ml-auto",
                        (e.lineDiscountPct ?? 0) > 0 || e.lineDiscountAmount ? "text-brand-foreground" : "text-muted",
                      )}
                    >
                      <Percent size={15} strokeWidth={2} aria-hidden />
                      <span className="whitespace-nowrap">{e.lineDiscountAmount ? formatMoney(e.lineDiscountAmount, currency) : (e.lineDiscountPct ?? 0) > 0 ? `−${e.lineDiscountPct}%` : t("summary.discount")}</span>
                    </button>
                    {productById(e.productId)?.durationConfig && e.fixedPrice != null && e.slotEnd && (
                      <button type="button" onClick={() => extendEntry(e)} className="flex h-11 items-center gap-inline rounded-full px-tight text-[0.8125rem] font-medium text-muted active:bg-ember/10">
                        <Plus size={15} strokeWidth={2} aria-hidden />
                        <span className="whitespace-nowrap">{t("cart.extend")} {productById(e.productId)!.durationConfig!.incrementMinutes}m</span>
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label={t("cart.remove")}
                      onClick={() => {
                        const at = cart.findIndex((x) => x.id === e.id);
                        const line = e;
                        setCart((c) => c.filter((x) => x.id !== e.id));
                        toast.success(t("cart.removed", { name: e.productName }), {
                          label: t("cart.undo"),
                          run: () => setCart((c) => {
                            if (c.some((x) => x.id === line.id)) return c;
                            const next = [...c];
                            next.splice(Math.min(at, next.length), 0, line);
                            return next;
                          }),
                        });
                      }}
                      className="flex h-11 items-center gap-inline rounded-full px-tight text-[0.8125rem] font-medium text-danger active:bg-danger/10"
                    >
                      <Trash2 size={15} strokeWidth={2} aria-hidden />
                      <span className="whitespace-nowrap">{t("cart.remove")}</span>
                    </button>
                  </div>
                  {lineDiscEdit === e.id && (
                    <div className="mt-tight border-t border-line pt-tight">
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
              {cart.length > 1 && (
                <div className="flex justify-end">
                  <button type="button" onClick={() => setClearOpen(true)} className="flex h-11 items-center rounded-full px-comfortable text-[0.8125rem] text-muted active:bg-ember/10">
                    {t("cart.clearAll")}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* The cart is the lines and what they add up to, and nothing else.
            Who the sale is for, a discount and a promo code are decided when
            it is paid — Shopify POS and Square both attach the customer and
            apply discounts at checkout rather than keeping them as permanent
            rows in the cart, which is a cart whose lines are harder to read. */}
        {cart.length > 0 && (
          <div className="border-t border-line p-comfortable">
            {/* The refusal guidance explains why an extend was declined, so it
                lives with the lines it is about. */}
            {cartNotice && <div className="mb-tight"><BlockedNotice message={cartNotice} onDismiss={() => setCartNotice(null)} /></div>}
            <div className="rounded-go bg-card p-comfortable">
              <div className="flex justify-between text-[0.8125rem] text-muted"><span>{t("summary.subtotal")}</span><span className="">{formatMoney(subtotal, currency)}</span></div>
              {lineDiscountTotal > 0 && <div className="flex justify-between text-[0.8125rem] text-muted"><span>{t("summary.lineDiscounts")}</span><span className="text-danger">−{formatMoney(lineDiscountTotal, currency)}</span></div>}
              {manualDiscount > 0 && <div className="flex justify-between text-[0.8125rem] text-muted"><span>{discountMode === "percent" ? t("summary.discountPct", { pct: discountPct }) : t("summary.discountFlat")}</span><span className="text-danger">−{formatMoney(manualDiscount, currency)}</span></div>}
              {couponDiscount > 0 && <div className="flex justify-between text-[0.8125rem] text-muted"><span>{appliedCoupon?.code ?? appliedCoupon?.name}</span><span className="text-danger">−{formatMoney(couponDiscount, currency)}</span></div>}
              {memberDiscount > 0 && <div className="flex justify-between text-[0.8125rem] text-muted"><span className="min-w-0 truncate">{t("summary.memberDiscount", { tier: benefit?.tierName ?? "" })}</span><span className="shrink-0 text-danger">−{formatMoney(memberDiscount, currency)}</span></div>}
              {pointsDiscount > 0 && <div className="flex justify-between text-[0.8125rem] text-muted"><span>{t("summary.pointsSpent", { count: pointsToSpend })}</span><span className="text-danger">−{formatMoney(pointsDiscount, currency)}</span></div>}
              <div className="flex justify-between text-[0.8125rem] text-muted"><span>{vatRatePct != null ? t("summary.vatRate", { pct: vatRatePct }) : t("summary.vat")}</span><span className="">{formatMoney(tax, currency)}</span></div>
              <div className="mt-tight flex items-baseline justify-between border-t border-line pt-tight text-lg font-semibold"><span>{t("summary.total")}</span><AnimatedMoney value={total} currency={currency} /></div>
              {balance > 0 && (
                <>
                  <div className="flex justify-between text-[0.8125rem]"><span>{t("summary.dueNow")}</span><span className="">{formatMoney(dueNow, currency)}</span></div>
                  <div className="flex justify-between text-[0.8125rem] text-muted"><span>{t("summary.balanceAtArrival")}</span><span className="">{formatMoney(balance, currency)}</span></div>
                </>
              )}
              {/* Lines the cashier discounted can put the sale over their own
                  limit, and the lines are here: say so where they can fix it. */}
              {overLimit && (
                <p className="mt-tight rounded-go border border-line border-l-[3px] border-l-ember bg-card p-tight text-[0.8125rem]">
                  {pt("pos.overPolicy", { limit: manualCapPct })}
                </p>
              )}
            </div>
          </div>
        )}
        </div>

        {cart.length > 0 && (
          <ActionBar
            docked="panel"
            className="lg:rounded-b-go"
            label={t("cart.barLabel")}
            secondary={{ label: t("cart.park"), icon: <Archive size={20} strokeWidth={2} aria-hidden />, onClick: () => { setParkName(customer); setParkOpen(true); } }}
            primary={{
              label: t("takeAmount", { amount: formatPriceShort(dueNow, currency) }),
              icon: <Banknote size={20} strokeWidth={2} aria-hidden />,
              onClick: () => void charge(),
            }}
          />
        )}
      </div>

      {/* The phone's sale dock — one solid footer from the top of the buttons
          to the bottom edge, with the tab bar inside it, so the wall scrolls
          away cleanly above it instead of showing round a floating card.

          Cart on the left, Take on the right, and nothing else. It used to open
          with a line — "Nothing in this sale yet" — that turned into a row of
          pictures and names on the first tap, which made the dock taller at
          the moment a finger had just left the wall and moved every card
          under it. The dock is now the same height for an empty sale and a
          full one: the count is on the Cart button, the money on Take, and
          each card on the wall carries its own count. */}
      {!cartOpen && (
          <ActionBar
            docked="dock"
            className="lg:hidden"
            label={t("cart.barLabel")}
            secondary={{ label: t("cart.openCount", { count: unitCount }), icon: <ShoppingBag size={20} strokeWidth={2} aria-hidden />, onClick: openCart, ariaLabel: t("cart.openAria", { count: unitCount }) }}
            primary={{ label: t("takeAmount", { amount: formatPriceShort(dueNow, currency) }), icon: <Banknote size={20} strokeWidth={2} aria-hidden />, onClick: () => void charge(), disabled: cart.length === 0 }}
          />
      )}

      {eventSheet && (
        <EventSheet
          event={eventSheet}
          currency={currency}
          onClose={() => setEventSheet(null)}
          onAdd={(entry, pay) => {
            upsertEntry(entry, pay);
            setEventSheet(null);
          }}
        />
      )}
      {sheet && <ProductSheet product={sheet.product} locationId={tillLocationId} currency={currency} initial={sheet.initial} preset={sheet.preset} seatsInCart={seatsInCart} onAdd={upsertEntry} onClose={() => setSheet(null)} team={teamQ.data?.data ?? []} resources={resources} />}

      {/* Checkout — the payment sheet. One sheet for every way of paying, and
          the place where a sale is finished: the amount, who it is for, a
          discount, a promo code, how they pay, how much of it now, and — for
          cash — what they handed over. Footer pinned: Back on the left, the
          orange button on the right. */}
      {cashOpen && (() => {
        const cash = method === "cash";
        const typed = tenderTaka !== "";
        const tenderedMinor = cash && typed ? (parseInt(tenderTaka, 10) || 0) * 100 : dueNow;
        const changeMinor = tenderedMinor - dueNow;
        const enough = tenderedMinor >= dueNow;
        const exact = tenderedMinor === dueNow;
        const blocked = overLimit || reasonNeeded;
        /* A discount that cannot be given opens its own row, so the refusal is
           read where it can be fixed, and cannot be folded away. */
        const discountOpen = discOpen || blocked;
        const discountValue = manualDiscount > 0 ? (discountMode === "percent" ? `${discountPct}%` : formatMoney(manualDiscount, currency)) : t("summary.none");
        return (
          <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={t("pay.title")}>
            <div className="go-sheet-scrim absolute inset-0 bg-inverse/40 backdrop-blur-sm" onClick={() => !cashSaving && setCashOpen(false)} aria-hidden />
            <div className="go-sheet-panel relative z-10 mx-auto flex max-h-[92vh] w-full max-w-[560px] flex-col rounded-t-go-lg bg-sheet">
              <div className="flex items-center justify-between gap-tight px-section pb-tight pt-tight">
                <span className="w-11" aria-hidden />
                <span className="h-1 w-10 rounded-full bg-line" aria-hidden />
                {/* 44px: Go is touch at every width. */}
                <button type="button" onClick={() => setCashOpen(false)} aria-label={t("cash.close")} className="flex h-11 w-11 items-center justify-center rounded-full active:bg-ember/10"><X size={20} strokeWidth={1.5} /></button>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-section overflow-y-auto px-section pb-section [&>*]:shrink-0">
                {/* What is being paid, as large as the screen allows: it is the
                    number the customer is told. It follows the discount, the
                    code and how much is paid now — all of which come from the
                    sale engine, not from arithmetic here. */}
                <div className="text-center" data-pay-amount>
                  <p className="text-[0.875rem] font-medium text-muted">{balance > 0 ? t("cash.depositDue") : t("cash.amountDue")}</p>
                  <p className="mt-inline font-bold tabular-nums text-fg" style={{ fontSize: "clamp(32px, 10vw, 44px)", lineHeight: 1.1 }}>{formatMoney(dueNow, currency)}</p>
                </div>

                {/* Who it is for, what comes off, and a promo code: one card of
                    rows, each saying where it stands. */}
                <div className="go-surface overflow-hidden rounded-go px-comfortable">
                  <CustomerRow attached={attached} onOpen={() => setCustomerOpen(true)} onRemove={() => setAttached(null)} />
                  {(FEATURES.memberships || (pointsAccount && program?.enabled)) && (
                    <div className="flex flex-wrap items-center gap-tight border-b border-line py-tight last:border-b-0">
                      {FEATURES.memberships && <button type="button" onClick={() => setMembershipOpen(true)} className="h-11 rounded-full border border-line px-comfortable text-[0.8125rem]">{t("summary.sellMembership")}</button>}
                      {pointsAccount && program?.enabled && (
                        <button type="button" onClick={() => setPointsOpen(true)} className="h-11 min-w-0 rounded-full border border-line px-comfortable text-[0.8125rem]">
                          <span className="truncate">{pointsToSpend > 0 ? t("summary.pointsApplied", { count: pointsToSpend }) : t("summary.spendPoints", { count: pointsAccount.balance })}</span>
                        </button>
                      )}
                    </div>
                  )}
                  {/* The member price is an entitlement, so say whose it is. */}
                  {benefit && (
                    <div className="border-b border-line py-tight last:border-b-0">
                      <p className="min-w-0 break-words text-[0.8125rem]">
                        <span className="font-medium">{benefit.tierName}</span>
                        {" · "}
                        {t("summary.memberRate", { pct: benefit.discountBps / 100 })}
                        {benefit.visitsLeft != null && ` · ${t("summary.memberVisits", { count: benefit.visitsLeft })}`}
                      </p>
                    </div>
                  )}
                  <SaleRow icon={Percent} label={t("summary.discount")} value={discountValue} open={discountOpen} onToggle={() => setDiscOpen((v) => !v)}>
                    {/* Four buttons meant a manager who agreed 12% had no way to
                        say so and the till decided it was 10. The chips still
                        fill the field; they are not the whole menu. The hint
                        lines under it are 12px in the shared control, under
                        this screen's 13px floor, so they are raised here. */}
                    <DiscountInput
                      shape="go"
                      mode={discountMode}
                      onMode={setDiscountMode}
                      value={discountMode === "percent" ? discountPct : discountAmt}
                      onChange={(v) => (discountMode === "percent" ? setDiscountPct(v) : setDiscountAmt(v))}
                      base={Math.max(0, preBase)}
                      currency={currency}
                      className="[&_p]:text-[0.8125rem]"
                    />
                    {overLimit && (
                      <p role="alert" className="mt-tight rounded-go border border-line border-l-[3px] border-l-ember bg-card p-tight text-[0.8125rem]">
                        {pt("pos.overPolicy", { limit: manualCapPct })}
                      </p>
                    )}
                    {/* A reason is asked for whenever a manual discount is given
                        and the business's policy requires one. */}
                    {manualDiscount > 0 && policyQ.data?.requireReason && (
                      <input
                        value={discountReason}
                        onChange={(e) => setDiscountReason(e.target.value)}
                        aria-label={pt("pos.reasonPlaceholder")}
                        placeholder={pt("pos.reasonPlaceholder")}
                        className={cn("mt-tight h-11 w-full rounded-full border bg-card px-comfortable text-[0.9375rem] outline-none placeholder:text-faint", reasonNeeded ? "border-danger" : "border-line focus:border-ember")}
                      />
                    )}
                  </SaleRow>
                  <PromoCodeRow
                    applied={appliedCoupon}
                    taken={couponDiscount}
                    input={couponInput}
                    onInput={(v) => { setCouponInput(v); setCouponError(null); }}
                    onApply={() => void applyCoupon()}
                    onRemove={() => { setAppliedCoupon(null); setCouponError(null); }}
                    error={couponError ? pt(`pos.rejected.${couponError}` as never) : null}
                    currency={currency}
                  />
                </div>

                {/* How they are paying: one row of flat cells, each a picture
                    and a word. Chosen is the till's one look for it: solid
                    orange, white, a tick. */}
                {availableMethods.length > 1 && (
                  <div>
                    <p className="mb-tight text-[0.875rem] font-semibold text-fg">{t("pay.method")}</p>
                    <div role="radiogroup" aria-label={t("pay.method")} className="go-surface grid overflow-hidden rounded-go" style={{ gridTemplateColumns: `repeat(${availableMethods.length}, minmax(0, 1fr))` }}>
                      {availableMethods.map((m, i) => {
                        const Icon = METHOD_ICON[m.value] ?? Wallet;
                        const on = method === m.value;
                        return (
                          <button
                            key={m.value}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            data-focus-inset
                            onClick={() => { setMethod(m.value); setTenderTaka(""); setPadOpen(false); }}
                            className={cn(
                              "relative flex min-h-[4.5rem] flex-col items-center justify-center gap-inline px-inline text-[0.875rem] font-semibold transition-colors duration-quick",
                              i > 0 && "border-l border-line",
                              on ? "bg-ember-solid text-white" : "bg-card text-fg",
                            )}
                          >
                            <Icon size={22} strokeWidth={1.75} aria-hidden />
                            <span className="max-w-full truncate">{enumL.method(m.value)}</span>
                            {on && <Check size={14} strokeWidth={3} className="absolute right-1.5 top-1.5" aria-hidden />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* How much of it now. Only where the business takes part
                    payment, and only the choices that are really different:
                    Minimum is left out when it is the whole amount or there is
                    none. */}
                {payOptions.length > 1 && (
                  <div>
                    <p className="mb-tight text-[0.875rem] font-semibold text-fg">{t("pay.howMuch")}</p>
                    <HowMuchNow options={payOptions} value={choice} onChange={setPayChoice} currency={currency} />
                    {balance > 0 && (
                      <p className="mt-tight text-[0.9375rem] font-medium text-fg" data-pay-part>
                        {t("pay.partSummary", { now: formatMoney(dueNow, currency), later: formatMoney(balance, currency) })}
                      </p>
                    )}
                  </div>
                )}

                {cash ? (
                  <>
                    {/* Cash: the figure handed over (the amount now, until a
                        cashier says otherwise) and what to give back. The notes
                        that work out the change sit inside the card as small
                        secondary chips — a cashier still needs them, but they
                        are no longer a full-width row leading the sheet. */}
                    <div className="go-surface divide-y divide-line overflow-hidden rounded-go">
                      {/* The received figure IS the way to the pad, which is how
                          Square does it — tap the amount and the keypad appears. */}
                      <button
                        type="button"
                        onClick={() => setPadOpen(true)}
                        aria-label={`${t("cash.tendered")} ${formatMoney(tenderedMinor, currency)} — ${t("cash.tapToChange")}`}
                        className="flex min-h-14 w-full items-center justify-between gap-tight px-comfortable text-left active:bg-ember/10"
                      >
                        <span className="flex min-w-0 items-center gap-inline text-[0.9375rem]">
                          {t("cash.tendered")}
                          <Pencil size={13} strokeWidth={2} aria-hidden className="shrink-0 text-muted" />
                        </span>
                        <span className="shrink-0 text-lg font-semibold tabular-nums" data-pay-tendered>{formatMoney(tenderedMinor, currency)}</span>
                      </button>
                      {/* Change is an ACTION — money to count back — so it is the
                          largest thing here WHEN THERE IS ANY. At zero it is one
                          quiet line, and the loud thing is the button. */}
                      {exact ? (
                        <p className="flex min-h-14 items-center px-comfortable text-[0.9375rem] font-medium text-success">{t("cash.noChange")}</p>
                      ) : (
                        <div className={`flex min-h-14 items-baseline justify-between gap-tight px-comfortable py-tight font-semibold ${enough ? "text-success" : "text-muted"}`}>
                          <span className="shrink-0 text-xl">{t("complete.giveChange")}</span>
                          <span className="min-w-0 truncate text-right" style={{ fontSize: "clamp(28px, 9.5vw, 40px)" }}>
                            {enough ? formatMoney(changeMinor, currency) : "—"}
                          </span>
                        </div>
                      )}
                      <div className="grid grid-cols-4 gap-tight p-comfortable" data-pay-notes>
                        <button
                          type="button"
                          aria-pressed={exact}
                          onClick={() => setTenderTaka("")}
                          className={cn("h-11 min-w-0 rounded-full border px-1 text-[0.9375rem] font-semibold", exact ? "border-ember-solid bg-ember-solid text-white" : "border-line bg-card text-fg active:bg-ember/10")}
                        >
                          {t("cash.exact")}
                        </button>
                        {quickNotes(dueNow).map((amt) => {
                          const on = typed && parseInt(tenderTaka, 10) === amt;
                          return (
                            <button key={amt} type="button" aria-pressed={on} onClick={() => setTenderTaka(String(amt))} className={cn("h-11 min-w-0 rounded-full border px-1 text-[0.9375rem] font-semibold tabular-nums", on ? "border-ember-solid bg-ember-solid text-white" : "border-line bg-card text-fg active:bg-ember/10")}>
                              {formatPriceShort(amt * 100, currency)}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* The pad only where it is wanted: on for a till that keeps
                        it, or once the received figure has been pressed. */}
                    {(prefs.posKeypad || padOpen) && (
                      <Keypad onKey={(d) => setTenderTaka((t) => (t + d).slice(0, 7))} onBackspace={() => setTenderTaka((t) => t.slice(0, -1))} />
                    )}
                  </>
                ) : (
                  <p className="rounded-go bg-card px-comfortable py-section text-center text-[0.9375rem] text-fg">
                    {method === "card_terminal" ? t("pay.cardHint") : t("pay.walletHint")}
                  </p>
                )}
              </div>
              <ActionBar
                docked="panel"
                label={t("pay.title")}
                secondary={{ label: t("cart.back"), icon: <ChevronLeft size={20} strokeWidth={2} aria-hidden />, onClick: () => setCashOpen(false), disabled: cashSaving }}
                primary={{
                  label: cash || method === "card_terminal" ? t("cash.completeSale") : t("pay.next"),
                  icon: <Check size={20} strokeWidth={2.5} aria-hidden />,
                  onClick: () => void finishPayment(tenderedMinor, changeMinor),
                  disabled: (cash && !enough) || cashSaving || blocked,
                }}
              />
            </div>
          </div>
        );
      })()}

      <Modal
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        title={t("cart.clearTitle")}
        footer={<><Button shape="pill" variant="secondary" onClick={() => setClearOpen(false)}>{t("custom.cancel")}</Button><Button shape="pill" variant="destructive" onClick={clearSale}>{t("cart.clearConfirm")}</Button></>}
      >
        <p className="text-sm text-muted">{t("cart.clearBody", { count: cart.length })}</p>
      </Modal>

      <Modal open={customOpen} onClose={() => setCustomOpen(false)} title={t("custom.title")} footer={<><Button shape="pill" variant="secondary" onClick={() => setCustomOpen(false)}>{t("custom.cancel")}</Button><Button shape="pill" onClick={addCustom} disabled={!customAmount}>{t("custom.add")}</Button></>}>
        <div className="flex flex-col gap-section">
          <FormField label={t("custom.description")} placeholder={t("custom.descriptionPlaceholder")} value={customName} onChange={(e) => setCustomName(e.target.value)} />
          <FormField label={t("custom.amountLabel", { currency })} variant="number" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} />
          <FormField label={t("custom.taxClass")} variant="select" value={customTax} onChange={(e) => setCustomTax(e.target.value as typeof customTax)} options={[{ value: "standard", label: enumL.tax("standard") }, { value: "reduced", label: enumL.tax("reduced") }, { value: "exempt", label: enumL.tax("exempt") }]} />
        </div>
      </Modal>

      <CustomerPicker open={customerOpen} onClose={() => setCustomerOpen(false)} attached={attached} onAttach={setAttached} />

      {FEATURES.memberships && (
      <MembershipSheet
        open={membershipOpen}
        onClose={() => setMembershipOpen(false)}
        hasCustomer={!!attached?.id}
        onPick={(tier) => {
          addMembershipToCart(tier);
          setMembershipOpen(false);
        }}
      />
      )}
      {FEATURES.loyalty && (
      <PointsSheet
        open={pointsOpen}
        onClose={() => setPointsOpen(false)}
        account={pointsAccount}
        program={program ?? undefined}
        maxPoints={maxPointsForSale}
        current={pointsToSpend}
        onApply={setPointsToSpend}
      />
      )}

      <Modal open={parkOpen} onClose={() => setParkOpen(false)} title={t("parked.title")} footer={<Button shape="pill" variant="secondary" onClick={() => setParkOpen(false)}>{t("parked.close")}</Button>}>
        <div className="flex flex-col gap-section">
          {cart.length > 0 && (
            <div className="flex items-end gap-tight">
              <FormField label={t("parked.parkAs")} placeholder={t("parked.parkAsPlaceholder")} value={parkName} onChange={(e) => setParkName(e.target.value)} className="flex-1" />
              <Button shape="pill" onClick={park}>{t("parked.park")}</Button>
            </div>
          )}
          {parked.length === 0 ? (
            <p className="text-[0.8125rem] text-muted">{t("parked.nothing")}</p>
          ) : (
            <div className="flex flex-col gap-tight">
              {parked.map((p, i) => (
                <div key={i} className="flex items-center justify-between rounded-go border border-line p-comfortable">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-[0.8125rem] text-muted">{t("parked.lines", { count: p.cart.length, amount: formatMoney(p.cart.reduce((s, e) => s + (e.fixedPrice ?? 0) + e.items.reduce((x, i2) => x + i2.unitPrice * i2.qty, 0), 0), currency) })}</p>
                  </div>
                  <Button shape="pill" size="sm" onClick={() => resume(i)} disabled={cart.length > 0} >{t("parked.resume")}</Button>
                </div>
              ))}
              {cart.length > 0 && <p className="text-[0.8125rem] text-muted">{t("parked.parkFirst")}</p>}
            </div>
          )}
        </div>
      </Modal>

      {/* Non-cash wallet flow — pending → confirmed | failed. Nothing is
          charged and no tickets exist until the payment confirms. */}
      <Modal open={!!nc} onClose={() => setNc(null)} title={nc?.method === "bkash" ? t("wallet.bkashTitle") : t("wallet.qrTitle")}>
        {nc?.state === "failed" ? (
          <div className="flex flex-col gap-section">
            <div className="rounded-go border border-danger/40 bg-danger/10 p-comfortable text-sm text-danger">
              {t("wallet.failed")}
            </div>
            <div className="flex gap-tight">
              <Button shape="pill" variant="secondary" fullWidth onClick={() => setNc(null)}>{t("wallet.cancelSale")}</Button>
              <Button shape="pill" fullWidth onClick={() => setNc({ ...nc, state: "pending", txn: "" })}>{t("wallet.tryAgain")}</Button>
            </div>
          </div>
        ) : nc?.method === "bkash" ? (
          <div className="flex flex-col gap-section">
            <p className="text-sm text-muted">{t("wallet.bkashInstruction", { amount: formatMoney(dueNow, currency), number: "01711-000000" })}</p>
            <FormField label={t("wallet.txnLabel")} placeholder={t("wallet.txnPlaceholder")} value={nc.txn} onChange={(e) => setNc({ ...nc, txn: e.target.value.toUpperCase() })} />
            <div className="flex gap-tight">
              <Button shape="pill" variant="secondary" fullWidth onClick={() => setNc({ ...nc, state: "failed" })}>{t("wallet.itFailed")}</Button>
              <Button shape="pill" fullWidth disabled={nc.txn.trim().length < 6} onClick={async () => { const txn = nc.txn.trim(); setNc({ ...nc, state: "confirmed" }); await settleInline(t("wallet.bkashConfirmedNote", { txn }), txn); setNc(null); }}>
                {nc.state === "confirmed" ? t("wallet.confirming") : t("wallet.paymentReceived")}
              </Button>
            </div>
          </div>
        ) : nc ? (
          <div className="flex flex-col gap-section">
            {/* Stand-in QR — a real terminal renders the payload from the PSP. */}
            <div className="mx-auto grid w-40 grid-cols-8 gap-px rounded-go border border-line bg-card p-tight" aria-label={t("wallet.qrAlt")}>
              {Array.from({ length: 64 }, (_, i) => (
                <span key={i} className={`aspect-square ${((i * 7 + 3) % 5 < 2 || i % 9 === 0) ? "bg-fg" : "bg-card"}`} />
              ))}
            </div>
            <p className="text-center text-lg">{formatMoney(dueNow, currency)}</p>
            <p className="text-center text-[0.8125rem] text-muted">{t("wallet.qrInstruction")}</p>
            <div className="flex gap-tight">
              <Button shape="pill" variant="secondary" fullWidth onClick={() => setNc({ ...nc, state: "failed" })}>{t("wallet.itFailed")}</Button>
              <Button shape="pill" fullWidth onClick={async () => { setNc({ ...nc, state: "confirmed" }); await settleInline(t("wallet.qrConfirmedNote")); setNc(null); }}>
                {nc.state === "confirmed" ? t("wallet.confirming") : t("wallet.paymentReceived")}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
