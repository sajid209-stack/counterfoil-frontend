"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowUpCircle, Ban, CalendarClock, ChevronDown, ChevronLeft, ChevronRight, PlusCircle, RotateCcw, Search, Timer, UserPlus } from "lucide-react";
import { ActionMenu, Button, DateField, EmptyState, FormField, Modal, useToast, type ActionMenuItem } from "@/components/ui";
import { DEMO_NOW_MINUTES, DEMO_TODAY, demoDay } from "@/lib/schedule";
import { cn } from "@/lib/cn";
import { useEnumLabels } from "@/lib/labels";
import { useApiQuery } from "@/lib/useApi";
import { useActiveCounterNow } from "@/lib/activeCounter";
import {
  addOrderLines,
  addOrderPayment,
  bookingEditable,
  checkInBooking,
  checkout,
  discountOrderBalance,
  extendBooking,
  isResourceFreeFor,
  listBookings,
  listOrders,
  listProducts,
  listResources,
  logOrderAction,
  markNoShow,
  rescheduleBooking,
  type Booking,
  type Order,
  type PaymentMethod,
  type Product,
} from "@/lib/api";
import { toMinutes, toTime } from "@/lib/schedule";
import { formatClock, formatDay, formatMoney } from "@/lib/format";
import { type RefundReason } from "@/lib/api/refundRequests";
import { pendingRefundFor, refundableFor } from "@/lib/api/refundRequests";
import { useActor, canRefundDirectly } from "../schedule/_lib/actor";
import { sendOrApproveRefund } from "../schedule/_lib/refundFlow";
import { DiscountFields, discountFromState, discountReasonText, emptyDiscount, MoveSheet, RefundSheet, type DiscountState } from "../schedule/_components/Sheets";

/* The app's one date, not a private copy of it — the token's own doc
   comment warns that two components each holding their own is how a hold
   lands in a different month from the schedule it blocks. */
const TODAY = DEMO_TODAY;
const TOMORROW = demoDay(1);
const time = (iso: string) => iso.slice(11, 16);
const METHODS: PaymentMethod[] = ["cash", "bkash", "bangla_qr", "card_terminal"];

/** How long a booking runs, in minutes — from its own end time if it has
 *  one, else the product's default session length. Needed to keep a moved
 *  booking the same length it was sold as. */
const durationOf = (b: Booking, product?: Product): number => {
  if (b.slotEnd) return Math.max(15, toMinutes(b.slotEnd.slice(11, 16)) - toMinutes(b.slotStart.slice(11, 16)));
  return product?.schedule?.sessionMinutes || product?.schedule?.slotMinutes || 60;
};

export default function CheckInPage() {
  const t = useTranslations("checkin");
  const tc = useTranslations("common");
  /* Refund, Move and the discount row are the same sheet and the same words
     the Schedule board uses — a cashier reads the same screen whichever door
     they came through. */
  const ts = useTranslations("schedule");
  const enumL = useEnumLabels();
  const toast = useToast();
  const actor = useActor();
  const [date, setDate] = useState(TODAY);
  /* Who is at the door is the venue this counter stands in. */
  const activeCounter = useActiveCounterNow();
  const venueId = activeCounter.locationId;
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const bookingsQ = useApiQuery(() => listBookings({ pageSize: 1000 }), []);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100 }), []);
  const ordersQ = useApiQuery(() => listOrders({ pageSize: 1000 }), []);
  const resourcesQ = useApiQuery(() => listResources({ pageSize: 200 }), []);
  const productName = (id: string) => productsQ.data?.data.find((p) => p.id === id)?.name ?? "—";
  const resourceName = (id?: string | null) => (id ? resourcesQ.data?.data.find((r) => r.id === id)?.name ?? null : null);
  const orderOf = (b: Booking): Order | undefined => ordersQ.data?.data.find((o) => o.id === b.orderId);
  const outstanding = (o?: Order) => (o ? Math.max(0, o.total - o.payments.reduce((s, p) => s + p.amount, 0)) : 0);
  const guestName = (b: Booking) => orderOf(b)?.customerName?.trim() || orderOf(b)?.reference || b.orderId;
  const whenFor = (b: Booking) => `${resourceName(b.resourceId) ?? productName(b.productId)} · ${formatClock(time(b.slotStart))}`;

  // Counter workflows on an expanded booking.
  const [payFor, setPayFor] = useState<Booking | null>(null);
  const [extraFor, setExtraFor] = useState<Booking | null>(null);
  const [upgradeFor, setUpgradeFor] = useState<Booking | null>(null);
  const [noShowFor, setNoShowFor] = useState<Booking | null>(null);
  const [noShowReason, setNoShowReason] = useState("");
  const [refundFor, setRefundFor] = useState<Booking | null>(null);
  const [moveFor, setMoveFor] = useState<Booking | null>(null);
  const [discount, setDiscount] = useState<DiscountState>(emptyDiscount());
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkInProduct, setWalkInProduct] = useState("");
  const [walkInParty, setWalkInParty] = useState(2);
  const [walkInName, setWalkInName] = useState("");

  const reload = () => { bookingsQ.reload(); ordersQ.reload(); };

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const orders = ordersQ.data?.data ?? [];
    const day = (bookingsQ.data?.data ?? []).filter((b) => {
      if (b.status !== "confirmed" || b.slotStart.slice(0, 10) !== date) return false;
      if (venueId && b.locationId !== venueId) return false;
      if (!q) return true;
      const o = orders.find((x) => x.id === b.orderId);
      return (
        b.orderId.toLowerCase().includes(q) ||
        (o?.reference.toLowerCase().includes(q) ?? false) ||
        (o?.customerName?.toLowerCase().includes(q) ?? false)
      );
    });
    const map = new Map<string, Booking[]>();
    day.forEach((b) => {
      const key = `${b.productId}|${b.slotStart}`;
      map.set(key, [...(map.get(key) ?? []), b]);
    });
    return [...map.entries()].sort((a, b) => a[0].split("|")[1].localeCompare(b[0].split("|")[1]));
  }, [bookingsQ.data, ordersQ.data, date, search, venueId]);

  /* The day, and every session's progress, read from the WHOLE day rather
     than from whatever the search box has narrowed it to. Taken off the
     filtered list, looking one guest up rewrote "at the door today" as that
     guest's own two tickets, and a session of three read "2 of 2 in". A search
     is a lookup, not a claim about the day. */
  const dayBookings = useMemo(
    () => (bookingsQ.data?.data ?? []).filter((b) => b.status === "confirmed" && b.slotStart.slice(0, 10) === date && (!venueId || b.locationId === venueId)),
    [bookingsQ.data, date, venueId],
  );

  const sessionTotals = useMemo(() => {
    const m = new Map<string, { expected: number; inCount: number }>();
    for (const b of dayBookings) {
      const k = `${b.productId}|${b.slotStart}`;
      const cur = m.get(k) ?? { expected: 0, inCount: 0 };
      m.set(k, { expected: cur.expected + b.partySize, inCount: cur.inCount + (b.checkedIn ?? 0) });
    }
    return m;
  }, [dayBookings]);

  const day = useMemo(() => {
    const items = dayBookings;
    const seen = new Set<string>();
    let owed = 0;
    for (const b of items) {
      if (seen.has(b.orderId)) continue;
      seen.add(b.orderId);
      owed += outstanding(orderOf(b));
    }
    const expected = items.reduce((sum, b) => sum + b.partySize, 0);
    const arrived = items.reduce((sum, b) => sum + (b.checkedIn ?? 0), 0);
    return { expected, arrived, owed, parties: items.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayBookings, ordersQ.data]);

  /* The session a door is standing in. Everything used to open shut, so the
     first thing a steward did on every arrival was tap a row open — and the
     names, which are the whole point of the screen, were behind that tap. */
  const nowKey = useMemo(() => {
    if (groups.length === 0) return null;
    if (date !== TODAY) return groups[0][0];
    const minutes = (key: string) => {
      const hhmm = key.split("|")[1].slice(11, 16);
      return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
    };
    const started = groups.filter(([k]) => minutes(k) <= DEMO_NOW_MINUTES);
    return (started[started.length - 1] ?? groups[0])[0];
  }, [groups, date]);

  const checkIn = async (b: Booking, count: number) => {
    setPending(b.id);
    await checkInBooking(b.id, count);
    setPending(null);
    reload();
  };

  // Post-sale extend: one increment, only when the lane is free right behind.
  const extendOf = (b: Booking) => {
    if (!b.resourceId || !b.slotEnd) return null;
    const p = productsQ.data?.data.find((x) => x.id === b.productId);
    const cfg = p?.durationConfig;
    if (!p || !cfg) return null;
    const endTime = b.slotEnd.slice(11, 16);
    const current = toMinutes(endTime) - toMinutes(b.slotStart.slice(11, 16));
    if (current + cfg.incrementMinutes > cfg.maxMinutes) return null;
    return { p, cfg, endTime };
  };

  const extend = async (b: Booking) => {
    const x = extendOf(b);
    if (!x) return;
    if (!isResourceFreeFor(b.resourceId!, b.slotStart.slice(0, 10), x.endTime, x.cfg.incrementMinutes, x.p.bufferMinutes ?? 0)) {
      toast.error(t("bookedAfter"));
      return;
    }
    setPending(b.id);
    const newEnd = `${b.slotStart.slice(0, 10)}T${toTime(toMinutes(x.endTime) + x.cfg.incrementMinutes)}:00+06:00`;
    const res = await extendBooking(b.id, newEnd);
    setPending(null);
    if (res.ok) { toast.success(t("extended", { time: formatClock(newEnd.slice(11, 16)) })); reload(); }
    else toast.error(res.error.message);
  };

  /** How much of the balance is being taken right now. Defaults to all of it
   *  (after any after-game discount), because that is the common case — but a
   *  party settling ৳2,000 as ৳1,200 on one phone and ৳800 on another is just
   *  as normal, and each tender is its own payment on the order rather than
   *  one rolled-up figure. */
  const [payAmount, setPayAmount] = useState<number | null>(null);
  const payOrder = payFor ? orderOf(payFor) : undefined;
  const payDue = outstanding(payOrder);
  const discountCalc = discountFromState(discount, payOrder?.total ?? 0, payDue, actor.discountLimitPct);
  const payDiscounted = Math.max(0, payDue - discountCalc.minor);
  const payNow = payAmount == null ? payDiscounted : Math.max(0, Math.min(payDiscounted, payAmount));
  const closePay = () => { setPayFor(null); setPayAmount(null); setDiscount(emptyDiscount()); };

  const giveDiscount = async (o: Order) => {
    const res = await discountOrderBalance(o.id, discountCalc.minor, discountReasonText(discount, (k) => ts(`discount.reasons.${k}`)), actor.name);
    if (!res.ok) toast.error(res.error.message);
    return res.ok;
  };

  /** The discount alone settles the order — nothing left to tender. */
  const applyDiscountOnly = async () => {
    if (!payFor || !payOrder || !discountCalc.valid || !discountCalc.hasAmount) return;
    setBusy(true);
    const ok = await giveDiscount(payOrder);
    setBusy(false);
    if (!ok) return;
    toast.success(t("discountApplied", { amount: formatMoney(discountCalc.minor) }));
    closePay();
    reload();
  };

  const takeBalance = async (method: PaymentMethod) => {
    if (!payFor || !payOrder || payNow <= 0 || !discountCalc.valid) return;
    setBusy(true);
    if (discountCalc.hasAmount) {
      const ok = await giveDiscount(payOrder);
      if (!ok) { setBusy(false); return; }
    }
    const res = await addOrderPayment(payOrder.id, method, payNow, actor.name);
    setBusy(false);
    if (res.ok) {
      const left = outstanding(payOrder) - discountCalc.minor - payNow;
      toast.success(
        left > 0
          ? t("partTaken", { amount: formatMoney(payNow), method: enumL.method(method), left: formatMoney(left) })
          : t("balanceTaken", { amount: formatMoney(payNow), method: enumL.method(method) }),
      );
      // Stay open while money is still owed: the second tender is usually
      // handed over in the same breath as the first.
      if (left > 0) { setPayAmount(null); setDiscount(emptyDiscount()); } else closePay();
    } else {
      toast.error(res.error.message);
    }
    reload();
  };

  const addExtra = async (addOnId: string) => {
    if (!extraFor) return;
    const p = productsQ.data?.data.find((x) => x.id === extraFor.productId);
    const a = p?.addOns?.find((x) => x.id === addOnId);
    if (!p || !a) return;
    await addOrderLines(extraFor.orderId, [{ productId: `addon_${a.id}`, productName: a.name, tierName: a.perPerson ? t("perPerson") : t("each"), admits: 0, quantity: 1, unitPrice: a.price }]);
    toast.success(t("extraAdded", { name: a.name }));
    setExtraFor(null);
    reload();
  };

  const upgrade = async (tierId: string) => {
    if (!upgradeFor) return;
    const p = productsQ.data?.data.find((x) => x.id === upgradeFor.productId);
    const o = orderOf(upgradeFor);
    const target = p?.tiers.find((t) => t.id === tierId);
    if (!p || !o || !target) return;
    const currentLine = o.lines.filter((l) => l.productId === p.id && l.unitPrice > 0).sort((a, b) => a.unitPrice - b.unitPrice)[0];
    const diff = target.price - (currentLine?.unitPrice ?? 0);
    if (diff <= 0) { toast.error(t("notAnUpgrade")); return; }
    await addOrderLines(o.id, [{ productId: p.id, productName: p.name, tierId: target.id, tierName: t("upgradeLine", { name: target.name }), admits: 0, quantity: 1, unitPrice: diff }]);
    toast.success(t("upgraded", { name: target.name, amount: formatMoney(diff) }));
    setUpgradeFor(null);
    reload();
  };

  const recordNoShow = async () => {
    if (!noShowFor) return;
    await markNoShow(noShowFor.id, noShowReason.trim() || undefined);
    toast.success(t("noShowRecorded"));
    setNoShowFor(null); setNoShowReason("");
    reload();
  };

  // ── refund and move, the same sheets the Schedule board offers ──────────
  const refundInfoFor = (b: Booking) => {
    const pending = pendingRefundFor(b.id);
    const found = refundableFor(b.id);
    return { pending, refundable: !!found && found.amount > 0, amount: found?.amount ?? 0, order: found?.order };
  };

  const sendRefund = async (reason: RefundReason, note: string) => {
    if (!refundFor) return;
    const info = refundInfoFor(refundFor);
    const direct = canRefundDirectly(actor, info.amount);
    setBusy(true);
    const res = await sendOrApproveRefund({ bookingId: refundFor.id, reason, note, requestedBy: actor.name, place: resourceName(refundFor.resourceId), direct });
    setBusy(false);
    if (!res.ok) { toast.error(t("refundFailed")); return; }
    setRefundFor(null);
    if (res.data.status === "approved") {
      const method = info.order?.payments[0]?.method ?? "cash";
      toast.success(t("refundedNow", { amount: formatMoney(res.data.amount), method: enumL.method(method) }));
    } else {
      toast.success(t("refundSent"));
    }
    reload();
  };

  const openMove = (b: Booking) => {
    const edit = bookingEditable(b.id, actor.name);
    if (!edit.editable) { toast.error(edit.reason); return; }
    setMoveFor(b);
  };

  const doMove = async (newDate: string, newTime: string) => {
    if (!moveFor) return;
    const product = productsQ.data?.data.find((p) => p.id === moveFor.productId);
    if (!product) return;
    const duration = durationOf(moveFor, product);
    setBusy(true);
    const res = await rescheduleBooking(moveFor.id, `${newDate}T${newTime}:00+06:00`, `${newDate}T${toTime(toMinutes(newTime) + duration)}:00+06:00`);
    setBusy(false);
    if (!res.ok) { toast.error(res.error.message); return; }
    await logOrderAction(moveFor.orderId, `Moved ${product.name} from ${moveFor.slotStart.slice(0, 10)} ${time(moveFor.slotStart)} to ${newDate} ${newTime}`, actor.name);
    setMoveFor(null);
    toast.success(t("moved", { day: formatDay(newDate), time: formatClock(newTime) }));
    reload();
  };

  const addWalkIn = async () => {
    const p = productsQ.data?.data.find((x) => x.id === walkInProduct);
    const tier = p?.tiers.find((t) => t.active);
    if (!p || !tier) return;
    const res = await checkout({
      channel: "counter", locationId: venueId || (p.locationIds[0] ?? "loc_fort"), counterId: activeCounter.counter?.id ?? null, staffId: null,
      customerName: walkInName.trim() || t("walkInDefaultName"),
      lines: [{ productId: p.id, productName: p.name, tierId: tier.id, tierName: tier.name, admits: tier.admits ?? 1, quantity: walkInParty, unitPrice: tier.price }],
      bookings: [{ productId: p.id, slotStart: `${date}T12:00:00+06:00`, partySize: walkInParty }],
      taxPct: 0, method: "cash", amountTendered: tier.price * walkInParty,
    });
    if (res.ok) { toast.success(t("walkInSold", { code: res.data.firstTicketCode })); setWalkInOpen(false); setWalkInName(""); setWalkInParty(2); reload(); }
    else toast.error(res.error.message);
  };

  const step = (n: number) => {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + n);
    setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  };

  const dayLabel = date === TODAY ? t("today") : date === TOMORROW ? t("tomorrow") : "";

  return (
    <main className="mx-auto w-full max-w-5xl px-section py-section">
      <div className="flex flex-col gap-section lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-section">
          <div className="flex flex-wrap items-center justify-between gap-tight">
            <div className="min-w-0">
              <h1 className="type-h1 text-xl">{t("title")}</h1>
              {dayLabel && <p className="text-[0.8125rem] text-muted">{dayLabel}</p>}
            </div>
            <Button shape="pill" variant="secondary" icon={<UserPlus size={16} strokeWidth={1.5} />} onClick={() => { setWalkInProduct(productsQ.data?.data.find((p) => p.bookingType === "BT-01" && p.status === "active")?.id ?? ""); setWalkInOpen(true); }}>
              {t("addWalkIn")}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-tight">
            <button type="button" onClick={() => step(-1)} aria-label={t("prevDay")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-card text-muted active:bg-ember/10">
              <ChevronLeft size={18} strokeWidth={1.5} />
            </button>
            <DateField
              value={date}
              today={TODAY}
              onChange={setDate}
              shape="go"
              labels={{ previousMonth: tc("previousMonth"), nextMonth: tc("nextMonth"), today: tc("today"), open: tc("openCalendar") }}
              className="w-[150px] shrink-0"
            />
            <button type="button" onClick={() => step(1)} aria-label={t("nextDay")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-card text-muted active:bg-ember/10">
              <ChevronRight size={18} strokeWidth={1.5} />
            </button>
            {/* Touch at every width: this is a door device, so the `md:` shrink
                that suits the admin app put a 38px field on a counter. */}
            <div data-focus-host className="flex h-11 min-w-40 flex-1 items-center gap-tight rounded-full border border-line bg-card px-comfortable focus-within:border-ember-solid">
              <Search size={16} strokeWidth={1.5} className="shrink-0 text-muted" aria-hidden />
              <input value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t("searchPlaceholder")} placeholder={t("searchPlaceholder")} className="h-full w-full bg-transparent text-sm outline-none" />
            </div>
          </div>

          {bookingsQ.loading ? (
            <div aria-busy="true" className="flex animate-pulse flex-col gap-tight">
              <div className="h-4 w-1/3 rounded-full bg-line" />
              <div className="h-16 rounded-go bg-line" />
              <div className="h-16 rounded-go bg-line" />
            </div>
          ) : groups.length === 0 ? (
            <EmptyState title={t("noBookingsTitle")} message={search ? t("noBookingsSearch") : t("noBookingsDay")} />
          ) : (
            <div className="flex flex-col gap-comfortable">
              {groups.map(([key, items]) => {
                const totals = sessionTotals.get(key) ?? { expected: 0, inCount: 0 };
                const expected = totals.expected;
                const inCount = totals.inCount;
                const [pid, iso] = key.split("|");
                /* Open where the door is standing, and open everything while a
                   search is running — a match hidden inside a shut row is a
                   match nobody finds. */
                const isOpen = search ? true : (open[key] ?? key === nowKey);
                const full = inCount >= expected;
                return (
                  <section key={key} data-group className="rounded-go go-surface">
                    <button
                      type="button"
                      onClick={() => setOpen((o) => ({ ...o, [key]: !isOpen }))}
                      aria-expanded={isOpen}
                      className="flex min-h-14 w-full items-center gap-comfortable px-section py-tight text-left"
                    >
                      {isOpen ? <ChevronDown size={18} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" /> : <ChevronRight size={18} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-tight">
                          <span className="shrink-0 whitespace-nowrap text-base font-semibold">{formatClock(time(iso))}</span>
                          <span className="min-w-0 truncate text-sm">{productName(pid)}</span>
                        </span>
                        <span className="mt-inline flex items-center gap-tight">
                          <span aria-hidden className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-line">
                            <span className={cn("block h-full rounded-full", full ? "bg-success" : "bg-inverse/40")} style={{ width: `${expected ? Math.round((inCount / expected) * 100) : 0}%` }} />
                          </span>
                          <span className={cn("text-[0.8125rem]", full ? "font-semibold text-success" : "text-muted")}>{t("inOfTotal", { done: inCount, total: expected })}</span>
                        </span>
                      </span>
                    </button>

                    {isOpen && (
                      /* The parties as rows on the session's own card,
                         divided by hairlines — no box inside a box. */
                      <div className="flex flex-col divide-y divide-line border-t border-line">
                        {items.map((b) => {
                          const o = orderOf(b);
                          const due = outstanding(o);
                          const done = (b.checkedIn ?? 0) >= b.partySize;
                          const prod = productsQ.data?.data.find((x) => x.id === b.productId);
                          const extendable = extendOf(b);
                          /* One primary action; everything else behind the
                             overflow. Seven equal pills stated no opinion about
                             which one a steward came for. */
                          const menu: ActionMenuItem[] = [];
                          if (!b.noShow && (prod?.addOns?.length ?? 0) > 0) {
                            menu.push({ key: "extra", label: t("addExtraBtn"), icon: <PlusCircle size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />, onSelect: () => setExtraFor(b) });
                          }
                          if (!b.noShow && (prod?.tiers.filter((tier) => tier.active).length ?? 0) > 1) {
                            menu.push({ key: "upgrade", label: t("upgradeBtn"), icon: <ArrowUpCircle size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />, onSelect: () => setUpgradeFor(b) });
                          }
                          if (!b.noShow && extendable) {
                            menu.push({ key: "extend", label: t("extendBtn", { minutes: extendable.cfg.incrementMinutes }), icon: <Timer size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />, onSelect: () => extend(b) });
                          }
                          if (!b.noShow && prod?.schedule) {
                            menu.push({ key: "move", label: t("moveBtn"), icon: <CalendarClock size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />, separated: menu.length > 0, onSelect: () => openMove(b) });
                          }
                          const refundInfo = b.noShow ? null : refundInfoFor(b);
                          if (refundInfo?.refundable && !refundInfo.pending) {
                            menu.push({ key: "refund", label: t("refundBtn"), icon: <RotateCcw size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />, onSelect: () => setRefundFor(b) });
                          }
                          if (!b.noShow && !done && (b.checkedIn ?? 0) === 0) {
                            menu.push({ key: "noshow", label: t("noShowBtn"), icon: <Ban size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />, separated: menu.length > 0, onSelect: () => { setNoShowFor(b); setNoShowReason(""); } });
                          }
                          const name = o?.customerName?.trim();
                          return (
                            <div key={b.id} data-party className="flex items-center gap-comfortable px-section py-comfortable">
                              <span className="min-w-0 flex-1">
                                {/* The name is what a steward matches against
                                    the person in front of them, so it leads and
                                    it WRAPS — it used to be third in a muted
                                    mono run-on, cut off with an ellipsis. */}
                                <span className={cn("block break-words text-[0.9375rem] font-semibold", !name && "font-mono text-sm")}>{name || o?.reference || b.orderId}</span>
                                <span className="mt-inline flex flex-wrap items-center gap-x-tight gap-y-inline text-[0.8125rem] text-muted">
                                  <span>{t("guests", { count: b.partySize })}</span>
                                  {(b.checkedIn ?? 0) > 0 && !done && <span>· {t("inOfTotal", { done: b.checkedIn ?? 0, total: b.partySize })}</span>}
                                </span>
                                {/* The code on its own line: it is what a guest
                                    reads off their phone, and after a "·" it
                                    wrapped to a line that began with a dot. */}
                                {name && <span className="mt-inline block break-all font-mono text-[0.8125rem] text-muted">{o?.reference ?? b.orderId}</span>}
                              </span>

                              {/* The row's one action is the right-most thing in
                                  it, orange, on every row — the till's pattern:
                                  the button that moves things on is always
                                  bottom-right. Anything else sits behind ⋯ to
                                  its left. */}
                              <span className="flex shrink-0 flex-wrap items-center justify-end gap-tight">
                                {menu.length > 0 ? (
                                  <ActionMenu shape="go" items={menu} label={t("rowMenu", { name: name || (o?.reference ?? b.orderId) })} />
                                ) : null}
                                {b.noShow ? (
                                  <span className="rounded-full bg-danger-solid px-comfortable py-inline text-[0.8125rem] font-medium text-white">
                                    {b.noShowReason ? t("noShowTagReason", { reason: b.noShowReason }) : t("noShowTag")}
                                  </span>
                                ) : due > 0 ? (
                                  <>
                                    <span className="rounded-full border border-warning/50 bg-warning-wash px-comfortable py-inline text-[0.8125rem] font-semibold text-fg">{t("owes", { amount: formatMoney(due) })}</span>
                                    <Button shape="pill" onClick={() => setPayFor(b)}>{t("takeBalanceBtn")}</Button>
                                  </>
                                ) : done ? (
                                  <span className="rounded-full bg-success/15 px-comfortable py-inline text-[0.8125rem] font-semibold text-success">{t("allIn")}</span>
                                ) : (
                                  <>
                                    {b.partySize > 1 && (b.checkedIn ?? 0) < b.partySize - 1 && (
                                      <Button shape="pill" variant="secondary" loading={pending === b.id} aria-label={t("plusOneLabel")} onClick={() => checkIn(b, (b.checkedIn ?? 0) + 1)}>{t("plusOne")}</Button>
                                    )}
                                    <Button shape="pill" loading={pending === b.id} onClick={() => checkIn(b, b.partySize)}>
                                      {b.partySize > 1 ? t("checkInCount", { count: b.partySize - (b.checkedIn ?? 0) }) : t("checkIn")}
                                    </Button>
                                  </>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>

        {/* The day, before anyone turns up. */}
        <aside className="flex flex-col gap-section">
          <section className="flex flex-col gap-comfortable rounded-go p-section go-surface">
            <h2 className="text-sm font-semibold">{t("summaryTitle")}</h2>
            <div className="grid grid-cols-3 divide-x divide-line overflow-hidden rounded-go-sm border border-line text-center">
              {(
                [
                  ["expected", day.expected],
                  ["arrived", day.arrived],
                  ["toCome", Math.max(0, day.expected - day.arrived)],
                ] as const
              ).map(([key, value]) => (
                <div key={key} className="flex flex-col items-center gap-inline py-comfortable">
                  <span className="text-xl font-semibold tabular-nums">{value}</span>
                  <span className="text-[0.8125rem] text-muted">{t(`stat_${key}`)}</span>
                </div>
              ))}
            </div>
            {day.owed > 0 && (
              <p className="rounded-go-sm border border-warning/50 bg-warning-wash px-comfortable py-tight text-[0.8125rem] font-semibold text-fg">
                {t("owedAcrossDay", { amount: formatMoney(day.owed) })}
              </p>
            )}
          </section>
        </aside>
      </div>

      {/* Take the outstanding balance — any configured method works. */}
      <Modal open={!!payFor} onClose={closePay} title={payFor ? t("takeAmount", { amount: formatMoney(payDiscounted) }) : t("takeBalanceTitle")}>
        <div className="mb-section flex items-baseline justify-between gap-comfortable">
          <span className="text-[0.8125rem] text-muted">{ts("sheet.owed")}</span>
          <span className="text-[1.125rem] font-semibold tabular-nums">{formatMoney(payDue)}</span>
        </div>

        <div className="mb-section">
          <DiscountFields state={discount} setState={setDiscount} orderTotal={payOrder?.total ?? 0} owed={payDue} limitPct={actor.discountLimitPct} />
        </div>

        {payDiscounted > 0 && (
          <>
            <div className="mb-section flex flex-col gap-tight">
              <label className="type-label text-[0.8125rem] text-muted" htmlFor="ci-amount">{t("amountLabel")}</label>
              <div className="flex items-center gap-tight">
                <input
                  id="ci-amount"
                  inputMode="decimal"
                  value={payAmount == null ? String(payDiscounted / 100) : String(payAmount / 100)}
                  onChange={(e) => {
                    const n = parseFloat(e.target.value.trim());
                    setPayAmount(Number.isFinite(n) ? Math.max(0, Math.round(n * 100)) : 0);
                  }}
                  className="h-12 min-w-0 flex-1 rounded-go-sm border border-line bg-card px-comfortable text-right font-mono text-sm outline-none focus:border-ember"
                />
                <button type="button" onClick={() => setPayAmount(null)} className="h-12 shrink-0 rounded-full border border-line px-comfortable text-[0.8125rem]">
                  {t("amountAll")}
                </button>
              </div>
              {payNow < payDiscounted && payNow > 0 && (
                <p className="text-[0.8125rem] text-muted">{t("partRemaining", { left: formatMoney(payDiscounted - payNow) })}</p>
              )}
            </div>
            <p className="mb-section text-[0.8125rem] text-muted">{t("receiptNote")}</p>
            <div className="grid grid-cols-2 gap-tight">
              {METHODS.map((m) => <Button shape="pill" key={m} variant="secondary" className="h-12" loading={busy} disabled={payNow <= 0 || !discountCalc.valid} onClick={() => takeBalance(m)}>{enumL.method(m)}</Button>)}
            </div>
          </>
        )}

        {payDiscounted <= 0 && discountCalc.hasAmount && (
          <Button shape="pill" className="w-full" loading={busy} disabled={!discountCalc.valid} onClick={applyDiscountOnly}>
            {ts("discount.applyOnly")}
          </Button>
        )}
      </Modal>

      <Modal open={!!extraFor} onClose={() => setExtraFor(null)} title={t("addExtraTitle")}>
        <div className="flex flex-col gap-tight">
          {(productsQ.data?.data.find((x) => x.id === extraFor?.productId)?.addOns ?? []).map((a) => (
            <Button shape="pill" key={a.id} variant="secondary" className="justify-between" onClick={() => addExtra(a.id)}>
              <span>{a.name}</span><span className="tabular-nums">{formatMoney(a.price)}{a.perPerson ? t("perHead") : ""}</span>
            </Button>
          ))}
        </div>
      </Modal>

      <Modal open={!!upgradeFor} onClose={() => setUpgradeFor(null)} title={t("upgradeTitle")}>
        <p className="mb-section text-[0.8125rem] text-muted">{t("upgradeNote")}</p>
        <div className="flex flex-col gap-tight">
          {(productsQ.data?.data.find((x) => x.id === upgradeFor?.productId)?.tiers.filter((tier) => tier.active) ?? []).map((tier) => (
            <Button shape="pill" key={tier.id} variant="secondary" className="justify-between" onClick={() => upgrade(tier.id)}>
              <span>{tier.name}</span><span className="tabular-nums">{formatMoney(tier.price)}</span>
            </Button>
          ))}
        </div>
      </Modal>

      <Modal open={!!noShowFor} onClose={() => setNoShowFor(null)} title={t("recordNoShowTitle")} footer={<><Button shape="pill" variant="secondary" onClick={() => setNoShowFor(null)}>{t("cancel")}</Button><Button shape="pill" onClick={recordNoShow}>{t("recordNoShowBtn")}</Button></>}>
        <FormField label={t("reasonLabel")} placeholder={t("reasonPlaceholder")} value={noShowReason} onChange={(e) => setNoShowReason(e.target.value)} />
      </Modal>

      <Modal open={walkInOpen} onClose={() => setWalkInOpen(false)} title={t("walkInTitle")} footer={<><Button shape="pill" variant="secondary" onClick={() => setWalkInOpen(false)}>{t("cancel")}</Button><Button shape="pill" disabled={!walkInProduct} onClick={addWalkIn}>{t("sellAndAdd")}</Button></>}>
        <div className="flex flex-col gap-section">
          <FormField label={t("productLabel")} variant="select" value={walkInProduct} onChange={(e) => setWalkInProduct(e.target.value)} options={(productsQ.data?.data ?? []).filter((p) => p.status === "active" && (p.bookingType === "BT-01" || p.bookingType === "BT-06")).map((p) => ({ value: p.id, label: p.name }))} />
          <FormField label={t("nameLabel")} placeholder={t("walkInDefaultName")} value={walkInName} onChange={(e) => setWalkInName(e.target.value)} />
          <div className="flex items-center justify-between rounded-go border border-line bg-card p-comfortable">
            <span className="text-sm">{t("partySize")}</span>
            <div className="flex items-center gap-tight">
              <button type="button" aria-label={t("fewer")} onClick={() => setWalkInParty((g) => Math.max(1, g - 1))} className="h-11 w-11 rounded-full border border-line text-lg">−</button>
              <span className="w-8 text-center font-semibold tabular-nums">{walkInParty}</span>
              <button type="button" aria-label={t("more")} onClick={() => setWalkInParty((g) => g + 1)} className="h-11 w-11 rounded-full border border-line text-lg">+</button>
            </div>
          </div>
          <p className="text-[0.8125rem] text-muted">{t("walkInHint")}</p>
        </div>
      </Modal>

      {refundFor && (
        <RefundSheet
          open={!!refundFor}
          onClose={() => setRefundFor(null)}
          title={guestName(refundFor)}
          when={whenFor(refundFor)}
          amount={refundInfoFor(refundFor).amount}
          direct={canRefundDirectly(actor, refundInfoFor(refundFor).amount)}
          onSend={sendRefund}
          busy={busy}
        />
      )}

      {moveFor && (() => {
        const product = productsQ.data?.data.find((p) => p.id === moveFor.productId);
        if (!product) return null;
        return (
          <MoveSheet
            open={!!moveFor}
            onClose={() => setMoveFor(null)}
            title={guestName(moveFor)}
            product={product}
            resourceId={moveFor.resourceId ?? null}
            placeName={resourceName(moveFor.resourceId) ?? product.name}
            date={moveFor.slotStart.slice(0, 10)}
            time={time(moveFor.slotStart)}
            durationMinutes={durationOf(moveFor, product)}
            bufferMinutes={product.bufferMinutes ?? 0}
            partySize={moveFor.partySize}
            bookingId={moveFor.id}
            onConfirm={doMove}
            busy={busy}
          />
        );
      })()}
    </main>
  );
}
