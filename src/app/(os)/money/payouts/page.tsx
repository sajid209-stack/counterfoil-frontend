"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CircleAlert, Landmark } from "lucide-react";
import { DataTable, EmptyState, PageShell, StatusPill, type Column } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { useActiveLocation } from "@/lib/activeLocation";
import { formatDay, formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  describeDestination,
  getPaymentSettings,
  getPayoutDestination,
  listLocations,
  listPayouts,
  type ApiResult,
  type Payout,
} from "@/lib/api";
import { PAYOUT_TONE, periodText } from "../_components/MoneyKit";

const held = <T,>() => new Promise<ApiResult<T>>(() => {});

/**
 * Payouts — the money Counterfoil sends the tenant.
 *
 * Shopify's and Stripe's payout lists, with the one row they both put first
 * pinned to the top: the payout that has not happened yet, labelled as an
 * estimate because it keeps growing until the run closes. Every figure in a
 * payout is split the way a bank statement will make someone ask about it —
 * collected, fees, refunds, paid — and a row opens the payout's own lines.
 *
 * Where it goes is said above the list, because a payout with nowhere to go is
 * the one state here that needs the tenant to act.
 */
export default function PayoutsPage() {
  const t = useTranslations("money");
  const router = useRouter();
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const { id: locationId, pending } = useActiveLocation(locationsQ.data?.data ?? []);
  const q = useApiQuery(() => (pending ? held<Payout[]>() : listPayouts(locationId)), [pending, locationId]);
  const destQ = useApiQuery(() => getPayoutDestination(), []);
  const settingsQ = useApiQuery(() => getPaymentSettings(), []);

  const payouts = q.data ?? [];
  const upcoming = payouts.filter((p) => p.status === "scheduled" || p.status === "instructed");
  const past = payouts.filter((p) => !upcoming.includes(p));
  const schedule = settingsQ.data?.payoutSchedule ?? "daily";
  const dest = destQ.data;

  const columns: Column<Payout>[] = [
    { key: "number", header: t("payouts.colNumber"), render: (p) => <span className="whitespace-nowrap font-mono text-[13px]">{p.number}</span> },
    { key: "date", header: t("payouts.colDate"), render: (p) => <span className="whitespace-nowrap">{formatDay(p.date, { weekday: true })}</span> },
    { key: "period", header: t("payouts.colPeriod"), render: (p) => <span className="whitespace-nowrap text-muted">{periodText(p.periodFrom, p.periodTo)}</span> },
    { key: "count", header: t("payouts.colCount"), align: "center", render: (p) => <span className="font-mono text-[13px]">{p.count}</span> },
    { key: "gross", header: t("payouts.colGross"), align: "right", render: (p) => <span className="whitespace-nowrap font-mono text-[13px] tabular-nums">{formatMoney(p.gross)}</span> },
    { key: "fees", header: t("payouts.colFees"), align: "right", render: (p) => <span className="whitespace-nowrap font-mono text-[13px] tabular-nums text-muted">−{formatMoney(p.feesDeducted)}</span> },
    {
      key: "refunds",
      header: t("payouts.colRefunds"),
      align: "right",
      render: (p) => <span className="whitespace-nowrap font-mono text-[13px] tabular-nums text-muted">{p.refundsDeducted ? `−${formatMoney(p.refundsDeducted)}` : formatMoney(0)}</span>,
    },
    { key: "amount", header: t("payouts.colAmount"), align: "right", render: (p) => <span className="whitespace-nowrap font-mono text-[13px] font-semibold tabular-nums">{formatMoney(p.amount)}</span> },
    { key: "status", header: t("payouts.colStatus"), render: (p) => <StatusPill tone={PAYOUT_TONE[p.status]}>{t(`payoutStatus.${p.status}`)}</StatusPill> },
  ];

  const card = (p: Payout) => (
    <div className="flex flex-col gap-inline">
      <div className="flex items-baseline justify-between gap-tight">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{formatDay(p.date, { weekday: true })}</span>
        <span className="shrink-0 font-mono text-[13px] font-semibold tabular-nums">{formatMoney(p.amount)}</span>
      </div>
      <div className="flex items-baseline justify-between gap-tight">
        <span className="min-w-0 flex-1 truncate text-[12px] text-muted"><span className="font-mono">{p.number}</span> · {periodText(p.periodFrom, p.periodTo)}</span>
        <StatusPill tone={PAYOUT_TONE[p.status]}>{t(`payoutStatus.${p.status}`)}</StatusPill>
      </div>
    </div>
  );

  return (
    <PageShell title={t("payouts.title")} description={t("payouts.description")}>
      <div className="flex flex-col gap-section">
        <div
          className={cn(
            "flex flex-col gap-tight rounded-md border px-card py-comfortable sm:flex-row sm:items-center sm:justify-between",
            dest === null || dest?.status === "pending_verification" ? "border-warning/40 bg-warning/5" : "border-hairline bg-card",
          )}
        >
          <div className="flex min-w-0 items-start gap-tight">
            {dest === null ? (
              <CircleAlert size={16} strokeWidth={1.5} aria-hidden className="mt-[2px] shrink-0 text-warning" />
            ) : (
              <Landmark size={16} strokeWidth={1.5} aria-hidden className="mt-[2px] shrink-0 text-muted" />
            )}
            <p className="min-w-0 text-[13px] leading-relaxed">
              {dest === undefined ? null : dest === null ? (
                <span className="font-medium text-fg">{t("payouts.noDestination")}</span>
              ) : (
                <>
                  <span className="font-medium text-fg">{t("payouts.destination", { destination: describeDestination(dest) ?? "" })}.</span>{" "}
                  <span className="text-muted">
                    {dest.status === "pending_verification"
                      ? t("payouts.pendingDestination")
                      : t("payouts.schedule", { schedule: t(schedule === "daily" ? "payouts.scheduleDaily" : schedule === "weekly" ? "payouts.scheduleWeekly" : "payouts.scheduleMonthly") })}
                  </span>
                </>
              )}
            </p>
          </div>
          <Link
            href="/settings/payments#bank"
            className="inline-flex min-h-11 shrink-0 items-center self-start text-[13px] font-medium text-brand-foreground underline-offset-4 hover:underline sm:self-center md:min-h-9"
          >
            {dest === null ? t("payouts.addBank") : t("payouts.manageBank")}
          </Link>
        </div>

        {upcoming.length > 0 && (
          <section aria-labelledby="up-h" className="flex flex-col gap-comfortable">
            <div>
              <h2 id="up-h" className="text-sm font-semibold text-fg">{t("payouts.upcoming")}</h2>
              <p className="mt-inline text-[12px] text-muted">{t("payouts.estimated")}</p>
            </div>
            <DataTable
              columns={columns}
              rows={upcoming}
              getRowId={(p) => p.id}
              onRowClick={(p) => router.push(`/money/payouts/${p.id}`)}
              minWidth="60rem"
              cardVariant="list"
              renderCard={card}
            />
          </section>
        )}

        <DataTable
          columns={columns}
          rows={past}
          getRowId={(p) => p.id}
          loading={q.loading || pending}
          onRowClick={(p) => router.push(`/money/payouts/${p.id}`)}
          minWidth="60rem"
          cardVariant="list"
          renderCard={card}
          emptyState={<EmptyState title={t("payouts.emptyTitle")} message={t("payouts.emptyMessage")} />}
        />
      </div>
    </PageShell>
  );
}
