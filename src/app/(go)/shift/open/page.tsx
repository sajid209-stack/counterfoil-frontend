"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export default function ShiftOpenPage() {
  const router = useRouter();
  const [float, setFloat] = useState("2000.00");

  return (
    <main className="mx-auto flex max-w-md flex-col gap-section px-section py-hero">
      <div>
        <p className="type-label text-[13px] text-ember">Start of shift</p>
        <h1 className="type-h1 mt-tight text-2xl">Opening float</h1>
        <p className="type-body mt-tight text-muted">Count the cash drawer before you start selling.</p>
      </div>

      <div className="flex flex-col gap-tight">
        <label className="type-label text-[12px] text-muted">Opening cash (৳)</label>
        <input
          inputMode="decimal"
          value={float}
          onChange={(e) => setFloat(e.target.value)}
          className="h-14 rounded-sm border border-line bg-card px-section font-mono text-2xl outline-none focus:border-inverse"
        />
      </div>

      <Button size="lg" fullWidth onClick={() => router.push("/pos")}>
        Open shift
      </Button>
    </main>
  );
}
