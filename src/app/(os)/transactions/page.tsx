"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Banknote, Copy, CreditCard, Download, FileMinus, QrCode, RotateCcw, Search, Smartphone, Ticket, Wallet, type LucideIcon } from "lucide-react";
import {
  Button,
  DataTable,
  EmptyState,
  FilterBar,
  PageShell,
  Select,
  Sheet,
  StatStrip,
  StatusPill,
  useToast,
  type Column,
  type PillTone,
} from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import {
  getTransactionSummary,
  listCounters,
  listLocations,
  listStaff,
  listTransactions,
  peekTransactions,
  type ApiResult,
  type ListResponse,
  type PaymentMethod,
  type PaymentStatus,
  type CollectedBy,
  type Transaction,
  type TransactionFilters,
  type TransactionKind,
  type TransactionSummary,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateTime, formatMoney, formatRelative } from "@/lib/format";
import { useEnumLabels } from "@/lib/labels";
import { useActiveLocation } from "@/lib/activeLocation";
import { DEMO_TODAY, demoNow } from "@/lib/schedule";
import { CollectorBadge } from "../money/_components/MoneyKit";

const METHOD_ICON: Record<PaymentMethod, LucideIcon> = {
  cash: Wallet,
  bkash: Smartphone,
  bangla_qr: QrCode,
  card_terminal: CreditCard,
  voucher: Ticket,
  credit: Ticket,
};

const STATUS_TONE: Record<PaymentStatus, PillTone> = { confirmed: "success", pending: "info", failed: "danger" };

/** A query that waits: the venue has not resolved yet, and reading every
 *  venue's money for one frame would flash a figure that is not this venue's. */
const held = <T,>() => new Promise<ApiResult<T>>(() => {});

type Range = "all" | "today" | "7d" | "30d";
const PAGE_SIZE = 15;

export default function TransactionsPage() {
  return (
    <Suspense>
      <TransactionsInner />
    </Suspense>
  );
}

/**
 * Transactions — the money, rather than the sale.
 *
 * Orders answers "what did we sell". This answers the question a manager asks
 * at close and an accountant asks at month end: what money moved, how, and
 * does it agree with the drawer and the bank. So a row is one movement — a
 * payment in, a refund out, or a balance written off — never an order, and a
 * split-tender sale is two rows because it was two payments.
 *
 * The shape is the one every payments console converged on (Stripe's Payments
 * list, Square's Transactions, Shopify's Payouts): figures first, a ledger you
 * can filter and export, a detail you open without leaving it, and payouts on
 * their own tab because they are a different timeline — when the bank gets
 * it, not when the customer paid.
 *
 * Scoped to the venue in the bar, like every OS page but Settings.
 */
function TransactionsInner() {
  const router = useRouter();

  const t = useTranslations("transactions");
  const tc = useTranslations("common");
  const tm = useTranslations("money");
  const enumL = useEnumLabels();
  const toast = useToast();
  const now = useMemo(() => demoNow(), []);

  const [search, setSearch] = useState("");
  const [range, setRange] = useState<Range>("30d");
  const [kind, setKind] = useState<TransactionKind | "">("");
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [status, setStatus] = useState<PaymentStatus | "">("");
  const [heldBy, setHeldBy] = useState<CollectedBy | "">("");
  const [sort, setSort] = useState<{ key: string; order: "asc" | "desc" }>({ key: "at", order: "desc" });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Transaction | null>(null);

  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const countersQ = useApiQuery(() => listCounters({ pageSize: 200 }), []);
  const staffQ = useApiQuery(() => listStaff({ pageSize: 200 }), []);
  const { id: locationId, pending } = useActiveLocation(locationsQ.data?.data ?? []);

  const bounds = useMemo(() => {
    if (range === "all") return {};
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    if (range === "7d") start.setDate(start.getDate() - 6);
    if (range === "30d") start.setDate(start.getDate() - 29);
    const end = new Date(now);
    end.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() + 1);
    return { from: start.toISOString(), to: end.toISOString() };
  }, [range, now]);

  const filters = useMemo<TransactionFilters>(
    () => ({
      locationId: locationId || undefined,
      kind: kind || undefined,
      method: method || undefined,
      status: status || undefined,
      collectedBy: heldBy || undefined,
      ...bounds,
    }),
    [locationId, kind, method, status, heldBy, bounds],
  );

  const listQ = useApiQuery(
    () => (pending ? held<ListResponse<Transaction>>() : listTransactions({ page, pageSize: PAGE_SIZE, search, sort: sort.key, order: sort.order, filters })),
    [pending, page, search, sort.key, sort.order, filters],
  );
  const summaryQ = useApiQuery(
    () => (pending ? held<TransactionSummary>() : getTransactionSummary(filters, search)),
    [pending, filters, search],
  );
  const s = summaryQ.data;

  const resetPage = () => setPage(1);
  const kindLabel = (k: TransactionKind) => t(`kind.${k}`);
  const rangeLabel = (r: Range) =>
    r === "today" ? t("rangeToday") : r === "7d" ? t("range7d") : r === "30d" ? t("range30d") : t("allRanges");
  const channelLabel = (c: string) => (c === "counter" ? t("channelCounter") : t("channelOnline"));

  /** Exactly what the filters show, every page of it — an export of page one
   *  would be a quietly wrong file. */
  const exportCsv = () => {
    const rows = peekTransactions(filters, search).sort((a, b) => b.at.localeCompare(a.at));
    const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = "Date,Transaction ID,Type,Method,Held by,Status,Amount,Order,Customer,Channel,Provider reference";
    const body = rows.map((r) =>
      [
        r.at,
        r.id,
        kindLabel(r.kind),
        r.method ? enumL.method(r.method) : "",
        r.collectedBy ? tm(`heldBy.${r.collectedBy}`) : "",
        t(`status.${r.status}`),
        (r.amount / 100).toFixed(2),
        r.orderReference,
        q(r.customerName ?? ""),
        channelLabel(r.channel),
        r.reference ?? "",
      ].join(","),
    );
    const url = URL.createObjectURL(new Blob([[header, ...body].join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${DEMO_TODAY}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("exported", { count: rows.length }));
  };

  const amountCell = (r: Transaction) => (
    <span
      className={cn(
        "whitespace-nowrap font-mono text-[13px] tabular-nums",
        // A write-off moved no money; it reads in the muted ink so it never
        // passes for a figure in the column's sum.
        r.kind === "write_off" ? "text-muted line-through decoration-muted/60" : r.amount < 0 ? "text-fg" : "font-medium text-fg",
      )}
    >
      {r.amount < 0 ? `−${formatMoney(-r.amount)}` : formatMoney(r.amount)}
    </span>
  );

  const methodCell = (r: Transaction) => {
    if (!r.method) return <span className="text-muted">{t("noMethod")}</span>;
    const Icon = METHOD_ICON[r.method];
    return (
      <span className="inline-flex items-center gap-tight whitespace-nowrap">
        <Icon size={15} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
        {enumL.method(r.method)}
      </span>
    );
  };

  const kindCell = (r: Transaction) => {
    const Icon = r.kind === "payment" ? Banknote : r.kind === "refund" ? RotateCcw : FileMinus;
    return (
      <span className={cn("inline-flex items-center gap-tight whitespace-nowrap", r.kind !== "payment" && "text-muted")}>
        <Icon size={15} strokeWidth={1.5} aria-hidden className="shrink-0" />
        {kindLabel(r.kind)}
      </span>
    );
  };

  const columns: Column<Transaction>[] = [
    {
      key: "at",
      header: t("colDate"),
      sortable: true,
      render: (r) => (
        <span className="whitespace-nowrap text-muted" title={formatDateTime(r.at)}>
          {formatRelative(r.at, now)}
        </span>
      ),
    },
    { key: "kind", header: t("colType"), render: kindCell },
    { key: "method", header: t("colMethod"), render: methodCell },
    /* Whose account the money went into — the fact that decides which way
       Counterfoil's fee on it runs (Fees & balances). */
    { key: "held", header: tm("heldBy.label"), render: (r) => (r.collectedBy ? <CollectorBadge by={r.collectedBy} /> : <span className="text-muted">—</span>) },
    {
      key: "customer",
      header: t("colCustomer"),
      render: (r) => (
        <span className={cn("block max-w-[12rem] truncate", !r.customerName && "text-muted")} title={r.customerName ?? undefined}>
          {r.customerName ?? t("walkIn")}
        </span>
      ),
    },
    {
      key: "order",
      header: t("colOrder"),
      render: (r) => <span className="whitespace-nowrap font-mono text-[13px]">{r.orderReference}</span>,
    },
    {
      key: "status",
      header: t("colStatus"),
      render: (r) => <StatusPill tone={STATUS_TONE[r.status]}>{t(`status.${r.status}`)}</StatusPill>,
    },
    { key: "amount", header: t("colAmount"), sortable: true, align: "right", render: amountCell },
  ];

  return (
    <PageShell
      title={t("title")}
      description={t("description")}
      actions={
        <Button variant="secondary" icon={<Download size={16} strokeWidth={1.5} />} onClick={exportCsv} disabled={!s || s.count === 0}>
          {t("export")}
        </Button>
      }
    >
      <div className="flex flex-col gap-section">
            <StatStrip
              loading={!s}
              items={[
                { key: "collected", label: t("statCollected"), value: s ? formatMoney(s.collected) : "—" },
                { key: "refunded", label: t("statRefunded"), value: s ? formatMoney(s.refunded) : "—" },
                {
                  key: "net",
                  label: t("statNet"),
                  value: s ? formatMoney(s.net) : "—",
                  // The split a manager reconciles against: one half is in a
                  // drawer, the other is coming from a provider.
                  context: s ? t("statNetSplit", { cash: formatMoney(s.cash), digital: formatMoney(s.digital) }) : null,
                },
                {
                  key: "count",
                  label: t("statCount"),
                  value: s ? String(s.count) : "—",
                  context: s && s.writtenOff > 0 ? t("statWrittenOff", { amount: formatMoney(s.writtenOff) }) : null,
                },
              ]}
            />

            <DataTable
              columns={columns}
              rows={listQ.data?.data ?? []}
              getRowId={(r) => r.id}
              loading={listQ.loading || pending}
              sort={sort}
              onSortChange={(key) => setSort((x) => ({ key, order: x.key === key && x.order === "desc" ? "asc" : "desc" }))}
              onRowClick={setOpen}
              isSelected={(r) => r.id === open?.id}
              toolbar={
                <FilterBar
                  search={
                    <div className="relative">
                      <Search size={16} strokeWidth={1.5} className="absolute left-comfortable top-1/2 -translate-y-1/2 text-muted" />
                      <input
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); resetPage(); }}
                        placeholder={t("searchPlaceholder")}
                        aria-label={t("searchPlaceholder")}
                        className="h-11 w-full min-w-0 rounded-sm border border-line pl-8 pr-comfortable text-sm outline-none focus:border-inverse md:h-9 md:w-72"
                      />
                    </div>
                  }
                  filters={[
                    {
                      key: "range",
                      label: t("filterDate"),
                      active: range === "all" ? null : rangeLabel(range),
                      onClear: () => { setRange("all"); resetPage(); },
                      control: (
                        <Select
                          aria-label={t("filterDate")}
                          value={range}
                          onChange={(v) => { setRange(v as Range); resetPage(); }}
                          options={(["all", "today", "7d", "30d"] as Range[]).map((r) => ({ value: r, label: rangeLabel(r) }))}
                        />
                      ),
                    },
                    {
                      key: "kind",
                      label: t("filterType"),
                      active: kind ? kindLabel(kind) : null,
                      onClear: () => { setKind(""); resetPage(); },
                      control: (
                        <Select
                          aria-label={t("filterType")}
                          value={kind}
                          onChange={(v) => { setKind(v as TransactionKind | ""); resetPage(); }}
                          options={[
                            { value: "", label: t("allTypes") },
                            ...(["payment", "refund", "write_off"] as const).map((k) => ({ value: k, label: kindLabel(k) })),
                          ]}
                        />
                      ),
                    },
                    {
                      key: "method",
                      label: t("filterMethod"),
                      active: method ? enumL.method(method) : null,
                      onClear: () => { setMethod(""); resetPage(); },
                      control: (
                        <Select
                          aria-label={t("filterMethod")}
                          value={method}
                          onChange={(v) => { setMethod(v as PaymentMethod | ""); resetPage(); }}
                          options={[
                            { value: "", label: t("allMethods") },
                            ...(["cash", "bkash", "bangla_qr", "card_terminal"] as const).map((m) => ({ value: m, label: enumL.method(m) })),
                          ]}
                        />
                      ),
                    },
                    {
                      key: "held",
                      label: tm("heldBy.label"),
                      active: heldBy ? tm(`heldBy.${heldBy}`) : null,
                      onClear: () => { setHeldBy(""); resetPage(); },
                      control: (
                        <Select
                          aria-label={tm("heldBy.label")}
                          value={heldBy}
                          onChange={(v) => { setHeldBy(v as CollectedBy | ""); resetPage(); }}
                          options={[
                            { value: "", label: tm("heldBy.all") },
                            { value: "platform", label: tm("heldBy.platform") },
                            { value: "operator", label: tm("heldBy.operator") },
                          ]}
                        />
                      ),
                    },
                    {
                      key: "status",
                      label: t("filterStatus"),
                      active: status ? t(`status.${status}`) : null,
                      onClear: () => { setStatus(""); resetPage(); },
                      control: (
                        <Select
                          aria-label={t("filterStatus")}
                          value={status}
                          onChange={(v) => { setStatus(v as PaymentStatus | ""); resetPage(); }}
                          options={[
                            { value: "", label: t("allStatuses") },
                            ...(["confirmed", "pending", "failed"] as const).map((x) => ({ value: x, label: t(`status.${x}`) })),
                          ]}
                        />
                      ),
                    },
                  ]}
                />
              }
              minWidth="56rem"
              cardVariant="list"
              renderCard={(r) => (
                /* Two lines, the way the orders list reads on a phone: what and
                   how much, then which and when. */
                <div className="flex flex-col gap-inline">
                  <div className="flex items-baseline justify-between gap-tight">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {kindLabel(r.kind)} · {r.method ? enumL.method(r.method) : t("noMethod")}
                    </span>
                    {amountCell(r)}
                  </div>
                  <div className="flex items-baseline justify-between gap-tight">
                    <span className="min-w-0 flex-1 truncate text-[12px] text-muted">
                      <span className="font-mono">{r.orderReference}</span> · {r.customerName ?? t("walkIn")} · {formatRelative(r.at, now)}
                    </span>
                    <StatusPill tone={STATUS_TONE[r.status]}>{t(`status.${r.status}`)}</StatusPill>
                  </div>
                </div>
              )}
              emptyState={<EmptyState title={t("emptyTitle")} message={t("emptyMessage")} />}
              pagination={{ page, pageSize: PAGE_SIZE, total: listQ.data?.page.total ?? 0, onPageChange: setPage }}
            />
      </div>

      <Sheet
        open={!!open}
        onClose={() => setOpen(null)}
        title={open ? t("detailTitle", { kind: kindLabel(open.kind), amount: open.amount < 0 ? `−${formatMoney(-open.amount)}` : formatMoney(open.amount) }) : ""}
        closeLabel={tc("close")}
        lead={open ? <p className="truncate font-mono text-[12px] text-muted">{open.id}</p> : undefined}
        footer={
          open ? (
            <div className="flex flex-wrap justify-end gap-tight">
              <Button
                variant="secondary"
                icon={<Copy size={16} strokeWidth={1.5} />}
                onClick={() => {
                  void navigator.clipboard?.writeText(open.id);
                  toast.success(t("copied"));
                }}
              >
                {t("copyId")}
              </Button>
              <Button onClick={() => router.push(`/orders/${open.orderId}`)}>{t("openOrder")}</Button>
            </div>
          ) : undefined
        }
      >
        {open && (
          <TransactionDetail
            tx={open}
            counter={(countersQ.data?.data ?? []).find((c) => c.id === open.counterId)?.name}
            staff={(staffQ.data?.data ?? []).find((m) => m.id === open.staffId)?.name}
            channel={channelLabel(open.channel)}
          />
        )}
      </Sheet>
    </PageShell>
  );
}

function TransactionDetail({ tx, counter, staff, channel }: { tx: Transaction; counter?: string; staff?: string; channel: string }) {
  const t = useTranslations("transactions");
  const enumL = useEnumLabels();
  const rows: [string, React.ReactNode][] = [
    [t("detailStatus"), <StatusPill key="s" tone={STATUS_TONE[tx.status]}>{t(`status.${tx.status}`)}</StatusPill>],
    [t("detailWhen"), formatDateTime(tx.at)],
    [t("detailMethod"), tx.method ? enumL.method(tx.method) : t("noMethod")],
  ];
  if (tx.reference) rows.push([t("detailReference"), <span key="r" className="font-mono">{tx.reference}</span>]);
  if (tx.tendered != null) rows.push([t("detailTendered"), formatMoney(tx.tendered)]);
  if (tx.change != null) rows.push([t("detailChange"), formatMoney(tx.change)]);
  if (tx.note) rows.push([t("detailReason"), tx.note]);
  rows.push(
    [t("detailOrder"), <Link key="o" href={`/orders/${tx.orderId}`} className="font-mono text-brand-foreground underline-offset-4 hover:underline">{tx.orderReference}</Link>],
    [t("detailCustomer"), tx.customerName ?? t("walkIn")],
    [t("detailChannel"), channel],
  );
  if (counter) rows.push([t("detailCounter"), counter]);
  if (staff) rows.push([t("detailStaff"), staff]);

  return (
    <div className="flex flex-col gap-section p-card">
      <p className={cn("font-mono text-[28px] font-semibold tabular-nums tracking-[-0.5px]", tx.kind === "write_off" && "text-muted")}>
        {tx.amount < 0 ? `−${formatMoney(-tx.amount)}` : formatMoney(tx.amount)}
      </p>
      {(tx.kind === "write_off" || tx.kind === "refund") && (
        <p className="-mt-tight text-[13px] leading-relaxed text-muted">{tx.kind === "write_off" ? t("writeOffNote") : t("refundNote")}</p>
      )}
      <dl className="divide-y divide-hairline rounded-sm border border-hairline">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-comfortable px-comfortable py-tight text-[14px]">
            <dt className="shrink-0 text-muted">{k}</dt>
            <dd className="min-w-0 text-right break-words">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
