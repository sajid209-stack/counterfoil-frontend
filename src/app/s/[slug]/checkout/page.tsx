"use client";

import { useParams } from "next/navigation";
import { LiveStorefrontShell } from "../../_components/flow/LiveFlowProvider";
import { CheckoutScreen } from "../../_components/flow/CheckoutScreen";

export default function StorefrontCheckoutPage() {
  const params = useParams<{ slug: string }>();
  return (
    <LiveStorefrontShell slug={params.slug}>
      <CheckoutScreen />
    </LiveStorefrontShell>
  );
}
