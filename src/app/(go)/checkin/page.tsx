"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowUpCircle, Ban, CalendarClock, ChevronDown, ChevronLeft, ChevronRight, HandCoins, PlusCircle, RotateCcw, Search, Timer, UserCheck, UserPlus } from "lucide-react";
import { Button, DateField, EmptyState, FormField, Modal, Skeleton, useToast, type ActionMenuItem } from "@/components/ui";
import { DEMO_NOW_MINUTES, DEMO_TODAY, demoDay } from "@/lib/schedule";
import { cn } from "@/lib/cn";
import { useEnumLabels } from "@/lib/labels";
import { useApiQuery } from "@/lib/useApi";
import { useActiveCounterNow } from "@/lib/activeCounter";
import {
  addOrderLines,
  addOrderPayment,
  canTakeNonCash,
  checkInBooking,
  checkout,
  bookingEditable,
  discountOrderBalance,
  extendBooking,
  isResourceFreeFor,
  listBookings,
  listOrders,
  listProducts,
  listResources,
  logOrderAction,
  markNoShow,
  orderOutstanding,
  peekCustomers,
  peekOrders,
  rescheduleBooking,
  tillMethods,
  type Booking,
  type Product,
} from "@/lib/api";
import { toMinutes, toTime } from "@/lib/schedule";
import { formatClock, formatDay, formatMoney } from "@/lib/format";
import { pendingRefundFor, refundableFor, withdrawRefundRequest } from "@/lib/api/refundRequests";
import { pendingWriteOffFor, useWriteOffVersion, withdrawWriteOff } from "@/lib/api/writeOffRequests";
import { pendingRescheduleFor, useRescheduleVersion, withdrawRescheduleRequest } from "@/lib/api/rescheduleRequests";
import { Stepper } from "../_components/Stepper";
import { Thumb } from "../_components/Thumb";
import { BookingGlyph } from "../_components/WallTile";
import { useActor, canRefundDirectly } from "../schedule/_lib/actor";
import { RefundFlowSheet } from "../_components/RefundFlowSheet";
import { WriteOffSheet } from "../_components/WriteOffSheet";
import { MoveSheet } from "../schedule/_components/Sheets";
import { PaymentSheet, type PaymentResult } from "../schedule/_components/PaymentSheet";
import { useMediaQuery } from "@/lib/useMedia";
import { GoPage, GoPageHeader } from "../_components/GoPage";
import { DaySummary } from "./_components/DaySummary";
import { FilterCells } from "./_components/FilterCells";
import { PartyRow } from "./_components/PartyRow";
import { buildParties, countByFilter, groupBySession, inFilter, matchesSearch, totalDue, type CheckInFilter, type Party } from "./_lib/parties";

/* The app's one date, not a private copy of it — the token's own doc
   comment warns that two components each holding their own is how a hold
   lands in a different month from the schedule it blocks. */
/* Desktop = the Tailwind `rail` variant: a tablet held sideways, a laptop, a
   monitor. Below it the screen is exactly what it was. */
const RAIL = "(min-width: 64rem) and (orientation: landscape)";

const TODAY = DEMO_TODAY;
const TOMORROW = demoDay(1);
const time = (iso: string) => iso.slice(11, 16);

/** How long a booking runs, in minutes — from its own end time if it has
 *  one, else the product's default session length. Needed to keep a moved
 *  booking the same length it was sold as. */
const durationOf = (b: Booking, product?: Product): number => {
  if (b.slotEnd) return Math.max(15, toMinutes(b.slotEnd.slice(11, 16)) - toMinutes(b.slotStart.slice(11, 16)));
  return product?.schedule?.sessionMinutes || product?.schedule?.slotMinutes || 60;
};

export default function CheckInPage() {
  return (
    <Suspense fallback={null}>
      <CheckInScreen />
    </Suspense>
  );
}

/* A link can open the list on one guest and one day (?q=&date=) — the Arrivals
   list sends a steward straight to the party they tapped. */
function CheckInScreen() {
  const params = useSearchParams();
  const t = useTranslations("checkin");
  const tc = useTranslations("common");
  const tr = useTranslations("refunds");
  const enumL = useEnumLabels();
  const toast = useToast();
  const actor = useActor();
  // A move asked for, answered or taken back changes a row's tag.
  useRescheduleVersion();
  useWriteOffVersion();
  const [date, setDate] = useState(/^d{4}-d{2}-d{2}$/.test(params.get("date") ?? "") ? params.get("date")! : TODAY);
  /* Who is at the door is the venue this counter stands in. */
  const activeCounter = useActiveCounterNow();
  const venueId = activeCounter.locationId;
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [filter, setFilter] = useState<CheckInFilter>("all");
  const bookingsQ = useApiQuery(() => listBookings({ pageSize: 1000 }), []);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100 }), []);
  const ordersQ = useApiQuery(() => listOrders({ pageSize: 1000 }), []);
  const resourcesQ = useApiQuery(() => listResources({ pageSize: 200 }), []);
  const productName = (id: string) => productsQ.data?.data.find((p) => p.id === id)?.name ?? "—";
  const productOf = (id: string) => productsQ.data?.data.find((p) => p.id === id);
  const resourceName = (id?: string | null) => (id ? resourcesQ.data?.data.find((r) => r.id === id)?.name ?? null : null);
  const whenFor = (b: Booking) => `${resourceName(b.resourceId) ?? productName(b.productId)} · ${formatClock(time(b.slotStart))}`;
  const payMethods = useMemo(() => tillMethods(canTakeNonCash()), []);

  // Counter workflows on a party's menu.
  const [payFor, setPayFor] = useState<Booking | null>(null);
  const [extraFor, setExtraFor] = useState<Booking | null>(null);
  const [upgradeFor, setUpgradeFor] = useState<Booking | null>(null);
  const [noShowFor, setNoShowFor] = useState<Booking | null>(null);
  const [noShowReason, setNoShowReason] = useState("");
  const [refundFor, setRefundFor] = useState<Booking | null>(null);
  const [writeOffFor, setWriteOffFor] = useState<Booking | null>(null);
  const [moveFor, setMoveFor] = useState<Booking | null>(null);
  const rail = useMediaQuery(RAIL);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkInProduct, setWalkInProduct] = useState("");
  const [walkInParty, setWalkInParty] = useState(2);
  const [walkInName, setWalkInName] = useState("");

  const reload = () => { bookingsQ.reload(); ordersQ.reload(); };

  /* The whole day at this venue, as parties. Everything that speaks about the
     DAY — the summary, each session's progress, what is still to collect —
     reads this, never the searched list: a search is a lookup, not a claim
     about the day. Typing one guest's name used to rewrite "at the door today"
     as that guest's own two tickets. */
  const dayParties = useMemo(() => {
    const day = (bookingsQ.data?.data ?? []).filter((b) => b.status === "confirmed" && b.slotStart.slice(0, 10) === date && (!venueId || b.locationId === venueId));
    return buildParties({ bookings: day, orders: ordersQ.data?.data ?? [], customers: peekCustomers(), outstanding: orderOutstanding });
  }, [bookingsQ.data, ordersQ.data, date, venueId]);

  const searched = useMemo(() => dayParties.filter((p) => matchesSearch(p, search)), [dayParties, search]);
  // The counts follow the search: they say what each cell would show.
  const counts = useMemo(() => countByFilter(searched), [searched]);
  const visible = useMemo(() => searched.filter((p) => inFilter(p, filter)), [searched, filter]);
  const groups = useMemo(() => groupBySession(visible, productName), [visible, productsQ.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const sessionTotals = useMemo(() => {
    const m = new Map<string, { expected: number; inCount: number }>();
    for (const p of dayParties) {
      const cur = m.get(p.sessionKey) ?? { expected: 0, inCount: 0 };
      m.set(p.sessionKey, { expected: cur.expected + p.size, inCount: cur.inCount + p.arrived });
    }
    return m;
  }, [dayParties]);

  const day = useMemo(() => {
    const due = totalDue(dayParties);
    return {
      expected: dayParties.reduce((s, p) => s + p.size, 0),
      arrived: dayParties.reduce((s, p) => s + p.arrived, 0),
      owed: due.amount,
      owingParties: due.parties,
    };
  }, [dayParties]);
  // The Due filter's headline: what is still to collect across what it lists.
  const dueNow = useMemo(() => totalDue(visible), [visible]);

  /* The session a door is standing in. Everything used to open shut, so the
     first thing a steward did on every arrival was tap a row open — and the
     names, which are the whole point of the screen, were behind that tap. */
  const nowKey = useMemo(() => {
    const all = groupBySession(dayParties, productName);
    if (all.length === 0) return null;
    if (date !== TODAY) return all[0].key;
    const started = all.filter((g) => toMinutes(time(g.start)) <= DEMO_NOW_MINUTES);
    return (started[started.length - 1] ?? all[0]).key;
  }, [dayParties, date, productsQ.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const checkIn = async (b: Booking, count: number) => {
    setPending(b.id);
    await checkInBooking(b.id, count);
    setPending(null);
    reload();
  };

  // Post-sale extend: one increment, only when the lane is free right behind.
  const extendOf = (b: Booking) => {
    if (!b.resourceId || !b.slotEnd) return null;
    const p = productOf(b.productId);
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

  // ── taking what is owed, with an after-match discount, and checking in ──
  const payOrder = payFor ? peekOrders().find((o) => o.id === payFor.orderId) : undefined;
  const payOwed = payOrder ? orderOutstanding(payOrder) : 0;
  const payParty = payFor ? dayParties.find((p) => p.booking.id === payFor.id) : undefined;

  const takePayment = async (r: PaymentResult) => {
    if (!payFor || !payOrder) return;
    setBusy(true);
    if (r.discountMinor > 0) {
      const d = await discountOrderBalance(payOrder.id, r.discountMinor, r.reasonText, actor.name);
      if (!d.ok) { setBusy(false); toast.error(d.error.message); return; }
    }
    if (r.payAmount > 0 && r.method) {
      const res = await addOrderPayment(payOrder.id, r.method, r.payAmount, actor.name);
      if (!res.ok) { setBusy(false); toast.error(res.error.message); return; }
    }
    const fresh = peekOrders().find((o) => o.id === payOrder.id);
    const left = fresh ? orderOutstanding(fresh) : 0;
    // Paid in full and the guest is here: the same step lets them in.
    const letIn = r.checkIn && left === 0;
    if (letIn) await checkInBooking(payFor.id, payFor.partySize);
    setBusy(false);
    const name = payParty?.name || t("walkInDefaultName");
    if (r.payAmount > 0 && r.method) {
      if (left > 0) toast.success(t("partTaken", { amount: formatMoney(r.payAmount), method: enumL.method(r.method), left: formatMoney(left) }));
      else if (letIn) toast.success(t("paidAndIn", { amount: formatMoney(r.payAmount), method: enumL.method(r.method), name }));
      else toast.success(t("balanceTaken", { amount: formatMoney(r.payAmount), method: enumL.method(r.method) }));
    } else {
      toast.success(letIn ? t("discountAppliedIn", { amount: formatMoney(r.discountMinor), name }) : t("discountApplied", { amount: formatMoney(r.discountMinor) }));
    }
    // Stay open while money is still owed: the second tender is usually
    // handed over in the same breath as the first.
    if (left === 0) setPayFor(null);
    reload();
  };

  const addExtra = async (addOnId: string) => {
    if (!extraFor) return;
    const p = productOf(extraFor.productId);
    const a = p?.addOns?.find((x) => x.id === addOnId);
    if (!p || !a) return;
    await addOrderLines(extraFor.orderId, [{ productId: `addon_${a.id}`, productName: a.name, tierName: a.perPerson ? t("perPerson") : t("each"), admits: 0, quantity: 1, unitPrice: a.price }]);
    toast.success(t("extraAdded", { name: a.name }));
    setExtraFor(null);
    reload();
  };

  const upgrade = async (tierId: string) => {
    if (!upgradeFor) return;
    const p = productOf(upgradeFor.productId);
    const o = peekOrders().find((x) => x.id === upgradeFor.orderId);
    const target = p?.tiers.find((tier) => tier.id === tierId);
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
    const found = refundableFor(b.id);
    return { pending: pendingRefundFor(b.id), refundable: !!found && found.amount > 0, amount: found?.amount ?? 0, order: found?.order };
  };

  /* The refund and write-off sheets send their own requests and close through
     here: the list reads again. */
  const requestSent = () => { setRefundFor(null); setWriteOffFor(null); reload(); };

  const withdrawRefund = async (b: Booking) => {
    const req = pendingRefundFor(b.id);
    if (!req) return;
    await withdrawRefundRequest(req.id);
    toast.success(t("refundWithdrawn"));
    reload();
  };

  const withdrawWriteOffFor = async (b: Booking) => {
    const req = pendingWriteOffFor(b.orderId);
    if (!req) return;
    await withdrawWriteOff(req.id);
    toast.success(tr("pos.status.takenBack"));
    reload();
  };

  const withdrawMove = async (b: Booking) => {
    const req = pendingRescheduleFor(b.id);
    if (!req) return;
    await withdrawRescheduleRequest(req.id);
    toast.success(t("moveWithdrawn"));
  };

  const openMove = (b: Booking) => {
    const edit = bookingEditable(b.id, actor.name);
    if (!edit.editable) { toast.error(edit.reason); return; }
    setMoveFor(b);
  };

  /* Only reached when this role may move on the spot ("direct"): a role set to
     "request" sends the move to a manager from inside the sheet. */
  const doMove = async (newDate: string, newTime: string) => {
    if (!moveFor) return;
    const product = productOf(moveFor.productId);
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
    const p = productOf(walkInProduct);
    const tier = p?.tiers.find((x) => x.active);
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

  /* One overflow per party: everything that is not the one thing a steward came
     for. What is offered follows the role — "off" hides a button, "request" asks
     a manager, "direct" does it on the spot. */
  const menuFor = (p: Party): ActionMenuItem[] => {
    const b = p.booking;
    const prod = productOf(b.productId);
    const items: ActionMenuItem[] = [];
    const icon = (I: typeof PlusCircle) => <I size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />;
    const noShow = p.state === "noshow";
    if (!noShow && p.state === "partial") {
      items.push({ key: "rest", label: t("checkInRest", { count: p.size - p.arrived }), icon: icon(UserCheck), onSelect: () => void checkIn(b, p.size) });
    }
    if (!noShow && p.state === "notin" && p.size > 1 && p.due === 0) {
      items.push({ key: "some", label: t("checkInSome"), icon: icon(UserCheck), onSelect: () => void checkIn(b, 1) });
    }
    if (!noShow && (prod?.addOns?.length ?? 0) > 0) items.push({ key: "extra", label: t("addExtraBtn"), icon: icon(PlusCircle), onSelect: () => setExtraFor(b) });
    if (!noShow && (prod?.tiers.filter((tier) => tier.active).length ?? 0) > 1) items.push({ key: "upgrade", label: t("upgradeBtn"), icon: icon(ArrowUpCircle), onSelect: () => setUpgradeFor(b) });
    const ext = noShow ? null : extendOf(b);
    if (ext) items.push({ key: "extend", label: t("extendBtn", { minutes: ext.cfg.incrementMinutes }), icon: icon(Timer), onSelect: () => void extend(b) });

    // Move — "off" hides it; "request" asks a manager; "direct" moves it now.
    if (!noShow && !actor.loading && prod?.schedule && actor.rescheduleMode !== "off") {
      if (pendingRescheduleFor(b.id)) {
        items.push({ key: "move-back", label: t("moveWithdrawBtn"), icon: icon(CalendarClock), separated: items.length > 0, onSelect: () => void withdrawMove(b) });
      } else {
        items.push({ key: "move", label: actor.rescheduleMode === "direct" ? t("moveBtn") : t("moveAskBtn"), icon: icon(CalendarClock), separated: items.length > 0, onSelect: () => openMove(b) });
      }
    }
    // Refund — the same three modes, and a request already waiting can be taken back.
    if (!noShow && !actor.loading && actor.refundMode !== "off") {
      const info = refundInfoFor(b);
      if (info.pending) {
        items.push({ key: "refund-back", label: t("refundWithdrawBtn"), icon: icon(RotateCcw), onSelect: () => void withdrawRefund(b) });
      } else if (info.refundable) {
        items.push({ key: "refund", label: canRefundDirectly(actor, info.amount) ? t("refundBtn") : t("refundAskBtn"), icon: icon(RotateCcw), onSelect: () => setRefundFor(b) });
      }
    }
    /* Write off what is still owed — hidden when nothing is owed or the role may
       not; a request already waiting can be taken back. */
    if (!noShow && !actor.loading && actor.writeOffMode !== "off") {
      if (pendingWriteOffFor(b.orderId)) {
        items.push({ key: "writeoff-back", label: tr("pos.writeOff.takeBack"), icon: icon(HandCoins), onSelect: () => void withdrawWriteOffFor(b) });
      } else if (p.due > 0) {
        items.push({ key: "writeoff", label: tr("pos.writeOff.action", { amount: formatMoney(p.due) }), icon: icon(HandCoins), onSelect: () => setWriteOffFor(b) });
      }
    }
    if (!noShow && p.state === "notin") {
      items.push({ key: "noshow", label: t("noShowBtn"), icon: icon(Ban), separated: items.length > 0, onSelect: () => { setNoShowFor(b); setNoShowReason(""); } });
    }
    return items;
  };

  const filterLabels = { all: t("filterAll"), due: t("filterDue"), notin: t("filterNotIn"), in: t("filterIn") };
  const emptyFor: Record<CheckInFilter, string> = { all: t("noBookingsSearch"), due: t("emptyDue"), notin: t("emptyNotIn"), in: t("emptyIn") };

  /* The same three controls on every screen; where they sit is the only thing
     that changes. A phone: title and walk-in, then the search, then the days.
     A desktop: all of them on the header's one line (search wide, the days,
     "Add a walk-in" rightmost) — each drawn once, never in both places. */
  const walkInBtn = (
    <Button variant="secondary" icon={<UserPlus size={16} strokeWidth={1.5} />} onClick={() => { setWalkInProduct(productsQ.data?.data.find((p) => p.bookingType === "BT-01" && p.status === "active")?.id ?? ""); setWalkInOpen(true); }}>
      {t("addWalkIn")}
    </Button>
  );
  /* Search leads: it is the first thing done when a guest walks up. */
  const searchEl = (
    <div data-focus-host className={cn("flex h-12 items-center gap-tight rounded-full bg-card px-comfortable shadow-card focus-within:ring-2 focus-within:ring-ember", rail && "w-96 max-w-full")}>
      <Search size={18} strokeWidth={1.5} className="shrink-0 text-muted" aria-hidden />
      <input value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t("searchPlaceholder")} placeholder={t("searchPlaceholder")} className="h-full w-full min-w-0 bg-transparent text-base" />
    </div>
  );
  const dateEl = (
    <div className="flex items-center gap-tight">
      <button type="button" onClick={() => step(-1)} aria-label={t("prevDay")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card text-muted shadow-card hover:bg-muted-wash active:bg-muted-wash">
        <ChevronLeft size={18} strokeWidth={1.5} />
      </button>
      <DateField
        value={date}
        today={TODAY}
        onChange={setDate}
        shape="go"
        labels={{ previousMonth: tc("previousMonth"), nextMonth: tc("nextMonth"), today: tc("today"), open: tc("openCalendar") }}
        className="min-w-0 flex-1 sm:w-[170px] sm:flex-none"
      />
      <button type="button" onClick={() => step(1)} aria-label={t("nextDay")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card text-muted shadow-card hover:bg-muted-wash active:bg-muted-wash">
        <ChevronRight size={18} strokeWidth={1.5} />
      </button>
    </div>
  );

  return (
    <GoPage width="wide">
    <main className="mx-auto w-full max-w-248 pb-section pt-tight rail:max-w-none rail:py-0">
      {rail && <GoPageHeader title={t("title")} subtitle={dayLabel || undefined} actions={<>{searchEl}{dateEl}{walkInBtn}</>} />}
      <div className="flex flex-col gap-section lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start rail:grid-cols-[minmax(0,1fr)_320px] rail:gap-major">
        <div className="flex min-w-0 flex-col gap-section">
          {!rail && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-tight">
                <div className="min-w-0">
                  <h1 className="text-xl font-semibold tracking-title text-fg">{t("title")}</h1>
                  {dayLabel && <p className="text-sm text-muted">{dayLabel}</p>}
                </div>
                {walkInBtn}
              </div>
              {searchEl}
              {dateEl}
            </>
          )}

          <FilterCells value={filter} onChange={setFilter} counts={counts} labels={filterLabels} label={t("filterLabel")} />

          {/* The Due view opens on the one number a steward collecting is
              working toward: everything still to take, and from how many. */}
          {filter === "due" && dueNow.parties > 0 && (
            <div data-due-banner className="flex flex-wrap items-baseline justify-between gap-x-comfortable gap-y-inline rounded-card bg-warning-wash p-card">
              <p className="text-2xl font-bold tabular-nums text-fg">{t("dueBannerAmount", { amount: formatMoney(dueNow.amount) })}</p>
              <p className="text-md font-semibold text-fg-secondary">{t("dueBannerCount", { count: dueNow.parties })}</p>
            </div>
          )}

          {bookingsQ.loading ? (
            <div aria-busy="true" className="flex flex-col gap-tight">
              <Skeleton h={16} w="33%" className="rounded-full" />
              <Skeleton h={64} className="rounded-card" />
              <Skeleton h={64} className="rounded-card" />
            </div>
          ) : dayParties.length === 0 ? (
            <EmptyState title={t("noBookingsTitle")} message={t("noBookingsDay")} />
          ) : groups.length === 0 ? (
            <EmptyState title={filter === "all" ? t("noBookingsTitle") : filterLabels[filter]} message={search && filter === "all" ? t("noBookingsSearch") : emptyFor[filter]} />
          ) : (
            <div className="flex flex-col gap-comfortable rail:rounded-card rail:bg-card rail:shadow-card rail:gap-0 rail:overflow-hidden">
              {groups.map((g) => {
                const totals = sessionTotals.get(g.key) ?? { expected: 0, inCount: 0 };
                const full = totals.inCount >= totals.expected;
                /* Open where the door is standing, and open everything while a
                   search or a filter is running — a match hidden inside a shut
                   row is a match nobody finds. */
                const isOpen = search || filter !== "all" ? true : (open[g.key] ?? g.key === nowKey);
                return (
                  <section key={g.key} data-group className="flex flex-col gap-tight rail:gap-0 rail:border-t rail:border-line rail:first:border-t-0">
                    <button
                      type="button"
                      onClick={() => setOpen((o) => ({ ...o, [g.key]: !isOpen }))}
                      aria-expanded={isOpen}
                      className="card-surface flex min-h-16 w-full items-center gap-comfortable p-comfortable text-left rail:rounded-none rail:bg-transparent rail:px-card rail:shadow-none rail:hover:bg-nav-hover"
                    >
                      <Thumb image={productOf(g.productId)?.images?.[0]?.url} glyph={<BookingGlyph bookingType={productOf(g.productId)?.bookingType} />} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-tight">
                          <span className="shrink-0 whitespace-nowrap text-md font-semibold tabular-nums">{formatClock(time(g.start))}</span>
                          <span className="min-w-0 break-words text-md font-semibold">{productName(g.productId)}</span>
                        </span>
                        <span className="mt-inline flex items-center gap-tight">
                          <span aria-hidden className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-line">
                            <span className={cn("block h-full rounded-full", full ? "bg-success" : "bg-inverse/40")} style={{ width: `${totals.expected ? Math.round((totals.inCount / totals.expected) * 100) : 0}%` }} />
                          </span>
                          <span className={cn("text-sm", full ? "font-semibold text-success" : "text-muted")}>{t("inOfTotal", { done: totals.inCount, total: totals.expected })}</span>
                        </span>
                      </span>
                      {isOpen ? <ChevronDown size={18} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" /> : <ChevronRight size={18} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />}
                    </button>

                    {isOpen && (
                      <ul className="flex flex-col gap-tight pl-tight rail:gap-0 rail:bg-surface rail:pl-0">
                        {g.parties.map((p) => (
                          <PartyRow
                            key={p.booking.id}
                            party={p}
                            pending={pending === p.booking.id}
                            refundAsked={!!pendingRefundFor(p.booking.id)}
                            writeOffAsked={!!pendingWriteOffFor(p.booking.orderId)}
                            moveAsked={!!pendingRescheduleFor(p.booking.id)}
                            menu={menuFor(p)}
                            menuLabel={t("rowMenu", { name: p.name || t("walkInDefaultName") })}
                            onTake={() => setPayFor(p.booking)}
                            onCheckIn={(count) => void checkIn(p.booking, count)}
                          />
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-section rail:sticky rail:top-section">
          <DaySummary expected={day.expected} arrived={day.arrived} owed={day.owed} owingParties={day.owingParties} onShowDue={() => { setFilter("due"); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
        </aside>
      </div>

      {/* Take the balance — one sheet, drawn like the till's own payment step:
          the amount, an after-match discount, how they pay, cash received. It
          checks the party in as part of the same step. */}
      {payFor && payOrder && (
        <PaymentSheet
          open
          onClose={() => setPayFor(null)}
          title={payParty?.name ?? ""}
          when={whenFor(payFor)}
          orderTotal={payOrder.total}
          owed={payOwed}
          limitPct={actor.discountLimitPct}
          methods={payMethods}
          checkIn={!(payParty?.state === "in")}
          allowPart
          onWriteOff={actor.writeOffMode !== "off" && !pendingWriteOffFor(payFor.orderId) ? () => { setWriteOffFor(payFor); setPayFor(null); } : undefined}
          onConfirm={(r) => void takePayment(r)}
          busy={busy}
        />
      )}

      <Modal open={!!extraFor} onClose={() => setExtraFor(null)} title={t("addExtraTitle")}>
        <div className="flex flex-col gap-tight">
          {(productOf(extraFor?.productId ?? "")?.addOns ?? []).map((a) => (
            <Button key={a.id} variant="secondary" className="justify-between" onClick={() => void addExtra(a.id)}>
              <span>{a.name}</span><span className="tabular-nums">{formatMoney(a.price)}{a.perPerson ? t("perHead") : ""}</span>
            </Button>
          ))}
        </div>
      </Modal>

      <Modal open={!!upgradeFor} onClose={() => setUpgradeFor(null)} title={t("upgradeTitle")}>
        <p className="mb-section text-sm text-muted">{t("upgradeNote")}</p>
        <div className="flex flex-col gap-tight">
          {(productOf(upgradeFor?.productId ?? "")?.tiers.filter((tier) => tier.active) ?? []).map((tier) => (
            <Button key={tier.id} variant="secondary" className="justify-between" onClick={() => void upgrade(tier.id)}>
              <span>{tier.name}</span><span className="tabular-nums">{formatMoney(tier.price)}</span>
            </Button>
          ))}
        </div>
      </Modal>

      <Modal open={!!noShowFor} onClose={() => setNoShowFor(null)} title={t("recordNoShowTitle")} footer={<><Button variant="secondary" onClick={() => setNoShowFor(null)}>{t("cancel")}</Button><Button onClick={() => void recordNoShow()}>{t("recordNoShowBtn")}</Button></>}>
        <FormField label={t("reasonLabel")} placeholder={t("reasonPlaceholder")} value={noShowReason} onChange={(e) => setNoShowReason(e.target.value)} />
      </Modal>

      <Modal open={walkInOpen} onClose={() => setWalkInOpen(false)} title={t("walkInTitle")} footer={<><Button variant="secondary" onClick={() => setWalkInOpen(false)}>{t("cancel")}</Button><Button disabled={!walkInProduct} onClick={() => void addWalkIn()}>{t("sellAndAdd")}</Button></>}>
        <div className="flex flex-col gap-section">
          <FormField label={t("productLabel")} variant="select" value={walkInProduct} onChange={(e) => setWalkInProduct(e.target.value)} options={(productsQ.data?.data ?? []).filter((p) => p.status === "active" && (p.bookingType === "BT-01" || p.bookingType === "BT-06")).map((p) => ({ value: p.id, label: p.name }))} />
          <FormField label={t("nameLabel")} placeholder={t("walkInDefaultName")} value={walkInName} onChange={(e) => setWalkInName(e.target.value)} />
          <div className="flex items-center justify-between rounded-inner bg-subtle p-comfortable">
            <span className="text-base">{t("partySize")}</span>
            <Stepper value={walkInParty} min={1} onChange={setWalkInParty} lessLabel={t("fewer")} moreLabel={t("more")} />
          </div>
          <p className="text-sm text-muted">{t("walkInHint")}</p>
        </div>
      </Modal>

      {refundFor && (
        <RefundFlowSheet
          key={refundFor.id}
          open
          onClose={() => setRefundFor(null)}
          title={dayParties.find((p) => p.booking.id === refundFor.id)?.name ?? ""}
          when={whenFor(refundFor)}
          bookingId={refundFor.id}
          place={resourceName(refundFor.resourceId)}
          onDone={requestSent}
        />
      )}

      {writeOffFor && (
        <WriteOffSheet
          key={writeOffFor.id}
          open
          onClose={() => setWriteOffFor(null)}
          title={dayParties.find((p) => p.booking.id === writeOffFor.id)?.name ?? ""}
          when={whenFor(writeOffFor)}
          orderId={writeOffFor.orderId}
          bookingId={writeOffFor.id}
          onDone={requestSent}
        />
      )}

      {moveFor && (() => {
        const product = productOf(moveFor.productId);
        if (!product) return null;
        return (
          <MoveSheet
            open={!!moveFor}
            onClose={() => setMoveFor(null)}
            title={dayParties.find((p) => p.booking.id === moveFor.id)?.name ?? ""}
            product={product}
            resourceId={moveFor.resourceId ?? null}
            placeName={resourceName(moveFor.resourceId) ?? product.name}
            date={moveFor.slotStart.slice(0, 10)}
            time={time(moveFor.slotStart)}
            durationMinutes={durationOf(moveFor, product)}
            bufferMinutes={product.bufferMinutes ?? 0}
            partySize={moveFor.partySize}
            bookingId={moveFor.id}
            onConfirm={(d, tm) => void doMove(d, tm)}
            busy={busy}
          />
        );
      })()}
    </main>
    </GoPage>
  );
}
