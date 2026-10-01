"use client";

import { useParams } from "next/navigation";
import { LiveStorefrontShell } from "../_components/flow/LiveFlowProvider";
import { StorefrontView } from "../_components/StorefrontView";

/**
 * A venue's public page.
 *
 * It used to publish without selling — "Buy your ticket at the counter" was
 * the whole of "How to book". The owner reversed that: this is now the front
 * door to the full guest journey (venue → booking → basket → checkout →
 * payment → confirmation), built as one flow controller
 * (`lib/storefront/FlowProvider`) so this live surface and the editor's
 * preview share every screen rather than keeping two copies in step by hand.
 */
export default function StorefrontPage() {
  const params = useParams<{ slug: string }>();
  return (
    <LiveStorefrontShell slug={params.slug}>
      <StorefrontView />
    </LiveStorefrontShell>
  );
}
