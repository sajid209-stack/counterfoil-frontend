"use client";
import { useState } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { ArrowRight, CalendarClock, Inbox, RotateCcw } from "lucide-react";
import { Button, Modal, controlClass, useToast } from "@/components/ui";
import { formatClockRange, formatDay, formatMoney, formatClock } from "@/lib/format";
import {
  approveRefundRequest,
  declineRefundRequest,
  pendingRefundRequests,
  type RefundRequest,
} from "@/lib/api/refundRequests";
import {
  approveRescheduleRequest,
  declineRescheduleRequest,
  pendingRescheduleRequests,
  useRescheduleVersion,
  type RescheduleRequest,
} from "@/lib/api/rescheduleRequests";

/**
 * Requests from the counter, waiting for a manager — to refund a booking, or to
 * move it to another day or time.
 *
 * A cashier asks; this is where somebody with the authority answers. Each
 * request says who, what, when and why, then offers the two answers:
 *
 *  - a refund: Refund (the money goes back and the slot goes back on sale) or
 *    Decline (with a reason the counter can read to the guest);
 *  - a move: Move it (the place is checked again first, then the booking goes
 *    to the new time) or Decline (with a reason).
 *
 * Both kinds sit in one list, oldest first, because they are one inbox: the
 * same people answer them and the same counter is waiting. Nothing is drawn
 * when nothing is waiting.
 *
 * `orderId` narrows it to one order, for the order's own page.
 */
type Item = { kind: "refund"; r: RefundRequest } | { kind: "move"; r: RescheduleRequest };

export function RefundRequests({ orderId, onDecided, who: whoProp }: { orderId?: string; onDecided?: () => void; who?: string }) {
  const t = useTranslations("refunds");
  const who = whoProp ?? t("manager");
  const format = useFormatter();
  const toast = useToast();
  // Re-read when a move is asked for, answered or taken back anywhere.
  useRescheduleVersion();
  const [, setVersion] = useState(0);
  const [approving, setApproving] = useState<Item | null>(null);
  const [declining, setDeclining] = useState<Item | null>(null);
  const [note, setNote] = useState("");
  const [noteErr, setNoteErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const list: Item[] = [
    ...pendingRefundRequests().map((r): Item => ({ kind: "refund", r })),
    ...pendingRescheduleRequests().map((r): Item => ({ kind: "move", r })),
  ]
    .filter((i) => !orderId || i.r.orderId === orderId)
    .sort((a, b) => Date.parse(a.r.requestedAt) - Date.parse(b.r.requestedAt));
  if (list.length === 0) return null;

  const dayAndTime = (start: string, end?: string | null) => {
    const day = formatDay(start.slice(0, 10), { weekday: true });
    const from = start.slice(11, 16);
    const to = end?.slice(11, 16);
    return `${day} · ${to ? formatClockRange(from, to) : formatClock(from)}`;
  };
  const what = (r: { productName: string; place?: string | null }) => [r.productName, r.place].filter(Boolean).join(" · ");

  const approve = async () => {
    if (!approving) return;
    setBusy(true);
    const res = approving.kind === "refund" ? await approveRefundRequest(approving.r.id, who) : await approveRescheduleRequest(approving.r.id, who);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(approving.kind === "refund" ? t("approved", { amount: formatMoney(approving.r.amount) }) : t("movedOk", { to: dayAndTime(approving.r.toStart, approving.r.toEnd) }));
    setApproving(null);
    setVersion((v) => v + 1);
    onDecided?.();
  };

  const decline = async () => {
    if (!declining) return;
    if (!note.trim()) {
      setNoteErr(t("declineNoteRequired"));
      document.getElementById("refund-decline-note")?.focus();
      return;
    }
    setBusy(true);
    const res = declining.kind === "refund" ? await declineRefundRequest(declining.r.id, who, note) : await declineRescheduleRequest(declining.r.id, who, note);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(declining.kind === "refund" ? t("declined") : t("moveDeclined"));
    setDeclining(null);
    setNote("");
    setVersion((v) => v + 1);
    onDecided?.();
  };

  return (
    <section aria-labelledby="refund-requests-title" className="card-surface overflow-hidden border border-warning-line">
      <header className="flex items-start gap-comfortable border-b border-line bg-warning-wash px-card py-comfortable">
        <span aria-hidden className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-card text-warning">
          <Inbox size={18} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="refund-requests-title" className="text-md font-semibold text-fg">
            {t("title", { count: list.length })}
          </h2>
          <p className="text-base text-fg-secondary">{t("lead")}</p>
        </div>
      </header>
      <ul className="divide-y divide-line">
        {list.map((item) => {
          const r = item.r;
          const kindTag = (
            <span className="inline-flex items-center gap-1 rounded-full bg-subtle px-tight py-0.5 text-sm font-medium text-fg-secondary ring-1 ring-inset ring-line">
              {item.kind === "refund" ? <RotateCcw size={12} strokeWidth={2.25} aria-hidden /> : <CalendarClock size={12} strokeWidth={2.25} aria-hidden />}
              {item.kind === "refund" ? t("kindRefund") : t("kindMove")}
            </span>
          );
          return (
            <li key={`${item.kind}-${r.id}`} data-request={item.kind} className="flex flex-col gap-comfortable px-card py-comfortable md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-tight gap-y-inline text-md font-semibold text-fg">
                  {kindTag}
                  <span>
                    {r.customerName || t("walkIn")}
                    <span className="font-normal text-muted"> · {what(r)}</span>
                  </span>
                </p>
                {item.kind === "refund" ? (
                  <p className="mt-inline text-base text-fg">{dayAndTime(item.r.slotStart, item.r.slotEnd)}</p>
                ) : (
                  <p className="mt-inline flex flex-wrap items-center gap-x-tight gap-y-inline text-base text-fg">
                    <span>{dayAndTime(item.r.fromStart, item.r.fromEnd)}</span>
                    {/* The arrow leads the second part, so a narrow screen breaks
                        BEFORE it and never strands it at the end of a line. */}
                    <span className="inline-flex items-center gap-tight font-semibold">
                      <ArrowRight size={16} strokeWidth={2} aria-hidden className="shrink-0 text-muted" />
                      {dayAndTime(item.r.toStart, item.r.toEnd)}
                    </span>
                  </p>
                )}
                <p className="mt-inline text-base text-fg">
                  {item.kind === "refund" ? (
                    <span className="font-medium">{t(`reasons.${item.r.reason}`)}</span>
                  ) : item.r.reason ? (
                    <span className="font-medium">{t(`moveReasons.${item.r.reason}`)}</span>
                  ) : !item.r.note ? (
                    <span className="text-muted">{t("moveWaiting")}</span>
                  ) : null}
                  {r.note ? <span className="text-muted"> — “{r.note}”</span> : null}
                </p>
                <p className="mt-inline text-sm text-muted">
                  {t("askedBy", { name: r.requestedBy, ago: format.relativeTime(new Date(r.requestedAt), new Date()) })}
                  {!orderId && (
                    <>
                      <span aria-hidden className="max-sm:hidden"> · </span>
                      <Link href={`/orders/${r.orderId}`} className="inline-flex min-h-11 items-center font-medium text-fg underline underline-offset-4 max-sm:flex sm:min-h-0">
                        {r.orderReference}
                      </Link>
                    </>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-tight md:flex-col md:items-end">
                <p className="mr-auto text-lg font-semibold tabular-nums text-fg md:mr-0">
                  {item.kind === "refund" ? formatMoney(item.r.amount) : item.r.partySize ? t("people", { count: item.r.partySize }) : ""}
                </p>
                <div className="flex gap-tight">
                  <Button variant="secondary" onClick={() => { setDeclining(item); setNote(""); setNoteErr(null); }}>
                    {t("decline")}
                  </Button>
                  <Button onClick={() => setApproving(item)}>
                    {item.kind === "refund" ? t("approve", { amount: formatMoney(item.r.amount) }) : t("approveMove")}
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <Modal
        open={!!approving}
        onClose={() => setApproving(null)}
        title={approving ? (approving.kind === "refund" ? t("approveTitle", { amount: formatMoney(approving.r.amount) }) : t("approveMoveTitle")) : ""}
        footer={
          <>
            <Button data-autofocus variant="secondary" onClick={() => setApproving(null)} disabled={busy}>
              {t("cancel")}
            </Button>
            <Button onClick={() => void approve()} loading={busy}>
              {approving ? (approving.kind === "refund" ? t("approve", { amount: formatMoney(approving.r.amount) }) : t("approveMove")) : ""}
            </Button>
          </>
        }
      >
        {approving && (
          <p className="text-md text-fg">
            {approving.kind === "refund"
              ? t("approveBody", { what: what(approving.r), when: dayAndTime(approving.r.slotStart, approving.r.slotEnd) })
              : t("approveMoveBody", {
                  what: what(approving.r),
                  from: dayAndTime(approving.r.fromStart, approving.r.fromEnd),
                  to: dayAndTime(approving.r.toStart, approving.r.toEnd),
                })}
          </p>
        )}
      </Modal>

      <Modal
        open={!!declining}
        onClose={() => setDeclining(null)}
        title={declining?.kind === "move" ? t("moveDeclineTitle") : t("declineTitle")}
        footer={
          <>
            <Button data-autofocus variant="secondary" onClick={() => setDeclining(null)} disabled={busy}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={() => void decline()} loading={busy}>
              {t("decline")}
            </Button>
          </>
        }
      >
        <label data-focus-host className="flex flex-col gap-tight">
          <span className="text-md font-medium text-fg">{t("declineNote")}</span>
          <textarea
            id="refund-decline-note"
            value={note}
            onChange={(e) => { setNote(e.target.value); setNoteErr(null); }}
            rows={3}
            placeholder={declining?.kind === "move" ? t("moveDeclinePlaceholder") : t("declinePlaceholder")}
            aria-invalid={!!noteErr}
            aria-describedby={noteErr ? "refund-decline-err" : "refund-decline-help"}
            className={controlClass(!!noteErr, true)}
          />
          {noteErr ? (
            <span id="refund-decline-err" className="text-base font-medium text-danger">{noteErr}</span>
          ) : (
            <span id="refund-decline-help" className="text-sm text-muted">{t("declineHelp")}</span>
          )}
        </label>
      </Modal>
    </section>
  );
}
