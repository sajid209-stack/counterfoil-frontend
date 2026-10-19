"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CircleCheck, HandCoins, RotateCcw, XCircle } from "lucide-react";
import { Notice, useToast } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import {
  pendingRefundFor,
  pendingRefundForOrder,
  refundRequestsForOrder,
  refundStatusOf,
  useRefundVersion,
  withdrawRefundRequest,
  type RefundRequest,
} from "@/lib/api/refundRequests";
import {
  pendingWriteOffFor,
  useWriteOffVersion,
  withdrawWriteOff,
  writeOffRequestsForOrder,
  writeOffStatusOf,
  type WriteOffRequest,
} from "@/lib/api/writeOffRequests";

/* ── What the counter asked for, and what the manager said ────────────────
 *
 * A request leaves the till and is answered somewhere else, so the screen
 * where it was asked has to tell the cashier two things: it is still waiting
 * (and can be taken back), or it has been answered — and what the manager
 * wrote, because that sentence is what the cashier tells the guest.
 *
 * `sheet` draws full notices inside a booking's sheet. `row` is one quiet line
 * for a list row (Check-in) and only speaks once there is an answer: the
 * waiting state is already a marker on that row.
 *
 * An answer the cashier gave themselves ("direct": they asked and approved in
 * one breath) is not shown — there is nothing to relay.
 */

type Answer =
  | { kind: "refund"; req: RefundRequest; status: "approved" | "declined" | "expired" }
  | { kind: "writeOff"; req: WriteOffRequest; status: "approved" | "rejected" | "expired" };

/** The most recent answered request for this booking (or order). */
function lastRefundAnswer(orderId: string, bookingId?: string): Answer | null {
  const list = refundRequestsForOrder(orderId).filter((r) => !bookingId || r.bookingId === bookingId);
  for (const r of list) {
    const st = refundStatusOf(r);
    if (st === "pending" || st === "withdrawn") continue;
    if ((st === "approved" || st === "declined") && r.decidedBy === r.requestedBy) continue;
    return { kind: "refund", req: r, status: st };
  }
  return null;
}

function lastWriteOffAnswer(orderId: string): Answer | null {
  for (const r of writeOffRequestsForOrder(orderId)) {
    const st = writeOffStatusOf(r);
    if (st === "pending" || st === "withdrawn") continue;
    if ((st === "approved" || st === "rejected") && r.decidedBy === r.requestedBy) continue;
    return { kind: "writeOff", req: r, status: st };
  }
  return null;
}

/** Is a refund or a write-off waiting on this booking's order? Re-renders when
 *  either changes. Used by the markers on the board and the Check-in rows. */
export function useAsked(orderId: string, bookingId?: string): { refund: boolean; writeOff: boolean } {
  useRefundVersion();
  useWriteOffVersion();
  return {
    refund: bookingId ? !!pendingRefundFor(bookingId) : !!pendingRefundForOrder(orderId),
    writeOff: !!pendingWriteOffFor(orderId),
  };
}

export function RequestNotes({
  orderId,
  bookingId,
  variant = "sheet",
  onChanged,
  className,
}: {
  orderId: string;
  bookingId?: string;
  variant?: "sheet" | "row";
  /** A request was taken back — the caller re-reads. */
  onChanged?: () => void;
  className?: string;
}) {
  const t = useTranslations("refunds");
  const toast = useToast();
  useRefundVersion();
  useWriteOffVersion();
  const [busy, setBusy] = useState<string | null>(null);

  const refundPending = bookingId ? pendingRefundFor(bookingId) : pendingRefundForOrder(orderId);
  const writeOffPending = pendingWriteOffFor(orderId);
  const refundAnswer = refundPending ? null : lastRefundAnswer(orderId, bookingId);
  const writeOffAnswer = writeOffPending ? null : lastWriteOffAnswer(orderId);

  const takeBack = async (kind: "refund" | "writeOff", id: string) => {
    if (busy) return;
    setBusy(id);
    if (kind === "refund") await withdrawRefundRequest(id);
    else await withdrawWriteOff(id);
    setBusy(null);
    toast.success(t("pos.status.takenBack"));
    onChanged?.();
  };

  const answers = [refundAnswer, writeOffAnswer].filter((a): a is Answer => !!a);

  if (variant === "row") {
    if (answers.length === 0) return null;
    return (
      <div className={className}>
        {answers.map((a) => {
          const { title, body } = describe(a, t);
          return (
            <p key={a.req.id} data-request-answer className="flex items-start gap-1.5 text-sm text-fg-secondary">
              {a.status === "approved" ? <CircleCheck size={14} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0 text-success" /> : <XCircle size={14} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0" />}
              <span className="min-w-0 break-words"><span className="font-semibold text-fg">{title}</span>{body ? ` · ${body}` : ""}</span>
            </p>
          );
        })}
      </div>
    );
  }

  if (!refundPending && !writeOffPending && answers.length === 0) return null;
  return (
    <div className={className ?? "flex flex-col gap-tight px-card pt-card"} data-request-notes>
      {refundPending && (
        <Notice
          tone="warning"
          icon={<RotateCcw size={18} strokeWidth={1.75} />}
          title={t("pos.status.refundPending", { amount: formatMoney(refundPending.amount) })}
          action={{ label: t("pos.status.takeBack"), variant: "button", onClick: () => void takeBack("refund", refundPending.id), busy: busy === refundPending.id }}
        >
          {t(`reasons.${refundPending.reason}`)}{refundPending.note ? ` · ${refundPending.note}` : ""}
        </Notice>
      )}
      {writeOffPending && (
        <Notice
          tone="warning"
          icon={<HandCoins size={18} strokeWidth={1.75} />}
          title={t("pos.status.writeOffPending", { amount: formatMoney(writeOffPending.amount) })}
          action={{ label: t("pos.status.takeBack"), variant: "button", onClick: () => void takeBack("writeOff", writeOffPending.id), busy: busy === writeOffPending.id }}
        >
          {t(`pos.writeOff.category.${writeOffPending.category}`)} · {writeOffPending.note}
        </Notice>
      )}
      {answers.map((a) => {
        const { title, body } = describe(a, t);
        return (
          <Notice key={a.req.id} tone={a.status === "approved" ? "success" : "neutral"} title={title}>
            {body}
          </Notice>
        );
      })}
    </div>
  );
}

/** The headline and the manager's words for an answered request. */
function describe(a: Answer, t: ReturnType<typeof useTranslations>): { title: string; body: string } {
  if (a.status === "expired") return { title: a.kind === "refund" ? t("pos.status.refundDeclined") : t("pos.status.writeOffRejected"), body: t("pos.status.expired") };
  const note = a.req.decisionNote?.trim();
  const said = note ? `${t("pos.status.byLine", { name: a.req.decidedBy ?? t("manager") })} ${note}` : t("pos.status.noNote");
  if (a.kind === "refund") {
    return a.status === "approved"
      ? { title: t("pos.status.refundApproved", { amount: formatMoney(a.req.approvedAmount ?? a.req.amount) }), body: said }
      : { title: t("pos.status.refundDeclined"), body: said };
  }
  return a.status === "approved"
    ? { title: t("pos.status.writeOffApproved", { amount: formatMoney(a.req.approvedAmount ?? a.req.amount) }), body: said }
    : { title: t("pos.status.writeOffRejected"), body: said };
}
