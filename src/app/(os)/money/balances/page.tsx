"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight, Download, Info } from "lucide-react";
import {
  Button,
  DataTable,
  EmptyState,
  FilterBar,
  PageShell,
  Select,
  Sheet,
  type Column,
} from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { useActiveLocation } from "@/lib/activeLocation";
import { formatDateTime, formatDay, formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  getPlatformFeeReport,
  listFeeEntries,
  listLocations,
  peekFeeEntries,
  percentLabel,
  type ApiResult,
  type CollectedBy,
  type PlatformFeeEntry,
  type PlatformFeeReport,
  type SettlementStatus,
} from "@/lib/api";
import {
  CollectorBadge,
  FeeBreakdown,
  Figure,
  PeriodPicker,
  SettledBy,
  SettlementBadge,
  csvMoney,
  defaultPeriod,
  downloadCsv,
  money,
  useHoldingLabel,
  wrapHead,
  type Period,
} from "../_components/MoneyKit";

const PAGE_SIZE = 20;
const held = <T,>() => new Promise<ApiResult<T>>(() => {});

/**
 * Fees & balances — how much is owed, in which direction, and why.
 *
 * Built on the shape the payments consoles converged on — Stripe's Balances
 * (available / pending, then the activity that makes them), Shopify's Payouts
 * summary, Square's Balance — bent to the one thing Counterfoil's model has
 * that theirs do not: money runs BOTH ways. So there are two balances, side by
 * side and never netted, each answering the same four questions in the same
 * order: how much is outstanding, how it got there (earned or charged, less
 * what has been settled), when it will next move, and where to see the runs.
 *
 * Below them, the period's arithmetic and then every movement. Every figure is
 * one press from its "why": a row opens its fee breakdown, the breakdown links
 * the order and the payout or collection that settles it.
 */
export default function BalancesPage() {
  const t = useTranslations("money");
  const tc = useTranslations("common");
  const router = useRouter();
  const holding = useHoldingLabel();
  const [period, setPeriod] = useState<Period>(defaultPeriod);
  const [heldBy, setHeldBy] = useState<CollectedBy | "">("");
  const [status, setStatus] = useState<SettlementStatus | "">("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<PlatformFeeEntry | null>(null);

  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const { id: locationId, location, pending } = useActiveLocation(locationsQ.data?.data ?? []);

  const reportQ = useApiQuery(
    () => (pending ? held<PlatformFeeReport>() : getPlatformFeeReport(locationId, period.from, period.to)),
    [pending, locationId, period.from, period.to],
  );
  const filters = useMemo(
    () => ({ from: period.from, to: period.to, collectedBy: heldBy || undefined, settlementStatus: status || undefined }),
    [period.from, period.to, heldBy, status],
  );
  const entriesQ = useApiQuery(
    () => (pending ? held<{ data: PlatformFeeEntry[]; total: number }>() : listFeeEntries(locationId, filters, page, PAGE_SIZE)),
    [pending, locationId, filters, page],
  );

  const r = reportQ.data;
  const rates = r?.rates;
  const b = r?.balance;
  const p = r?.period;
  const both = !!b && b.outstandingToOperator > 0 && b.outstandingByOperator > 0;
  const sw = r?.switches[r.switches.length - 1];
  /* Lower-case forms inside a sentence; the settings screen's labels are
     titles, and "switched to Your own account" reads as a typo. */
  const accountName = (c: string) => (c === "own" ? t("settings.ownInline") : t("settings.counterfoilInline"));

  const exportCsv = () => {
    const rows = peekFeeEntries(locationId, filters);
    downloadCsv(
      `fees-${location?.name.toLowerCase().replace(/\s+/g, "-") ?? "venue"}-${period.from}-${period.to}.csv`,
      ["When", "Order", "Kind", "Method", "Held by", "Amount", "VAT", "Fee base", "Platform fee", "Gateway fee", "We pay you", "You owe us", "Settlement"],
      rows.map((e) => [
        e.createdAt,
        e.orderNumber,
        e.kind,
        e.paymentMethod,
        t(`heldBy.${e.collectedBy}`),
        csvMoney(e.amount),
        csvMoney(e.vat),
        csvMoney(e.feeBase),
        csvMoney(e.platformFee),
        csvMoney(e.gatewayFee),
        csvMoney(e.owedToOperator),
        csvMoney(e.owedByOperator),
        t(`settlement.${e.settlementStatus}`),
      ]),
    );
  };

  const num = (v: number, opts: { dim?: boolean } = {}) => (
    <span className={cn("whitespace-nowrap font-mono text-[13px] tabular-nums", (opts.dim || v === 0) && "text-muted")}>{money(v)}</span>
  );

  const columns: Column<PlatformFeeEntry>[] = [
    /* When and which order as one stacked cell: eleven columns at 1440 cut
       off the two that say who owes whom, and these two are read together. */
    {
      key: "when",
      header: `${t("balances.colWhen")} · ${t("balances.colOrder")}`,
      render: (e) => (
        <span className="flex flex-col">
          <span className="whitespace-nowrap font-mono text-[13px]">{e.orderNumber}</span>
          <span className="whitespace-nowrap text-[12px] text-muted">{formatDateTime(e.createdAt)}</span>
        </span>
      ),
    },
    /* What was paid and whose account it went into, in one cell — the badge is
       the fact that decides which of the two owed columns the row fills. */
    {
      key: "payment",
      header: wrapHead(t("balances.colPaymentHeld")),
      render: (e) => (
        <span className="flex flex-col items-start gap-inline">
          <span className="whitespace-nowrap">{e.kind === "refund" ? `${t("kind.refund")} · ` : ""}{holding(e).split(" · ")[0]}</span>
          <CollectorBadge by={e.collectedBy} />
        </span>
      ),
    },
    { key: "amount", header: t("balances.colAmount"), align: "right", render: (e) => num(e.amount) },
    { key: "vat", header: t("balances.colVat"), align: "right", render: (e) => num(e.vat, { dim: true }) },
    { key: "platform", header: wrapHead(t("balances.colPlatformFee")), align: "right", render: (e) => num(e.platformFee) },
    { key: "gateway", header: wrapHead(t("balances.colGatewayFee")), align: "right", render: (e) => num(e.gatewayFee) },
    {
      key: "payYou",
      header: wrapHead(t("balances.colPayYou")),
      align: "right",
      render: (e) => <span className={cn("whitespace-nowrap font-mono text-[13px] tabular-nums", e.owedToOperator === 0 ? "text-muted" : "font-medium")}>{money(e.owedToOperator)}</span>,
    },
    {
      key: "oweUs",
      header: wrapHead(t("balances.colOweUs")),
      align: "right",
      render: (e) => <span className={cn("whitespace-nowrap font-mono text-[13px] tabular-nums", e.owedByOperator === 0 ? "text-muted" : "font-medium")}>{money(e.owedByOperator)}</span>,
    },
    { key: "settlement", header: wrapHead(t("settlement.label")), render: (e) => <SettlementBadge status={e.settlementStatus} /> },
  ];

  return (
    <PageShell title={t("balances.title")} description={t("balances.description")}>
      <div className="flex flex-col gap-section">
        {/* ── balances to date ── */}
        <section aria-labelledby="bal-h" className="flex flex-col gap-comfortable">
          <div className="flex flex-wrap items-baseline justify-between gap-tight">
            <h2 id="bal-h" className="text-sm font-semibold text-fg">{t("balances.toDate")}</h2>
            <p className="text-[12px] text-muted">{t("balances.toDateNote")}</p>
          </div>
          <div className="grid gap-section md:grid-cols-2">
            <BalanceCard
              loading={!b}
              title={t("balances.payYou")}
              help={rates ? t("balances.payYouHelp", { platform: percentLabel(rates.platformFeeBp), gateway: percentLabel(rates.platformGatewayFeeBp) }) : ""}
              outstanding={b?.outstandingToOperator ?? 0}
              rows={b ? [[t("balances.earned"), formatMoney(b.earnedToDate)], [t("balances.paidOut"), formatMoney(b.paidOutToDate)]] : []}
              next={
                b?.nextPayout
                  ? b.nextPayout.status === "instructed"
                    ? t("balances.nextPayoutSent", { amount: formatMoney(b.nextPayout.amount) })
                    : t("balances.nextPayout", { date: formatDay(b.nextPayout.date, { weekday: true }), amount: formatMoney(b.nextPayout.amount) })
                  : t("balances.nothingNext")
              }
              href="/money/payouts"
              linkLabel={t("balances.viewPayouts")}
            />
            <BalanceCard
              loading={!b}
              title={t("balances.oweUs")}
              help={rates ? t("balances.oweUsHelp", { platform: percentLabel(rates.platformFeeBp) }) : ""}
              outstanding={b?.outstandingByOperator ?? 0}
              rows={b ? [[t("balances.charged"), formatMoney(b.chargedToDate)], [t("balances.collected"), formatMoney(b.collectedToDate)]] : []}
              next={
                b?.nextCollection
                  ? b.nextCollection.status === "past_due"
                    ? t("balances.collectionPastDue", { date: formatDay(b.nextCollection.date), amount: formatMoney(b.nextCollection.amount) })
                    : b.nextCollection.status === "open"
                      ? t("balances.collectionOpen", { date: formatDay(b.nextCollection.date, { weekday: true }), amount: formatMoney(b.nextCollection.amount) })
                      : t("balances.nextCollection", { date: formatDay(b.nextCollection.date, { weekday: true }), amount: formatMoney(b.nextCollection.amount) })
                  : t("balances.nothingNext")
              }
              nextTone={b?.nextCollection?.status === "past_due" ? "warning" : undefined}
              href="/money/collections"
              linkLabel={t("balances.viewCollections")}
            />
          </div>
          <p className="text-[12px] text-muted">{t("balances.neverNetted")}</p>
          {both && (
            <div className="flex items-start gap-tight rounded-md border border-hairline bg-subtle px-card py-comfortable">
              <Info size={16} strokeWidth={1.5} aria-hidden className="mt-[2px] shrink-0 text-muted" />
              <div className="min-w-0 text-[13px] leading-relaxed">
                <p className="font-medium text-fg">{t("balances.bothTitle")}</p>
                <p className="mt-inline text-muted">
                  {sw
                    ? t("balances.bothSwitch", {
                        provider: t(`gatewayProvider.${sw.provider}`),
                        to: accountName(sw.to),
                        date: formatDay(sw.at.slice(0, 10)),
                        fromLabel: accountName(sw.from),
                        toLabel: accountName(sw.to),
                      })
                    : t("balances.bothCounter")}
                </p>
                {sw && (
                  <Link href="/settings/payments#accounts" className="mt-inline inline-flex min-h-11 items-center text-[13px] font-medium text-brand-foreground underline-offset-4 hover:underline md:min-h-0">
                    {t("balances.seeHistory")}
                  </Link>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ── the period ── */}
        <section aria-labelledby="period-h" className="card-surface flex flex-col gap-section p-card">
          <div className="flex flex-wrap items-center justify-between gap-tight">
            <div>
              <h2 id="period-h" className="text-sm font-semibold text-fg">{t("balances.period")}</h2>
              {p && <p className="mt-inline text-[12px] text-muted">{t("balances.paymentCount", { count: p.paymentCount })}</p>}
            </div>
            <PeriodPicker value={period} onChange={(v) => { setPeriod(v); setPage(1); }} />
          </div>
          {p && rates ? (
            <div className="grid grid-cols-2 gap-x-section gap-y-comfortable sm:grid-cols-3 lg:grid-cols-4">
              <Figure label={t("balances.collectedByPlatform")} value={formatMoney(p.collectedByPlatform)} />
              <Figure label={t("balances.collectedByOperator")} value={formatMoney(p.collectedByOperator)} />
              <Figure label={t("balances.vat")} value={formatMoney(p.vat)} />
              <Figure label={t("balances.feeBase")} value={formatMoney(p.feeBase)} />
              <Figure label={t("balances.platformFee", { rate: percentLabel(rates.platformFeeBp) })} value={formatMoney(p.platformFee)} />
              <Figure label={t("balances.gatewayFee", { rate: percentLabel(rates.platformGatewayFeeBp) })} value={formatMoney(p.gatewayFee)} />
              <Figure label={t("balances.refundedFromPlatform")} value={formatMoney(p.refundedFromPlatform)} />
              <Figure label={`${t("balances.colPayYou")} / ${t("balances.colOweUs")}`} value={`${formatMoney(p.owedToOperator)} / ${formatMoney(p.owedByOperator)}`} />
            </div>
          ) : (
            <div className="h-24 animate-pulse rounded-sm bg-line/50" />
          )}
        </section>

        {/* ── movements ── */}
        <section aria-labelledby="mv-h" className="flex flex-col gap-comfortable">
          <div className="flex flex-wrap items-end justify-between gap-tight">
            <div className="min-w-0">
              <h2 id="mv-h" className="text-sm font-semibold text-fg">{t("balances.movements")}</h2>
              <p className="mt-inline text-[13px] text-muted">{t("balances.movementsHelp")}</p>
            </div>
            <Button variant="secondary" icon={<Download size={16} strokeWidth={1.5} />} onClick={exportCsv} disabled={!entriesQ.data?.total}>
              {t("balances.export")}
            </Button>
          </div>
          <DataTable
            columns={columns}
            rows={entriesQ.data?.data ?? []}
            getRowId={(e) => e.id}
            loading={entriesQ.loading || pending}
            onRowClick={setOpen}
            isSelected={(e) => e.id === open?.id}
            toolbar={
              <FilterBar
                filters={[
                  {
                    key: "held",
                    label: t("heldBy.label"),
                    active: heldBy ? t(`heldBy.${heldBy}`) : null,
                    onClear: () => { setHeldBy(""); setPage(1); },
                    control: (
                      <Select
                        aria-label={t("heldBy.label")}
                        value={heldBy}
                        onChange={(v) => { setHeldBy(v as CollectedBy | ""); setPage(1); }}
                        options={[
                          { value: "", label: t("heldBy.all") },
                          { value: "platform", label: t("heldBy.platform") },
                          { value: "operator", label: t("heldBy.operator") },
                        ]}
                      />
                    ),
                  },
                  {
                    key: "status",
                    label: t("settlement.label"),
                    active: status ? t(`settlement.${status}`) : null,
                    onClear: () => { setStatus(""); setPage(1); },
                    control: (
                      <Select
                        aria-label={t("settlement.label")}
                        value={status}
                        onChange={(v) => { setStatus(v as SettlementStatus | ""); setPage(1); }}
                        options={[
                          { value: "", label: t("settlement.all") },
                          ...(["unsettled", "scheduled", "instructed", "paid", "open", "past_due", "none"] as const).map((s) => ({ value: s, label: t(`settlement.${s}`) })),
                        ]}
                      />
                    ),
                  },
                ]}
              />
            }
            minWidth="64rem"
            cardVariant="list"
            renderCard={(e) => (
              <div className="flex flex-col gap-inline">
                <div className="flex items-baseline justify-between gap-tight">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {e.kind === "refund" ? `${t("kind.refund")} · ` : ""}{holding(e)}
                  </span>
                  <span className="shrink-0 font-mono text-[13px] tabular-nums">{money(e.amount)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-tight text-[12px] text-muted">
                  <span className="min-w-0 flex-1 truncate"><span className="font-mono">{e.orderNumber}</span> · {formatDateTime(e.createdAt)}</span>
                  <span className="shrink-0 font-mono tabular-nums">
                    {e.owedToOperator !== 0 ? `${t("balances.colPayYou")} ${money(e.owedToOperator)}` : e.owedByOperator !== 0 ? `${t("balances.colOweUs")} ${money(e.owedByOperator)}` : ""}
                  </span>
                </div>
              </div>
            )}
            emptyState={<EmptyState title={t("balances.emptyTitle")} message={t("balances.emptyMessage")} />}
            pagination={{ page, pageSize: PAGE_SIZE, total: entriesQ.data?.total ?? 0, onPageChange: setPage }}
          />
        </section>
      </div>

      <Sheet
        open={!!open}
        onClose={() => setOpen(null)}
        title={t("breakdown.title")}
        closeLabel={tc("close")}
        lead={open ? <p className="truncate font-mono text-[12px] text-muted">{open.orderNumber} · {formatDateTime(open.createdAt)}</p> : undefined}
        side
        footer={
          open ? (
            <div className="flex justify-end">
              <Button onClick={() => router.push(`/orders/${open.orderId}`)}>{t("breakdown.openOrder")}</Button>
            </div>
          ) : undefined
        }
      >
        {open && rates && (
          <div className="flex flex-col gap-section overflow-y-auto p-card">
            <div className="flex flex-wrap items-center gap-tight">
              <CollectorBadge by={open.collectedBy} />
              <span className="text-[13px] text-muted">{holding(open)}</span>
            </div>
            <FeeBreakdown entry={open} rates={rates} />
            <SettledBy entry={open} />
          </div>
        )}
      </Sheet>
    </PageShell>
  );
}

function BalanceCard({
  loading,
  title,
  help,
  outstanding,
  rows,
  next,
  nextTone,
  href,
  linkLabel,
}: {
  loading: boolean;
  title: string;
  help: string;
  outstanding: number;
  rows: [string, string][];
  next: string;
  nextTone?: "warning";
  href: string;
  linkLabel: string;
}) {
  const t = useTranslations("money");
  if (loading) return <div className="card-surface h-64 animate-pulse" />;
  return (
    <div className="card-surface flex flex-col p-card">
      <p className="type-label text-[12px] text-muted">{title}</p>
      <p className="mt-tight font-mono text-[30px] font-semibold tabular-nums tracking-[-0.5px] text-fg">{formatMoney(outstanding)}</p>
      <p className="text-[12px] text-muted">{t("balances.outstanding")}</p>
      <p className="mt-comfortable text-[13px] leading-relaxed text-muted">{help}</p>
      <dl className="mt-section divide-y divide-hairline border-y border-hairline">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-comfortable py-tight text-[13px]">
            <dt className="text-muted">{k}</dt>
            <dd className="font-mono tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <p className={cn("mt-comfortable text-[13px] font-medium", nextTone === "warning" ? "text-warning" : "text-fg")}>{next}</p>
      <Link
        href={href}
        className="mt-auto inline-flex min-h-11 items-center gap-inline self-start pt-comfortable text-[13px] font-medium text-brand-foreground underline-offset-4 hover:underline md:min-h-9"
      >
        {linkLabel}
        <ArrowRight size={14} strokeWidth={1.5} aria-hidden />
      </Link>
    </div>
  );
}
