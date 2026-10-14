"use client";

import { useParams } from "next/navigation";
import { CheckoutScreen } from "@/app/s/_components/flow/CheckoutScreen";
import { LiveItemShell } from "../../_components/LiveItemShell";

export default function ItemCheckoutPage() {
  const params = useParams<{ slug: string }>();
  return (
    <LiveItemShell slug={params.slug}>
      <CheckoutScreen />
    </LiveItemShell>
  );
}
