"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, Archive, Copy, Pencil, Plus, Power, PowerOff, Search } from "lucide-react";
import {
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  PageShell,
  ProductThumb,
  StatStrip,
  StatusPill,
  useToast,
  type Column,
} from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import {
  archiveProduct,
  createProduct,
  listCategories,
  listProducts,
  listResources,
  listStaff,
  updateProduct,
  type Product,
} from "@/lib/api";
import { behaviourSubtitle } from "@/lib/behaviour";
import { sellingBlockers, type Blocker } from "@/lib/sellable";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import { MD, useMediaQuery } from "@/lib/useMedia";
import { RowMenu } from "./_components/RowMenu";

const PAGE_SIZE = 10;

/** Copy an object without certain keys. Written out rather than destructured
 *  into throwaway names, so that adding a field to `Product` cannot silently
 *  start copying it into a duplicate. */
function omit<T extends object, K extends keyof T>(source: T, keys: K[]): Omit<T, K> {
  const out = { ...source };
  for (const key of keys) delete out[key];
  return out;
}

function priceRange(p: Product): string {
  const prices = p.tiers.map((t) => t.price);
  if (prices.length === 0) return "—";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatMoney(min) : `${formatMoney(min)}–${formatMoney(max)}`;
}

export default function ProductsPage() {
  const router = useRouter();
  /* This page and the two beside it were the only OS screens with no
     translator at all, writing every label in English inline — while an empty
     `products` namespace sat registered in the loader waiting for them. */
  const t = useTranslations("products");
  const compact = !useMediaQuery(MD, true);

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<{ key: string; order: "asc" | "desc" }>({
    key: "name",
    order: "asc",
  });
  const [page, setPage] = useState(1);

  const categoriesQ = useApiQuery(() => listCategories({ pageSize: 100 }), []);
  const categories = useMemo(() => categoriesQ.data?.data ?? [], [categoriesQ.data]);
  // For the derived behaviour subtitle (never show raw BT codes in the UI).
  const resourcesQ = useApiQuery(() => listResources({ pageSize: 100 }), []);
  const teamQ = useApiQuery(() => listStaff({ pageSize: 100 }), []);
  const resources = useMemo(() => resourcesQ.data?.data ?? [], [resourcesQ.data]);
  const categoryName = (id: string | null) =>
    id ? (categories.find((c) => c.id === id)?.name ?? "—") : "—";

  const filters = useMemo(
    () => ({ status, categoryId: categoryId || undefined }),
    [status, categoryId],
  );

  const { data, loading, reload: reloadList } = useApiQuery(
    () =>
      listProducts({ page, pageSize: PAGE_SIZE, search, sort: sort.key, order: sort.order, filters }),
    [search, filters, sort.key, sort.order, page],
  );

  /* The whole catalogue behind the filters, for the figures above the table —
     "how many cannot be sold" is a question about the catalogue, not about the
     ten rows currently on screen. */
  const allQ = useApiQuery(() => listProducts({ pageSize: 500, search, filters }), [search, filters]);
  const reloadAll = allQ.reload;
  const summary = useMemo(() => {
    const all = allQ.data?.data ?? [];
    return {
      total: all.length,
      active: all.filter((p) => p.status === "active").length,
      categories: new Set(all.map((p) => p.categoryId).filter(Boolean)).size,
      blocked: all.filter((p) => sellingBlockers(p, resources).length > 0).length,
    };
  }, [allQ.data, resources]);

  const toast = useToast();
  /* Selection lives on ids, not on rows: a bulk action reloads the table and
     the row objects are replaced, but the ids the operator ticked are still
     the ids they meant. */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{ ids: string[] } | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => data?.data ?? [], [data]);
  const reload = () => {
    setSelected(new Set());
    reloadList();
    reloadAll();
  };

  const toggleOne = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAllOnPage = () =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (allOnPageSelected) rows.forEach((r) => next.delete(r.id));
      else rows.forEach((r) => next.add(r.id));
      return next;
    });

  /** Switching a product on or off is reversible and silent-free: it says what
   *  happened, and the row it happened to. */
  const setProductStatus = async (ids: string[], next: "active" | "inactive") => {
    setBusy(true);
    for (const id of ids) await updateProduct(id, { status: next });
    setBusy(false);
    toast.success(
      ids.length === 1
        ? t(next === "active" ? "toastActivated" : "toastDeactivated")
        : t(next === "active" ? "toastActivatedMany" : "toastDeactivatedMany", { count: ids.length }),
    );
    reload();
  };

  /* Archive asks first. It takes a product out of the catalogue and out of the
     till, which is not something to do on a mis-click. */
  const doArchive = async (ids: string[]) => {
    setBusy(true);
    for (const id of ids) await archiveProduct(id);
    setBusy(false);
    setConfirm(null);
    toast.success(ids.length === 1 ? t("toastArchived") : t("toastArchivedMany", { count: ids.length }));
    reload();
  };

  /** The most common thing anyone does to a catalogue: make the next one like
   *  the last one. Copies everything but the identity, lands inactive so a
   *  half-edited duplicate never appears on the till. */
  const duplicate = async (p: Product) => {
    setBusy(true);
    // The server assigns identity and timestamps; everything else is the copy.
    const base = omit(p, ["id", "createdAt", "updatedAt", "archivedAt", "tiers"]);
    const res = await createProduct({
      ...base,
      name: t("copyOf", { name: p.name }),
      status: "inactive",
      tiers: p.tiers.map((tier) => omit(tier, ["id"])),
    });
    setBusy(false);
    if (res.ok) {
      toast.success(t("toastDuplicated"));
      reload();
    }
  };

  const blockerLabel = (b: Blocker) =>
    t(
      b === "noPrice"
        ? "blockerNoPrice"
        : b === "noSchedule"
          ? "blockerNoSchedule"
          : b === "noResource"
            ? "blockerNoResource"
            : "blockerNoChannel",
    );

  const channelLabel = (c: string) =>
    c === "counter" ? t("channelCounter") : c === "online" ? t("channelOnline") : c;

  const columns: Column<Product>[] = [
    {
      /* Selection, so a seasonal switch-off is one action rather than twenty.
         The cell stops its own clicks: the row navigates, and ticking a box
         must not also open the record. */
      key: "select",
      header: "",
      width: "2.5rem",
      render: (p) => (
        <span onClick={(e) => e.stopPropagation()} className="flex">
          <input
            type="checkbox"
            checked={selected.has(p.id)}
            onChange={() => toggleOne(p.id)}
            aria-label={t("selectOne", { name: p.name })}
            className="h-4 w-4 accent-[var(--color-ember)]"
          />
        </span>
      ),
    },
    {
      key: "name",
      header: t("colName"),
      sortable: true,
      render: (p) => (
        <div className="flex items-center gap-comfortable">
          {/* A catalogue is the one screen where the picture earns its space —
              it is how an operator recognises their own product before they
              have read anything. */}
          <ProductThumb images={p.images} name={p.name} bookingType={p.bookingType} size="card" />
          <div className="min-w-0">
            <div className="truncate font-medium text-fg">{p.name}</div>
            {/* An exception, not a column. A "Ready to sell" column said the
                same word on every row, which is the same wasted width the
                always-identical Channels column already spends — a signal
                worth having is one that is silent until it is not. */}
            {(() => {
              const blockers = sellingBlockers(p, resources);
              if (blockers.length === 0) {
                return (
                  <div className="truncate text-[12px] text-muted">
                    {behaviourSubtitle(p, { resources, team: teamQ.data?.data ?? [] })}
                  </div>
                );
              }
              return (
                <div
                  className="flex items-center gap-inline truncate text-[12px] text-warning"
                  title={blockers.map(blockerLabel).join(" · ")}
                >
                  <AlertTriangle size={12} strokeWidth={2} className="shrink-0" aria-hidden />
                  {blockers.map(blockerLabel).join(" · ")}
                </div>
              );
            })()}
          </div>
        </div>
      ),
    },
    { key: "category", header: t("colCategory"), render: (p) => categoryName(p.categoryId) },
    {
      key: "price",
      header: t("colPrice"),
      align: "right",
      render: (p) => <span className="font-mono text-[13px]">{priceRange(p)}</span>,
    },
    {
      key: "channels",
      header: t("colChannels"),
      // Words, not the stored enum. "counter · online" in lowercase mono read
      // as a code the operator was not meant to see.
      render: (p) => (
        <span className={cn("text-[13px]", p.channels.length === 0 && "text-warning")}>
          {p.channels.length ? p.channels.map(channelLabel).join(" · ") : t("channelNone")}
        </span>
      ),
    },
    { key: "status", header: t("colStatus"), sortable: true, render: (p) => <StatusPill status={p.status} /> },
    {
      key: "updatedAt",
      header: t("colUpdated"),
      sortable: true,
      render: (p) => <span className="whitespace-nowrap text-muted">{formatDate(p.updatedAt)}</span>,
    },
    {
      key: "actions",
      header: "",
      width: "3rem",
      render: (p) => (
        <RowMenu
          label={t("rowActions", { name: p.name })}
          items={[
            {
              key: "edit",
              label: t("actionEdit"),
              icon: <Pencil size={14} strokeWidth={1.5} />,
              onSelect: () => router.push(`/bookings/${p.id}`),
            },
            {
              key: "duplicate",
              label: t("actionDuplicate"),
              icon: <Copy size={14} strokeWidth={1.5} />,
              onSelect: () => duplicate(p),
            },
            p.status === "active"
              ? {
                  key: "deactivate",
                  label: t("actionDeactivate"),
                  icon: <PowerOff size={14} strokeWidth={1.5} />,
                  onSelect: () => setProductStatus([p.id], "inactive"),
                }
              : {
                  key: "activate",
                  label: t("actionActivate"),
                  icon: <Power size={14} strokeWidth={1.5} />,
                  onSelect: () => setProductStatus([p.id], "active"),
                },
            {
              key: "archive",
              label: t("actionArchive"),
              icon: <Archive size={14} strokeWidth={1.5} />,
              destructive: true,
              disabled: p.status === "archived",
              onSelect: () => setConfirm({ ids: [p.id] }),
            },
          ]}
        />
      ),
    },
  ];

  const selectCls =
    "h-11 md:h-9 rounded-sm border border-line bg-card px-comfortable text-sm outline-none focus:border-inverse";

  return (
    <PageShell
      title={t("title")}
      description={t("description")}
      actions={
        <div className="flex gap-tight">
          <Button variant="secondary" onClick={() => router.push("/bookings/layouts")}>
            {t("seatLayouts")}
          </Button>
          <Button
            icon={<Plus size={16} strokeWidth={1.5} />}
            onClick={() => router.push("/bookings/new")}
          >
            {t("newBooking")}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-section">
        <StatStrip
          compact={compact}
          loading={allQ.loading}
          items={[
            { key: "total", label: t("statProducts"), value: String(summary.total) },
            { key: "active", label: t("statActive"), value: String(summary.active) },
            { key: "categories", label: t("statCategories"), value: String(summary.categories) },
            {
              key: "blocked",
              label: t("statNeedsWork"),
              value: String(summary.blocked),
              tone: summary.blocked > 0 ? "warning" : undefined,
            },
          ]}
        />

        <DataTable
          columns={columns}
          rows={data?.data ?? []}
          getRowId={(p) => p.id}
          loading={loading}
          sort={sort}
          minWidth="62rem"
          onSortChange={(key) => {
            setPage(1);
            setSort((s) => ({ key, order: s.key === key && s.order === "asc" ? "desc" : "asc" }));
          }}
          onRowClick={(p) => router.push(`/bookings/${p.id}`)}
          renderCard={(p) => {
            const blockers = sellingBlockers(p, resources);
            return (
              <div className="flex flex-col gap-tight">
                <div className="flex items-start gap-comfortable">
                  <ProductThumb images={p.images} name={p.name} bookingType={p.bookingType} size="card" />
                  <div className="min-w-0 flex-1">
                    <div className="break-words text-sm font-medium">{p.name}</div>
                    <div className="text-[12px] text-muted">
                      {behaviourSubtitle(p, { resources, team: teamQ.data?.data ?? [] })}
                    </div>
                  </div>
                  <StatusPill status={p.status} />
                </div>
                <div className="flex items-baseline justify-between gap-tight">
                  <span className="text-[12px] text-muted">{categoryName(p.categoryId)}</span>
                  <span className="font-mono text-sm font-medium">{priceRange(p)}</span>
                </div>
                {blockers.length > 0 && (
                  <span className="flex items-center gap-inline text-[12px] text-warning">
                    <AlertTriangle size={12} strokeWidth={2} aria-hidden />
                    {blockers.map(blockerLabel).join(" · ")}
                  </span>
                )}
              </div>
            );
          }}
          toolbar={
            selected.size > 0 ? (
              /* While something is ticked the toolbar becomes the thing you
                 would do to it. Filters are not what you came for mid-task,
                 and a bar that appears where they were is impossible to miss. */
              <div className="flex flex-wrap items-center gap-tight rounded-sm border border-ember bg-ember/5 px-comfortable py-tight">
                <span className="text-[13px] font-medium">
                  {t("selectedCount", { count: selected.size })}
                </span>
                <span className="flex-1" />
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  icon={<Power size={15} strokeWidth={1.5} />}
                  onClick={() => setProductStatus([...selected], "active")}
                >
                  {t("actionActivate")}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  icon={<PowerOff size={15} strokeWidth={1.5} />}
                  onClick={() => setProductStatus([...selected], "inactive")}
                >
                  {t("actionDeactivate")}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  icon={<Archive size={15} strokeWidth={1.5} />}
                  onClick={() => setConfirm({ ids: [...selected] })}
                >
                  {t("actionArchive")}
                </Button>
                <Button variant="tertiary" size="sm" onClick={() => setSelected(new Set())}>
                  {t("clearSelection")}
                </Button>
              </div>
            ) : (
            <div className="flex flex-wrap items-center gap-tight">
              <label className="flex h-11 items-center gap-tight px-tight text-[13px] text-muted md:h-9">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={toggleAllOnPage}
                  aria-label={t("selectAll")}
                  className="h-4 w-4 accent-[var(--color-ember)]"
                />
                {t("selectAll")}
              </label>
              <div className="relative">
                <Search
                  size={16}
                  strokeWidth={1.5}
                  className="absolute left-comfortable top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder={t("searchPlaceholder")}
                  className="h-11 w-full min-w-0 rounded-sm border border-line pl-8 pr-comfortable text-sm outline-none focus:border-inverse md:h-9 md:w-64"
                />
              </div>
              <select
                aria-label={t("allCategories")}
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setPage(1);
                }}
                className={selectCls}
              >
                <option value="">{t("allCategories")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                aria-label={t("allStatuses")}
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className={selectCls}
              >
                <option value="all">{t("allStatuses")}</option>
                <option value="active">{t("statusActive")}</option>
                <option value="inactive">{t("statusInactive")}</option>
                <option value="archived">{t("statusArchived")}</option>
              </select>
            </div>
            )
          }
          emptyState={
            <EmptyState
              title={t("emptyTitle")}
              message={search || categoryId || status !== "all" ? t("emptyFiltered") : t("emptyMessage")}
              action={
                <Button
                  icon={<Plus size={16} strokeWidth={1.5} />}
                  onClick={() => router.push("/bookings/new")}
                >
                  {t("newBooking")}
                </Button>
              }
            />
          }
          pagination={{
            page,
            pageSize: PAGE_SIZE,
            total: data?.page.total ?? 0,
            onPageChange: setPage,
          }}
        />
      </div>

      {/* Archive takes a product out of the catalogue and out of the till.
          Confirmed, never done on a mis-click. */}
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && doArchive(confirm.ids)}
        loading={busy}
        title={t("archiveTitle")}
        message={
          confirm && confirm.ids.length > 1
            ? t("archiveBodyMany", { count: confirm.ids.length })
            : t("archiveBody")
        }
        confirmLabel={t("actionArchive")}
      />
    </PageShell>
  );
}
