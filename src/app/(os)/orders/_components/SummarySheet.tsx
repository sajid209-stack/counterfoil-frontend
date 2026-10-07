"use client";

import { Download, Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, Sheet } from "@/components/ui";
import type { SalesSummary } from "@/lib/api";
import type { SalesLabels } from "../_lib/labels";
import { SalesSummaryView } from "./SalesSummaryView";

/**
 * "Sales summary" — the totals and breakdowns for the current filters, in a
 * drawer beside the list (a sheet from the bottom on a phone).
 *
 * It opens with what it is a summary OF — "Lalbagh Fort · 29 Jul 2026 ·
 * Fort Main Gate · Cash" — because a table of figures with no scope is a table
 * nobody can use, and then offers the two things a manager does with one:
 * keep it (CSV) or put it on paper.
 */
export function SummarySheet({
  open,
  onClose,
  summary,
  labels,
  filterText,
  onDownload,
  onPrint,
}: {
  open: boolean;
  onClose: () => void;
  summary: SalesSummary;
  labels: SalesLabels;
  filterText: string;
  onDownload: () => void;
  onPrint: () => void;
}) {
  const t = useTranslations("orders.summary");
  const tc = useTranslations("common");
  return (
    <Sheet
      open={open}
      onClose={onClose}
      side
      title={t("title")}
      closeLabel={tc("close")}
      className="md:w-[34rem]!"
      footer={
        <>
          <Button variant="secondary" icon={<Download size={16} strokeWidth={1.5} />} onClick={onDownload} className="flex-1">
            {t("download")}
          </Button>
          <Button icon={<Printer size={16} strokeWidth={1.5} />} onClick={onPrint} className="flex-1">
            {t("print")}
          </Button>
        </>
      }
    >
      <div className="p-card">
        <p data-summary-scope className="mb-major break-words text-sm text-muted">{filterText}</p>
        <SalesSummaryView summary={summary} L={labels} />
      </div>
    </Sheet>
  );
}
