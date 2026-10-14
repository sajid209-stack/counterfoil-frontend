"use client";

import { useParams } from "next/navigation";
import { BasketScreen } from "@/app/s/_components/flow/BasketScreen";
import { LiveItemShell } from "../../_components/LiveItemShell";

export default function ItemBasketPage() {
  const params = useParams<{ slug: string }>();
  return (
    <LiveItemShell slug={params.slug}>
      <BasketScreen />
    </LiveItemShell>
  );
}
