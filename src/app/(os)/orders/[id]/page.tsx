"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarClock, Printer, RotateCcw, Send, Wallet } from "lucide-react";
import {
  ActionMenu,
  Button,
  EmptyState,
  FormField,
  MarketBadge,
  Modal,
  PageShell,
  StatusPill,
  useToast,
  type ActionMenuItem,
} from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { MD, XL, useMediaQuery } from "@/lib/useMedia";
import {
  addOrderNote,
  addOrderPayment,
  attachOrderCustomer,
  canTakeNonCash,
  customerStats,
  getOrder,
  getSlots,
  isVoidedOrder,
  listBookings,
  listProducts,
  listTickets,
  lockBooking,
  logOrderAction,
  matchOrCreateCustomer,
  orderDue,
  refundOrderLines,
  rescheduleBooking,
  resolveCustomer,
  tillMethods,
  unlockBooking,
  writeOffOrder,
  type Booking,
  type PaymentMethod,
  type WriteOffCategory,
} from "@/lib/api";
import { formatClock, formatDay, formatMoney } from "@/lib/format";
import { OrderLinesDetail } from "@/components/OrderLinesDetail";
import { RefundRequests } from "@/components/RefundRequests";
import { useSalesLabels } from "../_lib/labels";
import { useDirectory } from "../_lib/useReport";
import { ShowMore } from "../_components/ShowMore";
import { KeyFacts } from "./_components/KeyFacts";
import { CustomerCard } from "./_components/CustomerCard";
import { FactsCard } from "./_components/FactsCard";
import { MoneyCard, parseTaka } from "./_components/MoneyCard";
import { PaymentsCard } from "./_components/PaymentsCard";
import { HistoryCard, NotesCard, TicketsCard, WriteOffsCard } from "./_components/RecordCards";
import { ReservationsCard } from "./_components/ReservationsCard";
import { Section } from "./_components/Section";

/* Who is acting. Real auth arrives with the backend; the counter manager is
   the actor everywhere else in OS. */
const ACTOR = "Nadia Islam";

/**
 * One order, organised the way a person reads one: what it is (the facts), what
 * is owed on it (Money, with the form to collect it), who it is for, what was
 * bought, what has happened to the money, and the record around it.
 *
 * Two columns from `xl` — the sale on the left, the money and the people on the
 * right — and one on a phone, where **Money follows the facts directly**,
 * because "is anything owed?" is the first question anyone opens an order with.
 * The two columns are laid out with `display: contents` and `order-*`, so the
 * phone's reading order is its own and not the desktop's stacked.
 *
 * Nothing the old page showed is gone: the reservations with lock and move, the
 * marketplace cut, the payments with Counterfoil's fee under them, the refund
 * requests, tickets, history, notes — and now the write-offs it recorded and
 * never showed.
 */
export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("orders");
  const toast = useToast();
  const order = useApiQuery(() => getOrder(params.id), [params.id]);
  const ticketsQ = useApiQuery(() => listTickets({ pageSize: 100, filters: { orderId: params.id } }), [params.id]);
  const bookingsQ = useApiQuery(() => listBookings({ pageSize: 1000 }), []);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100 }), []);
  const dir = useDirectory();
  const L = useSalesLabels(dir);
  /* From xl the Money card is the right-hand column, in view beside the sale. */
  const beside = useMediaQuery(XL);
  /* A phone gets the four things an order is opened for and folds the rest. */
  const phone = !useMediaQuery(MD);
  const methods = useMemo(() => tillMethods(canTakeNonCash()) as PaymentMethod[], []);

  // Per-line refund
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundLines, setRefundLines] = useState<Record<string, boolean>>({});
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);

  // Resend ticket
  const [resendOpen, setResendOpen] = useState(false);

  // Write off a balance
  const [woOpen, setWoOpen] = useState(false);
  const [woAmount, setWoAmount] = useState("");
  const [woCategory, setWoCategory] = useState<WriteOffCategory>("uncollectible");
  const [woReason, setWoReason] = useState("");
  const [woSaving, setWoSaving] = useState(false);

  // Change date/time, lock/unlock
  const [moveFor, setMoveFor] = useState<Booking | null>(null);
  const [moveDate, setMoveDate] = useState("");
  const [moveTime, setMoveTime] = useState("");
  const [lockFor, setLockFor] = useState<Booking | null>(null);
  const [lockReason, setLockReason] = useState("");
  const [locking, setLocking] = useState(false);

  // Add a customer to a sale that has none
  const [custOpen, setCustOpen] = useState(false);
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [custError, setCustError] = useState("");
  const [custSaving, setCustSaving] = useState(false);

  const o = order.data;
  const voided = o ? isVoidedOrder(o) : false;
  /* What is still due, computed once and read everywhere. It knows about
     refunded lines and forgiven balances, which `orderOutstanding` does not — a
     part-refunded order must not read as owing the refund. */
  const due = o ? orderDue(o) : 0;
  const canRefund = !!o && (o.status === "paid" || o.status === "partial" || o.status === "partly_refunded") && o.lines.some((l) => l.unitPrice > 0 && (l.refundedQuantity ?? 0) < l.quantity);
  const canWriteOff = !!o && due > 0;
  const orderBookings = useMemo(
    () => (bookingsQ.data?.data ?? []).filter((b) => b.orderId === params.id && b.status === "confirmed"),
    [bookingsQ.data, params.id],
  );
  const products = useMemo(() => productsQ.data?.data ?? [], [productsQ.data]);
  const movable = orderBookings.filter((b) => (products.find((p) => p.id === b.productId)?.schedule?.capacityPerSession ?? 0) > 0);

  const customer = o?.customerId ? resolveCustomer(o.customerId) : undefined;
  const stats = o?.customerId && customer ? customerStats(o.customerId) : undefined;

  const moveProduct = products.find((p) => p.id === moveFor?.productId);
  const moveSlots = moveFor && moveProduct && moveDate ? getSlots(moveProduct, moveDate) : [];

  if (!order.loading && (order.error || !order.data)) {
    return (
      <PageShell title={t("order")}>
        <EmptyState title={t("orderNotFound")} action={<Button onClick={() => router.push("/orders")}>{t("backToOrders")}</Button>} />
      </PageShell>
    );
  }

  const refundTotal = o ? o.lines.filter((l) => refundLines[l.id]).reduce((s, l) => s + (l.total ?? l.unitPrice * l.quantity) - (l.refundedAmount ?? 0), 0) : 0;
  const woMinor = parseTaka(woAmount);
  const woOver = woMinor !== null && woMinor > due;

  const doRefund = async () => {
    if (!o) return;
    const ids = Object.keys(refundLines).filter((id) => refundLines[id]);
    setRefunding(true);
    const res = await refundOrderLines(o.id, ids, refundReason.trim());
    setRefunding(false);
    setRefundOpen(false);
    setRefundLines({});
    setRefundReason("");
    if (res.ok) {
      toast.success(t("refunded", { amount: formatMoney(refundTotal) }));
      order.reload();
    } else toast.error(res.error.message);
  };

  const doWriteOff = async () => {
    if (!o || woMinor === null || woMinor <= 0 || woOver) return;
    setWoSaving(true);
    const res = await writeOffOrder(o.id, woMinor, woCategory, woReason.trim());
    setWoSaving(false);
    setWoOpen(false);
    setWoAmount("");
    setWoReason("");
    if (res.ok) {
      toast.success(t("wroteOff", { amount: formatMoney(woMinor) }));
      order.reload();
    } else toast.error(res.error.message);
  };

  /* Collecting happens in the Money card, not in a dialog. It returns whether
     the money was taken, so the card knows whether to stay as it is. */
  const collect = async (method: PaymentMethod, amount: number): Promise<boolean> => {
    if (!o) return false;
    const res = await addOrderPayment(o.id, method, amount, ACTOR);
    if (res.ok) {
      toast.success(t("tookPayment", { amount: formatMoney(amount) }));
      order.reload();
      return true;
    }
    toast.error(res.error.message);
    return false;
  };

  const jumpToCollect = () => {
    const el = document.getElementById("collect-amount");
    el?.scrollIntoView({ block: "center" });
    el?.focus({ preventScroll: true });
  };

  const resend = async (how: "email" | "sms") => {
    if (!o) return;
    await logOrderAction(o.id, `Ticket re-sent by ${how === "email" ? "email" : "SMS"}`);
    setResendOpen(false);
    toast.success(how === "email" ? t("resendQueued") : t("resendQueuedSms"));
    order.reload();
  };

  const openMove = (b: Booking) => {
    setMoveFor(b);
    setMoveDate(b.slotStart.slice(0, 10));
    setMoveTime("");
  };

  const doMove = async () => {
    if (!moveFor || !moveProduct || !moveDate || !moveTime) return;
    const slot = moveSlots.find((s) => s.time === moveTime);
    if (slot && slot.remaining < moveFor.partySize) {
      toast.error(t("moveTooTight", { count: slot.remaining, time: formatClock(moveTime), size: moveFor.partySize }));
      return;
    }
    const iso = `${moveDate}T${moveTime}:00+06:00`;
    const res = await rescheduleBooking(moveFor.id, iso);
    if (res.ok) {
      await logOrderAction(params.id, `Moved ${moveProduct.name} to ${moveDate} ${formatClock(moveTime)}`);
      toast.success(t("moved", { date: formatDay(moveDate, { weekday: true }), time: formatClock(moveTime) }));
      setMoveFor(null);
      bookingsQ.reload();
      order.reload();
    } else toast.error(res.error.message);
  };

  const addNote = async (text: string) => {
    if (!o) return;
    await addOrderNote(o.id, text, ACTOR);
    order.reload();
  };

  const openAddCustomer = () => {
    setCustName(o?.customerName ?? "");
    setCustPhone("");
    setCustEmail("");
    setCustError("");
    setCustOpen(true);
  };

  const doAddCustomer = async () => {
    if (!o) return;
    if (!custName.trim()) {
      setCustError(t("cust.nameRequired"));
      return;
    }
    setCustSaving(true);
    const found = await matchOrCreateCustomer({ name: custName.trim(), phone: custPhone.trim() || null, email: custEmail.trim() || null });
    if (!found.ok) {
      setCustSaving(false);
      setCustError(found.error.fieldErrors?.name ?? found.error.message);
      return;
    }
    const res = await attachOrderCustomer(o.id, { id: found.data.id, name: found.data.name }, ACTOR);
    setCustSaving(false);
    if (res.ok) {
      toast.success(t("cust.added", { name: found.data.name }));
      setCustOpen(false);
      order.reload();
    } else toast.error(res.error.message);
  };

  /* The menu: what you do to an order that is not the next thing to do. The
     two that move money, and the one that forgives it, sit apart and in danger. */
  const menu: ActionMenuItem[] = o
    ? [
        { key: "tickets", label: t("printTickets"), icon: <Printer size={14} strokeWidth={1.5} />, onSelect: () => router.push(`/print/tickets/${o.id}`) },
        { key: "resend", label: t("resendTicket"), icon: <Send size={14} strokeWidth={1.5} />, onSelect: () => setResendOpen(true) },
        ...(movable.length > 0
          ? [
              {
                key: "move",
                label: t("changeDateAction"),
                icon: <CalendarClock size={14} strokeWidth={1.5} />,
                onSelect: () => (movable.length === 1 ? openMove(movable[0]) : document.getElementById("order-reservations")?.scrollIntoView({ block: "start" })),
              },
            ]
          : []),
        ...(canRefund ? [{ key: "refund", label: t("refundAction"), icon: <RotateCcw size={14} strokeWidth={1.5} />, destructive: true, separated: true, onSelect: () => setRefundOpen(true) }] : []),
        ...(canWriteOff ? [{ key: "writeoff", label: t("writeOffAction"), destructive: true, separated: !canRefund, onSelect: () => { setWoAmount((due / 100).toFixed(2)); setWoOpen(true); } }] : []),
      ]
    : [];

  return (
    <PageShell
      title={o ? t("orderTitle", { reference: o.reference }) : t("order")}
      back={{ href: "/orders", label: t("backOrders") }}
      status={
        o ? (
          <span className="flex flex-wrap items-center gap-tight">
            <StatusPill status={o.status} />
            {o.source && (
              <span className="inline-flex items-center gap-inline text-[13px] text-muted">
                <MarketBadge id={o.source.marketplaceId} />
                {o.source.marketplaceName}
              </span>
            )}
          </span>
        ) : undefined
      }
      actions={
        o ? (
          /* One primary per screen. Collecting what is owed is the only action
             that is ever urgent, and its button — the only ember one — is in the
             Money card. From xl that card is beside the content, so the header
             does not say it twice. Below xl the card sits further down the page,
             so the header offers a plain button that takes you to its amount
             field; it is not a second primary. */
          <div className="flex flex-wrap items-center gap-tight">
            {due > 0 && !voided && !beside && (
              <Button variant="secondary" icon={<Wallet size={16} strokeWidth={1.5} />} onClick={jumpToCollect}>
                {t("collectPayment")}
              </Button>
            )}
            {/* Words from a tablet up; on a phone the printer alone, so the primary
                and the menu fit on one line beside it. Named for a screen reader either way. */}
            <Button variant="secondary" icon={<Printer size={16} strokeWidth={1.5} />} onClick={() => router.push(`/print/receipt/${o.id}`)} aria-label={t("printReceipt")} className="max-sm:w-11 max-sm:px-0">
              <span className="max-sm:sr-only">{t("printReceipt")}</span>
            </Button>
            <ActionMenu label={t("moreActions")} items={menu} />
          </div>
        ) : undefined
      }
    >
      {o && (
        <div className="mb-section">
          <RefundRequests orderId={o.id} onDecided={() => { order.reload(); bookingsQ.reload(); ticketsQ.reload(); }} />
        </div>
      )}

      {!o ? (
        <div aria-busy="true" className="flex animate-pulse flex-col gap-tight"><div className="h-4 w-1/3 rounded-xs bg-line" /><div className="h-4 w-2/3 rounded-xs bg-line" /><div className="h-4 w-1/2 rounded-xs bg-line" /></div>
      ) : phone ? (
        /* On a phone: how much, what state, who, when — then the lines — and
           everything else under "Show more". The Money card comes first only
           while there is something to collect, because that is when its form
           is the next thing to do; paid in full, it is one of the folded
           details. */
        <div className="flex flex-col gap-section pb-hero">
          <KeyFacts o={o} due={due} dir={dir} labels={L} />
          {due > 0 && !voided && <MoneyCard o={o} due={due} methods={methods} onCollect={collect} hideLead />}
          <Section title={t("cardItems")} id="order-items">
            <OrderLinesDetail order={o} hidePayments />
          </Section>
          <ShowMore>
            <div className="flex flex-col gap-section">
              {!(due > 0 && !voided) && <MoneyCard o={o} due={due} methods={methods} onCollect={collect} />}
              <FactsCard o={o} dir={dir} labels={L} due={due} />
              <CustomerCard o={o} customer={customer} stats={stats} onAdd={openAddCustomer} />
              <ReservationsCard bookings={orderBookings} products={products} actor={ACTOR} onMove={openMove} onLock={(b) => setLockFor(b)} />
              <PaymentsCard o={o} />
              <TicketsCard tickets={ticketsQ.data?.data ?? []} loading={ticketsQ.loading && !ticketsQ.data} />
              <WriteOffsCard o={o} />
              <HistoryCard o={o} />
              <NotesCard o={o} onAdd={addNote} />
            </div>
          </ShowMore>
        </div>
      ) : (
        <div className="flex flex-col gap-section pb-hero xl:grid xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
          {/* The sale. `contents` below xl, so on a phone its cards join the
              rail's in one column, in the order their `order-*` says. */}
          <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-section">
            <FactsCard o={o} dir={dir} labels={L} due={due} className="order-1" />
            <Section title={t("cardItems")} className="order-4" id="order-items">
              <OrderLinesDetail order={o} hidePayments />
            </Section>
            <ReservationsCard bookings={orderBookings} products={products} actor={ACTOR} onMove={openMove} onLock={(b) => setLockFor(b)} className="order-5" />
            <PaymentsCard o={o} className="order-6" />
            <HistoryCard o={o} className="order-9" />
          </div>

          {/* The money and the people. */}
          <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-section">
            <MoneyCard o={o} due={due} methods={methods} onCollect={collect} className="order-2" />
            <CustomerCard o={o} customer={customer} stats={stats} onAdd={openAddCustomer} className="order-3" />
            <WriteOffsCard o={o} className="order-7" />
            <TicketsCard tickets={ticketsQ.data?.data ?? []} loading={ticketsQ.loading && !ticketsQ.data} className="order-8" />
            <NotesCard o={o} onAdd={addNote} className="order-10" />
          </div>
        </div>
      )}

      {/* Per-line refund with a reason. */}
      <Modal
        open={refundOpen}
        onClose={() => setRefundOpen(false)}
        title={t("refundModalTitle")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRefundOpen(false)}>{t("cancel")}</Button>
            <Button variant="destructive" loading={refunding} disabled={refundTotal <= 0 || !refundReason.trim()} onClick={doRefund}>
              {t("refundButton", { amount: refundTotal > 0 ? formatMoney(refundTotal) : "" })}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-tight">
          {(o?.lines ?? []).filter((l) => l.unitPrice > 0 && (l.refundedQuantity ?? 0) < l.quantity).map((l) => (
            <label key={l.id} className="flex min-h-11 cursor-pointer items-center gap-tight rounded-sm border border-line p-comfortable text-sm">
              <input type="checkbox" checked={!!refundLines[l.id]} onChange={(e) => setRefundLines((r) => ({ ...r, [l.id]: e.target.checked }))} className="h-4 w-4 accent-[var(--color-ember)]" />
              <span className="min-w-0 flex-1 truncate">{l.parentLineId ? "↳ " : ""}{l.productName} · {l.tierName} ×{l.quantity}</span>
              <span className="tabular-nums text-[13px]">{formatMoney(l.total ?? l.unitPrice * l.quantity)}</span>
            </label>
          ))}
        </div>
        <FormField className="mt-section" label={t("reasonLabel")} placeholder={t("reasonPlaceholder")} value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
        <p className="mt-tight text-[12px] text-muted">{t("refundNote")}</p>
      </Modal>

      {/* Write off a balance — not a refund; clears what's owed with a reason.
          It cannot forgive more than is owed, and says so. */}
      <Modal
        open={woOpen}
        onClose={() => setWoOpen(false)}
        title={t("writeOffTitle")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setWoOpen(false)}>{t("cancel")}</Button>
            <Button variant="destructive" loading={woSaving} disabled={woMinor === null || woMinor <= 0 || woOver} onClick={doWriteOff}>{t("writeOffConfirm")}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-section">
          <FormField
            label={t("writeOffAmount")}
            inputMode="decimal"
            value={woAmount}
            onChange={(e) => setWoAmount(e.target.value)}
            help={due > 0 ? t("writeOffAmountHelp", { amount: formatMoney(due) }) : undefined}
            error={woOver ? t("writeOffOver", { due: formatMoney(due) }) : undefined}
          />
          <FormField label={t("writeOffCategory")} variant="select" value={woCategory} onChange={(e) => setWoCategory(e.target.value as WriteOffCategory)} options={[
            { value: "uncollectible", label: t("woUncollectible") },
            { value: "customer_dispute", label: t("woCustomerDispute") },
            { value: "business_decision", label: t("woBusinessDecision") },
            { value: "administrative", label: t("woAdministrative") },
          ]} />
          <FormField label={t("writeOffReason")} placeholder={t("writeOffReasonPlaceholder")} value={woReason} onChange={(e) => setWoReason(e.target.value)} />
        </div>
      </Modal>

      {/* Resend the ticket. */}
      <Modal open={resendOpen} onClose={() => setResendOpen(false)} title={t("resendModalTitle")}>
        <p className="mb-section text-[13px] text-muted">{o?.customerName ? t("resendToCustomer", { name: o.customerName }) : t("resendModalBody")}</p>
        <div className="grid grid-cols-2 gap-tight">
          <Button variant="secondary" className="h-12" onClick={() => resend("email")}>{t("byEmail")}</Button>
          <Button variant="secondary" className="h-12" onClick={() => resend("sms")}>{t("bySms")}</Button>
        </div>
      </Modal>

      {/* Add a customer to a sale that has none. If the phone or email is
          already on file, that person is used rather than a duplicate made. */}
      <Modal
        open={custOpen}
        onClose={() => setCustOpen(false)}
        title={t("cust.modalTitle")}
        description={t("cust.modalHelp")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCustOpen(false)}>{t("cancel")}</Button>
            <Button loading={custSaving} onClick={() => void doAddCustomer()}>{t("cust.save")}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-section">
          <FormField label={t("cust.name")} value={custName} onChange={(e) => { setCustName(e.target.value); setCustError(""); }} error={custError || undefined} autoComplete="off" />
          <FormField label={t("cust.phone")} value={custPhone} inputMode="tel" onChange={(e) => setCustPhone(e.target.value)} autoComplete="off" />
          <FormField label={t("cust.email")} variant="email" value={custEmail} onChange={(e) => setCustEmail(e.target.value)} autoComplete="off" />
        </div>
      </Modal>

      {/* Lock / unlock a booking (§61.7, §61.8). Unlocking always takes a
          reason, so the record says who overrode what. */}
      <Modal
        open={!!lockFor}
        onClose={() => { setLockFor(null); setLockReason(""); }}
        title={lockFor?.lockedAt ? t("unlockTitle") : t("lockTitle")}
        description={lockFor?.lockedAt ? t("unlockDescription") : t("lockDescription")}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setLockFor(null); setLockReason(""); }}>{t("cancel")}</Button>
            <Button
              loading={locking}
              onClick={async () => {
                if (!lockFor) return;
                setLocking(true);
                const res = lockFor.lockedAt
                  ? await unlockBooking(lockFor.id, ACTOR, lockReason)
                  : await lockBooking(lockFor.id, ACTOR, lockReason);
                setLocking(false);
                if (!res.ok) { toast.error(res.error.fieldErrors?.reason ?? res.error.message); return; }
                toast.success(lockFor.lockedAt ? t("unlocked") : t("locked"));
                setLockFor(null);
                setLockReason("");
                order.reload();
                bookingsQ.reload();
              }}
            >
              {lockFor?.lockedAt ? t("unlockBooking") : t("lockBooking")}
            </Button>
          </>
        }
      >
        <FormField
          label={lockFor?.lockedAt ? t("unlockReason") : t("lockReason")}
          variant="textarea"
          rows={3}
          value={lockReason}
          onChange={(e) => setLockReason(e.target.value)}
          help={lockFor?.lockedAt ? t("unlockReasonHelp") : t("lockReasonHelp")}
        />
      </Modal>

      {/* Change date/time — availability is re-checked before the move. */}
      <Modal
        open={!!moveFor}
        onClose={() => setMoveFor(null)}
        title={t("moveModalTitle", { product: moveProduct?.name ?? t("booking") })}
        footer={
          <>
            <Button variant="secondary" onClick={() => setMoveFor(null)}>{t("cancel")}</Button>
            <Button disabled={!moveDate || !moveTime} onClick={doMove}>{t("moveBooking")}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-section">
          <FormField label={t("newDate")} variant="date" value={moveDate} onChange={(e) => { setMoveDate(e.target.value); setMoveTime(""); }} />
          {moveDate && (
            moveSlots.length === 0 ? (
              <p className="text-[13px] text-muted">{t("noSessionsOnDay")}</p>
            ) : (
              <div className="grid grid-cols-4 gap-tight">
                {moveSlots.map((s) => {
                  const fits = s.remaining >= (moveFor?.partySize ?? 1) || s.time === moveFor?.slotStart.slice(11, 16);
                  return (
                    <button
                      key={s.time}
                      type="button"
                      disabled={!fits}
                      onClick={() => setMoveTime(s.time)}
                      className={`flex h-12 flex-col items-center justify-center rounded-sm border text-[13px] tabular-nums ${moveTime === s.time ? "border-inverse bg-inverse text-inverse-fg" : fits ? "border-line bg-card" : "border-line bg-subtle text-muted line-through"}`}
                    >
                      <span className="whitespace-nowrap">{formatClock(s.time)}</span>
                      <span className="text-[12px]">{fits ? t("slotLeft", { count: s.remaining }) : t("slotFull")}</span>
                    </button>
                  );
                })}
              </div>
            )
          )}
          <p className="text-[12px] text-muted">{t("moveNote", { size: moveFor?.partySize ?? 1 })}</p>
        </div>
      </Modal>
    </PageShell>
  );
}
