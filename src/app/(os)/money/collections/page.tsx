"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { Button, DataTable, EmptyState, PageShell, StatusPill, type Column } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { useActiveLocation } from "@/lib/activeLocation";
import { formatDay, formatMoney } from "@/lib/format";
import { listFeeCollections, listLocations, peekSettlementTerms, type ApiResult, type FeeCollection } from "@/lib/api";
import { COLLECTION_TONE, periodText } from "../_components/MoneyKit";
import { PayCollectionDialog } from "../_components/PayCollectionDialog";

const held = <T,>() => new Promise<ApiResult<T>>(() => {});

/**
 * Fee collections — what the tenant owes Counterfoil, and has paid.
 *
 * A billing-history list (Stripe's invoices, Shopify's bills) because that is
 * what these are: a run of the platform fee on the week's tenant-held sales,
 * issued, due, paid. An open or overdue one carries its own Pay now, so the
 * page that says what is owed is also where it is settled.
 */
export default function CollectionsPage() {
  const t = useTranslations("money");
  const router = useRouter();
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const { id: locationId, pending } = useActiveLocation(locationsQ.data?.data ?? []);
  const q = useApiQuery(() => (pending ? held<FeeCollection[]>() : listFeeCollections(locationId)), [pending, locationId]);
  const [paying, setPaying] = useState<FeeCollection | null>(null);
  const terms = peekSettlementTerms();

  const payable = (c: FeeCollection) => c.status === "open" || c.status === "past_due";
  const dueText = (c: FeeCollection) =>
    c.status === "accruing" ? t("collections.accruing", { date: formatDay(c.issuedOn) })
    : c.status === "paid" ? t("collections.paidOn", { date: formatDay(c.paidOn), method: c.paidWith ?? "" })
    : t("collections.dueOn", { date: formatDay(c.dueOn, { weekday: true }) });

  const columns: Column<FeeCollection>[] = [
    { key: "number", header: t("collections.colNumber"), render: (c) => <span className="whitespace-nowrap font-mono text-[13px]">{c.number}</span> },
    { key: "issued", header: t("collections.colIssued"), render: (c) => <span className="whitespace-nowrap">{formatDay(c.issuedOn)}</span> },
    { key: "period", header: t("collections.colPeriod"), render: (c) => <span className="whitespace-nowrap text-muted">{periodText(c.periodFrom, c.periodTo)}</span> },
    { key: "count", header: t("collections.colCount"), align: "center", render: (c) => <span className="font-mono text-[13px]">{c.count}</span> },
    { key: "base", header: t("collections.colBase"), align: "right", render: (c) => <span className="whitespace-nowrap font-mono text-[13px] tabular-nums text-muted">{formatMoney(c.feeBase)}</span> },
    { key: "amount", header: t("collections.colAmount"), align: "right", render: (c) => <span className="whitespace-nowrap font-mono text-[13px] font-semibold tabular-nums">{formatMoney(c.amount)}</span> },
    { key: "due", header: t("collections.colDue"), render: (c) => <span className="whitespace-nowrap text-[13px] text-muted">{dueText(c)}</span> },
    { key: "status", header: t("collections.colStatus"), render: (c) => <StatusPill tone={COLLECTION_TONE[c.status]}>{t(`collectionStatus.${c.status}`)}</StatusPill> },
    {
      key: "pay",
      header: "",
      align: "right",
      render: (c) =>
        payable(c) ? (
          <span onClick={(e) => e.stopPropagation()}>
            <Button size="sm" onClick={() => setPaying(c)}>{t("collections.payNow")}</Button>
          </span>
        ) : null,
    },
  ];

  return (
    <PageShell title={t("collections.title")} description={t("collections.description")}>
      <div className="flex flex-col gap-section">
        <p className="flex items-start gap-tight rounded-md border border-hairline bg-card px-card py-comfortable text-[13px] leading-relaxed text-muted">
          <Info size={16} strokeWidth={1.5} aria-hidden className="mt-[2px] shrink-0" />
          {t("collections.terms", { days: terms.collectionDueDays })}
        </p>
        <DataTable
          columns={columns}
          rows={q.data ?? []}
          getRowId={(c) => c.id}
          loading={q.loading || pending}
          onRowClick={(c) => router.push(`/money/collections/${c.id}`)}
          minWidth="64rem"
          cardVariant="list"
          renderCard={(c) => (
            <div className="flex flex-col gap-inline">
              <div className="flex items-baseline justify-between gap-tight">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{dueText(c)}</span>
                <span className="shrink-0 font-mono text-[13px] font-semibold tabular-nums">{formatMoney(c.amount)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-tight">
                <span className="min-w-0 flex-1 truncate text-[12px] text-muted"><span className="font-mono">{c.number}</span> · {periodText(c.periodFrom, c.periodTo)}</span>
                <StatusPill tone={COLLECTION_TONE[c.status]}>{t(`collectionStatus.${c.status}`)}</StatusPill>
              </div>
            </div>
          )}
          emptyState={<EmptyState title={t("collections.emptyTitle")} message={t("collections.emptyMessage")} />}
        />
      </div>
      <PayCollectionDialog collection={paying} onClose={() => setPaying(null)} onPaid={() => { setPaying(null); q.reload(); }} />
    </PageShell>
  );
}
