"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import {
  Button,
  DataTable,
  EmptyState,
  PageShell,
  ProductThumb,
  StatusPill,
  type Column,
} from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listCategories, listProducts, listResources, listStaff, type Product } from "@/lib/api";
import { behaviourSubtitle } from "@/lib/behaviour";
import { formatDate, formatMoney } from "@/lib/format";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "archived", label: "Archived" },
];

function priceRange(p: Product): string {
  const prices = p.tiers.map((t) => t.price);
  if (prices.length === 0) return "—";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatMoney(min) : `${formatMoney(min)}–${formatMoney(max)}`;
}

export default function ProductsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<{ key: string; order: "asc" | "desc" }>({
    key: "name",
    order: "asc",
  });
  const [page, setPage] = useState(1);

  const categoriesQ = useApiQuery(() => listCategories({ pageSize: 100 }), []);
  const categories = categoriesQ.data?.data ?? [];
  // For the derived behaviour subtitle (never show raw BT codes in the UI).
  const resourcesQ = useApiQuery(() => listResources({ pageSize: 100 }), []);
  const teamQ = useApiQuery(() => listStaff({ pageSize: 100 }), []);
  const categoryName = (id: string | null) =>
    id ? (categories.find((c) => c.id === id)?.name ?? "—") : "—";

  const { data, loading } = useApiQuery(
    () =>
      listProducts({
        page,
        pageSize: 10,
        search,
        sort: sort.key,
        order: sort.order,
        filters: { status, categoryId: categoryId || undefined },
      }),
    [search, categoryId, status, sort.key, sort.order, page],
  );

  const columns: Column<Product>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      render: (p) => (
        <div className="flex items-center gap-tight">
          <ProductThumb images={p.images} name={p.name} bookingType={p.bookingType} size="chip" />
          <div className="min-w-0">
            <div className="truncate font-medium text-fg">{p.name}</div>
            <div className="truncate text-[11px] text-faint">{behaviourSubtitle(p, { resources: resourcesQ.data?.data ?? [], team: teamQ.data?.data ?? [] })}</div>
          </div>
        </div>
      ),
    },
    { key: "category", header: "Category", render: (p) => categoryName(p.categoryId) },
    {
      key: "price",
      header: "Price",
      align: "right",
      render: (p) => <span className="font-mono text-[13px]">{priceRange(p)}</span>,
    },
    {
      key: "channels",
      header: "Channels",
      render: (p) => (
        <span className="font-mono text-[11px] text-muted">
          {p.channels.length ? p.channels.join(" · ") : "—"}
        </span>
      ),
    },
    { key: "status", header: "Status", sortable: true, render: (p) => <StatusPill status={p.status} /> },
    {
      key: "updatedAt",
      header: "Updated",
      sortable: true,
      render: (p) => <span className="text-muted">{formatDate(p.updatedAt)}</span>,
    },
  ];

  const selectCls =
    "h-9 rounded-sm border border-line bg-card px-comfortable text-sm outline-none focus:border-inverse";

  return (
    <PageShell
      title="Bookings"
      description="Everything you sell — admission, tours, events, add-ons."
      actions={
        <div className="flex gap-tight">
          <Button variant="secondary" onClick={() => router.push("/bookings/layouts")}>
            Seat layouts
          </Button>
          <Button
            icon={<Plus size={16} strokeWidth={1.5} />}
            onClick={() => router.push("/bookings/new")}
          >
            New booking
          </Button>
        </div>
      }
    >
      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(p) => p.id}
        loading={loading}
        sort={sort}
        onSortChange={(key) =>
          setSort((s) => ({
            key,
            order: s.key === key && s.order === "asc" ? "desc" : "asc",
          }))
        }
        onRowClick={(p) => router.push(`/bookings/${p.id}`)}
        toolbar={
          <div className="flex flex-wrap items-center gap-tight">
            <div className="relative">
              <Search
                size={16}
                strokeWidth={1.5}
                className="absolute left-comfortable top-1/2 -translate-y-1/2 text-faint"
              />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search bookings…"
                className="h-9 w-64 rounded-sm border border-line pl-8 pr-comfortable text-sm outline-none focus:border-inverse"
              />
            </div>
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setPage(1);
              }}
              className={selectCls}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className={selectCls}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        }
        emptyState={
          <EmptyState
            title="No bookings found"
            message="Try a different search or filter, or create a new booking."
            action={
              <Button
                icon={<Plus size={16} strokeWidth={1.5} />}
                onClick={() => router.push("/bookings/new")}
              >
                New booking
              </Button>
            }
          />
        }
        pagination={{
          page,
          pageSize: 10,
          total: data?.page.total ?? 0,
          onPageChange: setPage,
        }}
      />
    </PageShell>
  );
}
