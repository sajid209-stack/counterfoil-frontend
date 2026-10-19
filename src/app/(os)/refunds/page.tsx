"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { RotateCcw } from "lucide-react";
import { Select, StatusPill, type Column, type FilterSpec } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { useActiveLocation } from "@/lib/activeLocation";
import { formatMoney } from "@/lib/format";
import { listLocations } from "@/lib/api";
import {
  REFUND_REASONS,
  REFUND_SCOPES,
  dueAtOf,
  listRefundRequests,
  refundStatusOf,
  refundSummary,
  scopeOf,
  useRefundVersion,
  type RefundListTab,
  type RefundReason,
  type RefundRequest,
  type RefundScope,
} from "@/lib/api/refundRequests";
import { RefundDetail, REFUND_TONE, slotText } from "./_components/RefundDetail";
import { RequestsList } from "./_components/RequestsList";
import { RespondChip, useAgo, useNow } from "./_components/kit";

export default function RefundsPage() {
  return (
    <Suspense fallback={null}>
      <RefundsView />
    </Suspense>
  );
}

/**
 * Refunds — the requests the counter has sent, waiting for a manager.
 *
 * A cashier can see the guest and the booking, but usually cannot give money back
 * on their own say-so; they ask, and this is where somebody with the authority
 * answers. The list is the venue in the bar's, oldest first while it is waiting
 * (whoever has waited longest is first), newest first everywhere else. A row
 * opens the request beside the list; `?open=<id>` opens one directly, which is
 * how the order page links here.
 *
 * Nothing is read until the venues have arrived: the requests are seeded with the
 * real clock, so the server cannot draw the same list the browser will.
 */
function RefundsView() {
  const t = useTranslations("requests");
  const tf = useTranslations("requests.refunds");
  const sp = useSearchParams();
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const { id: locationId, pending } = useActiveLocation(locationsQ.data?.data ?? []);
  const version = useRefundVersion();
  const now = useNow();
  const ago = useAgo();

  const [tab, setTab] = useState<RefundListTab>("waiting");
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState<RefundReason | "">("");
  const [scope, setScope] = useState<RefundScope | "">("");
  const [askedBy, setAskedBy] = useState("");
  const [openId, setOpenId] = useState<string | null>(() => sp.get("open"));

  const open = (id: string | null) => {
    setOpenId(id);
    // Replace, never push: closing a detail is not a page the Back button should visit.
    window.history.replaceState(null, "", id ? `/refunds?open=${encodeURIComponent(id)}` : "/refunds");
  };

  const rows = useMemo(
    () =>
      pending
        ? []
        : listRefundRequests({ tab, q: search, locationId, reason: reason || undefined, scope: scope || undefined, requestedBy: askedBy || undefined }),
    // `version` is not read inside, but a request being answered changes the answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pending, tab, search, locationId, reason, scope, askedBy, version],
  );
  const summary = useMemo(
    () => (pending ? null : refundSummary(locationId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pending, locationId, version],
  );
  const people = useMemo(
    () => (pending ? [] : [...new Set(listRefundRequests({ locationId }).map((r) => r.requestedBy))].sort()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pending, locationId, version],
  );

  const filtered = !!(search.trim() || reason || scope || askedBy);
  const reset = () => {
    setSearch("");
    setReason("");
    setScope("");
    setAskedBy("");
  };

  const summaryText = !summary
    ? ""
    : summary.waiting === 0
      ? tf("summary.none")
      : [
          tf("summary.waiting", { count: summary.waiting }),
          formatMoney(summary.waitingAmount),
          ...(summary.overdue > 0 ? [tf("summary.overdue", { count: summary.overdue })] : []),
        ].join(" · ");

  const status = (r: RefundRequest) => refundStatusOf(r, now);
  const pill = (r: RefundRequest) => <StatusPill tone={REFUND_TONE[status(r)]}>{tf(`status.${status(r)}`)}</StatusPill>;
  const what = (r: RefundRequest) => tf(`scopeShort.${scopeOf(r)}`);
  /* The amount: what was asked — or, for an approved goodwill refund that was
     lowered, what actually went back, with the ask under it. */
  const given = (r: RefundRequest) => (status(r) === "approved" ? (r.approvedAmount ?? r.amount) : r.amount);

  const columns: Column<RefundRequest>[] = [
    {
      key: "guest",
      header: tf("col.guest"),
      render: (r) => (
        <span className="block min-w-0 max-w-[18rem]">
          <span className="block truncate font-medium">{r.customerName || t("walkIn")}</span>
          <span className="block truncate text-sm text-muted">{[r.productName, r.place].filter(Boolean).join(" · ")}</span>
          {slotText(r) && <span className="block truncate text-xs text-muted">{slotText(r)}</span>}
        </span>
      ),
    },
    {
      key: "amount",
      header: tf("col.amount"),
      align: "right",
      render: (r) => (
        <span className="block whitespace-nowrap">
          <span className="block font-medium tabular-nums">{formatMoney(given(r))}</span>
          {status(r) === "approved" && given(r) !== r.amount && (
            <span className="block text-xs text-muted">{tf("detail.askedOf", { asked: formatMoney(r.amount) })}</span>
          )}
        </span>
      ),
    },
    {
      key: "reason",
      header: tf("col.reason"),
      render: (r) => (
        <span className="block min-w-0 max-w-[12rem]">
          <span className="block truncate">{tf(`reasons.${r.reason}`)}</span>
          <span className="block truncate text-xs text-muted">{what(r)}</span>
        </span>
      ),
    },
    { key: "askedBy", header: tf("col.askedBy"), render: (r) => <span className="block max-w-[10rem] truncate">{r.requestedBy}</span> },
    {
      key: "asked",
      header: tf("col.asked"),
      render: (r) => <span className="whitespace-nowrap text-sm text-fg-secondary">{ago(r.requestedAt, now)}</span>,
    },
    {
      key: "respondBy",
      header: tf("col.respondBy"),
      render: (r) => (status(r) === "pending" ? <RespondChip dueAt={dueAtOf(r)} now={now} /> : <span className="text-muted">—</span>),
    },
    { key: "status", header: tf("col.status"), render: pill },
  ];

  /* The phone's row: who and how much, then what and when. One line each. */
  const renderCard = (r: RefundRequest) => (
    <div className="flex min-w-0 flex-col gap-inline">
      <div className="flex items-baseline justify-between gap-tight">
        <span className="min-w-0 flex-1 truncate text-base font-medium">{r.customerName || t("walkIn")}</span>
        <span className="shrink-0 text-base font-semibold tabular-nums">{formatMoney(given(r))}</span>
      </div>
      <div className="flex items-center justify-between gap-tight">
        <span className="min-w-0 flex-1 truncate text-sm text-muted">
          {[r.productName, tf(`reasons.${r.reason}`), ago(r.requestedAt, now)].join(" · ")}
        </span>
        {status(r) === "pending" ? <RespondChip dueAt={dueAtOf(r)} now={now} /> : pill(r)}
      </div>
    </div>
  );

  const filters: FilterSpec[] = [
    {
      key: "reason",
      label: tf("filters.reason"),
      active: reason ? tf(`reasons.${reason}`) : null,
      onClear: () => setReason(""),
      control: (
        <Select
          value={reason}
          onChange={(v) => setReason(v as RefundReason | "")}
          aria-label={tf("filters.reason")}
          size="sm"
          options={[{ value: "", label: tf("filters.anyReason") }, ...REFUND_REASONS.map((x) => ({ value: x, label: tf(`reasons.${x}`) }))]}
        />
      ),
    },
    {
      key: "what",
      label: tf("filters.what"),
      active: scope ? tf(`scopeShort.${scope}`) : null,
      onClear: () => setScope(""),
      control: (
        <Select
          value={scope}
          onChange={(v) => setScope(v as RefundScope | "")}
          aria-label={tf("filters.what")}
          size="sm"
          options={[{ value: "", label: tf("filters.anyWhat") }, ...REFUND_SCOPES.map((x) => ({ value: x, label: tf(`scopeShort.${x}`) }))]}
        />
      ),
    },
    {
      key: "askedBy",
      label: tf("filters.askedBy"),
      active: askedBy || null,
      onClear: () => setAskedBy(""),
      control: (
        <Select
          value={askedBy}
          onChange={setAskedBy}
          aria-label={tf("filters.askedBy")}
          size="sm"
          options={[{ value: "", label: tf("filters.anyone") }, ...people.map((p) => ({ value: p, label: p }))]}
        />
      ),
    },
  ];

  const emptyKey = filtered ? "filtered" : tab === "approved" ? "done" : tab;

  return (
    <RequestsList
      title={tf("title")}
      description={tf("description")}
      summary={summaryText}
      tabsLabel={tf("tabsLabel")}
      tabs={[
        { value: "waiting", label: tf("tabs.waiting"), count: summary?.waiting },
        { value: "approved", label: tf("tabs.done"), count: summary?.approved },
        { value: "declined", label: tf("tabs.declined"), count: summary?.declined },
        { value: "all", label: tf("tabs.all"), count: summary?.all },
      ]}
      tab={tab}
      onTab={(v) => setTab(v as RefundListTab)}
      search={search}
      onSearch={setSearch}
      searchPlaceholder={tf("search")}
      filters={filters}
      columns={columns}
      rows={rows}
      getRowId={(r) => r.id}
      onOpen={(r) => open(r.id)}
      renderCard={renderCard}
      loading={pending}
      emptyIcon={<RotateCcw size={24} strokeWidth={1.5} aria-hidden />}
      empty={{ title: tf(`empty.${emptyKey}.title`), body: tf(`empty.${emptyKey}.body`) }}
      filtered={filtered}
      onReset={reset}
    >
      <RefundDetail id={openId} onClose={() => open(null)} />
    </RequestsList>
  );
}
