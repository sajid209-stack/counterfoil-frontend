"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { FileX } from "lucide-react";
import { Select, StatusPill, type Column, type FilterSpec } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { useActiveLocation } from "@/lib/activeLocation";
import { formatMoney } from "@/lib/format";
import { listLocations } from "@/lib/api";
import {
  WRITE_OFF_CATEGORIES,
  listWriteOffRequests,
  useWriteOffVersion,
  writeOffDueAtOf,
  writeOffStatusOf,
  writeOffSummary,
  type WriteOffListTab,
  type WriteOffRequest,
} from "@/lib/api/writeOffRequests";
import type { WriteOffCategory } from "@/lib/api";
import { RequestsList } from "../refunds/_components/RequestsList";
import { RespondChip, useAgo, useNow } from "../refunds/_components/kit";
import { WRITE_OFF_TONE, WriteOffDetail } from "./_components/WriteOffDetail";

export default function WriteOffsPage() {
  return (
    <Suspense fallback={null}>
      <WriteOffsView />
    </Suspense>
  );
}

/**
 * Write-offs — balances the counter has asked to stop chasing.
 *
 * A write-off moves no money: it clears what a guest still owes and records why.
 * At the counter that is rarely a cashier's call, so they ask and a manager
 * answers here. The shape is Refunds' exactly — the venue in the bar's list,
 * oldest first while waiting, a row opening the request beside the list,
 * `?open=<id>` opening one directly — because it is the same job on a different
 * kind of request.
 */
function WriteOffsView() {
  const t = useTranslations("requests");
  const tw = useTranslations("requests.writeOffs");
  const sp = useSearchParams();
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const { id: locationId, pending } = useActiveLocation(locationsQ.data?.data ?? []);
  const version = useWriteOffVersion();
  const now = useNow();
  const ago = useAgo();

  const [tab, setTab] = useState<WriteOffListTab>("waiting");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<WriteOffCategory | "">("");
  const [askedBy, setAskedBy] = useState("");
  const [openId, setOpenId] = useState<string | null>(() => sp.get("open"));

  const open = (id: string | null) => {
    setOpenId(id);
    // Replace, never push: closing a detail is not a page the Back button should visit.
    window.history.replaceState(null, "", id ? `/write-offs?open=${encodeURIComponent(id)}` : "/write-offs");
  };

  const rows = useMemo(
    () => (pending ? [] : listWriteOffRequests({ tab, q: search, locationId, category: category || undefined, requestedBy: askedBy || undefined })),
    // `version` is not read inside, but a request being answered changes the answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pending, tab, search, locationId, category, askedBy, version],
  );
  const summary = useMemo(
    () => (pending ? null : writeOffSummary(locationId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pending, locationId, version],
  );
  const people = useMemo(
    () => (pending ? [] : [...new Set(listWriteOffRequests({ locationId }).map((r) => r.requestedBy))].sort()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pending, locationId, version],
  );

  const filtered = !!(search.trim() || category || askedBy);
  const reset = () => {
    setSearch("");
    setCategory("");
    setAskedBy("");
  };

  const summaryText = !summary
    ? ""
    : summary.waiting === 0
      ? tw("summary.none")
      : [
          tw("summary.waiting", { count: summary.waiting }),
          formatMoney(summary.waitingAmount),
          ...(summary.overdue > 0 ? [tw("summary.overdue", { count: summary.overdue })] : []),
        ].join(" · ");

  const status = (r: WriteOffRequest) => writeOffStatusOf(r, now);
  const pill = (r: WriteOffRequest) => <StatusPill tone={WRITE_OFF_TONE[status(r)]}>{tw(`status.${status(r)}`)}</StatusPill>;
  const given = (r: WriteOffRequest) => (status(r) === "approved" ? (r.approvedAmount ?? r.amount) : r.amount);

  const columns: Column<WriteOffRequest>[] = [
    {
      key: "guest",
      header: tw("col.guest"),
      render: (r) => (
        <span className="block min-w-0 max-w-[18rem]">
          <span className="block truncate font-medium">{r.customerName || t("walkIn")}</span>
          <span className="block truncate text-sm text-muted">{r.productName ?? "—"}</span>
          <span className="block truncate font-mono text-xs text-muted">{r.orderReference}</span>
        </span>
      ),
    },
    {
      key: "amount",
      header: tw("col.amount"),
      align: "right",
      render: (r) => (
        <span className="block whitespace-nowrap">
          <span className="block font-medium tabular-nums">{formatMoney(given(r))}</span>
          <span className="block text-xs text-muted">{tw("ofOwed", { owed: formatMoney(r.owedAtRequest) })}</span>
        </span>
      ),
    },
    { key: "category", header: tw("col.category"), render: (r) => <span className="block max-w-[12rem] truncate">{tw(`categories.${r.category}`)}</span> },
    { key: "askedBy", header: tw("col.askedBy"), render: (r) => <span className="block max-w-[10rem] truncate">{r.requestedBy}</span> },
    {
      key: "asked",
      header: tw("col.asked"),
      render: (r) => <span className="whitespace-nowrap text-sm text-fg-secondary">{ago(r.requestedAt, now)}</span>,
    },
    {
      key: "respondBy",
      header: tw("col.respondBy"),
      render: (r) => (status(r) === "pending" ? <RespondChip dueAt={writeOffDueAtOf(r)} now={now} /> : <span className="text-muted">—</span>),
    },
    { key: "status", header: tw("col.status"), render: pill },
  ];

  const renderCard = (r: WriteOffRequest) => (
    <div className="flex min-w-0 flex-col gap-inline">
      <div className="flex items-baseline justify-between gap-tight">
        <span className="min-w-0 flex-1 truncate text-base font-medium">{r.customerName || t("walkIn")}</span>
        <span className="shrink-0 text-base font-semibold tabular-nums">{formatMoney(given(r))}</span>
      </div>
      <div className="flex items-center justify-between gap-tight">
        <span className="min-w-0 flex-1 truncate text-sm text-muted">
          {[tw(`categories.${r.category}`), tw("ofOwed", { owed: formatMoney(r.owedAtRequest) }), ago(r.requestedAt, now)].join(" · ")}
        </span>
        {status(r) === "pending" ? <RespondChip dueAt={writeOffDueAtOf(r)} now={now} /> : pill(r)}
      </div>
    </div>
  );

  const filters: FilterSpec[] = [
    {
      key: "category",
      label: tw("filters.category"),
      active: category ? tw(`categories.${category}`) : null,
      onClear: () => setCategory(""),
      control: (
        <Select
          value={category}
          onChange={(v) => setCategory(v as WriteOffCategory | "")}
          aria-label={tw("filters.category")}
          size="sm"
          options={[{ value: "", label: tw("filters.anyCategory") }, ...WRITE_OFF_CATEGORIES.map((x) => ({ value: x, label: tw(`categories.${x}`) }))]}
        />
      ),
    },
    {
      key: "askedBy",
      label: tw("filters.askedBy"),
      active: askedBy || null,
      onClear: () => setAskedBy(""),
      control: (
        <Select
          value={askedBy}
          onChange={setAskedBy}
          aria-label={tw("filters.askedBy")}
          size="sm"
          options={[{ value: "", label: tw("filters.anyone") }, ...people.map((p) => ({ value: p, label: p }))]}
        />
      ),
    },
  ];

  const emptyKey = filtered ? "filtered" : tab === "approved" ? "done" : tab;

  return (
    <RequestsList
      title={tw("title")}
      description={tw("description")}
      summary={summaryText}
      tabsLabel={tw("tabsLabel")}
      tabs={[
        { value: "waiting", label: tw("tabs.waiting"), count: summary?.waiting },
        { value: "approved", label: tw("tabs.done"), count: summary?.approved },
        { value: "rejected", label: tw("tabs.rejected"), count: summary?.rejected },
        { value: "all", label: tw("tabs.all"), count: summary?.all },
      ]}
      tab={tab}
      onTab={(v) => setTab(v as WriteOffListTab)}
      search={search}
      onSearch={setSearch}
      searchPlaceholder={tw("search")}
      filters={filters}
      columns={columns}
      rows={rows}
      getRowId={(r) => r.id}
      onOpen={(r) => open(r.id)}
      renderCard={renderCard}
      loading={pending}
      emptyIcon={<FileX size={24} strokeWidth={1.5} aria-hidden />}
      empty={{ title: tw(`empty.${emptyKey}.title`), body: tw(`empty.${emptyKey}.body`) }}
      filtered={filtered}
      onReset={reset}
    >
      <WriteOffDetail id={openId} onClose={() => open(null)} />
    </RequestsList>
  );
}
