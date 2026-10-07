"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Boxes, PackagePlus } from "lucide-react";
import {
  ActionMenu,
  Button,
  DataTable,
  EmptyState,
  FilterBar,
  Select,
  StatusPill,
  Tabs,
  useToast,
  type ActionMenuItem,
  type Column,
} from "@/components/ui";
import { PagePrimaryButton, PageShell, type PagePrimary } from "@/components/ui/PageShell";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { useActiveLocation } from "@/lib/activeLocation";
import { formatMoney, formatPriceShort } from "@/lib/format";
import {
  archiveInventoryItem,
  listInventory,
  listLocations,
  listStaff,
  restoreInventoryItem,
  type InventoryItemView,
} from "@/lib/api";
import { DEMO_STAFF_ID } from "@/lib/session";
import { StockDialog, type StockAction } from "./_components/StockDialog";

const actorName = (staff: { id: string; name: string }[]) =>
  staff.find((x) => x.id === DEMO_STAFF_ID)?.name ?? "Counter";

/**
 * What the venue has, as opposed to what it sells.
 *
 * The catalogue answers "what can somebody buy"; this answers "what is on the
 * shelf, and is any of it about to run out". They are different questions with
 * different verbs — you put a booking on sale, you receive a tote bag — which
 * is why this is its own destination rather than a tab inside the catalogue.
 *
 * One count per row, deliberately — see `lib/api/inventory.ts` for why the
 * on-hand/committed/available split cannot be computed honestly here. What
 * the count is scoped TO is the thing that matters instead: a counter can only
 * sell what is kept at its own venue, so picking a venue scopes every figure
 * on this page, the counts on its tabs included.
 */
export default function InventoryPage() {
  const t = useTranslations("inventory");
  const router = useRouter();
  const toast = useToast();

  const [tab, setTab] = useState<"all" | "attention" | "archived">("all");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<string>("");
  const [unsoldOnly, setUnsoldOnly] = useState(false);
  const [stamp, setStamp] = useState(0);
  const [dialog, setDialog] = useState<{ item: InventoryItemView; action: StockAction } | null>(null);

  const locationsQ = useApiQuery(() => listLocations({ pageSize: 50 }), []);
  const staffQ = useApiQuery(() => listStaff({ pageSize: 100 }), []);
  const locations = useMemo(() => locationsQ.data?.data ?? [], [locationsQ.data]);
  /* From the bar. It used to be this page's own select, defaulting to every
     venue added up — a count no single till can sell from, and the figure the
     console stopped showing when the venue moved into the header. */
  const { id: venue } = useActiveLocation(locations);
  const itemsQ = useApiQuery(
    () => listInventory({ pageSize: 200, locationId: venue || undefined }),
    [venue, stamp],
  );
  /* A venue is always chosen now, so the count is always this venue's and the
     column says so. `scoped` survives for the one frame before the venues
     arrive. */
  const scoped = venue !== "";
  const all = useMemo(() => itemsQ.data?.data ?? [], [itemsQ.data]);

  /* Picking a venue narrows the WHOLE page, figures included. It used to
     narrow only the table: at a venue that keeps one item the band said seven
     needed attention — the six it does not stock, counted as out of stock —
     and the tab badge agreed with the band while the table underneath it read
     "Nothing needs attention". A screen that disagrees with itself two clicks
     into a demo is worse than one without the filter. */
  const here = useMemo(
    () => all.filter((i) => !venue || i.locationIds.includes(venue)),
    [all, venue],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return here.filter((i) => {
      if (tab === "archived" ? i.status !== "archived" : i.status === "archived") return false;
      if (tab === "attention" && !(i.outOfStock || i.low)) return false;
      if (kind && i.kind !== kind) return false;
      if (unsoldOnly && i.soldWith.length > 0) return false;
      if (q && !`${i.name} ${i.sku ?? ""} ${i.unit}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [here, tab, kind, query, unsoldOnly]);

  const live = useMemo(() => here.filter((i) => i.status !== "archived"), [here]);
  const summary = useMemo(
    () => ({
      attention: live.filter((i) => i.outOfStock || i.low).length,
      unsold: live.filter((i) => i.soldWith.length === 0).length,
    }),
    [live],
  );

  const reload = () => {
    setStamp((n) => n + 1);
    itemsQ.reload();
  };

  const act = async (item: InventoryItemView, archive: boolean) => {
    const res = archive ? await archiveInventoryItem(item.id) : await restoreInventoryItem(item.id);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(t(archive ? "toast.archived" : "toast.restored", { name: item.name }));
    reload();
  };

  const actionsFor = (i: InventoryItemView): ActionMenuItem[] =>
    i.status === "archived"
      ? [{ key: "restore", label: t("row.restore"), onSelect: () => void act(i, false) }]
      : [
          ...(i.tracked
            ? [
                { key: "receive", label: t("row.receive"), onSelect: () => setDialog({ item: i, action: "receive" as const }) },
                /* Only where it means something: a tote bag does not come
                   back, and an action that cannot apply is noise. */
                ...(i.returnable
                  ? [{ key: "back", label: t("row.back"), onSelect: () => setDialog({ item: i, action: "back" as const }) }]
                  : []),
                { key: "count", label: t("row.count"), onSelect: () => setDialog({ item: i, action: "count" as const }) },
                { key: "remove", label: t("row.remove"), onSelect: () => setDialog({ item: i, action: "remove" as const }) },
              ]
            : []),
          { key: "edit", label: t("row.edit"), onSelect: () => router.push(`/inventory/${i.id}`) },
          { key: "archive", label: t("row.archive"), separated: true, onSelect: () => void act(i, true) },
        ];

  /** The one place a stock figure is drawn, so the table, the card and the
   *  item page cannot disagree about what "low" looks like. */
  const stockCell = (i: InventoryItemView) => {
    if (!i.tracked) return <span className="text-[13px] text-muted">{t("untracked")}</span>;
    return (
      <span className="inline-flex items-center gap-tight whitespace-nowrap">
        <span
          className={cn(
            "text-[13px] font-medium tabular-nums",
            i.outOfStock ? "text-danger" : i.low ? "text-warning" : "text-fg",
          )}
        >
          {t("countUnit", { count: i.onHand, unit: i.unit })}
        </span>
        {i.outOfStock ? (
          <StatusPill tone="danger">{t("badge.out")}</StatusPill>
        ) : i.low ? (
          <StatusPill tone="warning">{t("badge.low")}</StatusPill>
        ) : null}
      </span>
    );
  };

  const columns: Column<InventoryItemView>[] = [
    {
      key: "name",
      header: t("col.item"),
      render: (i) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{i.name}</span>
          <span className="truncate text-[12px] text-muted">
            {[t(`kind.${i.kind}`), i.sku, i.returnable ? t("returnable") : null].filter(Boolean).join(" · ")}
          </span>
        </span>
      ),
    },
    {
      key: "soldWith",
      header: t("col.soldWith"),
      render: (i) =>
        i.soldWith.length === 0 ? (
          /* Not an error — an item can exist before anything sells it — but
             it is the one thing about a row that nobody would otherwise
             notice, and it is why stock sits still. */
          <span className="text-[12px] text-muted">{t("soldWithNone")}</span>
        ) : (
          <span className="block max-w-[22ch] truncate text-[13px]">
            {i.soldWith.map((s) => s.name).join(", ")}
          </span>
        ),
    },
    { key: "onHand", header: scoped ? t("col.onHandHere") : t("col.onHand"), render: stockCell },
    {
      key: "price",
      header: t("col.price"),
      align: "right",
      mono: false,
      render: (i) => <span className="whitespace-nowrap text-[13px] tabular-nums">{formatPriceShort(i.price)}</span>,
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("col.actions")}</span>,
      align: "right",
      width: "3rem",
      render: (i) => (
        <span onClick={(e) => e.stopPropagation()}>
          <ActionMenu items={actionsFor(i)} label={t("rowActions", { name: i.name })} />
        </span>
      ),
    },
  ];

  const empty =
    tab === "attention"
      ? { title: t("empty.attentionTitle"), body: t("empty.attentionBody") }
      : tab === "archived"
        ? { title: t("empty.archivedTitle"), body: t("empty.archivedBody") }
        : query || kind
          ? { title: t("empty.noMatchTitle"), body: t("empty.noMatchBody") }
          : { title: t("empty.title"), body: t("empty.body") };

  const primary: PagePrimary = { label: t("add"), onClick: () => router.push("/inventory/new") };

  return (
    <PageShell title={t("title")} description={t("description")} primary={primary}>
      <div className="flex flex-col gap-section">
        {/* The page's first toolbar. The tab strip IS the page's cut and stays
            visible; kind and venue fold on a phone, where four controls stacked
            took 148px. Add sits at the right end, on this row, not in a header
            row of its own — on a phone it is the bar's plus. */}
        <div className="flex flex-col gap-tight sm:flex-row sm:flex-wrap sm:items-center">
          <Tabs
            items={[
              { value: "all", label: t("tab.all"), count: live.length },
              { value: "attention", label: t("tab.attention"), count: summary.attention },
              { value: "archived", label: t("tab.archived") },
            ]}
            value={tab}
            onChange={(v) => setTab(v as typeof tab)}
          />
          <span className="hidden flex-1 sm:block" />
          <FilterBar
            className="min-w-0 sm:flex-row sm:items-center"
            search={
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchPlaceholder")}
                aria-label={t("searchPlaceholder")}
                className="h-11 w-full min-w-0 rounded-sm border border-line bg-card px-comfortable text-[13px] outline-none focus:border-inverse sm:h-9 sm:w-56"
              />
            }
            filters={[
              {
                /* The one figure that named a fixable problem, and it
                   filtered — so it is a filter now. */
                key: "unsold",
                label: t("stat.unsold"),
                active: unsoldOnly ? t("stat.unsold") : null,
                onClear: () => setUnsoldOnly(false),
                control: (
                  <button
                    type="button"
                    aria-pressed={unsoldOnly}
                    onClick={() => setUnsoldOnly((v) => !v)}
                    title={t("stat.unsoldNote")}
                    className={cn(
                      "flex h-11 items-center gap-tight rounded-sm border px-comfortable text-[13px] transition-colors duration-quick md:h-9",
                      unsoldOnly ? "border-ember bg-ember/10 text-brand-foreground" : "border-line text-muted hover:bg-muted-wash",
                    )}
                  >
                    {t("stat.unsold")}
                    <span className="tabular-nums">{summary.unsold}</span>
                  </button>
                ),
              },
              {
                key: "kind",
                label: t("filterKind"),
                active: kind ? t(`kind.${kind}`) : null,
                onClear: () => setKind(""),
                control: (
                  <Select
                    value={kind}
                    onChange={setKind}
                    aria-label={t("filterKind")}
                    triggerClassName="text-[13px] md:h-9"
                    options={[
                      { value: "", label: t("kindAll") },
                      ...(["merch", "food", "equipment", "service"] as const).map((k) => ({ value: k, label: t(`kind.${k}`) })),
                    ]}
                  />
                ),
              },
            ]}
          />
          <PagePrimaryButton primary={primary} />
        </div>

        {!itemsQ.loading && visible.length === 0 ? (
          <EmptyState
            icon={<Boxes size={24} strokeWidth={1.5} />}
            title={empty.title}
            message={empty.body}
            action={
              tab === "all" && !query && !kind ? (
                <Button icon={<PackagePlus size={16} strokeWidth={1.5} />} onClick={() => router.push("/inventory/new")}>
                  {t("add")}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <DataTable
            columns={columns}
            rows={visible}
            getRowId={(i) => i.id}
            loading={itemsQ.loading}
            onRowClick={(i) => router.push(`/inventory/${i.id}`)}
            minWidth="46rem"
            renderCard={(i) => (
              <div className="flex min-w-0 flex-col gap-inline">
                <div className="flex min-w-0 items-start gap-tight">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{i.name}</span>
                    <span className="block truncate text-[12px] text-muted">
                      {[t(`kind.${i.kind}`), i.sku].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span onClick={(e) => e.stopPropagation()}>
                    <ActionMenu items={actionsFor(i)} label={t("rowActions", { name: i.name })} />
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-tight gap-y-inline text-[13px]">
                  {stockCell(i)}
                  <span aria-hidden className="text-muted">·</span>
                  <span className="tabular-nums">{formatMoney(i.price)}</span>
                </div>
                <span className="truncate text-[12px] text-muted">
                  {i.soldWith.length === 0 ? t("soldWithNone") : i.soldWith.map((s) => s.name).join(", ")}
                </span>
              </div>
            )}
          />
        )}

        {/* Where the count actually moves. One dialog for all three verbs, so
            a delivery and a stocktake cannot drift apart in what they ask. */}
        {dialog && (
          <StockDialog
            item={dialog.item}
            action={dialog.action}
            locations={locations}
            actor={actorName(staffQ.data?.data ?? [])}
            onClose={() => setDialog(null)}
            onDone={(message) => {
              setDialog(null);
              toast.success(message);
              reload();
            }}
          />
        )}
      </div>
    </PageShell>
  );
}
