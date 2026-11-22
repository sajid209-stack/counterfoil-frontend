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
import { formatDateTime, formatMoney } from "@/lib/format";
import { PrintDocument } from "@/app/print/_components/PrintDocument";
import { useReportPrep } from "@/lib/useReportPrep";
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
  const tx = useTranslations("exports");
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

  /* The dates are the scope and the venue is in the letterhead; the line under them says what else narrowed the list. */
  const allDates = t("describe.allDates");
  const filterText = L.describe({ ...f, from: "", to: "" }, "").filter((x) => x !== allDates).join(" · ");
  const title = kind === "summary" ? t("summary.title") : tp("listTitle");
  const prep = useReportPrep();
  const period = f.from && f.to ? L.range(f.from, f.to) : t("describe.allDates");
  const lines = [filterText, prep.preparedBy ? `${tx("metaPreparedBy")}: ${prep.preparedBy}` : ""].filter(Boolean);

  return (
    <PrintDocument operator={opQ.data} venue={venue} title={title} scope={period} lines={lines} orientation={kind === "list" ? "landscape" : "portrait"} ready={ready}>
      {kind === "summary" ? (
        <SalesSummaryView summary={summary} L={L} variant="print" />
      ) : rows.length === 0 ? (
        <EmptyState title={t("emptyTitle")} message={t("emptyMessage")} />
      ) : (
        <div className="flex flex-col gap-major">
          <SalesSummaryView summary={summary} L={L} variant="print" compact />
          <OrdersTable rows={rows} L={L} dir={report.dir} />
        </div>
      )}
    </PrintDocument>
  );
}

/**
 * Every matching order on paper: hairline rows, figures right-aligned in
 * tabular numerals, the header repeated on every page, and one totals row at
 * the foot of the list — the same sums the Total, VAT, Paid, Discount and Items
 * columns show above it.
 */
function OrdersTable({ rows, L, dir }: { rows: Order[]; L: ReturnType<typeof useSalesLabels>; dir: ReturnType<typeof useSalesReport>["dir"] }) {
  const t = useTranslations("orders");
  const tp = useTranslations("orders.print");
  const th = "px-1.5 py-1.5 text-left text-xs font-medium text-muted";
  const thr = `${th} text-right`;
  const td = "px-1.5 py-1 align-top text-xs";
  const tdr = `${td} whitespace-nowrap text-right tabular-nums`;
  const sum = (pick: (o: Order) => number) => rows.reduce((n, o) => n + pick(o), 0);
  return (
    <table data-print-orders className="w-full border-collapse">
      <thead className="table-header-group">
        <tr className="border-b border-strong">
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
      {/* Once, after the last row: a footer group would repeat on every sheet. */}
      <tfoot className="print:table-row-group">
        <tr data-print-total className="break-inside-avoid border-t-2 border-fg font-semibold">
          <td colSpan={6} className={`${td} text-sm`}>{tp("totalRow", { count: rows.length })}</td>
          <td className={`${tdr} text-sm`}>{formatMoney(sum((o) => o.total))}</td>
          <td className={`${tdr} text-sm`}>{formatMoney(sum((o) => o.taxTotal ?? 0))}</td>
          <td className={`${tdr} text-sm`}>{formatMoney(sum(orderNetPaid))}</td>
          <td className={`${tdr} text-sm`}>{formatMoney(sum((o) => o.discountTotal ?? 0))}</td>
          <td colSpan={2} className={td} />
          <td className={`${tdr} text-sm`}>{sum(orderItemCount)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
