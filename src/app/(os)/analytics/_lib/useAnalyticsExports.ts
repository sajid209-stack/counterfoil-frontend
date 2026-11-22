"use client";

import { useTranslations } from "next-intl";
import { formatRange } from "@/components/ui";
import { getTaxReport, type AnalyticsOverview } from "@/lib/api";
import { useEnumLabels } from "@/lib/labels";
import { downloadReportCsv, downloadXlsx, slugify } from "@/lib/report";
import { useReportLabels, useReportMeta } from "@/lib/useReportLabels";
import { buildAnalyticsReport } from "./analyticsReport";
import { reportContext, type T } from "@/lib/reports/context";
import { buildVatReport, vatCsvReport, vatInvoiceRows } from "./vatReport";

/**
 * The page's two exports, ready to hand to an ExportMenu. Everything is read
 * from the overview already on screen (and, for VAT, the invoices behind its
 * figures), when the button is pressed — never while rendering.
 */
export function useAnalyticsExports(o: AnalyticsOverview | undefined, venueName: string, venueId: string) {
  const t = useTranslations("analytics") as unknown as T;
  const enumL = useEnumLabels();
  const labels = useReportLabels();
  const meta = useReportMeta();

  const analytics = () => {
    if (!o) return null;
    const ctx = reportContext();
    const rangeText = formatRange(o.from, o.to);
    const previousText = o.previous ? formatRange(o.previous.from, o.previous.to) : "";
    return buildAnalyticsReport({
      o,
      t,
      method: enumL.method,
      taxClass: enumL.tax,
      labels,
      business: ctx.business,
      currency: ctx.currency,
      fileBase: `analytics-${slugify(venueName) || venueId}-${o.from}_${o.to}`,
      rangeText,
      previousText,
      meta: meta({
        venue: venueName,
        period: rangeText,
        preparedBy: ctx.preparedBy,
        currency: ctx.currency,
        extra: [[t("export.metaCompare"), previousText ? t("export.comparedWith", { range: previousText }) : t("compare.noneShort")]],
      }),
    });
  };

  const vat = async () => {
    if (!o) return null;
    const ctx = reportContext();
    const res = await getTaxReport({ from: o.from, to: o.to, locationIds: [venueId] });
    if (!res.ok) return null;
    const rangeText = formatRange(o.from, o.to);
    const tax = res.data;
    const extra: [string, string][] = [[t("export.vat.metaTax"), tax.taxName]];
    if (tax.registrationNumber) extra.push([t("export.vat.metaRegistration"), tax.registrationNumber]);
    return buildVatReport({
      o,
      tax,
      invoices: vatInvoiceRows(venueId, o.from, o.to),
      t,
      taxClass: enumL.tax,
      labels,
      business: ctx.business,
      currency: ctx.currency,
      fileBase: `vat-${slugify(venueName) || venueId}-${o.from}_${o.to}`,
      meta: meta({ venue: venueName, period: rangeText, extra, preparedBy: ctx.preparedBy, currency: ctx.currency }),
    });
  };

  return {
    excel: () => {
      const r = analytics();
      if (r) downloadXlsx(r);
    },
    csv: () => {
      const r = analytics();
      if (r) downloadReportCsv(r);
    },
    vatExcel: () => {
      void vat().then((r) => r && downloadXlsx(r));
    },
    vatCsv: () => {
      void vat().then((r) => r && downloadReportCsv(vatCsvReport(r)));
    },
  };
}
