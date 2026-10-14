"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui";
import { StorefrontMissing } from "@/app/s/_components/Chrome";
import { ConfirmationScreen } from "@/app/s/_components/flow/ConfirmationScreen";
import { getOrder, listTickets } from "@/lib/api";
import { useApiQuery } from "@/lib/useApi";
import { LiveItemShell } from "../../../_components/LiveItemShell";

/** The confirmation after a sale made through an item's own link: the order and
 *  its tickets are fetched fresh, exactly as a receipt would be. */
export default function ItemDonePage() {
  const params = useParams<{ slug: string; orderId: string }>();
  return (
    <LiveItemShell slug={params.slug}>
      <LoadedConfirmation orderId={params.orderId} />
    </LiveItemShell>
  );
}

function LoadedConfirmation({ orderId }: { orderId: string }) {
  const t = useTranslations("storefront");
  const orderQ = useApiQuery(() => getOrder(orderId), [orderId]);
  const ticketsQ = useApiQuery(() => listTickets({ filters: { orderId }, pageSize: 50 }), [orderId]);

  if (orderQ.loading || ticketsQ.loading) {
    return (
      <div className="mx-auto max-w-sm space-y-section px-gutter py-hero" aria-busy="true">
        <Skeleton className="mx-auto" h={32} w="67%" />
        <Skeleton h={256} />
      </div>
    );
  }
  if (!orderQ.data) return <StorefrontMissing title={t("itemMissingTitle")} message={t("itemMissingBody")} />;

  return <ConfirmationScreen order={orderQ.data} tickets={ticketsQ.data?.data ?? []} isPreview={false} />;
}
