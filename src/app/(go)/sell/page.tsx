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
 * as a block in one scroll; finished blocks collapse into a line stating what
 * was decided. There is no cart, no drawer and no sheet over the selection —
 * only the payment pad, which appears at the bottom of the same scroll.
 *
 * What that buys, concretely: nothing is ever hidden behind an affordance you
 * have to know about, the running total is always the last thing on screen,
 * and changing the third item does not mean opening and closing two things.
 *
 * What it costs: the page is long. That is the trade, and it is the right one
 * on a touch screen, where scrolling is free and tapping is not.
 *
 * IMPORTANT: this is v2. The v1 till at /pos is untouched — this shares the
 * DATA layer (lib/api, lib/orderMath, lib/duration) and nothing else, so a
 * change here cannot regress the audited surface.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEnumLabels } from "@/lib/labels";
import { Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import { Button, EmptyState, FormField, Modal, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import {
  advanceMinimum,
  checkout,
  getAdvancePolicy,
  getManualDiscountPolicy,
  getOperator,
  listCategories,
  listLocations,
  listPaymentAccounts,
  listProducts,
  listResources,
  listRoles,
  listStaff,
  type PaymentMethod,
  type Product,
} from "@/lib/api";
import type { DiscountMode } from "@/components/ui";
import { CustomerPicker, type AttachedCustomer } from "../pos/CustomerPicker";
import { SaleRows, type RowKey } from "./_components/SaleRows";
import { formatDay, formatMoney } from "@/lib/format";
import { useMediaQuery } from "@/lib/useMedia";
import { Catalogue } from "./_components/Catalogue";
import { SelectionInline } from "./_components/SelectionInline";
import { Keypad } from "../_components/Keypad";
import { itemBalance, itemSeats, itemSlotISO, itemTotal, priceSale, type SaleItem } from "./_lib/saleMath";
import { draftFrom, newDraft, patternOf, resolveDraft, type Draft } from "./_lib/selection";

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

export default function SellPage() {
  const router = useRouter();
  const toast = useToast();
  const t = useTranslations("sell");
  const tp = useTranslations("pos");
  const enumL = useEnumLabels();

  const productsQ = useApiQuery(() => listProducts({ pageSize: 100, filters: { status: "active" } }), []);
  const opQ = useApiQuery(() => getOperator(), []);
  const catsQ = useApiQuery(() => listCategories({ pageSize: 100 }), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 1, filters: { status: "active" } }), []);
  const teamQ = useApiQuery(() => listStaff({ pageSize: 100, filters: { status: "active" } }), []);
  const resourcesQ = useApiQuery(() => listResources({ pageSize: 100 }), []);
  const payAcctsQ = useApiQuery(() => listPaymentAccounts({ pageSize: 100 }), []);
  const policyQ = useApiQuery(() => getManualDiscountPolicy(), []);
  const advanceQ = useApiQuery(() => getAdvancePolicy(), []);
  const rolesQ = useApiQuery(() => listRoles({ pageSize: 100 }), []);

  /* The wall has two homes — a column on a tablet, a section of the scroll on
     a phone — and it must exist in exactly ONE of them at a time. Rendering it
     into both and hiding one with `lg:` puts two copies in the DOM: twice the
     work, two search fields for a screen reader to find, and the hidden copy
     first in document order, so anything selecting "the search box" gets the
     invisible one. This project has been bitten by that before (the page-header
     portal, 2026-09-03); `useMediaQuery` is the mechanism it settled on. */
  const wide = useMediaQuery("(min-width: 64rem)");

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [browsing, setBrowsing] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [tenderTaka, setTenderTaka] = useState("");
  const [walletRef, setWalletRef] = useState("");
  const [saving, setSaving] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [customItems, setCustomItems] = useState<SaleItem[]>([]);
  const [attached, setAttached] = useState<AttachedCustomer | null>(null);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [openRow, setOpenRow] = useState<RowKey | null>(null);
  const [discountMode, setDiscountMode] = useState<DiscountMode>("percent");
  const [discountPct, setDiscountPct] = useState(0);
  const [discountAmt, setDiscountAmt] = useState(0);
  const [discountReason, setDiscountReason] = useState("");
  const [advance, setAdvance] = useState<number | null>(null);
  const [payInFull, setPayInFull] = useState(false);

  const operator = opQ.data;
  const currency = operator?.currency ?? "BDT";
  const products = useMemo(() => productsQ.data?.data ?? [], [productsQ.data]);
  const resources = useMemo(() => resourcesQ.data?.data ?? [], [resourcesQ.data]);
  const team = useMemo(() => teamQ.data?.data ?? [], [teamQ.data]);
  const productById = (id: string) => products.find((p) => p.id === id);

  // Non-cash tender needs a live PSP account. Cash always works.
  const nonCashOk = (payAcctsQ.data?.data ?? []).some((a) => a.status === "active" && a.chargesEnabled);
  const methods: PaymentMethod[] = nonCashOk
    ? ["cash", "bkash", "bangla_qr", "card_terminal"]
    : ["cash"];

  /* ── Resolving every block ───────────────────────────────────────────────
     Done in one pass so the blocks, the totals and the eventual payload can
     never be computed from different states. */
  const resolved = useMemo(
    () =>
      blocks.map((b) => {
        const product = productById(b.productId);
        if (!product) return { block: b, product: null, item: null, missing: null as null | string, amount: 0 };
        const r = resolveDraft(product, b.draft, b.id, { resources, team });
        return { block: b, product, item: r.item, missing: r.missing, amount: r.amount };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blocks, products, resources, team],
  );

  const items: SaleItem[] = useMemo(
    () => [...resolved.map((r) => r.item).filter((x): x is SaleItem => x !== null), ...customItems],
    [resolved, customItems],
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
    () => priceSale(items, { products, operator, manualDiscount }),
    [items, products, operator, manualDiscount],
  );

  /* The cashier's discount is capped by the business policy, falling back to
     the signed-in staff's role limit where no policy is set. The cap is on the
     EFFECTIVE rate — what actually came off, not what was typed. */
  const roleLimit =
    rolesQ.data?.data.find((r) => r.id === (teamQ.data?.data.find((x) => x.id === SIGNED_IN_STAFF_ID)?.roleId))
      ?.discountLimitPct ?? 100;
  const capPct = policyQ.data ? policyQ.data.maxPercentBps / 100 : roleLimit;
  const effectivePct = totals.subtotal > 0 ? (manualDiscount / totals.subtotal) * 100 : 0;
  const overLimit = effectivePct > capPct + 1e-9;
  const reasonNeeded = manualDiscount > 0 && !!policyQ.data?.requireReason && !discountReason.trim();

  /* ── Part payment ────────────────────────────────────────────────────────
     A booking's DEPOSIT policy says what the booking requires; an ADVANCE says
     what this customer actually handed over. The advance sits on top. */
  const depositBalance = items.reduce((sum, e) => sum + itemBalance(e, products), 0);
  const advanceRule = advanceQ.data?.counter;
  const advanceAllowed = !!advanceRule?.enabled && items.length > 0 && totals.total > 0;
  const advanceMin = advanceRule ? advanceMinimum(advanceRule, totals.total) : totals.total;
  const advanceValid = advance != null && advance >= advanceMin && advance < totals.total;
  const balance = advanceValid ? totals.total - advance! : payInFull ? 0 : depositBalance;
  const dueNow = totals.total - balance;

  /** Seats already spoken for elsewhere in this sale, so a session cannot be
   *  oversold by adding it twice. The block being edited excludes itself. */
  const seatsElsewhere = (productId: string, slotStart: string) =>
    items
      .filter((e) => e.id !== openId && e.productId === productId && itemSlotISO(e) === slotStart)
      .reduce((s, e) => s + itemSeats(e, products), 0);

  /* ── Adding, opening, removing ───────────────────────────────────────── */
  const pick = (p: Product) => {
    const id = newId();
    setBlocks((b) => [...b, { id, productId: p.id, draft: newDraft(p) }]);
    setOpenId(id);
    setBrowsing(false);
  };

  const openBlock = (id: string) => {
    const entry = resolved.find((r) => r.block.id === id);
    // Re-open on the choices that were made, not on a blank draft.
    if (entry?.product && entry.item) {
      setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, draft: draftFrom(entry.product!, entry.item!) } : b)));
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

  /* Bring a newly opened block into view. Scrolling is not state, so this is
     an effect that reads the DOM and nothing else — the codebase forbids
     setState in an effect, not effects. */
  const openRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (openId && openRef.current) {
      openRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [openId]);

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

  /* ── What the footer should say ──────────────────────────────────────────
     Never "Continue". Either it names the decision that is still open, or it
     names the money. */
  const openEntry = resolved.find((r) => r.block.id === openId);
  const openMissing = openEntry?.missing ?? null;
  const payable = totals.total > 0;

  const tenderedMinor = (parseInt(tenderTaka || "0", 10) || 0) * 100;
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
            ? t("footer.takeAmount", { amount: formatMoney(dueNow, currency) })
            : t("footer.completeAmount", { amount: formatMoney(dueNow, currency) });

  /* ── The sale ───────────────────────────────────────────────────────────
     The SAME lines that priced the footer are the lines handed to checkout.
     Rebuilding the payload here would be how a till shows one number and
     charges another. */
  const complete = async () => {
    if (!canComplete) return;
    setSaving(true);
    const bookings = items
      .filter((e) => e.slotDate)
      .map((e) => ({
        productId: e.productId,
        resourceId: e.resourceId ?? null,
        slotStart: itemSlotISO(e)!,
        slotEnd: e.slotEnd,
        partySize: itemSeats(e, products),
      }));
    const res = await checkout({
      channel: "counter",
      locationId: locationsQ.data?.data[0]?.id ?? "loc_fort",
      counterId: null,
      staffId: null,
      customerName: attached?.name ?? null,
      customerId: attached?.id ?? null,
      lines: totals.lines,
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
          lines: totals.lines.map((l) => ({
            name: l.tierName && l.tierName !== l.productName ? `${l.productName} · ${l.tierName}` : l.productName,
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
  const summaryOf = (item: SaleItem) => {
    const bits = [
      item.items.map((i) => `${i.qty} ${i.tierName}`).join(" · "),
      item.resourceLabel,
      item.providerLabel,
      item.slotTime,
      item.slotDate ? formatDay(item.slotDate, { weekday: true }) : "",
    ].filter(Boolean);
    return bits.join(" · ");
  };

  const catalogue = (
    <Catalogue
      products={products}
      categories={catsQ.data?.data ?? []}
      resources={resources}
      team={team}
      currency={currency}
      query={query}
      onQuery={setQuery}
      category={category}
      onCategory={setCategory}
      onPick={pick}
      onCustom={() => setCustomOpen(true)}
      loading={productsQ.loading}
    />
  );

  /* On a phone the PAGE scrolls, which is the whole idea — one scroll from
     the wall to the money.
     
     On a wide screen the two columns have to scroll independently, or reading
     the sale means scrolling past the catalogue. The Go shell hands its
     children no height to resolve against, so the height is stated here:
     the viewport less the 64px header, less the 96px the shell reserves for
     the bottom tab bar — which a tablet in landscape does not have, because
     there the nav is the left rail. `dvh` rather than `vh` so a phone browser
     collapsing its address bar does not leave the footer stranded. */
  return (
    <div className="grid grid-cols-1 gap-comfortable p-comfortable lg:h-[calc(100dvh-160px)] lg:grid-cols-[minmax(0,1fr)_30rem] lg:overflow-hidden rail:h-[calc(100dvh-64px)]">
      <h1 className="sr-only">{t("srTitle")}</h1>

      {/* The wall, as a column of its own on a tablet.
          overflow-x-hidden as well as -y: overflow-y:auto implies
          overflow-x:auto, and the chip row bleeds 16px past the column to put
          its cut on the screen edge — which handed this column a horizontal
          scrollbar. */}
      {wide && <div className="min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">{catalogue}</div>}

      {/* The sale — one scroll, ending in the money. */}
      <div className="flex min-h-0 min-w-0 flex-col">
        <div className="flex flex-col gap-comfortable pb-[160px] lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pb-0">
          {/* Phone: the wall lives here, above the sale. */}
          {!wide && (
          <div>
            {browsing ? (
              catalogue
            ) : (
              /* Folded. Leaving twenty bookings above the block being
                 configured means scrolling a screenful to check what was just
                 added — which is the round trip the cart used to be. */
              <button
                type="button"
                onClick={() => setBrowsing(true)}
                className="flex h-14 w-full items-center justify-center gap-tight rounded-go border border-dashed border-strong text-[14px] font-medium text-muted active:bg-ember/10"
              >
                <Plus size={18} strokeWidth={1.75} />
                {t("block.addAnother")}
              </button>
            )}
          </div>
          )}

          {wide && blocks.length === 0 && customItems.length === 0 && (
            <EmptyState title={t("sale.empty")} message={t("sale.emptyHint")} />
          )}

          {resolved.map(({ block, product, item, missing, amount }) => {
            const open = openId === block.id;
            if (!product) return null;
            return (
              <div
                key={block.id}
                ref={open ? openRef : undefined}
                className={`rounded-go border bg-card transition-shadow duration-quick ${open ? "border-ember shadow-go" : "border-line"}`}
              >
                <div className="flex items-start gap-tight p-comfortable">
                  <button
                    type="button"
                    onClick={() => (open ? setOpenId(null) : openBlock(block.id))}
                    aria-expanded={open}
                    className="flex min-h-11 min-w-0 flex-1 items-start gap-tight text-left"
                  >
                    <span
                      className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${item ? "bg-success/15 text-success" : "bg-line text-muted"}`}
                      aria-hidden
                    >
                      {item ? <Check size={13} strokeWidth={2.5} /> : <ChevronDown size={13} strokeWidth={2.5} className={open ? "rotate-180" : ""} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-[15px] font-semibold leading-snug">{product.name}</span>
                      <span className="mt-inline block text-[13px] text-muted">
                        {item ? summaryOf(item) : missing ? t(`missing.${missing}` as never) : ""}
                      </span>
                    </span>
                  </button>
                  <span className="flex shrink-0 items-center gap-tight">
                    <span className="whitespace-nowrap text-[15px] font-semibold tabular-nums">
                      {formatMoney(amount, currency)}
                    </span>
                    <button
                      type="button"
                      aria-label={t("block.remove")}
                      onClick={() => removeBlock(block.id)}
                      className="flex h-11 w-11 items-center justify-center rounded-full text-danger active:bg-ember/10"
                    >
                      <Trash2 size={16} strokeWidth={1.5} />
                    </button>
                  </span>
                </div>

                {open && (
                  <div className="border-t border-line p-comfortable">
                    <SelectionInline
                      product={product}
                      draft={block.draft}
                      onDraft={(d) => setDraft(block.id, d)}
                      currency={currency}
                      team={team}
                      seatsElsewhere={seatsElsewhere}
                    />
                    {patternOf(product) !== "unsupported" && (
                      <Button
                        variant="secondary"
                        shape="pill"
                        fullWidth
                        className="mt-section h-12"
                        disabled={!item}
                        onClick={() => setOpenId(null)}
                      >
                        {t("block.done")}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {customItems.map((c) => (
            <div key={c.id} className="flex items-center gap-tight rounded-go border border-line bg-card p-comfortable">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success" aria-hidden>
                <Check size={13} strokeWidth={2.5} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block break-words text-[15px] font-semibold leading-snug">{c.productName}</span>
                <span className="mt-inline block text-[13px] text-muted">{t("custom.lineLabel")}</span>
              </span>
              <span className="whitespace-nowrap text-[15px] font-semibold tabular-nums">
                {formatMoney(itemTotal(c), currency)}
              </span>
              <button
                type="button"
                aria-label={t("block.remove")}
                onClick={() => setCustomItems((x) => x.filter((y) => y.id !== c.id))}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-danger active:bg-ember/10"
              >
                <Trash2 size={16} strokeWidth={1.5} />
              </button>
            </div>
          ))}

          {/* Add another — on a tablet the wall is always there, so this is a
              phone affordance only; it appears above on that breakpoint. */}
          {items.length > 0 && !openId && (
            <button
              type="button"
              onClick={() => setBrowsing(true)}
              className={`h-12 w-full items-center justify-center gap-tight rounded-go border border-dashed border-strong text-[14px] font-medium text-muted active:bg-ember/10 ${wide ? "flex" : "hidden"}`}
            >
              <Plus size={18} strokeWidth={1.75} />
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
              advanceAllowed={advanceAllowed}
              advance={advance}
              onAdvance={setAdvance}
              advanceMin={advanceMin}
              total={totals.total}
              depositBalance={depositBalance}
              payInFull={payInFull}
              onPayInFull={setPayInFull}
            />
          )}

          {/* ── Pay ──────────────────────────────────────────────────────── */}
          {payable && (
            <div className="rounded-go border border-line bg-card p-comfortable">
              <p className="mb-tight text-[14px] font-semibold">{t("pay.label")}</p>

              <div
                className="relative grid h-14 rounded-full bg-line/60 p-inline"
                style={{ gridTemplateColumns: `repeat(${methods.length}, minmax(0, 1fr))` }}
              >
                {methods.length > 1 && (
                  <span
                    aria-hidden
                    className="absolute inset-y-inline rounded-full bg-ember transition-[left] duration-quick ease-counterfoil"
                    style={{
                      width: `calc(${100 / methods.length}% - 8px)`,
                      left: `calc(${Math.max(0, methods.indexOf(method)) * (100 / methods.length)}% + 4px)`,
                    }}
                  />
                )}
                {methods.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`relative z-10 min-w-0 truncate px-inline text-[13px] transition-colors duration-quick ${method === m ? "font-medium text-white" : "text-muted"}`}
                  >
                    {enumL.method(m)}
                  </button>
                ))}
              </div>

              <div className="mt-section flex flex-col gap-inline text-[13px]">
                <div className="flex justify-between text-muted">
                  <span>{t("pay.subtotal")}</span>
                  <span className="tabular-nums">{formatMoney(totals.subtotal, currency)}</span>
                </div>
                {totals.manualDiscount > 0 && (
                  <div className="flex justify-between text-muted">
                    <span className="min-w-0 truncate">
                      {discountMode === "percent" ? t("pay.discountPct", { pct: discountPct }) : t("pay.discountFlat")}
                    </span>
                    <span className="shrink-0 text-danger tabular-nums">
                      −{formatMoney(totals.manualDiscount, currency)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-muted">
                  <span>{t("pay.vat")}</span>
                  <span className="tabular-nums">{formatMoney(totals.tax, currency)}</span>
                </div>
                <div className="mt-inline flex items-baseline justify-between text-[17px] font-semibold">
                  <span>{t("pay.total")}</span>
                  <span className="tabular-nums">{formatMoney(totals.total, currency)}</span>
                </div>
                {/* Only where they differ. On a sale paid in full, "Due now"
                    repeating the total is a line that says nothing. */}
                {balance > 0 && (
                  <>
                    <div className="mt-inline flex justify-between font-medium">
                      <span>{t("pay.dueNow")}</span>
                      <span className="tabular-nums">{formatMoney(dueNow, currency)}</span>
                    </div>
                    <div className="flex justify-between text-muted">
                      <span>{t("pay.balanceAtArrival")}</span>
                      <span className="tabular-nums">{formatMoney(balance, currency)}</span>
                    </div>
                  </>
                )}
              </div>

              {method === "cash" && (
                <div className="mt-section">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[13px] text-muted">{t("pay.tendered")}</span>
                    <span className="text-[17px] font-semibold tabular-nums">{formatMoney(tenderedMinor, currency)}</span>
                  </div>
                  <div className={`mt-tight flex items-baseline justify-between ${cashReady ? "text-success" : "text-muted"}`}>
                    <span className="text-[14px] font-medium">{t("pay.change")}</span>
                    <span className="text-3xl font-semibold tabular-nums">
                      {cashReady ? formatMoney(Math.max(0, changeMinor), currency) : "—"}
                    </span>
                  </div>
                  <div className="mt-section flex gap-tight">
                    <button
                      type="button"
                      onClick={() => setTenderTaka(String(Math.ceil(dueNow / 100)))}
                      className="h-12 flex-1 rounded-full border border-inverse bg-card text-sm active:bg-ember/10"
                    >
                      {tp("cash.exact")}
                    </button>
                    {[500, 1000, 2000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setTenderTaka(String(amt))}
                        className="h-12 flex-1 rounded-full border border-line bg-card text-sm active:bg-ember/10"
                      >
                        ৳{amt}
                      </button>
                    ))}
                  </div>
                  <div className="mt-section">
                    <Keypad
                      onKey={(d) => setTenderTaka((v) => (v + d).slice(0, 7))}
                      onBackspace={() => setTenderTaka((v) => v.slice(0, -1))}
                    />
                  </div>
                </div>
              )}

              {method === "bkash" && (
                <div className="mt-section">
                  <FormField
                    label={t("pay.txnLabel")}
                    placeholder={t("pay.txnPlaceholder")}
                    value={walletRef}
                    onChange={(e) => setWalletRef(e.target.value)}
                  />
                  <p className="mt-tight text-[13px] text-muted">{t("pay.txnHint")}</p>
                </div>
              )}

              {method === "bangla_qr" && (
                <p className="mt-section rounded-go border border-line bg-subtle/40 p-comfortable text-[13px] text-muted">
                  {t("pay.qrHint")}
                </p>
              )}
            </div>
          )}
        </div>

        {/* The one thing that never scrolls away: what this costs, and the
            next decision. On a phone it clears the Go tab bar. */}
        <div
          className="fixed inset-x-comfortable bottom-[calc(70px+env(safe-area-inset-bottom))] z-30 lg:static lg:mt-comfortable"
        >
          <div className="flex items-center gap-comfortable rounded-full bg-inverse px-section py-tight shadow-go-pop lg:rounded-go lg:px-comfortable">
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] text-inverse-fg/60">{t("footer.total")}</span>
              <span className="block truncate text-[17px] font-semibold tabular-nums text-inverse-fg">
                {formatMoney(totals.total, currency)}
              </span>
            </span>
            <Button
              shape="pill"
              size="lg"
              className="h-12 shrink-0"
              disabled={!canComplete}
              loading={saving}
              onClick={complete}
            >
              <span className="min-w-0 truncate">{footerLabel}</span>
            </Button>
          </div>
        </div>
      </div>

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
            <Button shape="pill" variant="secondary" onClick={() => setCustomOpen(false)}>
              {tp("custom.cancel")}
            </Button>
            <Button shape="pill" onClick={addCustom} disabled={!customAmount}>
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
