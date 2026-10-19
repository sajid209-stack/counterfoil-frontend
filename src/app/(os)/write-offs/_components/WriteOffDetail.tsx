"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, ConfirmDialog, Modal, Notice, Sheet, StatusPill, useToast, type PillTone } from "@/components/ui";
import { formatDateTime, formatDay, formatMoney } from "@/lib/format";
import {
  approveWriteOff,
  getWriteOffRequest,
  isWriteOffOverdue,
  owedOn,
  rejectWriteOff,
  useWriteOffVersion,
  writeOffDueAtOf,
  writeOffStatusOf,
  type WriteOffDisplayStatus,
  type WriteOffRequest,
} from "@/lib/api/writeOffRequests";
import { AmountField, Block, Fact, ReasonDialog, RespondChip, Timeline, parseTaka, takaText, useAgo, useNow, useWho, type TimelineItem } from "../../refunds/_components/kit";

export const WRITE_OFF_TONE: Record<WriteOffDisplayStatus, PillTone> = {
  pending: "warning",
  approved: "success",
  rejected: "neutral",
  withdrawn: "neutral",
  expired: "neutral",
};

/** What the guest will still owe once `amount` is written off, in a sentence. */
function useConsequence() {
  const tw = useTranslations("requests.writeOffs");
  return (owedNow: number, amount: number): string => {
    const left = Math.max(0, owedNow - amount);
    return left > 0 ? tw("consequence.owes", { amount: formatMoney(left) }) : tw("consequence.none");
  };
}

/**
 * One write-off request, opened beside the list.
 *
 * A write-off moves no money: it stops chasing a balance a guest still owes. So
 * what a manager needs to see is how much is owed NOW (the guest may have paid
 * some since the counter asked), what the request is for, and — in one line —
 * what will be left owing afterwards. The footer is ONE primary (Write off ৳X,
 * capped at what is owed now), a secondary Different amount, and a soft-danger
 * Reject that asks why. An answered request shows the answer instead.
 */
export function WriteOffDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const t = useTranslations("requests");
  const tw = useTranslations("requests.writeOffs");
  const toast = useToast();
  const who = useWho();
  const now = useNow();
  const ago = useAgo();
  useWriteOffVersion();
  const [asking, setAsking] = useState<null | "full" | "different">(null);
  const [rejecting, setRejecting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const consequence = useConsequence();

  const r = id ? getWriteOffRequest(id) : null;
  const owedNow = r ? owedOn(r.orderId) : 0;
  const status = r ? writeOffStatusOf(r, now) : null;
  const waiting = status === "pending";
  /* What the primary writes off: what was asked, but never more than is owed
     now. The guest may have paid part of it since. */
  const primary = r ? Math.min(r.amount, owedNow) : 0;

  const body = (() => {
    if (!id) return null;
    if (!r || !status) return <Notice tone="info" className="m-card">{tw("detail.missing")}</Notice>;
    const given = r.approvedAmount ?? r.amount;
    const less = status === "approved" && given !== r.amount;
    const due = writeOffDueAtOf(r);
    const askedWhen = formatDateTime(r.requestedAt);
    const decidedWhen = r.decidedAt ? formatDateTime(r.decidedAt) : "";

    const timeline: TimelineItem[] = [{ id: "asked", label: tw("detail.tAsked", { name: r.requestedBy }), when: `${askedWhen} · ${ago(r.requestedAt, now)}`, note: r.note }];
    if (status === "approved") timeline.push({ id: "done", label: tw("detail.tApprovedAmount", { amount: formatMoney(given), name: r.decidedBy ?? "" }), when: decidedWhen, note: r.decisionNote });
    else if (status === "rejected") timeline.push({ id: "done", label: tw("detail.tRejected", { name: r.decidedBy ?? "" }), when: decidedWhen, note: r.decisionNote });
    else if (status === "withdrawn") timeline.push({ id: "done", label: tw("detail.tWithdrawn"), when: decidedWhen });
    else if (status === "expired") timeline.push({ id: "done", label: tw("detail.tExpired"), when: "" });

    return (
      <div>
        <div className="flex items-start justify-between gap-comfortable px-card py-section">
          <div className="min-w-0">
            <p className="text-3xl font-semibold tracking-figure tabular-nums text-fg">{formatMoney(status === "approved" ? given : r.amount)}</p>
            <p className="mt-inline text-sm text-muted">{tw("ofOwed", { owed: formatMoney(r.owedAtRequest) })}</p>
          </div>
          <StatusPill tone={WRITE_OFF_TONE[status]} className="shrink-0">
            {tw(`status.${status}`)}
          </StatusPill>
        </div>

        <Block title={tw("detail.what")}>
          <dl className="grid grid-cols-1 gap-comfortable sm:grid-cols-2">
            {waiting && (
              <div className="sm:col-span-2">
                <Fact label={tw("detail.after")}>
                  <span className="text-md font-medium">{consequence(owedNow, primary)}</span>
                </Fact>
              </div>
            )}
            <Fact label={tw("detail.guest")}>{r.customerName || t("walkIn")}</Fact>
            <Fact label={tw("detail.sale")}>
              <Link
                href={`/orders/${r.orderId}`}
                aria-label={tw("detail.openSale", { reference: r.orderReference })}
                className="inline-flex min-h-11 items-center font-mono text-sm text-brand-foreground underline underline-offset-4 hover:no-underline sm:min-h-0"
              >
                {r.orderReference}
              </Link>
            </Fact>
            {r.productName && (
              <Fact label={tw("detail.booking")}>
                {r.productName}
                {r.slotStart ? ` · ${formatDay(r.slotStart.slice(0, 10), { weekday: true })}` : ""}
              </Fact>
            )}
            <Fact label={tw("detail.owedThen")}>
              <span className="tabular-nums">{formatMoney(r.owedAtRequest)}</span>
            </Fact>
            <Fact label={tw("detail.owedNow")}>
              <span className="font-medium tabular-nums">{formatMoney(owedNow)}</span>
            </Fact>
          </dl>
          {waiting && owedNow <= 0 && (
            <Notice tone="warning" size="sm">
              {tw("detail.nothingOwed")}
            </Notice>
          )}
        </Block>

        <Block title={tw("detail.why")}>
          <p className="text-base font-medium text-fg">{tw(`categories.${r.category}`)}</p>
          {r.note ? <p className="break-words text-base text-fg-secondary">“{r.note}”</p> : <p className="text-sm text-muted">{t("noNote")}</p>}
          <p className="text-sm text-muted">{t("refunds.detail.askedLine", { name: r.requestedBy, ago: ago(r.requestedAt, now) })}</p>
        </Block>

        {waiting && (
          <Block title={tw("detail.respondBy")}>
            <div className="flex flex-wrap items-center gap-tight">
              <RespondChip dueAt={due} now={now} />
              <span className="text-base text-fg">
                {isWriteOffOverdue(r, now) ? tw("detail.overdueLine", { when: formatDateTime(due) }) : tw("detail.respondByLine", { when: formatDateTime(due) })}
              </span>
            </div>
          </Block>
        )}

        {!waiting && (
          <Block title={tw("detail.decision")}>
            {status === "approved" && (
              <p className="text-md font-medium text-fg">
                {less ? tw("detail.decisionApprovedLess", { amount: formatMoney(given), asked: formatMoney(r.amount) }) : tw("detail.decisionApproved", { amount: formatMoney(given) })}
              </p>
            )}
            {status === "rejected" && <p className="text-md font-medium text-fg">{tw("detail.decisionRejected")}</p>}
            {status === "withdrawn" && <p className="text-base text-fg">{tw("detail.decisionWithdrawn")}</p>}
            {status === "expired" && <p className="text-base text-fg">{tw("detail.expiredLine")}</p>}
            {(status === "approved" || status === "rejected") && r.decidedBy && (
              <p className="text-sm text-muted">{tw("detail.decidedBy", { name: r.decidedBy, when: decidedWhen })}</p>
            )}
            {r.decisionNote && <p className="break-words text-base text-fg-secondary">“{r.decisionNote}”</p>}
          </Block>
        )}

        <Block title={tw("detail.timeline")}>
          <Timeline items={timeline} />
        </Block>
      </div>
    );
  })();

  const canWriteOff = waiting && owedNow > 0;
  const footer = waiting && r ? (
    <div className="flex w-full flex-col-reverse gap-tight sm:flex-row sm:items-center">
      <div className="flex gap-tight sm:mr-auto">
        <Button variant="destructive" className="max-sm:flex-1" onClick={() => setRejecting(true)}>
          {tw("actions.reject")}
        </Button>
        {canWriteOff && (
          <Button variant="secondary" className="max-sm:flex-1" onClick={() => setAsking("different")}>
            {tw("actions.different")}
          </Button>
        )}
      </div>
      <Button disabled={!canWriteOff} onClick={() => setAsking("full")}>
        {tw("actions.writeOff", { amount: formatMoney(primary) })}
      </Button>
    </div>
  ) : undefined;

  return (
    <>
      <Sheet
        open={!!id}
        onClose={onClose}
        title={tw("detail.title")}
        closeLabel={t("close")}
        side
        footer={footer}
        className="max-md:h-[calc(100dvh-0.5rem)] max-md:max-h-none!"
      >
        {body}
      </Sheet>

      {asking === "full" && r && (
        <ConfirmDialog
          open
          destructive={false}
          title={tw("approve.title", { amount: formatMoney(primary) })}
          message={tw("approve.body", { consequence: consequence(owedNow, primary) })}
          loading={confirming}
          confirmLabel={tw("approve.confirm", { amount: formatMoney(primary) })}
          cancelLabel={t("cancel")}
          onClose={() => setAsking(null)}
          onConfirm={async () => {
            setConfirming(true);
            const res = await approveWriteOff(r.id, who, { amount: primary });
            setConfirming(false);
            if (!res.ok) {
              setAsking(null);
              toast.error(res.error.fieldErrors?.amount ?? res.error.message);
              return;
            }
            setAsking(null);
            toast.success(tw("approve.done", { amount: formatMoney(res.data.approvedAmount ?? res.data.amount) }));
          }}
        />
      )}

      {asking === "different" && r && (
        <DifferentAmountDialog
          r={r}
          owedNow={owedNow}
          who={who}
          onClose={() => setAsking(null)}
          onDone={(msg) => {
            setAsking(null);
            toast.success(msg);
          }}
        />
      )}

      {rejecting && r && (
        <ReasonDialog
          title={tw("reject.title")}
          label={tw("reject.noteLabel")}
          placeholder={tw("reject.placeholder")}
          help={tw("reject.help")}
          required={tw("reject.required")}
          confirm={tw("reject.confirm")}
          onClose={() => setRejecting(false)}
          onSubmit={async (note) => {
            const res = await rejectWriteOff(r.id, who, note);
            if (!res.ok) return res.error.fieldErrors?.note ?? res.error.message;
            setRejecting(false);
            toast.success(tw("reject.done"));
          }}
        />
      )}
    </>
  );
}

/**
 * Write off a different amount: at most what was asked, and at most what is
 * owed right now. Both limits are said in words, with the numbers, so the
 * manager does not have to work out which one they hit.
 */
function DifferentAmountDialog({
  r,
  owedNow,
  who,
  onClose,
  onDone,
}: {
  r: WriteOffRequest;
  owedNow: number;
  who: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const tw = useTranslations("requests.writeOffs");
  const tc = useTranslations("requests");
  const max = Math.min(r.amount, owedNow);
  const [text, setText] = useState(takaText(max));
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const parsed = parseTaka(text);
  const consequence = useConsequence();

  const problem = (): string | undefined => {
    if (!Number.isFinite(parsed)) return tw("approve.amountBad");
    if (parsed <= 0) return tw("approve.amountNeed");
    if (parsed > r.amount) return tw("approve.amountOverAsked", { asked: formatMoney(r.amount) });
    if (parsed > owedNow) return tw("approve.amountOverOwed", { owed: formatMoney(owedNow) });
    return undefined;
  };

  const submit = async () => {
    const bad = problem();
    if (bad) {
      setError(bad);
      document.getElementById("write-off-amount")?.focus();
      return;
    }
    setBusy(true);
    const res = await approveWriteOff(r.id, who, { amount: parsed });
    setBusy(false);
    if (!res.ok) {
      setError(res.error.fieldErrors?.amount ?? res.error.message);
      return;
    }
    onDone(tw("approve.done", { amount: formatMoney(res.data.approvedAmount ?? res.data.amount) }));
  };

  const valid = Number.isFinite(parsed) && parsed > 0;

  return (
    <Modal
      open
      onClose={onClose}
      title={tw("approve.differentTitle")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {tc("cancel")}
          </Button>
          <Button onClick={() => void submit()} loading={busy}>
            {tw("approve.confirm", { amount: valid ? formatMoney(parsed) : "" })}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-section">
        <p className="text-base text-fg-secondary">{tw("approve.differentLead", { asked: formatMoney(r.amount), owed: formatMoney(owedNow) })}</p>
        <AmountField
          id="write-off-amount"
          label={tw("approve.amountLabel")}
          help={tw("approve.amountHelp", { max: formatMoney(max) })}
          error={error}
          value={text}
          onChange={(v) => {
            setText(v);
            setError(undefined);
          }}
        />
        {valid && parsed <= max && <p className="text-sm text-muted">{consequence(owedNow, parsed)}</p>}
      </div>
    </Modal>
  );
}
