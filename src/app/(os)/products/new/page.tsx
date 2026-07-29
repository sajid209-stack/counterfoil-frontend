"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getOperator, listCategories, listLocations } from "@/lib/api";
import { ProductForm } from "../_components/ProductForm";

export default function NewProductPage() {
  const cats = useApiQuery(() => listCategories({ pageSize: 100 }), []);
  const locs = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const op = useApiQuery(() => getOperator(), []);
  const loading = cats.loading || locs.loading || op.loading;

  return (
    <PageShell title="New product" description="Create a product to sell at the counter or online.">
      <Link
        href="/products"
        className="mb-section inline-flex items-center gap-inline text-[13px] text-neutral-400 hover:text-ink"
      >
        <ArrowLeft size={14} strokeWidth={1.5} /> Products
      </Link>
      {loading ? (
        <p className="text-[13px] text-neutral-400">Loading…</p>
      ) : (
        <ProductForm
          mode="create"
          categories={cats.data?.data ?? []}
          locations={locs.data?.data ?? []}
          currency={op.data?.currency ?? "BDT"}
        />
      )}
    </PageShell>
  );
}
