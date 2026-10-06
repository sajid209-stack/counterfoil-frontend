"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Archive } from "lucide-react";
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
  listLocations,
  listProducts,
  listResources,
  listStaff,
  updateProduct,
} from "@/lib/api";
import { useBehaviourSubtitle } from "@/lib/behaviour";
import { ProductForm } from "../../_components/booking/ProductForm";

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const t = useTranslations("catalog.record");
  const subtitle = useBehaviourSubtitle();
  const tc = useTranslations("catalog");

  const prod = useApiQuery(() => getProduct(params.id), [params.id]);
  const locs = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const team = useApiQuery(() => listStaff({ pageSize: 100, filters: { status: "active" } }), []);
  const resourcesQ = useApiQuery(() => listResources({ pageSize: 100, filters: { status: "active" } }), []);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100, filters: { status: "active" } }), []);
  const op = useApiQuery(() => getOperator(), []);

  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const loading = prod.loading || locs.loading || team.loading || resourcesQ.loading || op.loading;

  const doArchive = async () => {
    setArchiving(true);
    const res = await archiveProduct(params.id);
    setArchiving(false);
    setConfirmArchive(false);
    if (res.ok) {
      const id = params.id;
      toast.success(t("archived"), {
        label: tc("undo"),
        run: async () => {
          await updateProduct(id, { status: "active", archivedAt: null } as never);
          toast.success(t("restored"));
        },
      });
      router.push("/catalog?kind=bookings");
    } else {
      toast.error(res.error.message);
    }
  };

  if (!loading && (prod.error || !prod.data)) {
    return (
      <PageShell title={t("fallbackTitle")}>
        <EmptyState
          title={t("notFound")}
          message={t("notFoundBody")}
          action={<Button onClick={() => router.push("/catalog?kind=bookings")}>{t("backButton")}</Button>}
        />
      </PageShell>
    );
  }

  const product = prod.data;
  const archived = product?.status === "archived";

  return (
    <PageShell
      title={product?.name ?? t("fallbackTitle")}
      description={product ? subtitle(product, { resources: resourcesQ.data?.data, team: team.data?.data }) : undefined}
      back={{ href: "/catalog?kind=bookings", label: t("back") }}
      status={product && archived ? <StatusPill status="archived" /> : undefined}
      actions={
        product && !archived ? (
          <Button
            variant="secondary"
            icon={<Archive size={16} strokeWidth={1.5} aria-hidden />}
            onClick={() => setConfirmArchive(true)}
          >
            {t("archive")}
          </Button>
        ) : undefined
      }
    >
      {loading || !product ? (
        <div aria-busy="true" className="flex animate-pulse flex-col gap-tight"><div className="h-4 w-1/3 rounded-xs bg-line" /><div className="h-4 w-2/3 rounded-xs bg-line" /><div className="h-4 w-1/2 rounded-xs bg-line" /></div>
      ) : (
        <ProductForm
          product={product}
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
        title={t("archiveTitle")}
        message={t("archiveBody")}
        confirmLabel={t("archive")}
        loading={archiving}
      />
    </PageShell>
  );
}
