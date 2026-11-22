"use client";

import { Download, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/ActionMenu";

/**
 * The one Export control every list and report uses: "Export ▾", opening
 *
 *   Excel workbook (.xlsx) — formatted, with a summary sheet and totals
 *   CSV (.csv)             — plain rows, for importing into other software
 *   ─────────────
 *   Print or save as PDF   — an A4 report with your logo        (when given)
 *
 * Excel comes first because it is what a manager opens; CSV is for the
 * accountant's software. One control in one place on every screen, so nobody
 * hunts for it twice.
 */
export function ExportMenu({
  onExcel,
  onCsv,
  onPrint,
  disabled,
  size = "sm",
  compact = false,
  shape = "default",
}: {
  onExcel: () => void;
  onCsv?: () => void;
  onPrint?: () => void;
  disabled?: boolean;
  size?: "sm" | "md";
  /** Icon only below md. */
  compact?: boolean;
  shape?: "default" | "go";
}) {
  const t = useTranslations("exports");
  const icon = (I: typeof Download) => <I size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />;
  const items: ActionMenuItem[] = [
    { key: "xlsx", label: t("excel"), hint: t("excelHint"), icon: icon(FileSpreadsheet), onSelect: onExcel },
  ];
  if (onCsv) items.push({ key: "csv", label: t("csv"), hint: t("csvHint"), icon: icon(FileText), onSelect: onCsv });
  if (onPrint) items.push({ key: "print", label: t("print"), hint: t("printHint"), icon: icon(Printer), onSelect: onPrint, separated: true });
  return (
    <ActionMenu
      items={items}
      label={t("menuLabel")}
      shape={shape}
      trigger={{ text: t("menu"), icon: <Download size={15} strokeWidth={1.5} aria-hidden />, size, compact, disabled }}
    />
  );
}
