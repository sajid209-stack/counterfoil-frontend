"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, Modal, Notice, RadioGroup, Sheet, StatusPill, useToast, type PillTone } from "@/components/ui";
import { formatClock, formatClockRange, formatDateTime, formatDay, formatMoney } from "@/lib/format";
import {
  approveRefundRequest,
  declineRefundRequest,
  dueAtOf,
  getRefundRequest,
  isOverdue,
  refundStatusOf,
  scopeOf,
  useRefundVersion,
  type RefundDisplayStatus,
  type RefundRequest,
} from "@/lib/api/refundRequests";
import { useRefundPolicy, type RefundMethod } from "@/lib/api/refundPolicy";
import { AmountField, Block, Fact, ReasonDialog, RespondChip, Timeline, parseTaka, takaText, useAgo, useNow, useWho, type TimelineItem } from "./kit";

export const REFUND_TONE: Record<RefundDisplayStatus, PillTone> = {
  pending: "warning",
  approved: "success",
  declined: "neutral",
  withdrawn: "neutral",
  expired: "neutral",
};

/** "Wed 29 Jul · 7:00 – 8:00 PM", or nothing for a refund with no booking. */
export function slotText(r: Pick<RefundRequest, "slotStart" | "slotEnd">): string | null {
  if (!r.slotStart) return null;
  const day = formatDay(r.slotStart.slice(0, 10), { weekday: true });
  const from = r.slotStart.slice(11, 16);
  const to = r.slotEnd?.slice(11, 16);
  return `${day} · ${to ? formatClockRange(from, to) : formatClock(from)}`;
}

/**
 * One refund request, opened beside the list.
 *
 * The decision is made here: what is being asked, why, by whom, how long it has
 * waited, and — in one line — what approving it will do. The footer holds the
 * answers and nothing else: ONE primary (Refund ৳X), a secondary Different
 * amount only where the amount may be lowered (goodwill), and a soft-danger
 * Decline that asks why. A request somebody has answered shows the answer
 * instead of the buttons. Acting does not close the sheet: the list behind it
 * moves, and the decision appears here, so the manager sees what they did.
 */
export function RefundDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const t = useTranslations("requests");
  const tf = useTranslations("requests.refunds");
  const toast = useToast();
  const who = useWho();
  const now = useNow();
  const ago = useAgo();
  const policy = useRefundPolicy();
  useRefundVersion();
  const [asking, setAsking] = useState<null | "full" | "different">(null);
  const [declining, setDeclining] = useState(false);

  const r = id ? getRefundRequest(id) : null;
  const body = (() => {
    if (!id) return null;
    if (!r) return <Notice tone="info" className="m-card">{tf("detail.missing")}</Notice>;
    const status = refundStatusOf(r, now);
    const scope = scopeOf(r);
    const waiting = status === "pending";
    const given = r.approvedAmount ?? r.amount;
    const less = status === "approved" && given !== r.amount;
    const slot = slotText(r);
    const where = [r.productName, r.place].filter(Boolean).join(" · ");
    const consequence = tf(`consequence.${scope}`, { count: r.ticketIds?.length ?? 0 });
    const scopeText = tf(`scope.${scope}`, { count: r.ticketIds?.length ?? 0 });
    const due = dueAtOf(r);
    const askedWhen = formatDateTime(r.requestedAt);
    const decidedWhen = r.decidedAt ? formatDateTime(r.decidedAt) : "";

    const timeline: TimelineItem[] = [{ id: "asked", label: tf("detail.tAsked", { name: r.requestedBy }), when: `${askedWhen} · ${ago(r.requestedAt, now)}`, note: r.note }];
    if (status === "approved") timeline.push({ id: "done", label: tf("detail.tApprovedAmount", { amount: formatMoney(given), name: r.decidedBy ?? "" }), when: decidedWhen, note: r.decisionNote });
    else if (status === "declined") timeline.push({ id: "done", label: tf("detail.tDeclined", { name: r.decidedBy ?? "" }), when: decidedWhen, note: r.decisionNote });
    else if (status === "withdrawn") timeline.push({ id: "done", label: tf("detail.tWithdrawn"), when: decidedWhen });
    else if (status === "expired") timeline.push({ id: "done", label: tf("detail.tExpired"), when: "" });

    return (
      <div>
        {/* The amount, large, with where it stands. */}
        <div className="flex items-start justify-between gap-comfortable px-card py-section">
          <div className="min-w-0">
            <p className="text-3xl font-semibold tracking-figure tabular-nums text-fg">{formatMoney(status === "approved" ? given : r.amount)}</p>
            {less && <p className="mt-inline text-sm text-muted">{tf("detail.askedOf", { asked: formatMoney(r.amount) })}</p>}
          </div>
          <StatusPill tone={REFUND_TONE[status]} className="shrink-0">
            {tf(`status.${status}`)}
          </StatusPill>
        </div>

        <Block title={tf("detail.what")}>
          <p className="text-md font-medium text-fg">{scopeText}</p>
          <p className="text-sm text-muted">{consequence}</p>
          <dl className="mt-tight grid grid-cols-1 gap-comfortable sm:grid-cols-2">
            <Fact label={tf("detail.guest")}>{r.customerName || tf("detail.walkIn")}</Fact>
            <Fact label={tf("detail.booking")}>{where || "—"}</Fact>
            {slot && <Fact label={tf("detail.when")}>{slot}</Fact>}
            <Fact label={tf("detail.sale")}>
              <Link
                href={`/orders/${r.orderId}`}
                aria-label={tf("detail.openSale", { reference: r.orderReference })}
                className="inline-flex min-h-11 items-center font-mono text-sm text-brand-foreground underline underline-offset-4 hover:no-underline sm:min-h-0"
              >
                {r.orderReference}
              </Link>
            </Fact>
          </dl>
        </Block>

        <Block title={tf("detail.why")}>
          <p className="text-base font-medium text-fg">{tf(`reasons.${r.reason}`)}</p>
          {r.note ? <p className="break-words text-base text-fg-secondary">“{r.note}”</p> : <p className="text-sm text-muted">{t("noNote")}</p>}
          <p className="text-sm text-muted">{tf("detail.askedLine", { name: r.requestedBy, ago: ago(r.requestedAt, now) })}</p>
        </Block>

        {waiting && (
          <Block title={tf("detail.respondBy")}>
            <div className="flex flex-wrap items-center gap-tight">
              <RespondChip dueAt={due} now={now} />
              <span className="text-base text-fg">
                {isOverdue(r, now) ? tf("detail.overdueLine", { when: formatDateTime(due) }) : tf("detail.respondByLine", { when: formatDateTime(due) })}
              </span>
            </div>
          </Block>
        )}

        {!waiting && (
          <Block title={tf("detail.decision")}>
            {status === "approved" && (
              <>
                <p className="text-md font-medium text-fg">
                  {less ? tf("detail.decisionApprovedLess", { amount: formatMoney(given), asked: formatMoney(r.amount) }) : tf("detail.decisionApproved", { amount: formatMoney(given) })}
                </p>
                {r.refundMethod && <p className="text-base text-fg-secondary">{tf(`detail.via.${r.refundMethod}`)}</p>}
              </>
            )}
            {status === "declined" && <p className="text-md font-medium text-fg">{tf("detail.decisionDeclined")}</p>}
            {status === "withdrawn" && <p className="text-base text-fg">{tf("detail.decisionWithdrawn")}</p>}
            {status === "expired" && <p className="text-base text-fg">{tf("detail.expiredLine")}</p>}
            {(status === "approved" || status === "declined") && r.decidedBy && (
              <p className="text-sm text-muted">{tf("detail.decidedBy", { name: r.decidedBy, when: decidedWhen })}</p>
            )}
            {r.decisionNote && <p className="break-words text-base text-fg-secondary">“{r.decisionNote}”</p>}
          </Block>
        )}

        <Block title={tf("detail.timeline")}>
          <Timeline items={timeline} />
        </Block>
      </div>
    );
  })();

  const waiting = !!r && refundStatusOf(r, now) === "pending";
  const goodwill = !!r && scopeOf(r) === "goodwill";

  const footer = waiting && r ? (
    <div className="flex w-full flex-col-reverse gap-tight sm:flex-row sm:items-center">
      <div className="flex gap-tight sm:mr-auto">
        <Button variant="destructive" className="max-sm:flex-1" onClick={() => setDeclining(true)}>
          {tf("actions.decline")}
        </Button>
        {goodwill && (
          <Button variant="secondary" className="max-sm:flex-1" onClick={() => setAsking("different")}>
            {tf("actions.different")}
          </Button>
        )}
      </div>
      <Button onClick={() => setAsking("full")}>{tf("actions.refund", { amount: formatMoney(r.amount) })}</Button>
    </div>
  ) : undefined;

  return (
    <>
      <Sheet
        open={!!id}
        onClose={onClose}
        title={tf("detail.title")}
        closeLabel={t("close")}
        side
        footer={footer}
        className="max-md:h-[calc(100dvh-0.5rem)] max-md:max-h-none!"
      >
        {body}
      </Sheet>

      {asking && r && (
        <ApproveDialog
          r={r}
          mode={asking}
          who={who}
          defaultMethod={policy.refundTo}
          onClose={() => setAsking(null)}
          onDone={(msg) => {
            setAsking(null);
            toast.success(msg);
          }}
        />
      )}

      {declining && r && (
        <ReasonDialog
          title={tf("decline.title")}
          label={tf("decline.noteLabel")}
          placeholder={tf("decline.placeholder")}
          help={tf("decline.help")}
          required={tf("decline.required")}
          confirm={tf("decline.confirm")}
          onClose={() => setDeclining(false)}
          onSubmit={async (note) => {
            const res = await declineRefundRequest(r.id, who, note);
            if (!res.ok) return res.error.fieldErrors?.note ?? res.error.message;
            setDeclining(false);
            toast.success(tf("decline.done"));
          }}
        />
      )}
    </>
  );
}

/**
 * Confirm a refund: what it will do, where the money goes, and — for goodwill,
 * the one kind that may be lowered — how much.
 *
 * A booking or ticket refund is approved whole or declined (a part-refund would
 * cancel a ticket for part of its price), so "different" only ever opens on
 * goodwill. The method starts from the business's policy and can be changed for
 * this one refund. Mounted only while open, so it always starts fresh.
 */
function ApproveDialog({
  r,
  mode,
  who,
  defaultMethod,
  onClose,
  onDone,
}: {
  r: RefundRequest;
  mode: "full" | "different";
  who: string;
  defaultMethod: RefundMethod;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const t = useTranslations("requests.refunds");
  const tc = useTranslations("requests");
  const [method, setMethod] = useState<RefundMethod>(defaultMethod);
  const [text, setText] = useState(takaText(r.amount));
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const different = mode === "different";
  const scope = scopeOf(r);
  const parsed = parseTaka(text);
  const amount = different ? parsed : r.amount;
  const consequence = t(`consequence.${scope}`, { count: r.ticketIds?.length ?? 0 });

  const problem = (): string | undefined => {
    if (!different) return undefined;
    if (!Number.isFinite(parsed)) return t("approve.amountBad");
    if (parsed <= 0) return t("approve.amountNeed");
    if (parsed > r.amount) return t("approve.amountOver", { max: formatMoney(r.amount) });
    return undefined;
  };

  const submit = async () => {
    const bad = problem();
    if (bad) {
      setError(bad);
      document.getElementById("refund-amount")?.focus();
      return;
    }
    setBusy(true);
    const res = await approveRefundRequest(r.id, who, { amount: different ? parsed : undefined, method });
    setBusy(false);
    if (!res.ok) {
      setError(res.error.fieldErrors?.amount ?? res.error.message);
      return;
    }
    const given = res.data.approvedAmount ?? res.data.amount;
    onDone(t(scope === "booking" ? "approve.doneBooking" : scope === "tickets" ? "approve.doneTickets" : "approve.doneGoodwill", { amount: formatMoney(given) }));
  };

  const label = Number.isFinite(amount) && amount > 0 ? formatMoney(amount) : "";

  return (
    <Modal
      open
      onClose={onClose}
      title={different ? t("approve.differentTitle") : t("approve.title", { amount: formatMoney(r.amount) })}
      footer={
        <>
          <Button data-autofocus={different ? undefined : ""} variant="secondary" onClick={onClose} disabled={busy}>
            {tc("cancel")}
          </Button>
          <Button onClick={() => void submit()} loading={busy}>
            {t("approve.confirm", { amount: label })}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-section">
        {different ? (
          <>
            <p className="text-base text-fg-secondary">{t("approve.differentLead", { asked: formatMoney(r.amount) })}</p>
            <AmountField
              id="refund-amount"
              label={t("approve.amountLabel")}
              help={t("approve.amountHelp", { max: formatMoney(r.amount) })}
              error={error}
              value={text}
              onChange={(v) => {
                setText(v);
                setError(undefined);
              }}
            />
            <p className="text-sm text-muted">{consequence}</p>
          </>
        ) : (
          <>
            <p className="text-md text-fg">{t("approve.body", { consequence })}</p>
            {error && <Notice tone="danger" size="sm">{error}</Notice>}
          </>
        )}
        <div className="flex flex-col gap-tight">
          <p id="refund-method-label" className="text-sm font-medium text-muted">
            {t("approve.methodLabel")}
          </p>
          <RadioGroup
            aria-labelledby="refund-method-label"
            value={method}
            onChange={(v) => setMethod(v as RefundMethod)}
            options={[
              { value: "original", label: t("approve.original"), description: t("approve.originalHint") },
              { value: "cash", label: t("approve.cash"), description: t("approve.cashHint") },
            ]}
          />
          <p className="text-xs text-muted">{t("approve.methodHelp")}</p>
        </div>
      </div>
    </Modal>
  );
}
