"use client";

import { BarChart3, Columns3, Download, Printer, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, FilterBar, type FilterSpec } from "@/components/ui";
import { MD, useMediaQuery } from "@/lib/useMedia";
import type { SalesFilters } from "../_lib/filters";
import type { SalesLabels } from "../_lib/labels";
import { Checklist, checklistSummary } from "./Checklist";
import type { ChipOption } from "./chip";
import { DateChip } from "./DateChip";
import { ToolbarMenu, type ToolbarMenuItem } from "./ToolbarMenu";

export interface FacetOptions {
  counters: ChipOption[];
  staff: ChipOption[];
  channels: ChipOption[];
  methods: ChipOption[];
  statuses: ChipOption[];
}

/**
 * The filter row, the way Shopify, Stripe and Linear lay a list out — and the
 * same one every list page in OS draws, because it is `FilterBar`.
 *
 *     [search] [Date] [Filters ⧩ 2]                          [Export] [⋯]
 *     Status: Paid ×   Channel: Online ×   Clear filters
 *
 * Search first, then the one filter used most (Date), then a **Filters** button
 * that opens every other filter in one panel and counts how many are set.
 * Whatever is set comes back out as a removable chip that names its value, so
 * nothing a person chose is ever only inside a closed panel. At the far end,
 * one visible action — Export — and a **⋯** that holds the rest (the columns,
 * the summary, printing): a row of four equal buttons states no opinion about
 * which one somebody came for.
 *
 * On a phone the row is search, Filters and ⋯, the panel is a bottom sheet that
 * also holds Date, and Export moves into the menu with the others.
 */
export function OrdersToolbar({
  f,
  set,
  options,
  labels,
  query,
  onQuery,
  onSummary,
  onExport,
  onPrint,
  columns,
  disabled,
}: {
  f: SalesFilters;
  set: (patch: Partial<SalesFilters>) => void;
  options: FacetOptions;
  labels: SalesLabels;
  /** The search box's own text, and how it changes. */
  query: string;
  onQuery: (v: string) => void;
  onSummary: () => void;
  onExport: () => void;
  onPrint: () => void;
  /** Which columns of the table are on show, and how to change that. */
  columns?: { options: ChipOption[]; value: string[]; onChange: (next: string[]) => void; onReset: () => void };
  /** Nothing to summarise, export or print yet. */
  disabled?: boolean;
}) {
  const t = useTranslations("orders.toolbar");
  const tf = useTranslations("orders.filters");
  const to = useTranslations("orders");
  const wide = useMediaQuery(MD);

  const dateSet = !!(f.from && f.to);
  const check = (key: string, label: string, opts: ChipOption[], value: string[], onChange: (next: string[]) => void, empty?: string): FilterSpec => ({
    key,
    label,
    active: checklistSummary(opts, value),
    onClear: () => onChange([]),
    control: <Checklist label={label} options={opts} value={value} onChange={onChange} empty={empty} />,
  });

  const filters: FilterSpec[] = [
    {
      key: "date",
      label: t("date"),
      inline: true,
      active: dateSet ? (labels.preset(f.from, f.to) ?? labels.range(f.from, f.to)) : null,
      onClear: () => set({ from: "", to: "" }),
      control: <DateChip from={f.from} to={f.to} onChange={(from, to) => set({ from, to })} className="w-full md:w-auto" />,
    },
    check("counter", tf("counter"), options.counters, f.counters, (counters) => set({ counters }), tf("noOptions")),
    check("staff", tf("staff"), options.staff, f.staff, (staff) => set({ staff }), tf("noOptions")),
    check("channel", tf("channel"), options.channels, f.channels, (channels) => set({ channels: channels as SalesFilters["channels"] })),
    check("method", tf("method"), options.methods, f.methods, (methods) => set({ methods: methods as SalesFilters["methods"] }), tf("noOptions")),
    check("status", tf("status"), options.statuses, f.statuses, (statuses) => set({ statuses: statuses as SalesFilters["statuses"] })),
  ];

  const search = (
    <div className="relative min-w-0 md:w-60 md:min-w-[9rem] xl:w-72">
      <Search size={16} strokeWidth={1.5} aria-hidden className="absolute left-comfortable top-1/2 -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder={to("searchPlaceholder")}
        aria-label={to("filterResults")}
        className="h-11 w-full min-w-0 rounded-sm border border-line bg-card pl-8 pr-comfortable text-sm outline-none placeholder:text-muted focus:border-inverse md:h-9"
      />
    </div>
  );

  /* Desktop: the columns, the summary, printing. Phone: the table is a list of
     rows with no columns to choose, and Export is here with the rest. */
  const items: ToolbarMenuItem[] = wide
    ? [
        ...(columns
          ? [
              {
                key: "columns",
                label: t("columns"),
                icon: <Columns3 size={15} strokeWidth={1.5} aria-hidden />,
                panel: (
                  <>
                    <Checklist label={t("columns")} options={columns.options} value={columns.value} onChange={columns.onChange} />
                    <button type="button" onClick={columns.onReset} className="mx-comfortable mt-inline h-9 text-[0.8125rem] font-medium text-brand-foreground underline-offset-2 hover:underline">
                      {t("columnsReset")}
                    </button>
                  </>
                ),
              },
            ]
          : []),
        { key: "summary", label: t("summary"), icon: <BarChart3 size={15} strokeWidth={1.5} aria-hidden />, onSelect: onSummary, disabled },
        { key: "print", label: t("print"), icon: <Printer size={15} strokeWidth={1.5} aria-hidden />, onSelect: onPrint, disabled },
      ]
    : [
        { key: "summary", label: t("summary"), icon: <BarChart3 size={15} strokeWidth={1.5} aria-hidden />, onSelect: onSummary, disabled },
        { key: "export", label: t("export"), icon: <Download size={15} strokeWidth={1.5} aria-hidden />, onSelect: onExport, disabled },
        { key: "print", label: t("print"), icon: <Printer size={15} strokeWidth={1.5} aria-hidden />, onSelect: onPrint, disabled },
      ];

  const actions = (
    <>
      <Button variant="secondary" size="sm" disabled={disabled} icon={<Download size={15} strokeWidth={1.5} aria-hidden />} onClick={onExport} className="max-md:hidden">
        {t("export")}
      </Button>
      <ToolbarMenu label={to("moreActions")} items={items} />
    </>
  );

  return <FilterBar search={search} filters={filters} actions={actions} />;
}
