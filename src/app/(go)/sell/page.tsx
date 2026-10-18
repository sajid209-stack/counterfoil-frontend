"use client";

/* ── The till, without a cart ──────────────────────────────────────────────
 *
 * v1 is a wall of bookings on the left and a cart on the right: you choose a
 * thing, a sheet covers the wall to ask its questions, the answer flies into
 * a panel, and to check what you have sold you go and look at the panel. On a
 * phone the panel is a drawer, so that is a round trip behind a scrim for
 * every line.
 *
 * Here the sale IS the page. Each thing added stays where it was configured,
 * as a card in one scroll; finished cards collapse into a calm summary row.
 * There is no cart, no drawer and no sheet over the selection.
 *
 * It is drawn in the cart till's card language (docs/mobile.md §5): the page
 * is the ground, every group is its own white card 12px from the next, every
 * choice is its own rounded tile, headings are 16px semibold, and the orange
 * button is bottom-right with the "not now" action on its left.
 *
 * IMPORTANT: this is v2. The v1 till at /pos is untouched — this shares the
 * DATA layer (lib/api, lib/orderMath, lib/duration) and nothing else.
 */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEnumLabels } from "@/lib/labels";
import { Banknote, CreditCard, Plus, QrCode, Send, Trash2, Wallet, type LucideIcon } from "lucide-react";
import { EmptyState, FormField, Modal, useToast, Button } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { useActiveCounterNow } from "@/lib/activeCounter";
import {
  tillMethods,
  advanceMinimum,
  checkout,
  counterItems,
  getAdvancePolicy,
  getManualDiscountPolicy,
  getOperator,
  inventoryItem,
  inventoryLineId,
  listLocations,
  listPaymentAccounts,
  listProducts,
  listResources,
  listRoles,
  listStaff,
  quoteCart,
  releaseHold,
  activeHolds,
  HOLDS_EVENT,
  CHECKOUT_HELD_FOR,
  type AppliedPromotion,
  type HoldView,
  type InventoryItemView,
  type PaymentMethod,
  type Product,
  type QuoteLine,
} from "@/lib/api";
import type { DiscountMode } from "@/components/ui";
import { CustomerPicker, type AttachedCustomer } from "../pos/CustomerPicker";
import { HeldSheet } from "../pos/HeldSheet";
import type { PayChoice } from "../pos/CheckoutParts";
import { ActionBar, secondaryButton } from "../_components/ActionBar";
import { ActionTile, Tile, TileGrid, TileLabel, GoCard } from "../_components/Tiles";
import { BookingGlyph } from "../_components/WallTile";
import { Thumb } from "../_components/Thumb";
import { Stepper } from "../_components/Stepper";
import { SaleRows, type RowKey } from "./_components/SaleRows";
import { ShopGlyph, productNeedsSheet } from "./_lib/wall";
import { formatClock, formatDay, formatMoney, formatPriceShort } from "@/lib/format";
import { useMediaQuery } from "@/lib/useMedia";
import { toMinutes, toTime } from "@/lib/schedule";
import { Catalogue } from "./_components/Catalogue";
import { SelectionInline } from "./_components/SelectionInline";
import { Keypad } from "../_components/Keypad";
import { usePrefs } from "@/lib/prefs";
import { cn } from "@/lib/cn";
import { itemBalance, itemSeats, itemSlotISO, itemTotal, priceSale, type SaleItem } from "@/lib/sale/saleMath";
import { draftFrom, newDraft, patternOf, resolveDraft, type Draft } from "@/lib/sale/selection";

/** A way of paying is recognised as an object, not a word: cash is a note, bKash
 *  is a send, the QR is a code, the terminal is a card. */
const METHOD_ICON: Partial<Record<PaymentMethod, LucideIcon>> = {
  cash: Banknote,
  bkash: Send,
  bangla_qr: QrCode,
  card_terminal: CreditCard,
};

/** One thing in the sale, and the questions it is still answering.
 *
 *  The draft is kept beside the resolved item rather than thrown away, so
 *  re-opening a finished block lands on the choices that were made. */
interface Block {
  id: string;
  productId: string;
  draft: Draft;
}

/** The signed-in staff member (mock session): Nadia, whose role sets the
 *  discount ceiling when no business policy overrides it. */
const SIGNED_IN_STAFF_ID = "stf_nadia";

const newId = () => `item_${globalThis.crypto.randomUUID().slice(0, 8)}`;
const noSubscribe = () => () => {};

/** Notes a customer hands over for this amount: the next round hundred, five
 *  hundred and thousand above it, never one that is too small. */
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

/** A finished thing in the sale as one calm row: a 48px picture, a bold name,
 *  a quiet line, the price. The left part is the control that opens it. */
/** The block's Done once something is chosen: filled ink. Orange stays with the
 *  dock's Complete, the screen's one primary. */
const DONE_FILLED =
  "inline-flex h-13 w-full min-w-0 items-center justify-center rounded-control bg-ink px-comfortable text-md font-semibold text-paper transition-transform duration-quick active:scale-[0.98]";

function SummaryRow({
  thumb,
  name,
  line,
  price,
  onOpen,
  open,
  onRemove,
  removeLabel,
}: {
  thumb: React.ReactNode;
  name: string;
  line: string;
  price: string;
  onOpen?: () => void;
  open?: boolean;
  onRemove: () => void;
  removeLabel: string;
}) {
  const body = (
    <>
      {thumb}
      <span className="min-w-0 flex-1">
        <span className="block break-words text-md font-semibold leading-snug">{name}</span>
        {line && <span className="block break-words text-sm text-muted">{line}</span>}
      </span>
    </>
  );
  return (
    <div className="flex items-center gap-tight">
      {onOpen ? (
        <button type="button" onClick={onOpen} aria-expanded={open} className="flex min-h-12 min-w-0 flex-1 items-center gap-comfortable text-left">
          {body}
        </button>
      ) : (
        <div className="flex min-h-12 min-w-0 flex-1 items-center gap-comfortable">{body}</div>
      )}
      {price && <span className="shrink-0 whitespace-nowrap text-md font-bold tabular-nums">{price}</span>}
      <button
        type="button"
        aria-label={removeLabel}
        onClick={onRemove}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted active:bg-muted-wash"
      >
        <Trash2 size={18} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}

export default function SellPage() {
  const router = useRouter();
  const toast = useToast();
  const t = useTranslations("sell");
  const tp = useTranslations("pos");
  const tr = useTranslations();
  const enumL = useEnumLabels();

  const productsQ = useApiQuery(() => listProducts({ pageSize: 100, filters: { status: "active" } }), []);
  const opQ = useApiQuery(() => getOperator(), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 1, filters: { status: "active" } }), []);
  const activeCounter = useActiveCounterNow();
  const teamQ = useApiQuery(() => listStaff({ pageSize: 100, filters: { status: "active" } }), []);
  const resourcesQ = useApiQuery(() => listResources({ pageSize: 100 }), []);
  const payAcctsQ = useApiQuery(() => listPaymentAccounts({ pageSize: 100 }), []);
  const policyQ = useApiQuery(() => getManualDiscountPolicy(), []);
  const advanceQ = useApiQuery(() => getAdvancePolicy(), []);
  const rolesQ = useApiQuery(() => listRoles({ pageSize: 100 }), []);

  /* The wall has two homes — a column on a tablet, a section of the scroll on
     a phone — and it must exist in exactly ONE of them at a time (two copies
     in the DOM means two search fields and the hidden one first). */
  const wide = useMediaQuery("(min-width: 64rem)");

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [browsing, setBrowsing] = useState(true);
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  /* Empty reads as the exact amount: a derived default follows the sale as
     lines are added instead of going stale the moment it does. */
  const [tenderTaka, setTenderTaka] = useState("");
  const [padOpen, setPadOpen] = useState(false);
  const prefs = usePrefs();
  const [walletRef, setWalletRef] = useState("");
  const [saving, setSaving] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [customItems, setCustomItems] = useState<SaleItem[]>([]);
  /** Shop items in the sale: item id → how many. */
  const [shopQty, setShopQty] = useState<Record<string, number>>({});
  const [attached, setAttached] = useState<AttachedCustomer | null>(null);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [openRow, setOpenRow] = useState<RowKey | null>(null);
  const [discountMode, setDiscountMode] = useState<DiscountMode>("percent");
  const [discountPct, setDiscountPct] = useState(0);
  const [discountAmt, setDiscountAmt] = useState(0);
  const [discountReason, setDiscountReason] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedPromotion | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [advance, setAdvance] = useState<number | null>(null);
  const [payInFull, setPayInFull] = useState(false);

  const operator = opQ.data;
  const currency = operator?.currency ?? "BDT";
  // Events (BT-15) are not part of this wall: a booking sheet cannot sell one.
  const products = useMemo(() => (productsQ.data?.data ?? []).filter((p) => p.bookingType !== "BT-15"), [productsQ.data]);
  const resources = useMemo(() => resourcesQ.data?.data ?? [], [resourcesQ.data]);
  const team = useMemo(() => teamQ.data?.data ?? [], [teamQ.data]);
  const productById = (id: string) => products.find((p) => p.id === id);

  // Non-cash tender needs a live PSP account. Cash always works.
  const nonCashOk = (payAcctsQ.data?.data ?? []).some((a) => a.status === "active" && a.chargesEnabled);
  const methods: PaymentMethod[] = tillMethods(nonCashOk);

  /* The shelf at this counter's venue — the same venue the sale will be filed
     at and its stock taken from. Read once the browser has taken over: the
     store can hold a different business in the browser than the server drew. */
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const tillLocationId = activeCounter.locationId || (locationsQ.data?.data[0]?.id ?? "loc_fort");
  const shop = useMemo(
    () => (hydrated ? counterItems(tillLocationId) : []),
    [hydrated, tillLocationId],
  );

  /* Places held for people at this venue (not the till's own ten-minute
     checkout holds). Followed through the holds event, and re-read now and then
     because a hold with an end time lapses by itself. */
  const heldSig = useSyncExternalStore(
    (cb) => {
      window.addEventListener(HOLDS_EVENT, cb);
      const id = window.setInterval(cb, 20000);
      return () => { window.removeEventListener(HOLDS_EVENT, cb); window.clearInterval(id); };
    },
    () => activeHolds().map((h) => `${h.id}:${h.heldFor === CHECKOUT_HELD_FOR ? 0 : 1}`).join(","),
    () => "",
  );
  const heldHere = useMemo(() => {
    void heldSig;
    return activeHolds().filter(
      (h) => h.heldFor !== CHECKOUT_HELD_FOR && (h.locationId === tillLocationId || (productsQ.data?.data ?? []).find((p) => p.id === h.productId)?.locationIds.includes(tillLocationId)),
    );
  }, [heldSig, tillLocationId, productsQ.data]);
  const [heldOpen, setHeldOpen] = useState(false);

  /* ── Resolving every block ───────────────────────────────────────────────
     Done in one pass so the blocks, the totals and the eventual payload can
     never be computed from different states. */
  const resolved = useMemo(
    () =>
      blocks.map((b) => {
        const product = productById(b.productId);
        if (!product) return { block: b, product: null, lines: [] as SaleItem[], missing: null as null | string, amount: 0 };
        const r = resolveDraft(product, b.draft, b.id, { resources, team });
        return { block: b, product, lines: r.items, missing: r.missing, amount: r.amount };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blocks, products, resources, team],
  );

  /* A shop item is one line, one unit: nothing to configure, so it never has a
     block of its own — a count and a stepper are the whole of it. */
  const shopLines = useMemo(
    () =>
      shop
        .filter((i) => (shopQty[i.id] ?? 0) > 0)
        .map((i): { item: InventoryItemView; sale: SaleItem } => ({
          item: i,
          sale: {
            id: `shop_${i.id}`,
            productId: inventoryLineId(i.id),
            productName: i.name,
            /* Its own rate: an item carries the tax it is sold at. */
            taxRatePct: i.taxClass === "exempt" ? 0 : i.taxClass === "reduced" ? (operator?.reducedRatePct ?? 0) : (operator?.taxRatePct ?? 0),
            items: [{ tierId: i.id, tierName: i.unit, unitPrice: i.price, qty: shopQty[i.id] }],
          },
        })),
    [shop, shopQty, operator],
  );

  const items: SaleItem[] = useMemo(
    () => [...resolved.flatMap((r) => r.lines), ...customItems, ...shopLines.map((s) => s.sale)],
    [resolved, customItems, shopLines],
  );

  /* ── The money ───────────────────────────────────────────────────────────
     Priced in two passes because a percentage discount needs something to be
     a percentage OF. The first pass is the sale at list price; the second
     applies the discount that pass sized. */
  const listTotals = useMemo(
    () => priceSale(items, { products, operator }),
    [items, products, operator],
  );
  const discountBase = listTotals.subtotal - listTotals.lineDiscountTotal;
  const manualDiscount =
    discountMode === "percent"
      ? Math.round((Math.max(0, discountBase) * discountPct) / 100)
      : Math.min(Math.max(0, discountBase), discountAmt);

  const totals = useMemo(
    () => priceSale(items, { products, operator, manualDiscount, couponDiscount: appliedCoupon?.discount ?? 0 }),
    [items, products, operator, manualDiscount, appliedCoupon],
  );

  /* The cashier's discount is capped by the business policy, falling back to
     the signed-in staff's role limit where no policy is set. The cap is on the
     EFFECTIVE rate — what actually came off, not what was typed. A promo code
     is an entitlement, not a cashier discount, so it is not counted here. */
  const roleLimit =
    rolesQ.data?.data.find((r) => r.id === (teamQ.data?.data.find((x) => x.id === SIGNED_IN_STAFF_ID)?.roleId))
      ?.discountLimitPct ?? 100;
  const capPct = policyQ.data ? policyQ.data.maxPercentBps / 100 : roleLimit;
  const effectivePct = totals.subtotal > 0 ? (manualDiscount / totals.subtotal) * 100 : 0;
  const overLimit = effectivePct > capPct + 1e-9;
  const reasonNeeded = manualDiscount > 0 && !!policyQ.data?.requireReason && !discountReason.trim();

  /* ── Part payment ────────────────────────────────────────────────────────
     A booking's DEPOSIT policy says what the booking requires; an ADVANCE says
     what this customer actually handed over. Shown as Full · Half · Minimum. */
  const depositBalance = items.reduce((sum, e) => sum + itemBalance(e, products), 0);
  const advanceRule = advanceQ.data?.counter;
  const advanceAllowed = !!advanceRule?.enabled && items.length > 0 && totals.total > 0;
  const advanceMin = advanceRule ? advanceMinimum(advanceRule, totals.total) : totals.total;
  const advanceValid = advance != null && advance >= advanceMin && advance < totals.total;
  const balance = advanceValid ? totals.total - advance! : payInFull ? 0 : depositBalance;
  const dueNow = totals.total - balance;

  const partAllowed = totals.total > 0 && (advanceAllowed || depositBalance > 0);
  const requiredNow = depositBalance > 0 ? totals.total - depositBalance : 0;
  const minNow = advanceAllowed ? Math.max(advanceMin, requiredNow) : requiredNow;
  const halfNow = Math.round(totals.total / 2);
  const payOptions: { id: PayChoice; label: string; amount: number }[] = partAllowed
    ? [
        { id: "full", label: tp("pay.full"), amount: totals.total },
        ...(advanceAllowed && halfNow >= minNow && halfNow < totals.total ? [{ id: "half" as const, label: tp("pay.half"), amount: halfNow }] : []),
        ...(minNow > 0 && minNow < totals.total ? [{ id: "minimum" as const, label: tp("pay.minimum"), amount: minNow }] : []),
      ]
    : [];
  const payChoice: PayChoice = advanceValid
    ? advance === halfNow && halfNow !== minNow
      ? "half"
      : "minimum"
    : payInFull || depositBalance === 0
      ? "full"
      : "minimum";
  const choosePay = (c: PayChoice) => {
    if (c === "full") {
      setAdvance(null);
      setPayInFull(true);
    } else if (c === "half") {
      setAdvance(halfNow);
      setPayInFull(false);
    } else {
      setPayInFull(false);
      setAdvance(advanceAllowed && minNow >= advanceMin && minNow < totals.total ? minNow : null);
    }
  };

  /** Seats already spoken for elsewhere in this sale, so a session cannot be
   *  oversold by adding it twice. The block being edited excludes itself. */
  const seatsElsewhere = (productId: string, slotStart: string) =>
    items
      .filter((e) => e.id !== openId && e.productId === productId && itemSlotISO(e) === slotStart)
      .reduce((s, e) => s + itemSeats(e, products), 0);

  /** How many of this are in the sale, as the wall's tile counts them. */
  const countOf = (productId: string) =>
    resolved
      .filter((r) => r.block.productId === productId)
      .reduce(
        (n, r) =>
          n +
          r.lines.reduce(
            (a, l) => a + (l.fixedPrice != null || l.seatLabels?.length ? Math.max(1, l.seatLabels?.length ?? 1) : l.items.reduce((x, i) => x + i.qty, 0)),
            0,
          ),
        0,
      );

  /* ── Adding, opening, removing ───────────────────────────────────────── */
  /** One tap on a "+" tile adds it (a second tap is one more); a "›" tile opens
      its questions in a block of its own. */
  const pick = (p: Product) => {
    if (!productNeedsSheet(p) && p.bookingType !== "BT-02") {
      const tier = p.tiers.find((x) => x.active);
      if (tier) {
        const existing = blocks.find((b) => b.productId === p.id && (b.draft.qty[tier.id] ?? 0) > 0);
        if (existing) {
          setDraft(existing.id, { ...existing.draft, qty: { ...existing.draft.qty, [tier.id]: (existing.draft.qty[tier.id] ?? 0) + 1 } });
        } else {
          const id = newId();
          setBlocks((b) => [...b, { id, productId: p.id, draft: { ...newDraft(p), qty: { [tier.id]: 1 } } }]);
        }
        return;
      }
    }
    const id = newId();
    setBlocks((b) => [...b, { id, productId: p.id, draft: newDraft(p) }]);
    setOpenId(id);
    setBrowsing(false);
  };

  const openBlock = (id: string) => {
    const entry = resolved.find((r) => r.block.id === id);
    // Re-open on the choices that were made, not on a blank draft.
    if (entry?.product && entry.lines.length > 0) {
      setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, draft: draftFrom(entry.product!, entry.lines) } : b)));
    }
    setOpenId(id);
    setBrowsing(false);
  };

  const removeBlock = (id: string) => {
    setBlocks((bs) => bs.filter((b) => b.id !== id));
    if (openId === id) setOpenId(null);
  };

  const setDraft = (id: string, draft: Draft) =>
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, draft } : b)));

  const heldName = (h: HoldView) => h.productName || productById(h.productId)?.name || "";
  const putBackHeld = async (h: HoldView) => {
    if (heldHere.length <= 1) setHeldOpen(false);
    await releaseHold(h.id);
    toast.success(tp("held.putBackToast", { name: h.heldFor }));
  };
  /* The person it was held for is here: the hold goes, and exactly what was
     kept becomes a block in the sale, already on that day, time, place and
     number of places — the /sell equivalent of putting it in the cart. */
  const sellHeld = async (h: HoldView) => {
    const product = productById(h.productId);
    await releaseHold(h.id);
    setHeldOpen(false);
    if (!product) return;
    const time = (h.slotStart ?? "").slice(11, 16);
    const draft: Draft = { ...newDraft(product), date: h.date, slotTime: time || undefined };
    const pattern = patternOf(product);
    if (h.kind === "resource" && h.resourceId && time) {
      draft.resourceId = h.resourceId;
      const end = (h.slotEnd ?? "").slice(11, 16);
      const span = end ? toMinutes(end) - toMinutes(time) : 0;
      if (pattern === "flexible") {
        if (span > 0) draft.durationMinutes = span;
      } else {
        const step = product.schedule?.sessionMinutes ?? 60;
        const slots: { date: string; time: string; resourceId: string }[] = [];
        for (let m = toMinutes(time); m < toMinutes(time) + Math.max(span, step); m += step) slots.push({ date: h.date, time: toTime(m), resourceId: h.resourceId });
        draft.slots = slots;
        draft.slotTime = undefined;
      }
    } else if (h.kind === "capacity" && h.quantity > 0) {
      const tier = product.tiers.find((x) => x.active);
      if (tier) draft.qty = { [tier.id]: h.quantity };
    }
    const id = newId();
    setBlocks((b) => [...b, { id, productId: product.id, draft }]);
    setOpenId(id);
    setBrowsing(false);
  };

  /** One tap sells a shelf item; a second is one more, up to what is on it. */
  const tapItem = (i: InventoryItemView) => {
    const have = shopQty[i.id] ?? 0;
    if (i.tracked && have >= i.onHand) {
      toast.error(i.onHand <= 0 ? tp("shop.none", { name: i.name }) : tp("shop.allOfIt", { count: i.onHand, unit: i.unit, name: i.name }));
      return;
    }
    setShopQty((q) => ({ ...q, [i.id]: have + 1 }));
  };
  const setShop = (id: string, n: number) =>
    setShopQty((q) => {
      const next = { ...q };
      if (n <= 0) delete next[id];
      else next[id] = n;
      return next;
    });

  /* Bring a newly opened block into view. Scrolling is not state, so this is
     an effect that reads the DOM and nothing else. */
  const openRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (openId && openRef.current) {
      openRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [openId]);

  const wallRef = useRef<HTMLDivElement | null>(null);
  const addMore = () => {
    setBrowsing(true);
    setOpenId(null);
    requestAnimationFrame(() => wallRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const addCustom = () => {
    const minor = Math.round((parseFloat(customAmount) || 0) * 100);
    if (minor <= 0) return;
    setCustomItems((c) => [
      ...c,
      {
        id: newId(),
        productId: "custom",
        productName: customName || t("custom.defaultName"),
        taxRatePct: operator?.taxRatePct ?? 0,
        items: [{ tierId: "custom", tierName: t("custom.lineLabel"), unitPrice: minor, qty: 1 }],
      },
    ]);
    setCustomOpen(false);
    setCustomName("");
    setCustomAmount("");
    setBrowsing(false);
  };

  /* ── A promo code ───────────────────────────────────────────────────────
     Asked of the promotions engine with what is in the sale. Only a promotion
     that came in BY the typed code counts. */
  const quoteLines = (): QuoteLine[] =>
    items.flatMap((e) => [
      ...(e.fixedPrice != null && e.fixedPrice > 0 ? [{ lineId: `${e.id}|booking`, quantity: 1, unitAmount: e.fixedPrice }] : []),
      ...e.items.filter((i) => i.unitPrice > 0).map((i) => ({ lineId: `${e.id}|${i.tierId}`, quantity: i.qty, unitAmount: i.unitPrice })),
    ]);
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

  /* ── What the footer should say ──────────────────────────────────────────
     Never "Continue". Either it names the decision that is still open, or it
     names the money. */
  const openEntry = resolved.find((r) => r.block.id === openId);
  const openMissing = openEntry?.missing ?? null;
  const payable = totals.total > 0;

  const tenderedMinor = tenderTaka === "" ? dueNow : (parseInt(tenderTaka, 10) || 0) * 100;
  const exactTender = tenderedMinor === dueNow;
  const changeMinor = tenderedMinor - dueNow;
  const cashReady = method !== "cash" || tenderedMinor >= dueNow;
  const walletReady = method !== "bkash" || walletRef.trim().length > 0;
  const canComplete = payable && !openMissing && cashReady && walletReady && !overLimit && !reasonNeeded;

  const footerLabel = openMissing
    ? t(`missing.${openMissing}` as never)
    : !payable
      ? t("footer.nothingYet")
      : overLimit
        ? t("footer.overLimit")
        : reasonNeeded
          ? t("footer.needReason")
          : method === "cash" && !cashReady
            ? t("footer.takeAmount", { amount: formatPriceShort(dueNow, currency) })
            : t("footer.completeAmount", { amount: formatPriceShort(dueNow, currency) });

  /* ── The sale ───────────────────────────────────────────────────────────
     The SAME lines that priced the footer are the lines handed to checkout.
     Rebuilding the payload here would be how a till shows one number and
     charges another. */
  const complete = async () => {
    if (!canComplete || saving) return;
    setSaving(true);
    /* A code taken off before the sale changed was quoted against the OLD sale:
       it is asked again, and a changed figure is shown before any money moves. */
    if (appliedCoupon?.code) {
      const r = await quoteCode(appliedCoupon.code);
      if ("applied" in r) {
        if (r.applied.discount !== appliedCoupon.discount) {
          setAppliedCoupon(r.applied);
          setSaving(false);
          toast.error(t("rows.codeUpdated"));
          return;
        }
      } else {
        setAppliedCoupon(null);
        setCouponError(r.error);
        setSaving(false);
        toast.error(tr(`pos.rejected.${r.error}` as never));
        return;
      }
    }
    const bookings = items
      .filter((e) => e.slotDate)
      .map((e) => ({
        productId: e.productId,
        resourceId: e.resourceId ?? null,
        slotStart: itemSlotISO(e)!,
        slotEnd: e.slotEnd,
        partySize: itemSeats(e, products),
      }));
    /* A shelf line is a thing handed over, not a way in: it admits nobody, or
       it would mint a ticket for a tote bag. */
    const lines = totals.lines.map((l) => {
      if (!l.productId.startsWith("inv_")) return l;
      /* ...and it is reported at its own tax class, not the booking default. */
      const shelf = inventoryItem(l.productId.slice(4));
      return { ...l, admits: 0, taxClass: shelf?.taxClass ?? l.taxClass };
    });
    const res = await checkout({
      channel: "counter",
      locationId: tillLocationId,
      counterId: activeCounter.counter?.id ?? null,
      staffId: null,
      customerName: attached?.name ?? null,
      customerId: attached?.id ?? null,
      lines,
      orderDiscount: totals.orderDiscount,
      bookings,
      taxPct: operator?.taxRatePct ?? 0,
      method,
      amountTendered: method === "cash" ? tenderedMinor : dueNow,
      paymentReference: method === "bkash" ? walletRef.trim() : undefined,
      // Below the total, the order lands as "partial" with the rest owed at
      // arrival — which is what the balance line on the receipt then says.
      payNow: dueNow,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    sessionStorage.setItem(
      "sell_complete",
      JSON.stringify({
        orderId: res.data.order.id,
        code: res.data.firstTicketCode,
        change: method === "cash" ? Math.max(0, changeMinor) : 0,
        balance,
        receipt: {
          // A multi-slot sale produces several lines that differ ONLY by when
          // they are. Without the time they read as three identical charges,
          // which is what a receipt dispute is made of.
          lines: totals.lines.map((l) => ({
            name: [
              l.tierName && l.tierName !== l.productName ? `${l.productName} · ${l.tierName}` : l.productName,
              l.booking?.startTime ? formatClock(l.booking.startTime) : null,
              l.booking?.date ? formatDay(l.booking.date, { weekday: true }) : null,
            ]
              .filter(Boolean)
              .join(" · "),
            qty: l.quantity,
            amount: l.unitPrice * l.quantity,
            child: l.parentIndex != null,
          })),
          subtotal: totals.subtotal,
          lineDiscountTotal: totals.lineDiscountTotal,
          orderDiscount: totals.orderDiscount,
          tax: totals.tax,
          total: totals.total,
        },
        payments: [
          method === "cash"
            ? { method: "cash", amount: dueNow, tendered: tenderedMinor, change: Math.max(0, changeMinor) }
            : { method, amount: dueNow },
        ],
      }),
    );
    router.push("/sell/complete");
  };

  /* ── A finished block, as one line ──────────────────────────────────────── */
  /** One line of prose for a finished block. Several slots collapse to a
   *  count plus the days they fall on, because listing eight of them turns
   *  the collapsed summary back into the thing it was collapsed to avoid. */
  const summaryOf = (lines: SaleItem[]) => {
    if (lines.length > 1) {
      const days = [...new Set(lines.map((l) => l.slotDate).filter(Boolean))] as string[];
      return [
        t("block.slotCount", { count: lines.length }),
        days.length === 1
          ? formatDay(days[0], { weekday: true })
          : t("block.dayCount", { count: days.length }),
      ].join(" · ");
    }
    const item = lines[0];
    if (!item) return "";
    const bits = [
      item.items.map((i) => `${i.qty} ${i.tierName}`).join(" · "),
      item.resourceLabel,
      item.providerLabel,
      item.slotTime ? formatClock(item.slotTime) : "",
      item.slotDate ? formatDay(item.slotDate, { weekday: true }) : "",
    ].filter(Boolean);
    return bits.join(" · ");
  };

  const catalogue = (
    <Catalogue
      products={products}
      resources={resources}
      team={team}
      shop={shop}
      currency={currency}
      query={query}
      onQuery={setQuery}
      onPick={pick}
      onTapItem={tapItem}
      onCustom={() => setCustomOpen(true)}
      countOf={countOf}
      shopCountOf={(id) => shopQty[id] ?? 0}
      heldCount={heldHere.length}
      onHeld={() => setHeldOpen(true)}
      loading={productsQ.loading}
    />
  );

  const saleEmpty = items.length === 0 && blocks.length === 0;

  /* The sale's total bar. Phone: the docked pair above the tab bar — "not now"
     (add more) on the left, the orange button on the right. Wide: the same pair
     in flow at the foot of the sale column. */
  const bar = (
    <ActionBar
      docked={wide ? "panel" : "dock"}
      tone="ground"
      label={t("footer.barLabel")}
      secondary={wide ? null : { label: t("block.addMore"), icon: <Plus size={20} strokeWidth={2} aria-hidden />, onClick: addMore }}
      primary={{
        label: footerLabel,
        icon: canComplete ? <Banknote size={20} strokeWidth={2} aria-hidden /> : undefined,
        onClick: () => void complete(),
        disabled: !canComplete || saving,
      }}
    />
  );

  /* On a phone the PAGE scrolls, which is the whole idea — one scroll from
     the wall to the money. On a wide screen the two columns scroll
     independently; the height is stated here because the Go shell hands its
     children none. */
  return (
    <div className="grid grid-cols-1 gap-comfortable p-comfortable lg:h-[calc(100dvh-152px)] lg:grid-cols-[minmax(0,1fr)_30rem] lg:overflow-hidden rail:h-[calc(100dvh-64px)]">
      <h1 className="sr-only">{t("srTitle")}</h1>

      {/* The wall, as a column of its own on a tablet. */}
      {wide && <div className="min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">{catalogue}</div>}

      {/* The sale — one scroll, ending in the money. */}
      <div className="flex min-h-0 min-w-0 flex-col">
        <div className="flex flex-col gap-comfortable pb-44 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pb-0">
          {/* Phone: the wall lives here, above the sale. */}
          {!wide && (
            <div ref={wallRef} className="scroll-mt-comfortable">
              {browsing && catalogue}
            </div>
          )}

          {wide && saleEmpty && <EmptyState title={t("sale.empty")} message={t("sale.emptyHint")} />}

          {resolved.map(({ block, product, lines, missing, amount }) => {
            const open = openId === block.id;
            if (!product) return null;
            return (
              <div key={block.id} ref={open ? openRef : undefined}>
                <GoCard className="gap-comfortable">
                  <SummaryRow
                    thumb={<Thumb image={product.images?.[0]?.url} glyph={<BookingGlyph bookingType={product.bookingType} />} />}
                    name={product.name}
                    line={lines.length ? summaryOf(lines) : missing ? t(`missing.${missing}` as never) : ""}
                    price={amount > 0 ? formatPriceShort(amount, currency) : ""}
                    onOpen={() => (open ? setOpenId(null) : openBlock(block.id))}
                    open={open}
                    onRemove={() => removeBlock(block.id)}
                    removeLabel={t("block.remove")}
                  />
                  {open && (
                    <>
                      <SelectionInline
                        product={product}
                        draft={block.draft}
                        onDraft={(d) => setDraft(block.id, d)}
                        currency={currency}
                        team={team}
                        resources={resources}
                        seatsElsewhere={seatsElsewhere}
                      />
                      {patternOf(product) !== "unsupported" && (
                        <button
                          type="button"
                          className={lines.length > 0 ? DONE_FILLED : secondaryButton("h-13", "w-full")}
                          disabled={lines.length === 0}
                          onClick={() => setOpenId(null)}
                        >
                          {t("block.done")}
                        </button>
                      )}
                    </>
                  )}
                </GoCard>
              </div>
            );
          })}

          {shopLines.map(({ item, sale }) => {
            const n = shopQty[item.id] ?? 0;
            return (
              <GoCard key={sale.id}>
                <SummaryRow
                  thumb={<Thumb glyph={<ShopGlyph kind={item.kind} />} />}
                  name={item.name}
                  line={`${n} × ${formatPriceShort(item.price, currency)}`}
                  price={formatPriceShort(itemTotal(sale), currency)}
                  onRemove={() => setShop(item.id, 0)}
                  removeLabel={t("block.remove")}
                />
                <div className="flex justify-end">
                  <Stepper
                    variant="round"
                    value={n}
                    min={0}
                    max={item.tracked ? item.onHand : undefined}
                    onChange={(v) => setShop(item.id, v)}
                    lessLabel={t("qty.less", { tier: item.name })}
                    moreLabel={t("qty.more", { tier: item.name })}
                  />
                </div>
              </GoCard>
            );
          })}

          {customItems.map((c) => (
            <GoCard key={c.id}>
              <SummaryRow
                thumb={<Thumb glyph={<Plus strokeWidth={1.5} aria-hidden />} />}
                name={c.productName}
                line={t("custom.lineLabel")}
                price={formatPriceShort(itemTotal(c), currency)}
                onRemove={() => setCustomItems((x) => x.filter((y) => y.id !== c.id))}
                removeLabel={t("block.remove")}
              />
            </GoCard>
          ))}

          {/* Add another - below the last block. On a tablet the wall is always
              there, so this is a phone affordance only. */}
          {!wide && !browsing && (
            <button
              type="button"
              onClick={addMore}
              className="card-surface flex min-h-14 w-full items-center justify-center gap-tight px-comfortable text-md font-medium text-fg active:bg-muted-wash"
            >
              <Plus size={18} strokeWidth={2} aria-hidden />
              {t("block.addAnother")}
            </button>
          )}

          {/* The decisions that belong to the sale rather than to one item. */}
          {payable && (
            <SaleRows
              currency={currency}
              openRow={openRow}
              onOpenRow={setOpenRow}
              attached={attached}
              onPickCustomer={() => setCustomerOpen(true)}
              onRemoveCustomer={() => setAttached(null)}
              discountMode={discountMode}
              onDiscountMode={setDiscountMode}
              discountValue={discountMode === "percent" ? discountPct : discountAmt}
              onDiscountValue={(v) => (discountMode === "percent" ? setDiscountPct(v) : setDiscountAmt(v))}
              discountBase={discountBase}
              discountReason={discountReason}
              onDiscountReason={setDiscountReason}
              reasonRequired={!!policyQ.data?.requireReason}
              overLimit={overLimit}
              capPct={capPct}
              appliedCoupon={appliedCoupon}
              couponTaken={totals.couponDiscount}
              couponInput={couponInput}
              onCouponInput={(v) => { setCouponInput(v); setCouponError(null); }}
              onApplyCoupon={() => void applyCoupon()}
              onRemoveCoupon={() => { setAppliedCoupon(null); setCouponError(null); }}
              couponError={couponError ? tr(`pos.rejected.${couponError}` as never) : null}
              payOptions={payOptions}
              payChoice={payChoice}
              onPayChoice={choosePay}
              dueNow={dueNow}
              balance={balance}
            />
          )}

          {/* ── Pay ──────────────────────────────────────────────────────── */}
          {payable && (
            <>
              {/* What is being paid, as large as the screen allows: it is the
                  number the customer is told. */}
              <div className="text-center">
                <p className="text-base font-medium text-muted">{balance > 0 ? t("pay.collectNow") : t("pay.collect")}</p>
                <p className="mt-inline text-[clamp(2rem,10vw,2.75rem)] font-bold leading-tight tabular-nums text-fg">{formatMoney(dueNow, currency)}</p>
              </div>

              {/* How they are paying: each way is its own tile, a picture in a
                  soft round and a word; chosen is solid orange. */}
              {methods.length > 1 && (
                <div className="flex flex-col gap-tight">
                  <TileLabel>{t("pay.label")}</TileLabel>
                  <TileGrid
                    cols={methods.length >= 4 ? 4 : (Math.max(2, methods.length) as 2 | 3)}
                    role="radiogroup"
                    aria-label={t("pay.label")}
                    className={methods.length >= 4 ? "grid-cols-2 min-[360px]:grid-cols-4" : undefined}
                  >
                    {methods.map((m) => {
                      const Icon = METHOD_ICON[m] ?? Wallet;
                      return (
                        <ActionTile
                          key={m}
                          role="radio"
                          aria-checked={method === m}
                          selected={method === m}
                          icon={<Icon strokeWidth={1.75} />}
                          label={enumL.method(m)}
                          className="[&>svg]:hidden"
                          onClick={() => { setMethod(m); setTenderTaka(""); setPadOpen(false); }}
                        />
                      );
                    })}
                  </TileGrid>
                </div>
              )}

              {/* The sums behind the figure. */}
              <GoCard className="gap-inline text-sm">
                <div className="flex justify-between text-muted">
                  <span>{t("pay.subtotal")}</span>
                  <span className="tabular-nums">{formatMoney(totals.subtotal, currency)}</span>
                </div>
                {totals.manualDiscount > 0 && (
                  <div className="flex justify-between text-muted">
                    <span className="min-w-0 truncate">
                      {discountMode === "percent" ? t("pay.discountPct", { pct: discountPct }) : t("pay.discountFlat")}
                    </span>
                    <span className="shrink-0 text-danger tabular-nums">−{formatMoney(totals.manualDiscount, currency)}</span>
                  </div>
                )}
                {totals.couponDiscount > 0 && (
                  <div className="flex justify-between text-muted">
                    <span className="min-w-0 truncate">{appliedCoupon?.code ?? appliedCoupon?.name}</span>
                    <span className="shrink-0 text-danger tabular-nums">−{formatMoney(totals.couponDiscount, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted">
                  <span>{t("pay.vat")}</span>
                  <span className="tabular-nums">{formatMoney(totals.tax, currency)}</span>
                </div>
                {balance > 0 && (
                  <>
                    <div className="flex justify-between text-muted">
                      <span>{t("pay.total")}</span>
                      <span className="tabular-nums">{formatMoney(totals.total, currency)}</span>
                    </div>
                    <div className="flex justify-between text-muted">
                      <span>{t("pay.balanceAtArrival")}</span>
                      <span className="tabular-nums">{formatMoney(balance, currency)}</span>
                    </div>
                  </>
                )}
              </GoCard>

              {method === "cash" && (
                <>
                  {/* Cash: the figure handed over (the amount now, until a
                      cashier says otherwise) and what to give back, on a card
                      of its own. The received figure IS the way to the pad. */}
                  <div className="card-surface divide-y divide-line overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setPadOpen(true)}
                      aria-label={`${t("pay.received")} ${formatMoney(tenderedMinor, currency)} — ${tp("cash.tapToChange")}`}
                      className="flex min-h-14 w-full items-center justify-between gap-tight px-comfortable py-1 text-left"
                    >
                      <span className="min-w-0 text-md">{t("pay.received")}</span>
                      <span
                        className={cn(
                          "flex min-h-11 min-w-[8rem] shrink-0 items-center justify-end rounded-inner bg-surface px-comfortable text-lg font-semibold tabular-nums ring-inset",
                          padOpen || tenderTaka !== "" ? "ring-2 ring-ember" : "ring-1 ring-strong",
                        )}
                      >
                        {formatMoney(tenderedMinor, currency)}
                      </span>
                    </button>
                    {exactTender ? (
                      <p className="flex min-h-14 items-center px-comfortable text-md font-medium text-success">{tp("cash.noChange")}</p>
                    ) : (
                      <div className={cn("flex min-h-14 items-baseline justify-between gap-tight px-comfortable py-tight font-semibold", cashReady ? "text-success" : "text-muted")}>
                        <span className="shrink-0 text-xl">{t("pay.change")}</span>
                        <span className="min-w-0 truncate text-right text-[clamp(1.75rem,9.5vw,2.5rem)]">
                          {cashReady ? formatMoney(Math.max(0, changeMinor), currency) : "—"}
                        </span>
                      </div>
                    )}
                  </div>
                  <TileGrid cols={2} className="min-[360px]:grid-cols-4">
                    <Tile selected={exactTender} onClick={() => setTenderTaka("")} label={tp("cash.exact")} className="h-11 [&>svg]:hidden" />
                    {quickNotes(dueNow).map((amt) => (
                      <Tile
                        key={amt}
                        selected={tenderTaka === String(amt)}
                        onClick={() => setTenderTaka(String(amt))}
                        label={formatPriceShort(amt * 100, currency)}
                        className="h-11 tabular-nums [&>svg]:hidden"
                      />
                    ))}
                  </TileGrid>
                  {(prefs.posKeypad || padOpen) && (
                    <Keypad
                      onKey={(d) => setTenderTaka((v) => (v + d).slice(0, 7))}
                      onBackspace={() => setTenderTaka((v) => v.slice(0, -1))}
                    />
                  )}
                </>
              )}

              {method === "bkash" && (
                <GoCard>
                  <FormField
                    label={t("pay.txnLabel")}
                    placeholder={t("pay.txnPlaceholder")}
                    value={walletRef}
                    onChange={(e) => setWalletRef(e.target.value)}
                  />
                  <p className="text-sm text-muted">{t("pay.txnHint")}</p>
                </GoCard>
              )}

              {method === "bangla_qr" && (
                <GoCard>
                  <p className="text-md text-fg">{t("pay.qrHint")}</p>
                </GoCard>
              )}
            </>
          )}
        </div>

        {/* The one thing that never scrolls away: the next decision, with the
            money in it. On a phone it clears the Go tab bar. */}
        {bar}
      </div>

      <HeldSheet open={heldOpen && heldHere.length > 0} holds={heldHere} nameOf={heldName} onClose={() => setHeldOpen(false)} onSell={sellHeld} onPutBack={putBackHeld} />

      <CustomerPicker
        open={customerOpen}
        onClose={() => setCustomerOpen(false)}
        attached={attached}
        onAttach={setAttached}
      />

      <Modal
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        title={t("custom.title")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCustomOpen(false)}>
              {tp("custom.cancel")}
            </Button>
            <Button onClick={addCustom} disabled={!customAmount}>
              {tp("custom.add")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-section">
          <FormField
            label={tp("custom.description")}
            placeholder={tp("custom.descriptionPlaceholder")}
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
          />
          <FormField
            label={tp("custom.amountLabel", { currency })}
            variant="number"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
