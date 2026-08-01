"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CalendarClock, RotateCcw, Send } from "lucide-react";
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
  type Booking,
} from "@/lib/api";
import { formatDateTime, formatMoney } from "@/lib/format";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-line bg-card p-major">
      <h2 className="type-label mb-section text-[12px] text-muted">{title}</h2>
      {children}
    </div>
  );
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
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

  const moveProduct = productsQ.data?.data.find((p) => p.id === moveFor?.productId);
  const moveSlots = moveFor && moveProduct && moveDate ? getSlots(moveProduct, moveDate) : [];

  if (!order.loading && (order.error || !order.data)) {
    return (
      <PageShell title="Order">
        <EmptyState title="Order not found" action={<Button onClick={() => router.push("/orders")}>Back to orders</Button>} />
      </PageShell>
    );
  }

  const refundTotal = o ? o.lines.filter((l) => refundLines[l.id]).reduce((s, l) => s + l.unitPrice * l.quantity, 0) : 0;

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
      toast.success(`Refunded ${formatMoney(refundTotal)}. Slot capacity release is handled by the backend.`);
      order.reload();
    } else toast.error(res.error.message);
  };

  const resend = async (how: "email" | "sms") => {
    if (!o) return;
    await logOrderAction(o.id, `Ticket re-sent by ${how === "email" ? "email" : "SMS"}`);
    setResendOpen(false);
    toast.success(how === "email" ? "Ticket emailed again." : "Ticket re-sent by SMS.");
    order.reload();
  };

  const doMove = async () => {
    if (!moveFor || !moveProduct || !moveDate || !moveTime) return;
    const slot = moveSlots.find((s) => s.time === moveTime);
    if (slot && slot.remaining < moveFor.partySize) {
      toast.error(`Only ${slot.remaining} left at ${moveTime} — party of ${moveFor.partySize} won't fit.`);
      return;
    }
    const iso = `${moveDate}T${moveTime}:00+06:00`;
    const res = await rescheduleBooking(moveFor.id, iso);
    if (res.ok) {
      await logOrderAction(params.id, `Moved ${moveProduct.name} to ${moveDate} ${moveTime}`);
      toast.success(`Moved to ${moveDate} at ${moveTime}.`);
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
      title={o?.reference ?? "Order"}
      actions={
        o ? (
          <div className="flex items-center gap-tight">
            <StatusPill status={o.status} />
            <Button variant="secondary" icon={<Send size={16} strokeWidth={1.5} />} onClick={() => setResendOpen(true)}>
              Resend ticket
            </Button>
            {canRefund && (
              <Button variant="secondary" icon={<RotateCcw size={16} strokeWidth={1.5} />} onClick={() => setRefundOpen(true)}>
                Refund…
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      <Link href="/orders" className="mb-section inline-flex items-center gap-inline text-[13px] text-faint hover:text-fg">
        <ArrowLeft size={14} strokeWidth={1.5} /> Orders
      </Link>

      {order.loading || !o ? (
        <div aria-busy="true" className="flex animate-pulse flex-col gap-tight"><div className="h-4 w-1/3 rounded-xs bg-line" /><div className="h-4 w-2/3 rounded-xs bg-line" /><div className="h-4 w-1/2 rounded-xs bg-line" /></div>
      ) : (
        <div className="flex flex-col gap-section pb-hero">
          <div className="grid gap-section sm:grid-cols-3">
            <Card title="Placed">
              <p className="text-sm">{formatDateTime(o.createdAt)}</p>
              <p className="mt-inline font-mono text-[12px] text-faint">{o.channel}{o.customerName ? ` · ${o.customerName}` : ""}</p>
            </Card>
            <Card title="Total">
              <p className="font-mono text-2xl">{formatMoney(o.total)}</p>
            </Card>
            <Card title="Paid">
              <p className="font-mono text-2xl">{formatMoney(o.payments.reduce((s, p) => s + p.amount, 0))}</p>
            </Card>
          </div>

          <Card title="Items">
            <table className="w-full text-sm">
              <tbody>
                {o.lines.map((l) => (
                  <tr key={l.id} className="border-b border-line last:border-0">
                    <td className="py-tight">
                      <div className="font-medium">{l.productName}</div>
                      <div className="font-mono text-[11px] text-faint">{l.tierName}</div>
                    </td>
                    <td className="py-tight text-center font-mono text-[13px]">×{l.quantity}</td>
                    <td className="py-tight text-right font-mono text-[13px]">{formatMoney(l.unitPrice * l.quantity)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td className="pt-tight text-muted" colSpan={2}>Subtotal</td><td className="pt-tight text-right font-mono">{formatMoney(o.subtotal)}</td></tr>
                <tr><td className="text-muted" colSpan={2}>Tax</td><td className="text-right font-mono">{formatMoney(o.tax)}</td></tr>
                <tr><td className="font-medium" colSpan={2}>Total</td><td className="text-right font-mono font-medium">{formatMoney(o.total)}</td></tr>
              </tfoot>
            </table>
          </Card>

          {orderBookings.length > 0 && (
            <Card title="Bookings">
              {orderBookings.map((b) => {
                const p = productsQ.data?.data.find((x) => x.id === b.productId);
                return (
                  <div key={b.id} className="flex items-center gap-section border-b border-line py-tight text-sm last:border-0">
                    <span className="min-w-0 flex-1 truncate">{p?.name ?? b.productId}</span>
                    <span className="font-mono text-[12px] text-muted">{b.slotStart.slice(0, 10)} {b.slotStart.slice(11, 16)} · party {b.partySize}</span>
                    {p?.schedule && (p.schedule.capacityPerSession ?? 0) > 0 && (
                      <Button size="sm" variant="secondary" icon={<CalendarClock size={14} strokeWidth={1.5} />} onClick={() => { setMoveFor(b); setMoveDate(b.slotStart.slice(0, 10)); setMoveTime(""); }}>
                        Change date/time
                      </Button>
                    )}
                  </div>
                );
              })}
            </Card>
          )}

          <div className="grid gap-section sm:grid-cols-2">
            <Card title="Payments">
              {o.payments.length === 0 ? (
                <p className="text-[13px] text-faint">No payments recorded.</p>
              ) : (
                o.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between border-b border-line py-tight text-sm last:border-0">
                    <span className="font-mono text-[12px] text-muted">{p.method}{p.amount < 0 ? " · refund" : ""}</span>
                    <span className={`font-mono text-[13px] ${p.amount < 0 ? "text-danger" : ""}`}>{formatMoney(p.amount)}</span>
                  </div>
                ))
              )}
            </Card>
            <Card title={`Tickets (${ticketsQ.data?.data.length ?? 0})`}>
              {ticketsQ.loading ? (
                <div aria-busy="true" className="flex animate-pulse flex-col gap-tight"><div className="h-4 w-1/3 rounded-xs bg-line" /><div className="h-4 w-2/3 rounded-xs bg-line" /></div>
              ) : (ticketsQ.data?.data.length ?? 0) === 0 ? (
                <p className="text-[13px] text-faint">No tickets issued.</p>
              ) : (
                ticketsQ.data!.data.map((t) => (
                  <div key={t.id} className="flex items-center justify-between border-b border-line py-tight text-sm last:border-0">
                    <span className="font-mono text-[12px]">{t.code}</span>
                    <StatusPill status={t.status === "issued" ? "confirmed" : t.status === "redeemed" ? "active" : "void"}>{t.status}</StatusPill>
                  </div>
                ))
              )}
            </Card>
          </div>

          <div className="grid gap-section sm:grid-cols-2">
            <Card title="History">
              {(o.history ?? []).length === 0 ? (
                <p className="text-[13px] text-faint">No changes since the sale.</p>
              ) : (
                [...(o.history ?? [])].reverse().map((h, i) => (
                  <div key={i} className="border-b border-line py-tight text-[13px] last:border-0">
                    <p>{h.text}</p>
                    <p className="mt-inline font-mono text-[11px] text-faint">{formatDateTime(h.at)} · {h.who}</p>
                  </div>
                ))
              )}
            </Card>
            <Card title="Internal notes">
              {(o.notes ?? []).length === 0 ? (
                <p className="mb-tight text-[13px] text-faint">Nothing noted yet — guests never see these.</p>
              ) : (
                [...(o.notes ?? [])].reverse().map((n, i) => (
                  <div key={i} className="border-b border-line py-tight text-[13px] last:border-0">
                    <p>{n.text}</p>
                    <p className="mt-inline font-mono text-[11px] text-faint">{formatDateTime(n.at)} · {n.who}</p>
                  </div>
                ))
              )}
              <div className="mt-tight flex gap-tight">
                <input value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()} placeholder="Add a note…" className="h-9 min-w-0 flex-1 rounded-sm border border-line bg-card px-comfortable text-sm outline-none focus:border-inverse" />
                <Button size="sm" variant="secondary" disabled={!noteDraft.trim()} onClick={addNote}>Add</Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Per-line refund with a reason. */}
      <Modal
        open={refundOpen}
        onClose={() => setRefundOpen(false)}
        title="Refund lines"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRefundOpen(false)}>Cancel</Button>
            <Button variant="destructive" loading={refunding} disabled={refundTotal <= 0 || !refundReason.trim()} onClick={doRefund}>
              Refund {refundTotal > 0 ? formatMoney(refundTotal) : ""}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-tight">
          {(o?.lines ?? []).filter((l) => l.unitPrice > 0).map((l) => (
            <label key={l.id} className="flex cursor-pointer items-center gap-tight rounded-sm border border-line p-comfortable text-sm">
              <input type="checkbox" checked={!!refundLines[l.id]} onChange={(e) => setRefundLines((r) => ({ ...r, [l.id]: e.target.checked }))} className="h-4 w-4 accent-[var(--color-ember)]" />
              <span className="min-w-0 flex-1 truncate">{l.productName} · {l.tierName} ×{l.quantity}</span>
              <span className="font-mono text-[13px]">{formatMoney(l.unitPrice * l.quantity)}</span>
            </label>
          ))}
        </div>
        <FormField className="mt-section" label="Reason" placeholder="Rained out / guest request / double charge" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
        <p className="mt-tight text-[12px] text-faint">Refunding voids the matching tickets. Releasing held capacity back to sale is handled by the backend.</p>
      </Modal>

      {/* Resend the ticket. */}
      <Modal open={resendOpen} onClose={() => setResendOpen(false)} title="Resend the ticket">
        <p className="mb-section text-[13px] text-muted">Sends every ticket on this order again{o?.customerName ? ` to ${o.customerName}` : ""}.</p>
        <div className="grid grid-cols-2 gap-tight">
          <Button variant="secondary" className="h-12" onClick={() => resend("email")}>By email</Button>
          <Button variant="secondary" className="h-12" onClick={() => resend("sms")}>By SMS</Button>
        </div>
      </Modal>

      {/* Change date/time — availability is re-checked before the move. */}
      <Modal
        open={!!moveFor}
        onClose={() => setMoveFor(null)}
        title={`Move ${moveProduct?.name ?? "booking"}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setMoveFor(null)}>Cancel</Button>
            <Button disabled={!moveDate || !moveTime} onClick={doMove}>Move booking</Button>
          </>
        }
      >
        <div className="flex flex-col gap-section">
          <FormField label="New date" variant="date" value={moveDate} onChange={(e) => { setMoveDate(e.target.value); setMoveTime(""); }} />
          {moveDate && (
            moveSlots.length === 0 ? (
              <p className="text-[13px] text-faint">No sessions run on that day.</p>
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
                      <span className="text-[10px]">{fits ? `${s.remaining} left` : "FULL"}</span>
                    </button>
                  );
                })}
              </div>
            )
          )}
          <p className="text-[12px] text-faint">Party of {moveFor?.partySize} — only sessions with room are selectable.</p>
        </div>
      </Modal>
    </PageShell>
  );
}
