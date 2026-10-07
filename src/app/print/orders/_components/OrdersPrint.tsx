"use client";

import { useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import {
  getOperator,
  orderChannelOf,
  orderDue,
  orderItemCount,
  orderMethodOf,
  orderNetPaid,
  type Order,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateTime, formatMoney } from "@/lib/format";
import { PrintToolbar } from "@/app/print/_components/PrintToolbar";
import { SalesSummaryView } from "@/app/(os)/orders/_components/SalesSummaryView";
import { parseFilters } from "@/app/(os)/orders/_lib/filters";
import { useSalesLabels } from "@/app/(os)/orders/_lib/labels";
import { useSalesReport } from "@/app/(os)/orders/_lib/useReport";

/**
 * The sales report on paper: the venue's header, what the filters were, when it
 * was made, and either the summary (portrait) or every matching order with the
 * summary above it (landscape — thirteen columns need the width).
 *
 * It reads the same address the Orders list writes — filters, sort, and the
 * venue — and the same `useSalesReport`, so the page that prints is the page
 * that was on screen. It opens the print dialog itself once everything has
 * loaded, like the receipt and ticket pages, and `paper` pins the light colours
 * so a dark-theme operator still gets dark type on white.
 */
export function OrdersPrint({ kind }: { kind: "summary" | "list" }) {
  const t = useTranslations("orders");
  const tp = useTranslations("orders.print");
  const sp = useSearchParams();
  const f = useMemo(() => parseFilters(sp), [sp]);
  const venueParam = sp.get("venue") ?? "";
  const report = useSalesReport(f, venueParam || undefined);
  const opQ = useApiQuery(() => getOperator(), []);
  const L = useSalesLabels(report.dir);
  const { rows, summary, venue } = report;

  const ready = !report.loading && !opQ.loading;
  const printed = useRef(false);
  useEffect(() => {
    if (ready && !printed.current) {
      printed.current = true;
      const id = setTimeout(() => window.print(), 400);
      return () => clearTimeout(id);
    }
  }, [ready]);

  const landscape = kind === "list";
  const filterText = L.describe(f, venue?.name ?? "").join(" · ");
  const address = venue ? [venue.addressLine1, venue.city].filter(Boolean).join(", ") : "";
  const generated = useMemo(() => formatDateTime(new Date().toISOString()), []);
  const title = kind === "summary" ? t("summary.title") : tp("listTitle");

  return (
    <div className="min-h-screen bg-surface px-section py-section print:min-h-0 print:bg-white print:p-0">
      {/* A4, and the orientation the content needs. */}
      <style>{`@page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 12mm; }`}</style>
      <div className={cn("mx-auto", landscape ? "max-w-[297mm]" : "max-w-[210mm]")}>
        <PrintToolbar />
        <article className="paper rounded-md border border-line bg-card p-major text-fg print:rounded-none print:border-0 print:p-0">
          <header className="mb-major flex flex-wrap items-start justify-between gap-x-major gap-y-tight border-b border-line pb-section">
            <div className="min-w-0">
              <p className="type-h2 break-words text-base">{opQ.data?.name ?? "Counterfoil"}</p>
              {venue && <p className="mt-inline break-words text-[12px] text-muted">{[venue.name, address].filter(Boolean).join(" · ")}</p>}
              {opQ.data?.contactPhone && <p className="break-words text-[12px] text-muted">{opQ.data.contactPhone}</p>}
            </div>
            <div className="min-w-0 text-right max-sm:text-left">
              <h1 className="type-h1 text-xl">{title}</h1>
              <p data-print-scope className="mt-inline break-words text-[13px]">{filterText}</p>
              <p className="text-[12px] text-muted">{tp("generated", { at: generated })}</p>
            </div>
          </header>

          {!ready ? (
            <div aria-busy="true" className="h-64 animate-pulse rounded-md bg-subtle" />
          ) : kind === "summary" ? (
            <SalesSummaryView summary={summary} L={L} variant="print" />
          ) : rows.length === 0 ? (
            <EmptyState title={t("emptyTitle")} message={t("emptyMessage")} />
          ) : (
            <div className="flex flex-col gap-major">
              <SalesSummaryView summary={summary} L={L} variant="print" compact />
              <OrdersTable rows={rows} L={L} dir={report.dir} />
            </div>
          )}
        </article>
      </div>
    </div>
  );
}

/** Every matching order: all thirteen columns, tabular figures, no row split across pages. */
function OrdersTable({ rows, L, dir }: { rows: Order[]; L: ReturnType<typeof useSalesLabels>; dir: ReturnType<typeof useSalesReport>["dir"] }) {
  const t = useTranslations("orders");
  const th = "px-1.5 py-1.5 text-left text-[12px] font-medium text-muted";
  const thr = `${th} text-right`;
  const td = "px-1.5 py-1 align-top text-[12px]";
  const tdr = `${td} whitespace-nowrap text-right tabular-nums`;
  return (
    <table data-print-orders className="w-full border-collapse">
      <thead>
        <tr className="border-b border-line">
          <th scope="col" className={th}>{t("colReference")}</th>
          <th scope="col" className={th}>{t("colDate")}</th>
          <th scope="col" className={th}>{t("colCustomer")}</th>
          <th scope="col" className={th}>{t("colChannel")}</th>
          <th scope="col" className={th}>{t("colCounter")}</th>
          <th scope="col" className={th}>{t("colStaff")}</th>
          <th scope="col" className={thr}>{t("colTotal")}</th>
          <th scope="col" className={thr}>{t("colTax")}</th>
          <th scope="col" className={thr}>{t("colPaid")}</th>
          <th scope="col" className={thr}>{t("colDiscount")}</th>
          <th scope="col" className={th}>{t("colMethod")}</th>
          <th scope="col" className={th}>{t("colStatus")}</th>
          <th scope="col" className={thr}>{t("colItems")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((o) => (
          <tr key={o.id} data-order={o.id} className="break-inside-avoid border-b border-hairline">
            <td className={`${td} whitespace-nowrap font-mono`}>{o.reference}</td>
            <td className={`${td} whitespace-nowrap`}>{formatDateTime(o.createdAt)}</td>
            <td className={`${td} break-words`}>{o.customerName ?? t("walkIn")}</td>
            <td className={td}>{o.source ? o.source.marketplaceName : L.channel(orderChannelOf(o))}</td>
            <td className={td}>{o.counterId ? dir.counterName(o.counterId) : "—"}</td>
            <td className={td}>{o.staffId ? dir.staffName(o.staffId) : "—"}</td>
            <td className={tdr}>{formatMoney(o.total)}</td>
            <td className={tdr}>{formatMoney(o.taxTotal ?? 0)}</td>
            <td className={tdr}>
              {formatMoney(orderNetPaid(o))}
              {orderDue(o) > 0 && <span className="block text-warning">{t("dueLabel", { amount: formatMoney(orderDue(o)) })}</span>}
            </td>
            <td className={tdr}>{formatMoney(o.discountTotal ?? 0)}</td>
            <td className={td}>{L.method(orderMethodOf(o))}</td>
            <td className={td}>{L.status(o.status)}</td>
            <td className={tdr}>{orderItemCount(o)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
