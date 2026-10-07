"use client";

import { useState } from "react";
import { BarChart3, Columns3, Download, Printer, SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, Sheet } from "@/components/ui";
import { cn } from "@/lib/cn";
import { MD, useMediaQuery } from "@/lib/useMedia";
import type { SalesFilters } from "../_lib/filters";
import type { SalesLabels } from "../_lib/labels";
import { DateChip } from "./DateChip";
import { FilterChip, type ChipOption } from "./FilterChip";

export interface FacetOptions {
  counters: ChipOption[];
  staff: ChipOption[];
  channels: ChipOption[];
  methods: ChipOption[];
  statuses: ChipOption[];
}

/**
 * The filter row: a chip for each thing a sales report can be cut by, and
 * Summary, Export and Print on the right.
 *
 * On a desktop every chip is on the row. Six controls and three buttons do not
 * fit a phone — measured, they were 285px of a 735px screen before the first
 * order — so there the row is one **Filters** button that counts what is set,
 * and a sheet holding the same chips. Anything set also comes back out as a pill
 * under the row that says what it is and clears it: nothing a person chose is
 * ever only inside a closed sheet, so a narrowed list never looks like the whole
 * one.
 *
 * Which side draws the chips is decided rather than hidden with CSS: a hidden
 * copy is a real node, first in document order, and the first thing anything
 * selecting "the Counter filter" finds.
 */
export function OrdersToolbar({
  f,
  set,
  options,
  labels,
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
  const tc = useTranslations("common");
  const wide = useMediaQuery(MD);
  const [sheet, setSheet] = useState(false);

  /* One definition of the chips, drawn once — on the row, or in the sheet. */
  const chips = (full: boolean) => (
    <>
      <DateChip from={f.from} to={f.to} onChange={(from, to) => set({ from, to })} className={full ? "w-full" : undefined} />
      <FilterChip label={tf("counter")} options={options.counters} value={f.counters} onChange={(counters) => set({ counters })} className={full ? "w-full" : undefined} emptyLabel={tf("noOptions")} />
      <FilterChip label={tf("staff")} options={options.staff} value={f.staff} onChange={(staff) => set({ staff })} className={full ? "w-full" : undefined} searchPlaceholder={tf("searchStaff")} emptyLabel={tf("noOptions")} />
      <FilterChip label={tf("channel")} options={options.channels} value={f.channels} onChange={(channels) => set({ channels: channels as SalesFilters["channels"] })} className={full ? "w-full" : undefined} />
      <FilterChip label={tf("method")} options={options.methods} value={f.methods} onChange={(methods) => set({ methods: methods as SalesFilters["methods"] })} className={full ? "w-full" : undefined} emptyLabel={tf("noOptions")} />
      <FilterChip label={tf("status")} options={options.statuses} value={f.statuses} onChange={(statuses) => set({ statuses: statuses as SalesFilters["statuses"] })} className={full ? "w-full" : undefined} />
    </>
  );

  /* What is set, as pills — for the phone, where the chips are in a sheet. */
  const pills: { key: string; text: string; label: string; clear: () => void }[] = [];
  if (f.from && f.to) pills.push({ key: "date", label: t("date"), text: labels.preset(f.from, f.to) ?? labels.range(f.from, f.to), clear: () => set({ from: "", to: "" }) });
  const group = (key: string, label: string, names: string[], clear: () => void) => {
    if (names.length) pills.push({ key, label, text: names.length > 1 ? `${names[0]} +${names.length - 1}` : names[0], clear });
  };
  group("counter", tf("counter"), f.counters.map(labels.counter), () => set({ counters: [] }));
  group("staff", tf("staff"), f.staff.map(labels.staff), () => set({ staff: [] }));
  group("channel", tf("channel"), f.channels.map(labels.channel), () => set({ channels: [] }));
  group("method", tf("method"), f.methods.map(labels.method), () => set({ methods: [] }));
  group("status", tf("status"), f.statuses.map(labels.status), () => set({ statuses: [] }));

  const actions = (
    <>
      <Button variant="secondary" size="sm" disabled={disabled} icon={<BarChart3 size={15} strokeWidth={1.5} />} onClick={onSummary}>
        {t("summary")}
      </Button>
      <Button variant="secondary" size="sm" disabled={disabled} icon={<Download size={15} strokeWidth={1.5} />} onClick={onExport} aria-label={t("export")} className="max-md:w-11 max-md:px-0">
        <span className="max-md:sr-only">{t("export")}</span>
      </Button>
      <Button variant="secondary" size="sm" disabled={disabled} icon={<Printer size={15} strokeWidth={1.5} />} onClick={onPrint} aria-label={t("print")} className="max-md:w-11 max-md:px-0">
        <span className="max-md:sr-only">{t("print")}</span>
      </Button>
    </>
  );

  if (wide) {
    return (
      <div className="flex flex-wrap items-center gap-tight">
        {chips(false)}
        <div className="ml-auto flex flex-wrap items-center gap-tight">
          {columns && (
            <FilterChip
              iconOnly
              icon={<Columns3 size={16} strokeWidth={1.5} aria-hidden />}
              label={t("columns")}
              options={columns.options}
              value={columns.value}
              onChange={columns.onChange}
              resetLabel={t("columnsReset")}
              onReset={columns.onReset}
            />
          )}
          {actions}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-tight">
      <div className="flex items-center gap-tight">
        <button
          type="button"
          onClick={() => setSheet(true)}
          aria-expanded={sheet}
          className={cn(
            "flex h-11 min-w-0 flex-1 items-center justify-center gap-inline rounded-sm border px-comfortable text-[0.8125rem] font-medium transition-colors duration-quick",
            pills.length ? "border-ember bg-ember/10 text-fg" : "border-line text-fg active:bg-muted-wash",
          )}
        >
          <SlidersHorizontal size={16} strokeWidth={1.75} aria-hidden />
          {tc("filters")}
          {pills.length > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-inverse px-inline text-[0.75rem] font-semibold text-inverse-fg">{pills.length}</span>
          )}
        </button>
        {actions}
      </div>

      {pills.length > 0 && (
        <div className="flex flex-wrap items-center gap-inline">
          {pills.map((p) => (
            <span key={p.key} className="flex items-center gap-inline rounded-full border border-line bg-subtle py-inline pl-comfortable pr-tight text-[0.75rem]">
              <span className="min-w-0 truncate">
                <span className="text-muted">{p.label}: </span>
                <span className="font-medium">{p.text}</span>
              </span>
              <button
                type="button"
                onClick={p.clear}
                aria-label={tc("clearFilter", { name: p.label })}
                className="-my-1.5 -mr-1.5 grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted transition-colors duration-quick hover:text-fg active:bg-muted-wash"
              >
                <X size={13} strokeWidth={2} aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}

      <Sheet open={sheet} onClose={() => setSheet(false)} title={tc("filters")} closeLabel={tc("close")}>
        <div className="flex flex-col gap-tight p-card">{chips(true)}</div>
      </Sheet>
    </div>
  );
}
