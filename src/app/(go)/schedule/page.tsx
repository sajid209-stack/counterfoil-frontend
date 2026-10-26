"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { Check, ChevronRight, Lock, MapPinOff, ShoppingBag, X } from "lucide-react";
import { Button, Checkbox, EmptyState, FormField, Modal, Notice, ProductThumb, Skeleton, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatClockMin, formatClockRange, formatDay, formatMoney } from "@/lib/format";
import { useEnumLabels } from "@/lib/labels";
import { DEMO_NOW_MINUTES, DEMO_TODAY, slotISO, toMinutes, toTime } from "@/lib/schedule";
import { useApiQuery } from "@/lib/useApi";
import { LG, useMediaQuery } from "@/lib/useMedia";
import { DEMO_STAFF_ID, DEMO_TILL_ID } from "@/lib/session";
import { useActiveCounterNow } from "@/lib/activeCounter";
import {
  activeHolds,
  addOrderPayment,
  bookingEditable,
  canTakeNonCash,
  checkInBooking,
  discountOrderBalance,
  getOperator,
  listProducts,
  listResources,
  listStaff,
  logOrderAction,
  orderOutstanding,
  peekBookings,
  peekOrders,
  placeCheckoutHold,
  placeHold,
  releaseHold,
  rescheduleBooking,
  tillMethods,
  updateResource,
  type Order,
  type PaymentMethod,
  type Resource,
} from "@/lib/api";
import { appendToLiveSale, setReturnTo } from "../pos/_lib/liveSale";
import { buildOrderLines } from "@/lib/orderMath";
import { taxRateFor } from "@/lib/tax";
import { buildBoard, dayLoad, toTimeOfDay, type Block, type Column } from "./_lib/board";
import { entriesFor, entryPrice, guideFor, holdEntries, needsWaiver, productsIn, sessionEntry, spansOf, type Pick } from "./_lib/toCart";
import { useActor } from "./_lib/actor";
import { RefundFlowSheet } from "../_components/RefundFlowSheet";
import { WriteOffSheet } from "../_components/WriteOffSheet";
import { pendingWriteOffFor, useWriteOffVersion } from "@/lib/api/writeOffRequests";
import { Board } from "./_components/Board";
import { BlockSheet, HoldSheet, MoveSheet, SessionSheet, TakeBalanceSheet, type HoldRequest } from "./_components/Sheets";
import { pendingRefundFor, refundableFor, refundRequestsForOrder } from "@/lib/api/refundRequests";
import { ActionBar, BarSummary } from "../_components/ActionBar";
import { Tile, TileGrid } from "../_components/Tiles";
import { GoPage } from "../_components/GoPage";
import { DayStrip } from "./_components/DayStrip";

type SessionBlock = Extract<Block, { type: "session" }>;
type SessionPick = {
  column: Column;
  block: SessionBlock;
  /** Selling a held group: start on its size, and release the hold first. */
  presetQty?: number;
  releaseHoldId?: string;
  sellLabel?: string;
};
type BlockPick = { column: Column; block: Extract<Block, { type: "booking" | "hold" }> };

const noopSubscribe = () => () => {};
const KEY = "cf_schedule_";
function remembered(k: string): string | null {
  try {
    return typeof window === "undefined" ? null : sessionStorage.getItem(KEY + k);
  } catch {
    return null;
  }
}
function remember(k: string, v: string) {
  try {
    sessionStorage.setItem(KEY + k, v);
  } catch {
    // The choice still applies for this visit.
  }
}

/**
 * The counter's schedule: the day as a board of places and hours.
 *
 * Tap free hours to choose them — they turn orange — and a bar comes up with
 * the two things a counter does with them: **Hold** on the left, **Add to
 * sale** on the right. Add to sale puts them straight into the cart; nothing
 * asks again for the day, the field or the time that was just tapped.
 *
 * That is the pattern court and turf systems settled on (a multi-select grid
 * with a sticky bar, contiguous hours merged into one booking), and it is the
 * one a cashier under pressure can work from memory: tap the hours, tap the
 * orange button.
 */
export default function SchedulePage() {
  const router = useRouter();
  const t = useTranslations("schedule");
  const format = useFormatter();
  const toast = useToast();

  /* Where the cashier was — the day and the group — survives a trip to
     the till and back. Coming back to today's courts when you were on
     Saturday's lanes is how a second sale gets rung up on the wrong day. */
  const [date, setDateState] = useState<string>(() => remembered("date") ?? DEMO_TODAY);
  const [groupKey, setGroupState] = useState<string | null>(() => remembered("group"));
  /* What is chosen belongs to what is on screen: a different day or group is
     a different question, and a choice nobody can see any more must not be
     sold by the next tap. */
  const [picks, setPicks] = useState<Pick[]>([]);
  const [choice, setChoice] = useState<string | null>(null);
  const [waiverOk, setWaiverOk] = useState(false);
  const [waiverMissing, setWaiverMissing] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const clearPicks = () => { setPicks([]); setChoice(null); setWaiverOk(false); setWaiverMissing(false); setLastKey(null); };
  const setDate = (d: string) => { setDateState(d); remember("date", d); clearPicks(); };
  const setGroupKey = (g: string) => { setGroupState(g); remember("group", g); clearPicks(); };

  const [holdOpen, setHoldOpen] = useState(false);
  const [sessionPick, setSessionPick] = useState<SessionPick | null>(null);
  const [blockPick, setBlockPick] = useState<BlockPick | null>(null);
  const [busy, setBusy] = useState(false);
  /* The mock store is synchronous and the board reads it directly, so a
     change is shown by asking again rather than by refetching. */
  const [version, setVersion] = useState(0);
  /* The refund form, open over the booking it is for. */
  const [refundOpen, setRefundOpen] = useState(false);
  /* Ask to write off what the booking's order still owes. */
  const [writeOffOpen, setWriteOffOpen] = useState(false);
  // A write-off asked for or answered elsewhere changes what the sheet offers.
  useWriteOffVersion();
  /* Move and Take ৳X, each open over the same booking sheet. */
  const [moveOpen, setMoveOpen] = useState(false);
  const [takeOpen, setTakeOpen] = useState(false);
  const [oos, setOos] = useState<Resource | null>(null);
  const [oosReason, setOosReason] = useState("");
  const [oosSaving, setOosSaving] = useState(false);

  const productsQ = useApiQuery(() => listProducts({ pageSize: 200, filters: { status: "active" } }), []);
  const resourcesQ = useApiQuery(() => listResources({ pageSize: 200 }), [version]);
  const staffQ = useApiQuery(() => listStaff({ pageSize: 200 }), []);
  const operatorQ = useApiQuery(() => getOperator(), []);
  const staff = staffQ.data?.data ?? [];
  /* Who is signed in, and what their role lets them do without a manager —
     the refund limit and the discount cap both read from here. */
  const actor = useActor();
  const enumL = useEnumLabels();
  const payMethods = useMemo(() => tillMethods(canTakeNonCash()), []);

  const locationId = useActiveCounterNow().locationId || "loc_fort";
  const isToday = date === DEMO_TODAY;
  const nowMinutes = isToday ? DEMO_NOW_MINUTES : null;
  const me = staff.find((s) => s.id === DEMO_STAFF_ID)?.name ?? t("sheet.counter");
  /* "Wed 29 Jul" — day before month, the way the rest of the app writes a
     date, built from parts so the English locale does not turn it round. */
  const dayDate = new Date(`${date}T12:00:00`);
  /* Latin digits for every date here: the week strip, the times and the
     prices are all Latin, and "২৯" beside "29" for the same day, 60px apart,
     is two scripts for one fact. */
  const latn = { numberingSystem: "latn" } as const;
  const dayShort = `${format.dateTime(dayDate, { day: "numeric", ...latn })} ${format.dateTime(dayDate, { month: "short" })}`;
  const dayLabel = `${format.dateTime(dayDate, { weekday: "short" })} ${dayShort}`;

  const groups = useMemo(
    () =>
      buildBoard({
        products: productsQ.data?.data ?? [],
        resources: resourcesQ.data?.data ?? [],
        bookings: peekBookings(),
        holds: activeHolds(),
        orders: peekOrders(),
        date,
        today: DEMO_TODAY,
        nowMinutes: DEMO_NOW_MINUTES,
        locationId,
        sessionsLabel: t("board.shows"),
        placesLabel: t("board.places"),
      }),
    // `version` is the store's change signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [productsQ.data, resourcesQ.data, date, locationId, version, t],
  );
  const group = groups.find((g) => g.key === groupKey) ?? groups[0] ?? null;

  /* How busy each day is: the dots under it in the strip. Looked up per day, so
     the strip can run over as many days as it likes. */
  const loadOf = useMemo(() => {
    const bookings = peekBookings();
    return (d: string) => dayLoad(bookings, d, locationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, version]);

  // ── what is chosen, and what it becomes ───────────────────────────────
  const selected = useMemo(() => new Set(picks.map((p) => p.block.key)), [picks]);
  const offered = useMemo(() => productsIn(picks), [picks]);
  const entries = useMemo(() => entriesFor(picks, choice, date), [picks, choice, date]);
  /* What the till will ask for, VAT included — worked out by the till's own
     order engine, so the number the cashier reads out here is the number on
     the Take-payment button a moment later. */
  const total = useMemo(() => {
    const op = operatorQ.data;
    const byId = new Map((productsQ.data?.data ?? []).map((p) => [p.id, p]));
    return buildOrderLines(
      entries.map((e) => {
        const p = byId.get(e.productId);
        return { productId: e.productId, productName: e.productName, tierName: e.productName, quantity: 1, unitPrice: entryPrice(e), taxRate: p ? taxRateFor(p, op) / 100 : 0 };
      }),
      0,
      "quote",
    ).totals.total;
  }, [entries, operatorQ.data, productsQ.data]);
  const chosenMinutes = picks.reduce((s, p) => s + (p.block.end - p.block.start), 0);
  const chosenCount = chosenMinutes % 60 === 0 ? t("bar.hours", { count: chosenMinutes / 60 }) : t("bar.minutes", { count: chosenMinutes });
  const spans = useMemo(() => spansOf(picks, choice), [picks, choice]);
  const waiver = needsWaiver(spans.map((s) => s.product));
  /* "Indoor Field 12:00 – 1:00 PM, 3:00 – 4:00 PM" — each place named once. */
  const chosenLine = useMemo(() => {
    const byPlace = new Map<string, string[]>();
    for (const s of spans) byPlace.set(s.column.name, [...(byPlace.get(s.column.name) ?? []), formatClockRange(s.start, s.end)]);
    return [...byPlace].map(([name, r]) => `${name} ${r.join(", ")}`).join(" · ");
  }, [spans]);

  const toggleFree = (column: Column, block: Extract<Block, { type: "free" }>) => {
    setPicks((p) => (p.some((x) => x.block.key === block.key) ? p.filter((x) => x.block.key !== block.key) : [...p, { column, block }]));
    setLastKey(block.key);
  };

  // ── actions ────────────────────────────────────────────────────────────
  /* Only for what the board cannot sell itself (a seat map, sections): the
     till's own sheet, already on this day and time. */
  const openTill = (productId: string, time: string, resourceId?: string) => {
    sessionStorage.setItem("pos_open_product", productId);
    sessionStorage.setItem("pos_open_slot", JSON.stringify({ date, time, resourceId }));
    router.push("/pos");
  };

  /* Into the sale, and on to the cart. The till is not mounted here, so the
     lines go where it looks for them when it opens. */
  const toCart = (lines: typeof entries) => {
    appendToLiveSale(lines);
    /* Paid, the next guest in this queue is asking about another hour — so
       New sale comes back here rather than to the sell wall. */
    setReturnTo("/schedule");
    router.push("/pos/cart");
  };

  const addPicks = () => {
    if (!entries.length) return;
    if (waiver && !waiverOk) {
      setWaiverMissing(true);
      return;
    }
    const lines = entries;
    clearPicks();
    toCart(lines);
  };

  const lengthToExpiry = (length: HoldRequest["length"]) =>
    length === "day" ? null : new Date(Date.now() + length * 60000).toISOString();

  const holdPicks = async (req: HoldRequest) => {
    setBusy(true);
    const placed: string[] = [];
    for (const s of spans) {
      const res = await placeHold({
        productId: s.product.id,
        productName: s.product.name,
        locationId,
        kind: "resource",
        date,
        slotStart: slotISO(date, toTimeOfDay(s.start)),
        slotEnd: slotISO(date, toTimeOfDay(s.end)),
        quantity: 1,
        resourceId: s.column.id,
        resourceName: s.column.name,
        heldFor: req.heldFor,
        placedBy: me,
        expiresAt: lengthToExpiry(req.length),
      });
      if (!res.ok) {
        toast.error(res.error.message);
        break;
      }
      placed.push(res.data.id);
    }
    setBusy(false);
    if (!placed.length) return;
    setHoldOpen(false);
    clearPicks();
    setVersion((v) => v + 1);
    toast.success(t("toast.held", { name: req.heldFor }), {
      label: t("toast.undo"),
      run: async () => {
        for (const id of placed) await releaseHold(id);
        setVersion((v) => v + 1);
      },
    });
  };

  const openSession = (column: Column, block: SessionBlock) => {
    const p = block.product;
    if (p.layoutId || (p.sections?.length ?? 0) > 0) {
      openTill(p.id, block.time);
      return;
    }
    if (block.remaining <= 0) return;
    setSessionPick({ column, block });
  };

  const addSession = async (qty: Record<string, number>) => {
    if (!sessionPick) return;
    const { block, releaseHoldId } = sessionPick;
    const p = block.product;
    const guide = guideFor(p, date, block.time, staff);
    if (guide === null) return;
    setBusy(true);
    if (releaseHoldId) await releaseHold(releaseHoldId);
    const entry = sessionEntry(p, date, block.time, qty, guide);
    const seats = entry.items.reduce((s, i) => s + i.qty, 0);
    /* The till holds the places while its cart is open, so a second till
       cannot sell them out from under this sale. Held under the till's own
       name, so the till can let them go again when the sale ends. */
    await placeCheckoutHold({
      productId: p.id,
      productName: p.name,
      locationId,
      date,
      slotStart: slotISO(date, block.time),
      quantity: seats,
      placedBy: DEMO_TILL_ID,
    });
    setBusy(false);
    setSessionPick(null);
    toCart([entry]);
  };

  const holdSession = async (req: HoldRequest) => {
    if (!sessionPick) return;
    const { block } = sessionPick;
    setBusy(true);
    const res = await placeHold({
      productId: block.product.id,
      productName: block.product.name,
      locationId,
      kind: "capacity",
      date,
      slotStart: slotISO(date, block.time),
      slotEnd: slotISO(date, toTimeOfDay(block.end)),
      quantity: req.quantity,
      heldFor: req.heldFor,
      placedBy: me,
      expiresAt: lengthToExpiry(req.length),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    setSessionPick(null);
    setVersion((v) => v + 1);
    toast.success(t("toast.held", { name: req.heldFor }), {
      label: t("toast.undo"),
      run: async () => {
        await releaseHold(res.data.id);
        setVersion((v) => v + 1);
      },
    });
  };

  /* Where the booking on the sheet stands on a refund, and whether this till
     can give the money back on its own say-so. Read on every render (version
     bumps after a request), from the mock's own store. */
  const refundInfo = (() => {
    if (!blockPick || blockPick.block.type !== "booking") return undefined;
    const b = blockPick.block.booking;
    void version;
    const pending = pendingRefundFor(b.id);
    const last = refundRequestsForOrder(b.orderId).find((r) => r.bookingId === b.id) ?? null;
    const found = refundableFor(b.id);
    const amount = found?.amount ?? 0;
    return { pending, last, refundable: !!found && amount > 0, amount, order: found?.order };
  })();
  /* The refund and the write-off sheets close themselves when they have sent
     a request (or done the thing); this closes what is under them and asks
     the board to read again. */
  const requestSent = () => {
    setRefundOpen(false);
    setWriteOffOpen(false);
    setBlockPick(null);
    setVersion((v) => v + 1);
  };

  /* Move: the booking's own place, a different day or hour, same price. */
  const openMove = () => {
    if (!blockPick || blockPick.block.type !== "booking") return;
    const edit = bookingEditable(blockPick.block.booking.id, actor.name);
    if (!edit.editable) {
      toast.error(edit.reason);
      return;
    }
    setMoveOpen(true);
  };

  const doMove = async (newDate: string, newTime: string) => {
    if (!blockPick || blockPick.block.type !== "booking") return;
    const b = blockPick.block.booking;
    const product = blockPick.block.product;
    if (!product) return;
    const duration = blockPick.block.end - blockPick.block.start;
    setBusy(true);
    const res = await rescheduleBooking(b.id, slotISO(newDate, newTime), slotISO(newDate, toTime(toMinutes(newTime) + duration)));
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    await logOrderAction(
      b.orderId,
      `Moved ${product.name} from ${b.slotStart.slice(0, 10)} ${b.slotStart.slice(11, 16)} to ${newDate} ${newTime}`,
      actor.name,
    );
    setMoveOpen(false);
    setBlockPick(null);
    setVersion((v) => v + 1);
    toast.success(t("toast.moved", { day: formatDay(newDate), time: formatClockMin(toMinutes(newTime)) }));
  };

  /* Take ৳X: what the booking's order still owes, with an optional discount. */
  const takeOrder: Order | undefined = (() => {
    if (!blockPick || blockPick.block.type !== "booking") return undefined;
    const orderId = blockPick.block.booking.orderId;
    return peekOrders().find((o) => o.id === orderId);
  })();
  const takeOwed = takeOrder ? orderOutstanding(takeOrder) : 0;

  const doTake = async (opts: { discountMinor: number; reasonText: string; method: PaymentMethod | null; payAmount: number }) => {
    if (!takeOrder) return;
    setBusy(true);
    if (opts.discountMinor > 0) {
      const dres = await discountOrderBalance(takeOrder.id, opts.discountMinor, opts.reasonText, actor.name);
      if (!dres.ok) {
        setBusy(false);
        toast.error(dres.error.message);
        return;
      }
    }
    if (opts.payAmount > 0 && opts.method) {
      const pres = await addOrderPayment(takeOrder.id, opts.method, opts.payAmount, actor.name);
      if (!pres.ok) {
        setBusy(false);
        toast.error(pres.error.message);
        return;
      }
    }
    setBusy(false);
    setTakeOpen(false);
    setBlockPick(null);
    setVersion((v) => v + 1);
    toast.success(
      opts.payAmount > 0
        ? t("toast.balanceTaken", { amount: formatMoney(opts.payAmount), method: enumL.method(opts.method ?? "cash") })
        : t("toast.discountOnly"),
    );
  };

  const release = async () => {
    if (!blockPick || blockPick.block.type !== "hold") return;
    const h = blockPick.block.hold;
    setBusy(true);
    await releaseHold(h.id);
    setBusy(false);
    setBlockPick(null);
    setVersion((v) => v + 1);
    toast.success(t("toast.released", { name: h.heldFor }));
  };

  /* The person it was held for is at the counter: the hold goes, and exactly
     what was being kept for them goes into the sale. */
  const sellHold = async () => {
    if (!blockPick || blockPick.block.type !== "hold") return;
    const h = blockPick.block.hold;
    const product = (productsQ.data?.data ?? []).find((p) => p.id === h.productId);
    const time = (h.slotStart ?? "").slice(11, 16);
    if (h.kind === "resource" && product) {
      const resource = (resourcesQ.data?.data ?? []).find((r) => r.id === h.resourceId);
      const lines = holdEntries(h, product, resource, date);
      await releaseHold(h.id);
      setBlockPick(null);
      if (lines.length) toCart(lines);
      else openTill(h.productId, time, h.resourceId ?? undefined);
      return;
    }
    // Places held on a show: the tickets sheet, starting on the group's size.
    const shows = groups.find((g) => g.isSessions);
    const column = shows?.columns.find((c) => c.id === h.productId);
    const block = column && (shows?.blocks.get(column.id) ?? []).find((b): b is SessionBlock => b.type === "session" && b.time === time);
    setBlockPick(null);
    if (column && block) {
      setSessionPick({
        column,
        block: { ...block, remaining: block.remaining + h.quantity },
        presetQty: h.quantity,
        releaseHoldId: h.id,
        sellLabel: t("sheet.sellTo", { name: h.heldFor }),
      });
    } else {
      await releaseHold(h.id);
      openTill(h.productId, time);
    }
  };

  const checkIn = async () => {
    if (!blockPick || blockPick.block.type !== "booking") return;
    const b = blockPick.block.booking;
    setBusy(true);
    const res = await checkInBooking(b.id, b.partySize);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    setBlockPick(null);
    setVersion((v) => v + 1);
    toast.success(t("toast.checkedIn", { name: blockPick.block.guest ?? t("board.walkIn") }));
  };

  const saveOos = async (outOfService: boolean) => {
    if (!oos) return;
    setOosSaving(true);
    const res = await updateResource(oos.id, { outOfService, outOfServiceReason: outOfService ? oosReason || null : null });
    setOosSaving(false);
    if (res.ok) {
      toast.success(outOfService ? t("markedOut", { name: oos.name }) : t("backInService", { name: oos.name }));
      setOos(null);
      clearPicks();
      setVersion((v) => v + 1);
      productsQ.reload();
    } else toast.error(res.error.message);
  };

  /* Bookings on this group that name no place: named above the board. */
  const unassigned = useMemo(() => {
    const out: { column: Column; block: Extract<Block, { type: "booking" }> }[] = [];
    for (const c of group?.columns ?? []) if (c.kind === "unassigned") for (const b of group?.blocks.get(c.id) ?? []) if (b.type === "booking") out.push({ column: c, block: b });
    return out.sort((a, b) => a.block.start - b.block.start);
  }, [group]);

  /* The server cannot see what this browser remembered, so nothing that
     depends on it is drawn until the browser has taken over — otherwise the
     first paint and the hydrated one disagree about the day. */
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const loading = !hydrated || productsQ.loading || resourcesQ.loading;
  const sessionGuideMissing = sessionPick ? guideFor(sessionPick.block.product, date, sessionPick.block.time, staff) === null : false;

  /* What to show.
     One row, each place-type an equal share of it, so four groups sit on one
     line of a phone instead of wrapping onto two. The name alone: a count
     beside it made the short names sit on one line and the long ones wrap,
     which read as four different controls. The board shows what is free; a
     screen reader still hears the count. A venue with one kind of place has
     nothing to choose, so it gets no row at all. From 1024px up the tabs sit
     on the week's own row, where there is room, and the board gets the line. */
  const wide = useMediaQuery(LG);
  const showTabs = groups.length > 1;
  const groupTabs = (frame: string) => (
    <TileGrid
      role="tablist"
      aria-label={t("board.whatLabel")}
      className={cn(frame, "rail:rounded-card rail:bg-card rail:shadow-card rail:gap-inline rail:p-inline")}
      style={{ gridTemplateColumns: `repeat(${Math.min(groups.length, 4)}, minmax(0, 1fr))` }}
    >
      {groups.map((g) => {
        const on = g.key === group?.key;
        return (
          <Tile
            key={g.key}
            role="tab"
            aria-selected={on}
            selected={on}
            aria-label={t("board.groupAria", { name: g.label, count: g.freeCount })}
            onClick={() => setGroupKey(g.key)}
            className="min-h-12 px-1 text-base font-semibold leading-tight rail:min-h-11 rail:rounded-sm rail:aria-[selected=false]:bg-transparent rail:aria-[selected=false]:shadow-none rail:aria-[selected=false]:hover:bg-nav-hover"
          >
            {g.label}
          </Tile>
        );
      })}
    </TileGrid>
  );

  return (
    <GoPage width="full" className="sm:px-gutter">
    <main className="-mx-section flex w-auto flex-col gap-comfortable px-section pb-0 pt-inline sm:-mx-gutter sm:px-gutter rail:-mx-major rail:px-major rail:pt-0">
      <h1 className="sr-only rail:hidden">{t("title")}</h1>

      {/* ── the days, with how busy each is ──
          One row of controls (which week, back to today, the calendar) over one
          strip of days that scrolls sideways. Every pixel above the board is an
          hour the cashier cannot see, so nothing here takes a line of its own. */}
      <section className="flex flex-col gap-tight rail:gap-section">
        <DayStrip
          title={t("title")}
          date={date}
          today={DEMO_TODAY}
          load={hydrated ? loadOf : () => 0}
          onChange={setDate}
          middle={showTabs && wide ? groupTabs("") : undefined}
        />
      </section>

      {showTabs && !wide && groupTabs("")}

      {loading ? (
        <Skeleton h="60dvh" className="rounded-card" />
      ) : !group ? (
        <EmptyState title={t("board.emptyTitle")} message={t("board.emptyMessage")} />
      ) : (
        <>
        <Board
          group={group}
          nowMinutes={nowMinutes}
          selected={selected}
          focusKey={lastKey}
          corner={[format.dateTime(dayDate, { weekday: "short" }), format.dateTime(dayDate, { day: "numeric", ...latn })]}
          hideKey={picks.length > 0}
          notice={unassigned.length > 0 && (
          <div className="flex flex-wrap items-center gap-tight px-comfortable pt-tight">
            {unassigned.slice(0, 3).map(({ column, block }) => (
              <button
                key={block.key}
                type="button"
                onClick={() => setBlockPick({ column, block })}
                className="inline-flex min-h-11 max-w-full items-center gap-tight rounded-full border border-line bg-card px-comfortable text-left text-base text-fg"
              >
                <MapPinOff size={16} strokeWidth={2} className="shrink-0 text-muted" aria-hidden />
                <span className="min-w-0 truncate">
                  <span className="font-semibold">{block.guest ?? t("board.walkIn")} {formatClockMin(block.start)}</span>
                  <span className="text-muted"> · {t("board.noPlaceShort")}</span>
                </span>
                <span className="shrink-0 font-semibold">{t("board.noPlaceOpen")}</span>
                <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-muted" aria-hidden />
              </button>
            ))}
            {unassigned.length > 3 && <span className="text-base text-muted">{t("board.noPlaceMore", { count: unassigned.length - 3 })}</span>}
          </div>
        )}
          onFree={toggleFree}
          onSession={openSession}
          onBooking={(column, block) => setBlockPick({ column, block })}
          onHold={(column, block) => setBlockPick({ column, block })}
          onColumn={(c) => { if (c.resource) { setOos(c.resource); setOosReason(c.resource.outOfServiceReason ?? ""); } }}
        />
        </>
      )}

      {/* ── what is chosen: Hold on the left, Add to sale on the right ──
          Fixed above the tab bar, and the board ends above it, so no hour is
          ever under a button. Only there while something is chosen. */}
      {picks.length > 0 && (
        <ActionBar
          id="sched-bar"
          label={t("bar.label")}
          summary={
            <BarSummary
              lead={chosenCount}
              /* Wraps rather than truncating: a touch screen has no hover to
                 show the rest. The day is in the board's corner already. */
              sub={chosenLine}
              money={formatMoney(total)}
              moneySub={t("bar.withVat")}
              trailing={
                <button
                  type="button"
                  onClick={clearPicks}
                  aria-label={t("bar.clearAria")}
                  className="-mr-1 -mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-muted-wash"
                >
                  <X size={20} strokeWidth={2} aria-hidden />
                </button>
              }
            />
          }
          secondary={{ label: t("bar.hold"), icon: <Lock size={20} strokeWidth={2} aria-hidden />, onClick: () => setHoldOpen(true) }}
          primary={{ label: t("bar.add"), icon: <ShoppingBag size={20} strokeWidth={2} aria-hidden />, onClick: addPicks }}
        >
          {offered.length > 1 && (
            <div role="radiogroup" aria-label={t("bar.sellAs")} className="flex flex-wrap items-center gap-tight">
              <span className="text-sm font-semibold text-muted">{t("bar.sellAs")}</span>
              {offered.map((p) => {
                const on = (choice ?? spans[0]?.product.id) === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setChoice(p.id)}
                    className={cn(
                      "inline-flex h-11 items-center gap-tight rounded-full pl-1 pr-comfortable text-md font-semibold",
                      on ? "bg-ember-solid text-on-solid" : "bg-card text-fg shadow-card",
                    )}
                  >
                    {/* The booking's own picture, so the choice can be made by
                        someone who does not read the name. */}
                    {p.images?.length ? (
                      <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full">
                        <ProductThumb images={p.images} name={p.name} bookingType={p.bookingType} size="chip" className="h-8 w-8" />
                      </span>
                    ) : (
                      /* No photograph: its first letters, not the fallback
                         glyph — a map pin beside a cricket photo read as a
                         picture that failed to load. */
                      <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-inverse text-sm font-semibold text-inverse-fg">
                        {p.name.slice(0, 2)}
                      </span>
                    )}
                    {p.name}
                    {on && <Check size={16} strokeWidth={3} aria-hidden />}
                  </button>
                );
              })}
            </div>
          )}

          {waiver && (
            <Checkbox
              checked={waiverOk}
              onCheckedChange={(c) => { setWaiverOk(c); setWaiverMissing(false); }}
              invalid={waiverMissing}
              label={t("bar.waiver")}
            />
          )}
          {waiverMissing && <Notice tone="danger" size="sm">{t("bar.waiverMissing")}</Notice>}
        </ActionBar>
      )}

      {holdOpen && (
        <HoldSheet
          open
          onClose={() => setHoldOpen(false)}
          title={t("sheet.holdTitle", { what: chosenCount })}
          when={`${dayLabel} · ${chosenLine}`}
          onHold={holdPicks}
          busy={busy}
        />
      )}

      {sessionPick && (
        <SessionSheet
          key={sessionPick.block.key + (sessionPick.releaseHoldId ?? "")}
          open
          onClose={() => setSessionPick(null)}
          product={sessionPick.block.product}
          block={sessionPick.block}
          title={sessionPick.block.product.name}
          when={`${formatClockRange(sessionPick.block.time, sessionPick.block.end)} · ${dayLabel}`}
          initialQty={sessionPick.presetQty}
          sellLabel={sessionPick.sellLabel}
          guideMissing={sessionGuideMissing}
          onAdd={addSession}
          onHold={sessionPick.releaseHoldId ? undefined : holdSession}
          busy={busy}
        />
      )}

      <BlockSheet
        open={!!blockPick && !refundOpen && !writeOffOpen && !moveOpen && !takeOpen}
        onClose={() => setBlockPick(null)}
        column={blockPick?.column ?? null}
        block={blockPick?.block ?? null}
        isToday={isToday}
        onCheckIn={checkIn}
        onRelease={release}
        onSellHold={sellHold}
        refund={refundInfo}
        onRefund={() => setRefundOpen(true)}
        onWriteOff={() => setWriteOffOpen(true)}
        onRequestsChanged={() => setVersion((v) => v + 1)}
        canMove={blockPick?.block.type === "booking" && !!blockPick.block.product?.schedule && !blockPick.block.noShow}
        onMove={openMove}
        owed={takeOwed}
        onTake={() => setTakeOpen(true)}
        busy={busy}
      />

      {blockPick?.block.type === "booking" && refundOpen && (
        <RefundFlowSheet
          key={blockPick.block.booking.id}
          open
          onClose={() => setRefundOpen(false)}
          title={blockPick.block.guest ?? t("board.walkIn")}
          when={`${blockPick.column.kind === "unassigned" ? t("board.noPlace") : blockPick.column.name} · ${formatClockRange(blockPick.block.start, blockPick.block.end)}`}
          bookingId={blockPick.block.booking.id}
          place={blockPick.column.kind === "resource" ? blockPick.column.name : null}
          onDone={requestSent}
        />
      )}

      {blockPick?.block.type === "booking" && writeOffOpen && (
        <WriteOffSheet
          key={blockPick.block.booking.id}
          open
          onClose={() => setWriteOffOpen(false)}
          title={blockPick.block.guest ?? t("board.walkIn")}
          when={`${blockPick.column.kind === "unassigned" ? t("board.noPlace") : blockPick.column.name} · ${formatClockRange(blockPick.block.start, blockPick.block.end)}`}
          orderId={blockPick.block.booking.orderId}
          bookingId={blockPick.block.booking.id}
          onDone={requestSent}
        />
      )}

      {blockPick?.block.type === "booking" && blockPick.block.product && (
        <MoveSheet
          open={moveOpen}
          onClose={() => setMoveOpen(false)}
          title={blockPick.block.guest ?? t("board.walkIn")}
          product={blockPick.block.product}
          resourceId={blockPick.block.booking.resourceId ?? null}
          placeName={blockPick.column.kind === "unassigned" ? t("board.noPlace") : blockPick.column.name}
          date={blockPick.block.booking.slotStart.slice(0, 10)}
          time={blockPick.block.booking.slotStart.slice(11, 16)}
          durationMinutes={blockPick.block.end - blockPick.block.start}
          bufferMinutes={blockPick.block.product.bufferMinutes ?? 0}
          partySize={blockPick.block.booking.partySize}
          bookingId={blockPick.block.booking.id}
          onConfirm={doMove}
          busy={busy}
        />
      )}

      {blockPick?.block.type === "booking" && takeOrder && (
        <TakeBalanceSheet
          open={takeOpen}
          onClose={() => setTakeOpen(false)}
          title={blockPick.block.guest ?? t("board.walkIn")}
          when={`${blockPick.column.kind === "unassigned" ? t("board.noPlace") : blockPick.column.name} · ${formatClockRange(blockPick.block.start, blockPick.block.end)}`}
          orderTotal={takeOrder.total}
          owed={takeOwed}
          limitPct={actor.discountLimitPct}
          methods={payMethods}
          onWriteOff={actor.writeOffMode !== "off" && !pendingWriteOffFor(takeOrder.id) ? () => { setTakeOpen(false); setWriteOffOpen(true); } : undefined}
          onConfirm={doTake}
          busy={busy}
        />
      )}

      <Modal
        open={!!oos}
        onClose={() => setOos(null)}
        title={oos ? (oos.outOfService ? t("oosTitleOut", { name: oos.name }) : t("oosTitleIn", { name: oos.name })) : ""}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOos(null)}>
              {t("cancel")}
            </Button>
            <Button loading={oosSaving} onClick={() => saveOos(!oos?.outOfService)}>
              {oos?.outOfService ? t("returnToService") : t("markOutOfService")}
            </Button>
          </>
        }
      >
        {oos?.outOfService ? (
          <p className="text-base text-muted">{oos.outOfServiceReason ? t("currentlyOutReason", { reason: oos.outOfServiceReason }) : t("currentlyOut")}</p>
        ) : (
          <FormField label={t("reasonLabel")} placeholder={t("reasonPlaceholder")} value={oosReason} onChange={(e) => setOosReason(e.target.value)} help={t("reasonHelp")} />
        )}
      </Modal>
    </main>
    </GoPage>
  );
}

