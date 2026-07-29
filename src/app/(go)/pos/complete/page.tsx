"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { Button } from "@/components/ui";
import { formatMoney } from "@/lib/format";

export default function CompletePage() {
  const router = useRouter();
  const [info, setInfo] = useState<{ code: string; change: number } | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("pos_complete");
    if (raw) setInfo(JSON.parse(raw));
    else router.replace("/pos");
  }, [router]);

  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-major px-section py-hero text-center">
      <div className="flex items-center gap-tight text-success">
        <CircleCheck size={28} strokeWidth={1.5} />
        <h1 className="type-h1 text-2xl text-ink">Ticket issued</h1>
      </div>

      {info && (
        <>
          {/* The brand moment — a literal ticket stub with a perforated tear line. */}
          <div className="relative w-full">
            <div className="rounded-md bg-ink px-section pb-major pt-major text-paper">
              <p className="type-label text-[11px] text-neutral-400">Booking reference</p>
              <p className="mt-tight font-mono text-3xl tracking-tight">{info.code}</p>
            </div>
            {/* perforation */}
            <div className="relative flex items-center">
              <span className="absolute -left-2 h-4 w-4 rounded-full bg-paper" aria-hidden />
              <span className="absolute -right-2 h-4 w-4 rounded-full bg-paper" aria-hidden />
              <span className="mx-major flex-1 border-t-2 border-dashed border-paper/40" aria-hidden />
            </div>
            <div className="rounded-md bg-ink px-section pb-major pt-tight text-paper">
              <p className="font-mono text-[12px] text-neutral-400">Present at the gate · scan to check in</p>
            </div>
          </div>

          {info.change > 0 && (
            <p className="type-body text-neutral-600">
              Change due <span className="font-mono text-ink">{formatMoney(info.change)}</span>
            </p>
          )}
        </>
      )}

      <Button size="lg" fullWidth onClick={() => router.push("/pos")}>New sale</Button>
    </main>
  );
}
