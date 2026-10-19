"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { HandCoins, Inbox, RotateCcw } from "lucide-react";
import { Button, Skeleton, useToast } from "@/components/ui";
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
import { GoCard, Tile, TileGrid } from "../_components/Tiles";

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
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-comfortable px-section py-section pb-28 lg:pb-section">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-title text-fg">{t("pos.requests.title")}</h1>
        <p className="text-sm text-muted">{t("pos.requests.subtitle")}</p>
      </div>

      <TileGrid cols={3} role="tablist" aria-label={t("pos.requests.title")}>
        {tabs.map((x) => (
          <Tile key={x.key} role="tab" aria-selected={tab === x.key} selected={tab === x.key} onClick={() => setTab(x.key)} className="min-h-12 flex-row gap-inline text-md font-semibold">
            {x.label}
            <span className="tabular-nums opacity-80">{counts[x.key]}</span>
          </Tile>
        ))}
      </TileGrid>

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
        <ul className="flex flex-col gap-tight">
          {shown.map((i) => (
            <RequestCard key={`${i.kind}-${i.id}`} item={i} busy={busy === i.id} onTakeBack={() => void takeBack(i)} />
          ))}
        </ul>
      )}
    </main>
  );
}

function RequestCard({ item: i, busy, onTakeBack }: { item: Item; busy: boolean; onTakeBack: () => void }) {
  const t = useTranslations("refunds");
  const st = statusOf(i);
  const r = i.req;
  const approved = st.tone === "good";
  const amount = approved ? r.approvedAmount ?? r.amount : r.amount;
  const slot = r.slotStart ? `${formatDay(r.slotStart.slice(0, 10), { weekday: true })}, ${formatClock(r.slotStart.slice(11, 16))}` : null;
  const guest = r.customerName?.trim() || t("pos.requests.noGuest");
  const why = i.kind === "refund" ? t(`reasons.${i.req.reason}`) : t(`pos.writeOff.category.${i.req.category}`);
  const what = i.kind === "refund" ? t(`pos.requests.scope.${scopeOf(i.req)}`) : null;
  const yourNote = r.note?.trim();
  const decisionNote = r.decisionNote?.trim();
  /* A manager said something — not a refund the cashier did on the spot (they
     asked and approved in one breath: there is nothing to relay). */
  const answered = !!r.decidedAt && st.tone !== "quiet" && r.decidedBy !== r.requestedBy;
  const Icon = i.kind === "refund" ? RotateCcw : HandCoins;

  return (
    <li data-request={i.kind} data-status={st.key} className="card-surface flex flex-col gap-tight p-comfortable">
      <div className="flex items-center gap-comfortable">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-subtle text-fg [&_svg]:size-5">
          <Icon strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-md font-semibold text-fg">{i.kind === "refund" ? t("pos.requests.kindRefund") : t("pos.requests.kindWriteOff")}</p>
          <p className="text-sm text-muted">{t("pos.requests.askedAt", { when: formatDateTime(r.requestedAt) })}</p>
        </div>
        <span data-status-pill className={cn("shrink-0 rounded-full px-comfortable py-inline text-sm font-semibold", TONE[st.tone])}>
          {t(`pos.requests.status.${st.key}`)}
        </span>
      </div>

      <div className="flex items-end justify-between gap-comfortable">
        <div className="min-w-0">
          <p className="break-words text-md font-semibold text-fg">{r.productName || guest}</p>
          <p className="break-words text-sm text-muted">{[guest, slot].filter(Boolean).join(" · ")}</p>
        </div>
        <p className="shrink-0 text-2xl font-semibold tabular-nums text-fg">{formatMoney(amount)}</p>
      </div>

      <p className="text-sm text-fg-secondary">{[what, why].filter(Boolean).join(" · ")}</p>
      {yourNote && (
        <p className="break-words text-sm text-muted">
          <span className="font-semibold text-fg-secondary">{t("pos.requests.yourNote")}: </span>
          {yourNote}
        </p>
      )}

      {answered && (
        <div data-manager-note className={cn("rounded-inner p-comfortable", approved ? "bg-success-wash" : "bg-subtle ring-1 ring-inset ring-line")}>
          <p className="text-sm font-semibold text-fg">{t("pos.requests.managerNote")}</p>
          <p className="break-words text-md text-fg">{decisionNote || t("pos.status.noNote")}</p>
          {r.decidedBy && <p className="mt-inline text-sm text-muted">{t("pos.requests.decidedBy", { name: r.decidedBy })}</p>}
        </div>
      )}
      {st.key === "expired" && <p className="text-sm text-muted">{t("pos.status.expired")}</p>}

      {st.tone === "waiting" && (
        <div className="flex justify-end">
          <Button variant="secondary" size="lg" loading={busy} onClick={onTakeBack}>
            {t("pos.status.takeBack")}
          </Button>
        </div>
      )}
    </li>
  );
}
