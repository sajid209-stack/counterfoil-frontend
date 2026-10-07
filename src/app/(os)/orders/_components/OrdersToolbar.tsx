"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BarChart3, Columns3, Download, ListFilter, Printer, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, Sheet } from "@/components/ui";
import { cn } from "@/lib/cn";
import { MD, useMediaQuery } from "@/lib/useMedia";
import type { SalesFilters } from "../_lib/filters";
import type { SalesLabels } from "../_lib/labels";
import { DateChip } from "./DateChip";
import { FilterChip, chipBox, type ChipOption } from "./FilterChip";
import { FilterFacets, facetSummary, type Facet } from "./FilterFacets";

export interface FacetOptions {
  counters: ChipOption[];
  staff: ChipOption[];
  channels: ChipOption[];
  methods: ChipOption[];
  statuses: ChipOption[];
}

/**
 * The filter row, the way Shopify, Stripe and Linear lay a list out.
 *
 * Search first, then the one filter that is used most (Date), then a **Filters**
 * button that opens every other filter in one panel and counts how many are
 * set. Whatever is set comes back out onto the row as a chip that names its
 * value and can be removed ("Status: Paid ×"), so nothing a person chose is
 * ever only inside a closed panel. **Clear filters** shows only when something
 * is set — a filter or a search — and sits at the end of the chips. Columns,
 * Summary, Export and Print are at the far end.
 *
 * On a phone the row is search with the Filters button beside it, and the
 * panel is a bottom sheet that also holds Date. Which side draws the panel is
 * decided rather than hidden with CSS: a hidden copy is a real node, first in
 * document order, and the first thing anything selecting "the Status filter"
 * finds.
 */
export function OrdersToolbar({
  f,
  set,
  options,
  labels,
  query,
  onQuery,
  narrowed,
  onReset,
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
  /** A filter or a search is narrowing the list. */
  narrowed: boolean;
  onReset: () => void;
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
  const to = useTranslations("orders");
  const td = useTranslations("orders.chip");
  const wide = useMediaQuery(MD);
  const [open, setOpen] = useState(false);
  const [facet, setFacet] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const facets: Facet[] = [
    { key: "counter", label: tf("counter"), options: options.counters, value: f.counters, onChange: (counters) => set({ counters }), empty: tf("noOptions") },
    { key: "staff", label: tf("staff"), options: options.staff, value: f.staff, onChange: (staff) => set({ staff }), empty: tf("noOptions") },
    { key: "channel", label: tf("channel"), options: options.channels, value: f.channels, onChange: (channels) => set({ channels: channels as SalesFilters["channels"] }) },
    { key: "method", label: tf("method"), options: options.methods, value: f.methods, onChange: (methods) => set({ methods: methods as SalesFilters["methods"] }), empty: tf("noOptions") },
    { key: "status", label: tf("status"), options: options.statuses, value: f.statuses, onChange: (statuses) => set({ statuses: statuses as SalesFilters["statuses"] }) },
  ];

  /* What is set, as removable chips. The date is one too, but on a desktop it
     already is a chip on the row, naming itself. */
  const chips: { key: string; label: string; text: string; clear: () => void }[] = facets
    .filter((x) => x.value.length > 0)
    .map((x) => ({ key: x.key, label: x.label, text: facetSummary(x), clear: () => x.onChange([]) }));
  const dateSet = !!(f.from && f.to);
  const count = chips.length + (dateSet ? 1 : 0);
  const shown =
    wide || !dateSet
      ? chips
      : [{ key: "date", label: t("date"), text: labels.preset(f.from, f.to) ?? labels.range(f.from, f.to), clear: () => set({ from: "", to: "" }) }, ...chips];

  const openAt = (key: string | null) => {
    setFacet(key);
    setOpen(true);
  };
  const close = (focus = true) => {
    setOpen(false);
    if (focus) trigger.current?.focus();
  };

  /* Placement, written onto the node as `FilterChip` does: where the panel
     lands is a fact about a layout that has just happened. */
  useLayoutEffect(() => {
    const el = panel.current;
    const tr = trigger.current;
    if (!open || !wide || !el || !tr) return;
    const place = () => {
      const pad = 8;
      const a = tr.getBoundingClientRect();
      el.style.top = "0px";
      el.style.left = "0px";
      el.style.maxHeight = "";
      const r = el.getBoundingClientRect();
      const x = Math.max(pad, Math.min(a.left, window.innerWidth - pad - r.width));
      const below = window.innerHeight - a.bottom;
      const flip = r.height + pad > below && a.top > below;
      el.style.left = `${Math.round(x)}px`;
      el.style.top = `${Math.round(flip ? Math.max(pad, a.top - r.height - 4) : a.bottom + 4)}px`;
      el.style.maxHeight = `${Math.round(Math.max(200, (flip ? a.top : below) - pad - 8))}px`;
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, wide, facet]);

  useEffect(() => {
    if (!open || !wide) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    const away = (e: MouseEvent) => {
      const n = e.target as Node;
      if (!root.current?.contains(n) && !panel.current?.contains(n)) setOpen(false);
    };
    document.addEventListener("keydown", esc);
    document.addEventListener("mousedown", away);
    return () => {
      document.removeEventListener("keydown", esc);
      document.removeEventListener("mousedown", away);
    };
  }, [open, wide]);

  const search = (
    <div className="relative min-w-0 flex-1 md:w-60 md:min-w-[9rem] md:shrink">
      <Search size={16} strokeWidth={1.5} aria-hidden className="absolute left-comfortable top-1/2 -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder={to("searchPlaceholder")}
        aria-label={to("filterResults")}
        className="h-[46px] w-full min-w-0 rounded-sm border border-line bg-card pl-8 pr-comfortable text-sm outline-none placeholder:text-muted focus:border-inverse md:h-9"
      />
    </div>
  );

  const filtersButton = (
    <div ref={root} className={cn("shrink-0", chipBox(count > 0, open))}>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={count ? t("filtersCount", { count }) : tc("filters")}
        onClick={() => (open ? close(false) : openAt(null))}
        className="flex min-w-0 flex-1 items-center gap-tight rounded-sm px-comfortable outline-none"
      >
        <ListFilter size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted" />
        <span className="font-medium text-fg">{tc("filters")}</span>
        {count > 0 && (
          <span data-filter-count className="grid h-5 min-w-5 place-items-center rounded-full bg-ember-solid px-inline text-[0.75rem] font-semibold text-white">
            {count}
          </span>
        )}
      </button>
    </div>
  );

  const pills = shown.map((p) => (
    <div key={p.key} data-applied={p.key} className={cn(chipBox(true, false), "shrink-0")}>
      <button
        type="button"
        aria-label={`${p.label}: ${p.text}`}
        onClick={() => openAt(p.key === "date" ? null : p.key)}
        className="flex min-w-0 items-center rounded-sm px-comfortable text-left outline-none"
      >
        <span className="min-w-0 truncate">
          <span className="text-fg">{p.label}: </span>
          <span className="font-medium text-fg">{p.text}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={p.clear}
        aria-label={tc("clearFilter", { name: p.label })}
        className="grid w-11 shrink-0 place-items-center rounded-r-sm text-muted transition-colors duration-quick hover:text-fg active:bg-muted-wash md:w-9"
      >
        <X size={14} strokeWidth={2} aria-hidden />
      </button>
    </div>
  ));

  const reset = narrowed && (
    <Button variant="tertiary" size="sm" onClick={onReset} className="shrink-0">
      {to("reset")}
    </Button>
  );

  const actions = (compact: boolean) => compact ? (
    <>
      <Button variant="secondary" size="sm" disabled={disabled} icon={<BarChart3 size={15} strokeWidth={1.5} />} onClick={onSummary}>
        {t("summary")}
      </Button>
      <Button variant="secondary" size="sm" disabled={disabled} icon={<Download size={15} strokeWidth={1.5} />} onClick={onExport} aria-label={t("export")} title={t("export")} className="max-xl:w-9 max-xl:px-0">
        <span className="max-xl:sr-only">{t("export")}</span>
      </Button>
      <Button variant="secondary" size="sm" disabled={disabled} icon={<Printer size={15} strokeWidth={1.5} />} onClick={onPrint} aria-label={t("print")} title={t("print")} className="max-xl:w-9 max-xl:px-0">
        <span className="max-xl:sr-only">{t("print")}</span>
      </Button>
    </>
  ) : (
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
      <div className="flex flex-col gap-tight">
      <div className="flex items-center justify-between gap-tight">
        <div className="flex min-w-0 items-center gap-tight">
        {search}
        <DateChip from={f.from} to={f.to} onChange={(from, to) => set({ from, to })} className="shrink-0" />
        {filtersButton}
        </div>
        <div className="flex shrink-0 items-center gap-tight">
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
          {actions(true)}
        </div>
        </div>
        {(pills.length > 0 || reset) && (
          <div className="flex flex-wrap items-center gap-tight">
            {pills}
            {reset}
          </div>
        )}
        {open &&
          createPortal(
            <div
              ref={panel}
              role="dialog"
              aria-label={tc("filters")}
              className="fixed z-50 flex w-[22rem] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-md border border-line bg-card shadow-lg"
            >
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <FilterFacets facets={facets} open={facet} onOpen={setFacet} />
              </div>
              <div className="flex shrink-0 items-center justify-end border-t border-hairline px-tight py-inline">
                <button type="button" onClick={() => close()} className="h-9 rounded-sm px-comfortable text-[0.8125rem] font-medium text-fg hover:bg-muted-wash">
                  {td("done")}
                </button>
              </div>
            </div>,
            document.body,
          )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-tight">
      <div className="flex items-center gap-tight">
        {search}
        {filtersButton}
      </div>
      <div className="flex items-center gap-tight">{actions(false)}</div>
      {(shown.length > 0 || reset) && (
        <div className="flex flex-wrap items-center gap-tight">
          {pills}
          {reset}
        </div>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title={tc("filters")} closeLabel={tc("close")}>
        <div className="flex flex-col">
          <div className="border-b border-hairline p-card">
            <DateChip from={f.from} to={f.to} onChange={(from, to) => set({ from, to })} className="w-full" />
          </div>
          <FilterFacets facets={facets} open={facet} onOpen={setFacet} />
        </div>
      </Sheet>
    </div>
  );
}
