"use client";

import { useTranslations } from "next-intl";
import { formatDateTime } from "@/lib/format";
import type { ReportLabels } from "@/lib/report";

/** The words every exported report's frame uses, in the reader's language. */
export function useReportLabels(): ReportLabels {
  const t = useTranslations("exports");
  return {
    summarySheet: t("summarySheet"),
    aboutSheet: t("aboutSheet"),
    keyFigures: t("keyFigures"),
    breakdowns: t("breakdowns"),
    definitions: t("definitions"),
    page: t("page"),
    totalsFollowFilter: t("totalsFollowFilter"),
    rows: (n) => t("rows", { count: n }),
    noRows: t("noRows"),
  };
}

/**
 * The context block every report opens with, in one reading order:
 * Venue · Period · Filters · Prepared by · Generated. Leave a field out to omit
 * its row; Generated is always now.
 */
export function useReportMeta() {
  const t = useTranslations("exports");
  return (m: { venue?: string; period?: string; filters?: string; preparedBy?: string; currency?: string; extra?: [string, string][] }): [string, string][] => {
    const rows: [string, string][] = [];
    if (m.venue) rows.push([t("metaVenue"), m.venue]);
    rows.push([t("metaPeriod"), m.period || t("allTime")]);
    if (m.filters !== undefined) rows.push([t("metaFilters"), m.filters || t("noFilters")]);
    for (const e of m.extra ?? []) rows.push(e);
    if (m.preparedBy) rows.push([t("metaPreparedBy"), m.preparedBy]);
    if (m.currency) rows.push([t("metaCurrency"), m.currency]);
    rows.push([t("metaGenerated"), formatDateTime(new Date().toISOString())]);
    return rows;
  };
}
