"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/ui";
import { LocationForm } from "../_components/LocationForm";

export default function NewLocationPage() {
  return (
    <PageShell title="New location" description="Add a site where you sell and admit guests.">
      <Link href="/locations" className="mb-section inline-flex items-center gap-inline text-[13px] text-neutral-400 hover:text-ink">
        <ArrowLeft size={14} strokeWidth={1.5} /> Locations
      </Link>
      <LocationForm mode="create" />
    </PageShell>
  );
}
