"use client";
import { useState } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { RotateCcw } from "lucide-react";
import { Button, Modal, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatClockRange, formatDay, formatMoney, formatClock } from "@/lib/format";
import {
  approveRefundRequest,
  declineRefundRequest,
  pendingRefundRequests,
  type RefundRequest,
} from "@/lib/api/refundRequests";

/**
 * Refund requests from the counter, waiting for a manager.
 *
 * A cashier asks; this is where somebody with the authority answers. Each
 * request says who, what, when and why, and what goes back — worked out from
 * the sale, never typed — then offers the two answers: Refund (the money goes
 * back and the slot goes back on sale) or Decline (with a reason the counter
 * can read to the guest). Nothing is drawn when nothing is waiting.
 *
 * `orderId` narrows it to one order, for the order's own page.
 */
export function RefundRequests({ orderId, onDecided, who: whoProp }: { orderId?: string; onDecided?: () => void; who?: string }) {
  const t = useTranslations("refunds");
  const who = whoProp ?? t("manager");
  const format = useFormatter();
  const toast = useToast();
  const [, setVersion] = useState(0);
  const [approving, setApproving] = useState<RefundRequest | null>(null);
  const [declining, setDeclining] = useState<RefundRequest | null>(null);
  const [note, setNote] = useState("");
  const [noteErr, setNoteErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const list = pendingRefundRequests().filter((r) => !orderId || r.orderId === orderId);
  if (list.length === 0) return null;

  const when = (r: RefundRequest) => {
    const day = formatDay(r.slotStart.slice(0, 10), { weekday: true });
    const start = r.slotStart.slice(11, 16);
    const end = r.slotEnd?.slice(11, 16);
    return `${day} · ${end ? formatClockRange(start, end) : formatClock(start)}`;
  };
  const what = (r: RefundRequest) => [r.productName, r.place].filter(Boolean).join(" · ");

  const approve = async () => {
    if (!approving) return;
    setBusy(true);
    const res = await approveRefundRequest(approving.id, who);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(t("approved", { amount: formatMoney(approving.amount) }));
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
    const res = await declineRefundRequest(declining.id, who, note);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(t("declined"));
    setDeclining(null);
    setNote("");
    setVersion((v) => v + 1);
    onDecided?.();
  };

  return (
    <section aria-labelledby="refund-requests-title" className="card-surface overflow-hidden rounded-lg border border-warning/40">
      <header className="flex items-start gap-comfortable border-b border-line bg-warning-wash px-card py-comfortable">
        <span aria-hidden className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-card text-warning">
          <RotateCcw size={18} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="refund-requests-title" className="text-[1rem] font-semibold text-fg">
            {t("title", { count: list.length })}
          </h2>
          <p className="text-[0.875rem] text-fg/80">{t("lead")}</p>
        </div>
      </header>
      <ul className="divide-y divide-line">
        {list.map((r) => (
          <li key={r.id} className="flex flex-col gap-comfortable px-card py-comfortable md:flex-row md:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-[0.9375rem] font-semibold text-fg">
                {r.customerName || t("walkIn")}
                <span className="font-normal text-muted"> · {what(r)}</span>
              </p>
              <p className="text-[0.875rem] text-fg">{when(r)}</p>
              <p className="mt-inline text-[0.875rem] text-fg">
                <span className="font-medium">{t(`reasons.${r.reason}`)}</span>
                {r.note ? <span className="text-muted"> — “{r.note}”</span> : null}
              </p>
              <p className="mt-inline text-[0.8125rem] text-muted">
                {t("askedBy", { name: r.requestedBy, ago: format.relativeTime(new Date(r.requestedAt), new Date()) })}
                {!orderId && (
                  <>
                    {" · "}
                    <Link href={`/orders/${r.orderId}`} className="font-medium text-fg underline underline-offset-4">
                      {r.orderReference}
                    </Link>
                  </>
                )}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-tight md:flex-col md:items-end">
              <p className="mr-auto text-[1.125rem] font-semibold tabular-nums text-fg md:mr-0">{formatMoney(r.amount)}</p>
              <div className="flex gap-tight">
                <Button variant="secondary" onClick={() => { setDeclining(r); setNote(""); setNoteErr(null); }}>
                  {t("decline")}
                </Button>
                <Button onClick={() => setApproving(r)}>{t("approve", { amount: formatMoney(r.amount) })}</Button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Modal
        open={!!approving}
        onClose={() => setApproving(null)}
        title={approving ? t("approveTitle", { amount: formatMoney(approving.amount) }) : ""}
        footer={
          <>
            <Button data-autofocus variant="secondary" onClick={() => setApproving(null)} disabled={busy}>
              {t("cancel")}
            </Button>
            <Button onClick={() => void approve()} loading={busy}>
              {approving ? t("approve", { amount: formatMoney(approving.amount) }) : ""}
            </Button>
          </>
        }
      >
        {approving && (
          <p className="text-[0.9375rem] text-fg">
            {t("approveBody", { what: what(approving), when: when(approving) })}
          </p>
        )}
      </Modal>

      <Modal
        open={!!declining}
        onClose={() => setDeclining(null)}
        title={t("declineTitle")}
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
          <span className="text-[0.9375rem] font-medium text-fg">{t("declineNote")}</span>
          <textarea
            id="refund-decline-note"
            value={note}
            onChange={(e) => { setNote(e.target.value); setNoteErr(null); }}
            rows={3}
            placeholder={t("declinePlaceholder")}
            aria-invalid={!!noteErr}
            aria-describedby={noteErr ? "refund-decline-err" : "refund-decline-help"}
            className={cn("rounded-md border bg-card px-comfortable py-tight text-[0.9375rem] text-fg outline-none focus:ring-2 focus:ring-ember/25", noteErr ? "border-danger" : "border-line focus:border-ember")}
          />
          {noteErr ? (
            <span id="refund-decline-err" className="text-[0.875rem] font-medium text-danger">{noteErr}</span>
          ) : (
            <span id="refund-decline-help" className="text-[0.8125rem] text-muted">{t("declineHelp")}</span>
          )}
        </label>
      </Modal>
    </section>
  );
}
