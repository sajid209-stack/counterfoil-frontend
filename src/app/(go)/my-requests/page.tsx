"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Inbox } from "lucide-react";
import { Button, SegmentedControl, Skeleton, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatClock, formatDateTime, formatDay, formatMoney } from "@/lib/format";
import {
  refundRequestsBy,
  refundStatusOf,
  scopeOf,
  useRefundVersion,
  withdrawRefundRequest,
  type RefundRequest,
} from "@/lib/api/refundRequests";
import {
  useWriteOffVersion,
  withdrawWriteOff,
  writeOffRequestsBy,
  writeOffStatusOf,
  type WriteOffRequest,
} from "@/lib/api/writeOffRequests";
import { useActor } from "../schedule/_lib/actor";
import { GoCard } from "../_components/Tiles";
import { GoPage, GoPageHeader } from "../_components/GoPage";
import { RAIL_SEGMENT } from "../_components/railType";
import { T } from "../_components/type";

/* ── My requests ──────────────────────────────────────────────────────────
 *
 * What THIS person asked a manager for — refunds and write-offs — and what the
 * manager said, so the cashier can tell the guest. Newest first, one card each.
 * A request that is still waiting can be taken back from here.
 */

type Item =
  | { kind: "refund"; id: string; at: string; req: RefundRequest }
  | { kind: "writeOff"; id: string; at: string; req: WriteOffRequest };

type Tab = "waiting" | "answered" | "all";
type Tone = "waiting" | "good" | "bad" | "quiet";

const isWaiting = (i: Item) => (i.kind === "refund" ? refundStatusOf(i.req) : writeOffStatusOf(i.req)) === "pending";

/** The status in words (a key under refunds.pos.requests.status) and its tone. */
function statusOf(i: Item): { key: string; tone: Tone } {
  if (i.kind === "refund") {
    const st = refundStatusOf(i.req);
    if (st === "pending") return { key: "pending", tone: "waiting" };
    if (st === "approved") return { key: "approvedRefund", tone: "good" };
    if (st === "declined") return { key: "declined", tone: "bad" };
    if (st === "withdrawn") return { key: "withdrawn", tone: "quiet" };
    return { key: "expired", tone: "quiet" };
  }
  const st = writeOffStatusOf(i.req);
  if (st === "pending") return { key: "pending", tone: "waiting" };
  if (st === "approved") return { key: "approvedWriteOff", tone: "good" };
  if (st === "rejected") return { key: "rejected", tone: "bad" };
  if (st === "withdrawn") return { key: "withdrawn", tone: "quiet" };
  return { key: "expired", tone: "quiet" };
}

const TONE: Record<Tone, string> = {
  waiting: "bg-warning-wash text-fg",
  good: "bg-success-wash text-success",
  bad: "bg-danger-wash text-danger",
  quiet: "bg-subtle text-fg-secondary ring-1 ring-inset ring-line",
};

export default function MyRequestsPage() {
  const t = useTranslations("refunds");
  const toast = useToast();
  const actor = useActor();
  useRefundVersion();
  useWriteOffVersion();
  const [tab, setTab] = useState<Tab>("waiting");
  const [busy, setBusy] = useState<string | null>(null);

  /* Both lists are read from the mock store on every render: a request made on
     the Schedule is here the moment the cashier opens this page. */
  const items: Item[] = actor.loading
    ? []
    : [
        ...refundRequestsBy(actor.name).map((req): Item => ({ kind: "refund", id: req.id, at: req.requestedAt, req })),
        ...writeOffRequestsBy(actor.name).map((req): Item => ({ kind: "writeOff", id: req.id, at: req.requestedAt, req })),
      ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  const waitingCount = items.filter(isWaiting).length;
  const counts = { waiting: waitingCount, answered: items.length - waitingCount, all: items.length };
  const shown = items.filter((i) => (tab === "all" ? true : tab === "waiting" ? isWaiting(i) : !isWaiting(i)));

  const takeBack = async (i: Item) => {
    if (busy) return;
    setBusy(i.id);
    if (i.kind === "refund") await withdrawRefundRequest(i.id);
    else await withdrawWriteOff(i.id);
    setBusy(null);
    toast.success(t("pos.status.takenBack"));
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "waiting", label: t("pos.requests.tabWaiting") },
    { key: "answered", label: t("pos.requests.tabAnswered") },
    { key: "all", label: t("pos.requests.tabAll") },
  ];

  return (
    <GoPage width="narrow">
    <main className="mx-auto w-full max-w-160 pt-tight pb-40 rail:max-w-none rail:pb-0 rail:pt-0">
      <GoPageHeader title={t("pos.requests.title")} subtitle={<span className="-mt-inline block">{t("pos.requests.subtitle")}</span>} className="mb-comfortable! rail:mb-major!" />

      <div className="flex flex-col gap-comfortable rail:gap-section">
      {/* Three views of one list: a standard segmented control, equal widths,
          the count after the word ("Waiting · 4"), no tick. */}
      <SegmentedControl
        fullWidth
        className={`rail:w-auto rail:max-w-md ${RAIL_SEGMENT}`}
        aria-label={t("pos.requests.title")}
        value={tab}
        onChange={(v) => setTab(v as Tab)}
        options={tabs.map((x) => ({ value: x.key, label: `${x.label} · ${counts[x.key]}` }))}
      />

      {actor.loading ? (
        <div aria-busy="true" className="flex flex-col gap-tight">
          <Skeleton h={120} className="rounded-card" />
          <Skeleton h={120} className="rounded-card" />
        </div>
      ) : shown.length === 0 ? (
        <GoCard className="items-center py-major text-center">
          <Inbox size={32} strokeWidth={1.5} aria-hidden className="text-muted" />
          <p className="max-w-xs text-md text-muted">
            {tab === "waiting" ? t("pos.requests.emptyWaiting") : tab === "answered" ? t("pos.requests.emptyAnswered") : t("pos.requests.emptyAll")}
          </p>
        </GoCard>
      ) : (
        <ul className="flex flex-col gap-tight rail:rounded-card rail:bg-card rail:shadow-card rail:gap-0 rail:overflow-hidden">
          {shown.map((i) => (
            <RequestCard key={`${i.kind}-${i.id}`} item={i} busy={busy === i.id} onTakeBack={() => void takeBack(i)} />
          ))}
        </ul>
      )}
      </div>
    </main>
    </GoPage>
  );
}

function RequestCard({ item: i, busy, onTakeBack }: { item: Item; busy: boolean; onTakeBack: () => void }) {
  const t = useTranslations("refunds");
  const [open, setOpen] = useState(false);
  const st = statusOf(i);
  const r = i.req;
  const approved = st.tone === "good";
  const amount = approved ? r.approvedAmount ?? r.amount : r.amount;
  const slot = r.slotStart ? `${formatDay(r.slotStart.slice(0, 10), { weekday: true })}, ${formatClock(r.slotStart.slice(11, 16))}` : null;
  const guest = r.customerName?.trim() || t("pos.requests.noGuest");
  const why = i.kind === "refund" ? t(`reasons.${i.req.reason}`) : t(`pos.writeOff.category.${i.req.category}`);
  const what = i.kind === "refund" ? t(`pos.requests.scope.${scopeOf(i.req)}`) : null;
  const reason = [what, why].filter(Boolean).join(" · ");
  const yourNote = r.note?.trim();
  /* A manager said something: not a refund the cashier did on the spot (they
     asked and approved in one breath: there is nothing to relay). */
  const decisionNote = r.decisionNote?.trim();
  const answered = !!r.decidedAt && st.tone !== "quiet" && r.decidedBy !== r.requestedBy;
  const kind = i.kind === "refund" ? t("pos.requests.kindRefund") : t("pos.requests.kindWriteOff");
  const hasMore = !!yourNote || reason.length > 48 || !!r.productName;

  return (
    <li data-request={i.kind} data-status={st.key} className="card-surface flex flex-col gap-tight p-comfortable rail:rounded-none rail:border-t rail:border-line rail:bg-transparent rail:px-card rail:py-comfortable rail:shadow-none rail:first:border-t-0">
      <div className="flex items-baseline justify-between gap-comfortable">
        <p className={`min-w-0 break-words ${T.item}`}>{r.productName || guest}</p>
        <p className={`shrink-0 ${T.price}`}>{formatMoney(amount)}</p>
      </div>

      <div className="flex items-center justify-between gap-comfortable">
        <p className={`min-w-0 ${T.meta}`}>
          {kind} · {formatDateTime(r.requestedAt)}
        </p>
        <span data-status-pill className={cn("shrink-0 rounded-full px-comfortable py-inline", T.status, TONE[st.tone])}>
          {t(`pos.requests.status.${st.key}`)}
        </span>
      </div>

      <p className={cn(T.body, !open && "truncate")}>{reason}</p>

      {open && (
        <div className="flex flex-col gap-inline">
          <p className={T.meta}>{[guest, slot].filter(Boolean).join(" · ")}</p>
          {yourNote && (
            <p className={`break-words ${T.body}`}>
              <span className={T.label}>{t("pos.requests.yourNote")}: </span>
              {yourNote}
            </p>
          )}
        </div>
      )}

      {answered && (
        <div data-manager-note className={cn("rounded-inner p-comfortable", approved ? "bg-success-wash" : "bg-subtle ring-1 ring-inset ring-line")}>
          <p className={T.label}>{t("pos.requests.managerNote")}</p>
          <p className={`break-words ${T.body}`}>{decisionNote || t("pos.status.noNote")}</p>
          {r.decidedBy && <p className={`mt-inline ${T.meta}`}>{t("pos.requests.decidedBy", { name: r.decidedBy })}</p>}
        </div>
      )}
      {st.key === "expired" && <p className={T.meta}>{t("pos.status.expired")}</p>}

      {(hasMore || st.tone === "waiting") && (
        <div className="flex items-center justify-between gap-comfortable">
          {hasMore ? (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="inline-flex min-h-11 items-center text-sm font-medium text-brand-foreground underline-offset-2 hover:underline rail:min-h-10"
            >
              {open ? t("pos.requests.hideNote") : t("pos.requests.showNote")}
            </button>
          ) : (
            <span />
          )}
          {st.tone === "waiting" && (
            <Button variant="secondary" size="md" className="h-10! whitespace-nowrap text-sm! font-medium!" loading={busy} onClick={onTakeBack}>
              {t("pos.status.takeBack")}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
