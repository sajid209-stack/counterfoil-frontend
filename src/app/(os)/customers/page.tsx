"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { DataTable, EmptyState, PageShell, type Column } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listOrders } from "@/lib/api";
import { formatMoney } from "@/lib/format";

interface CustomerRow {
  name: string;
  orders: number;
  spent: number;
  lastVisit: string;
}

// Read path only — capture happens at POS (the customer chip). This page
// answers "who is this person and what have they done here".
export default function CustomersPage() {
  const router = useRouter();
  const t = useTranslations("customers");
  const [search, setSearch] = useState("");
  const ordersQ = useApiQuery(() => listOrders({ pageSize: 1000 }), []);

  const rows = useMemo<CustomerRow[]>(() => {
    const map = new Map<string, CustomerRow>();
    for (const o of ordersQ.data?.data ?? []) {
      if (!o.customerName) continue;
      const cur = map.get(o.customerName) ?? { name: o.customerName, orders: 0, spent: 0, lastVisit: "" };
      cur.orders += 1;
      if (o.status === "paid" || o.status === "partial") cur.spent += o.total;
      if (o.createdAt > cur.lastVisit) cur.lastVisit = o.createdAt;
      map.set(o.customerName, cur);
    }
    const q = search.trim().toLowerCase();
    return [...map.values()]
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .sort((a, b) => b.lastVisit.localeCompare(a.lastVisit));
  }, [ordersQ.data, search]);

  const columns: Column<CustomerRow>[] = [
    { key: "name", header: t("colCustomer"), render: (c) => <span className="font-medium">{c.name}</span> },
    { key: "orders", header: t("colBookings"), align: "right", render: (c) => String(c.orders) },
    { key: "spent", header: t("colSpent"), align: "right", render: (c) => formatMoney(c.spent) },
    { key: "lastVisit", header: t("colLastVisit"), render: (c) => <span className="font-mono text-[12px] text-muted">{c.lastVisit.slice(0, 10)}</span> },
  ];

  return (
    <PageShell title={t("title")} description={t("description")}>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(c) => c.name}
        loading={ordersQ.loading}
        onRowClick={(c) => router.push(`/orders?customer=${encodeURIComponent(c.name)}`)}
        toolbar={
          <div className="relative">
            <Search size={16} strokeWidth={1.5} className="absolute left-comfortable top-1/2 -translate-y-1/2 text-faint" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} className="h-9 w-64 rounded-sm border border-line pl-8 pr-comfortable text-sm outline-none focus:border-inverse" />
          </div>
        }
        emptyState={<EmptyState title={t("emptyTitle")} message={t("emptyMessage")} />}
      />
    </PageShell>
  );
}
