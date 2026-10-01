"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useApiQuery } from "@/lib/useApi";
import { getOrder, listTickets } from "@/lib/api";
import { LiveStorefrontShell } from "../../../_components/flow/LiveFlowProvider";
import { ConfirmationScreen } from "../../../_components/flow/ConfirmationScreen";
import { StorefrontMissing } from "../../../_components/Chrome";

/** The confirmation screen, reached after a real sale: the order and its
 *  tickets are fetched fresh, exactly as a receipt would be, rather than
 *  carried in memory from the checkout step. */
export default function StorefrontDonePage() {
  const params = useParams<{ slug: string; orderId: string }>();
  return (
    <LiveStorefrontShell slug={params.slug}>
      <LoadedConfirmation orderId={params.orderId} />
    </LiveStorefrontShell>
  );
}

function LoadedConfirmation({ orderId }: { orderId: string }) {
  const t = useTranslations("storefront");
  const orderQ = useApiQuery(() => getOrder(orderId), [orderId]);
  const ticketsQ = useApiQuery(() => listTickets({ filters: { orderId }, pageSize: 50 }), [orderId]);

  if (orderQ.loading || ticketsQ.loading) {
    return (
      <div className="mx-auto max-w-sm animate-pulse space-y-section px-gutter py-hero" aria-busy="true">
        <div className="mx-auto h-8 w-2/3 rounded-sm bg-line" />
        <div className="h-64 rounded-md bg-line/60" />
      </div>
    );
  }
  if (!orderQ.data) return <StorefrontMissing title={t("missingTitle")} message={t("missingBody")} />;

  return <ConfirmationScreen order={orderQ.data} tickets={ticketsQ.data?.data ?? []} isPreview={false} />;
}
