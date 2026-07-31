"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getOperator, listCategories, listLocations, listProducts, listResources, listStaff } from "@/lib/api";
import { ProductWizard } from "../_components/ProductWizard";

export default function NewProductPage() {
  const cats = useApiQuery(() => listCategories({ pageSize: 100 }), []);
  const locs = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const team = useApiQuery(() => listStaff({ pageSize: 100, filters: { status: "active" } }), []);
  const resources = useApiQuery(() => listResources({ pageSize: 100, filters: { status: "active" } }), []);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100, filters: { status: "active" } }), []);
  const op = useApiQuery(() => getOperator(), []);
  const loading = cats.loading || locs.loading || team.loading || resources.loading || productsQ.loading || op.loading;

  return (
    <PageShell title="Create a product" description="A few steps — we'll handle the technical setup for you.">
      <Link href="/products" className="mb-section inline-flex items-center gap-inline text-[13px] text-neutral-400 hover:text-ink">
        <ArrowLeft size={14} strokeWidth={1.5} /> Products
      </Link>
      {loading ? (
        <div aria-busy="true" className="flex animate-pulse flex-col gap-tight"><div className="h-4 w-1/3 rounded-xs bg-neutral-200" /><div className="h-4 w-2/3 rounded-xs bg-neutral-200" /><div className="h-4 w-1/2 rounded-xs bg-neutral-200" /></div>
      ) : (
        <ProductWizard categories={cats.data?.data ?? []} locations={locs.data?.data ?? []} team={team.data?.data ?? []} resources={resources.data?.data ?? []} products={productsQ.data?.data ?? []} currency={op.data?.currency ?? "BDT"} />
      )}
    </PageShell>
  );
}
