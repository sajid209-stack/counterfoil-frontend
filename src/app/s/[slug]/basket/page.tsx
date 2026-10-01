"use client";

import { useParams } from "next/navigation";
import { LiveStorefrontShell } from "../../_components/flow/LiveFlowProvider";
import { BasketScreen } from "../../_components/flow/BasketScreen";

export default function StorefrontBasketPage() {
  const params = useParams<{ slug: string }>();
  return (
    <LiveStorefrontShell slug={params.slug}>
      <BasketScreen />
    </LiveStorefrontShell>
  );
}
