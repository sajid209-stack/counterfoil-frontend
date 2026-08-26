"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, CalendarClock, Printer, RotateCcw, Send } from "lucide-react";
import {
  Button,
  EmptyState,
  FormField,
  Modal,
  PageShell,
  StatusPill,
  useToast,
} from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import {
  getOrder,
  getSlots,
  listBookings,
  listProducts,
  listTickets,
  logOrderAction,
  addOrderNote,
  refundOrderLines,
  rescheduleBooking,
  writeOffOrder,
  type Booking,
  type WriteOffCategory,
} from "@/lib/api";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useEnumLabels } from "@/lib/labels";
import { OrderLinesDetail } from "@/components/OrderLinesDetail";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-surface p-major">
      <h2 className="type-label mb-section text-[12px] text-muted">{title}</h2>
      {children}
    </div>
  );
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("orders");
  const enumL = useEnumLabels();
  const toast = useToast();
  const order = useApiQuery(() => getOrder(params.id), [params.id]);
  const ticketsQ = useApiQuery(() => listTickets({ pageSize: 100, filters: { orderId: params.id } }), [params.id]);
  const bookingsQ = useApiQuery(() => listBookings({ pageSize: 1000 }), []);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100 }), []);

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

  // Change date/time
  const [moveFor, setMoveFor] = useState<Booking | null>(null);
  const [moveDate, setMoveDate] = useState("");
  const [moveTime, setMoveTime] = useState("");

  // Notes
  const [noteDraft, setNoteDraft] = useState("");

  const o = order.data;
  const canRefund = o && (o.status === "paid" || o.status === "partial");
  const orderBookings = useMemo(
    () => (bookingsQ.data?.data ?? []).filter((b) => b.orderId === params.id && b.status === "confirmed"),
    [bookingsQ.data, params.id],
  );

  const channelLabel = (c: string) => (c === "counter" ? t("channelCounter") : c === "online" ? t("channelOnline") : c);

  const moveProduct = productsQ.data?.data.find((p) => p.id === moveFor?.productId);
  const moveSlots = moveFor && moveProduct && moveDate ? getSlots(moveProduct, moveDate) : [];

  if (!order.loading && (order.error || !order.data)) {
    return (
      <PageShell title={t("order")}>
        <EmptyState title={t("orderNotFound")} action={<Button onClick={() => router.push("/orders")}>{t("backToOrders")}</Button>} />
      </PageShell>
    );
  }

  const refundTotal = o ? o.lines.filter((l) => refundLines[l.id]).reduce((s, l) => s + (l.total ?? l.unitPrice * l.quantity) - (l.refundedAmount ?? 0), 0) : 0;

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
    if (!o) return;
    const minor = Math.round((parseFloat(woAmount) || 0) * 100);
    if (minor <= 0) return;
    setWoSaving(true);
    const res = await writeOffOrder(o.id, minor, woCategory, woReason.trim());
    setWoSaving(false);
    setWoOpen(false);
    setWoAmount(""); setWoReason("");
    if (res.ok) { toast.success(t("wroteOff", { amount: formatMoney(minor) })); order.reload(); }
    else toast.error(res.error.message);
  };

  const resend = async (how: "email" | "sms") => {
    if (!o) return;
    await logOrderAction(o.id, `Ticket re-sent by ${how === "email" ? "email" : "SMS"}`);
    setResendOpen(false);
    toast.success(how === "email" ? t("resendQueued") : t("resendQueuedSms"));
    order.reload();
  };

  const doMove = async () => {
    if (!moveFor || !moveProduct || !moveDate || !moveTime) return;
    const slot = moveSlots.find((s) => s.time === moveTime);
    if (slot && slot.remaining < moveFor.partySize) {
      toast.error(t("moveTooTight", { count: slot.remaining, time: moveTime, size: moveFor.partySize }));
      return;
    }
    const iso = `${moveDate}T${moveTime}:00+06:00`;
    const res = await rescheduleBooking(moveFor.id, iso);
    if (res.ok) {
      await logOrderAction(params.id, `Moved ${moveProduct.name} to ${moveDate} ${moveTime}`);
      toast.success(t("moved", { date: moveDate, time: moveTime }));
      setMoveFor(null);
      bookingsQ.reload();
      order.reload();
    } else toast.error(res.error.message);
  };

  const addNote = async () => {
    if (!o || !noteDraft.trim()) return;
    await addOrderNote(o.id, noteDraft.trim());
    setNoteDraft("");
    order.reload();
  };

  return (
    <PageShell
      title={o?.reference ?? t("order")}
      actions={
        o ? (
          <div className="flex items-center gap-tight">
            <StatusPill status={o.status} />
            <Button variant="secondary" icon={<Printer size={16} strokeWidth={1.5} />} onClick={() => router.push(`/print/tickets/${o.id}`)}>
              {t("printTickets")}
            </Button>
            <Button variant="secondary" icon={<Printer size={16} strokeWidth={1.5} />} onClick={() => router.push(`/print/receipt/${o.id}`)}>
              {t("printReceipt")}
            </Button>
            <Button variant="secondary" icon={<Send size={16} strokeWidth={1.5} />} onClick={() => setResendOpen(true)}>
              {t("resendTicket")}
            </Button>
            {canRefund && (
              <Button variant="secondary" icon={<RotateCcw size={16} strokeWidth={1.5} />} onClick={() => setRefundOpen(true)}>
                {t("refundAction")}
              </Button>
            )}
            {canRefund && (
              <Button variant="secondary" onClick={() => setWoOpen(true)}>
                {t("writeOffAction")}
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      <Link href="/orders" className="mb-section inline-flex items-center gap-inline text-[13px] text-faint hover:text-fg">
        <ArrowLeft size={14} strokeWidth={1.5} /> {t("backOrders")}
      </Link>

      {order.loading || !o ? (
        <div aria-busy="true" className="flex animate-pulse flex-col gap-tight"><div className="h-4 w-1/3 rounded-xs bg-line" /><div className="h-4 w-2/3 rounded-xs bg-line" /><div className="h-4 w-1/2 rounded-xs bg-line" /></div>
      ) : (
        <div className="flex flex-col gap-section pb-hero">
          <div className="grid gap-section sm:grid-cols-3">
            <Card title={t("cardPlaced")}>
              <p className="text-sm">{formatDateTime(o.createdAt)}</p>
              <p className="mt-inline font-mono text-[12px] text-faint">{channelLabel(o.channel)}{o.customerName ? ` · ${o.customerName}` : ""}</p>
            </Card>
            <Card title={t("cardTotal")}>
              <p className="font-mono text-2xl">{formatMoney(o.total)}</p>
            </Card>
            <Card title={t("cardPaid")}>
              <p className="font-mono text-2xl">{formatMoney(o.payments.reduce((s, p) => s + p.amount, 0))}</p>
            </Card>
          </div>

          <Card title={t("cardItems")}>
            <OrderLinesDetail order={o} />
          </Card>

          {orderBookings.length > 0 && (
            <Card title={t("cardBookings")}>
              {orderBookings.map((b) => {
                const p = productsQ.data?.data.find((x) => x.id === b.productId);
                return (
                  <div key={b.id} className="flex items-center gap-section border-b border-line py-tight text-sm last:border-0">
                    <span className="min-w-0 flex-1 truncate">{p?.name ?? b.productId}</span>
                    <span className="font-mono text-[12px] text-muted">{b.slotStart.slice(0, 10)} {b.slotStart.slice(11, 16)} · {t("party", { size: b.partySize })}</span>
                    {p?.schedule && (p.schedule.capacityPerSession ?? 0) > 0 && (
                      <Button size="sm" variant="secondary" icon={<CalendarClock size={14} strokeWidth={1.5} />} onClick={() => { setMoveFor(b); setMoveDate(b.slotStart.slice(0, 10)); setMoveTime(""); }}>
                        {t("changeDateTime")}
                      </Button>
                    )}
                  </div>
                );
              })}
            </Card>
          )}

          <div className="grid gap-section sm:grid-cols-2">
            <Card title={t("cardPayments")}>
              {o.payments.length === 0 ? (
                <p className="text-[13px] text-faint">{t("noPayments")}</p>
              ) : (
                o.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between border-b border-line py-tight text-sm last:border-0">
                    <span className="font-mono text-[12px] text-muted">{enumL.method(p.method)}{p.amount < 0 ? t("refundSuffix") : ""}</span>
                    <span className={`font-mono text-[13px] ${p.amount < 0 ? "text-danger" : ""}`}>{formatMoney(p.amount)}</span>
                  </div>
                ))
              )}
            </Card>
            <Card title={t("cardTickets", { count: ticketsQ.data?.data.length ?? 0 })}>
              {ticketsQ.loading ? (
                <div aria-busy="true" className="flex animate-pulse flex-col gap-tight"><div className="h-4 w-1/3 rounded-xs bg-line" /><div className="h-4 w-2/3 rounded-xs bg-line" /></div>
              ) : (ticketsQ.data?.data.length ?? 0) === 0 ? (
                <p className="text-[13px] text-faint">{t("noTickets")}</p>
              ) : (
                ticketsQ.data!.data.map((tk) => (
                  <div key={tk.id} className="flex items-center justify-between border-b border-line py-tight text-sm last:border-0">
                    <span className="font-mono text-[12px]">{tk.code}</span>
                    <StatusPill status={tk.status === "issued" ? "confirmed" : tk.status === "redeemed" ? "active" : "void"}>{enumL.status(tk.status)}</StatusPill>
                  </div>
                ))
              )}
            </Card>
          </div>

          <div className="grid gap-section sm:grid-cols-2">
            <Card title={t("cardHistory")}>
              {(o.history ?? []).length === 0 ? (
                <p className="text-[13px] text-faint">{t("noHistory")}</p>
              ) : (
                [...(o.history ?? [])].reverse().map((h, i) => (
                  <div key={i} className="border-b border-line py-tight text-[13px] last:border-0">
                    <p>{h.text}</p>
                    <p className="mt-inline font-mono text-[11px] text-faint">{formatDateTime(h.at)} · {h.who}</p>
                  </div>
                ))
              )}
            </Card>
            <Card title={t("cardNotes")}>
              {(o.notes ?? []).length === 0 ? (
                <p className="mb-tight text-[13px] text-faint">{t("noNotes")}</p>
              ) : (
                [...(o.notes ?? [])].reverse().map((n, i) => (
                  <div key={i} className="border-b border-line py-tight text-[13px] last:border-0">
                    <p>{n.text}</p>
                    <p className="mt-inline font-mono text-[11px] text-faint">{formatDateTime(n.at)} · {n.who}</p>
                  </div>
                ))
              )}
              <div className="mt-tight flex gap-tight">
                <input value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()} placeholder={t("addNotePlaceholder")} className="h-9 min-w-0 flex-1 rounded-sm border border-line bg-card px-comfortable text-sm outline-none focus:border-inverse" />
                <Button size="sm" variant="secondary" disabled={!noteDraft.trim()} onClick={addNote}>{t("add")}</Button>
              </div>
            </Card>
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
            <label key={l.id} className="flex cursor-pointer items-center gap-tight rounded-sm border border-line p-comfortable text-sm">
              <input type="checkbox" checked={!!refundLines[l.id]} onChange={(e) => setRefundLines((r) => ({ ...r, [l.id]: e.target.checked }))} className="h-4 w-4 accent-[var(--color-ember)]" />
              <span className="min-w-0 flex-1 truncate">{l.parentLineId ? "↳ " : ""}{l.productName} · {l.tierName} ×{l.quantity}</span>
              <span className="font-mono text-[13px]">{formatMoney(l.total ?? l.unitPrice * l.quantity)}</span>
            </label>
          ))}
        </div>
        <FormField className="mt-section" label={t("reasonLabel")} placeholder={t("reasonPlaceholder")} value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
        <p className="mt-tight text-[12px] text-faint">{t("refundNote")}</p>
      </Modal>

      {/* Write off a balance — not a refund; clears what's owed with a reason. */}
      <Modal
        open={woOpen}
        onClose={() => setWoOpen(false)}
        title={t("writeOffTitle")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setWoOpen(false)}>{t("cancel")}</Button>
            <Button variant="destructive" loading={woSaving} disabled={!(parseFloat(woAmount) > 0)} onClick={doWriteOff}>{t("writeOffConfirm")}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-section">
          <FormField label={t("writeOffAmount")} variant="number" value={woAmount} onChange={(e) => setWoAmount(e.target.value)} />
          <FormField label={t("writeOffCategory")} variant="select" value={woCategory} onChange={(e) => setWoCategory(e.target.value as WriteOffCategory)} options={[
            { value: "uncollectible", label: t("woUncollectible") },
            { value: "customer_dispute", label: t("woCustomerDispute") },
            { value: "business_decision", label: t("woBusinessDecision") },
            { value: "administrative", label: t("woAdministrative") },
          ]} />
          <FormField label={t("writeOffReason")} placeholder={t("reasonPlaceholder")} value={woReason} onChange={(e) => setWoReason(e.target.value)} />
        </div>
      </Modal>

      {/* Resend the ticket. */}
      <Modal open={resendOpen} onClose={() => setResendOpen(false)} title={t("resendModalTitle")}>
        <p className="mb-section text-[13px] text-muted">{t("resendModalBody", { customer: o?.customerName ? t("resendToCustomer", { name: o.customerName }) : "" })}</p>
        <div className="grid grid-cols-2 gap-tight">
          <Button variant="secondary" className="h-12" onClick={() => resend("email")}>{t("byEmail")}</Button>
          <Button variant="secondary" className="h-12" onClick={() => resend("sms")}>{t("bySms")}</Button>
        </div>
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
              <p className="text-[13px] text-faint">{t("noSessionsOnDay")}</p>
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
                      className={`flex h-12 flex-col items-center justify-center rounded-sm border font-mono text-[13px] ${moveTime === s.time ? "border-inverse bg-inverse text-inverse-fg" : fits ? "border-line bg-card" : "border-line bg-subtle text-faint"}`}
                    >
                      {s.time}
                      <span className="text-[10px]">{fits ? t("slotLeft", { count: s.remaining }) : t("slotFull")}</span>
                    </button>
                  );
                })}
              </div>
            )
          )}
          <p className="text-[12px] text-faint">{t("moveNote", { size: moveFor?.partySize ?? 1 })}</p>
        </div>
      </Modal>
    </PageShell>
  );
}
