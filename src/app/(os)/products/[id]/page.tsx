"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Archive } from "lucide-react";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  PageShell,
  StatusPill,
  useToast,
} from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import {
  archiveProduct,
  getOperator,
  getProduct,
  listCategories,
  listLocations,
  listProducts,
  listResources,
  listStaff,
} from "@/lib/api";
import { behaviourSubtitle } from "@/lib/behaviour";
import { ProductForm } from "../_components/ProductForm";

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();

  const prod = useApiQuery(() => getProduct(params.id), [params.id]);
  const cats = useApiQuery(() => listCategories({ pageSize: 100 }), []);
  const locs = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const team = useApiQuery(() => listStaff({ pageSize: 100, filters: { status: "active" } }), []);
  const resourcesQ = useApiQuery(() => listResources({ pageSize: 100, filters: { status: "active" } }), []);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100, filters: { status: "active" } }), []);
  const op = useApiQuery(() => getOperator(), []);

  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const loading = prod.loading || cats.loading || locs.loading || team.loading || resourcesQ.loading || op.loading;

  const doArchive = async () => {
    setArchiving(true);
    const res = await archiveProduct(params.id);
    setArchiving(false);
    setConfirmArchive(false);
    if (res.ok) {
      toast.success("Product archived.");
      router.push("/products");
    } else {
      toast.error(res.error.message);
    }
  };

  if (!loading && (prod.error || !prod.data)) {
    return (
      <PageShell title="Product">
        <EmptyState
          title="Product not found"
          message="It may have been removed."
          action={<Button onClick={() => router.push("/products")}>Back to products</Button>}
        />
      </PageShell>
    );
  }

  const product = prod.data;
  const archived = product?.status === "archived";

  return (
    <PageShell
      title={product?.name ?? "Product"}
      description={product ? behaviourSubtitle(product, { resources: resourcesQ.data?.data, team: team.data?.data }) : undefined}
      actions={
        product && !archived ? (
          <Button
            variant="secondary"
            icon={<Archive size={16} strokeWidth={1.5} />}
            onClick={() => setConfirmArchive(true)}
          >
            Archive
          </Button>
        ) : product && archived ? (
          <StatusPill status="archived" />
        ) : undefined
      }
    >
      <Link
        href="/products"
        className="mb-section inline-flex items-center gap-inline text-[13px] text-neutral-400 hover:text-ink"
      >
        <ArrowLeft size={14} strokeWidth={1.5} /> Products
      </Link>

      {loading || !product ? (
        <p className="text-[13px] text-neutral-400">Loading…</p>
      ) : (
        <ProductForm
          product={product}
          categories={cats.data?.data ?? []}
          locations={locs.data?.data ?? []}
          team={team.data?.data ?? []}
          resources={resourcesQ.data?.data ?? []}
          products={(productsQ.data?.data ?? []).filter((p) => p.id !== product.id)}
          currency={op.data?.currency ?? "BDT"}
        />
      )}

      <ConfirmDialog
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        onConfirm={doArchive}
        title="Archive this product?"
        message="It will be hidden from sale. You can restore it later from the backend."
        confirmLabel="Archive"
        loading={archiving}
      />
    </PageShell>
  );
}
