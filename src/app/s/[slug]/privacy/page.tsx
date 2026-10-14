"use client";

import { useParams } from "next/navigation";
import { LiveStorefrontShell } from "../../_components/flow/LiveFlowProvider";
import { PrivacyScreen } from "./PrivacyScreen";

/** A venue's privacy policy, at /s/<slug>/privacy. Only a published venue has one. */
export default function StorefrontPrivacyPage() {
  const params = useParams<{ slug: string }>();
  return (
    <LiveStorefrontShell slug={params.slug}>
      <PrivacyScreen />
    </LiveStorefrontShell>
  );
}
