"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, MessageSquare, Printer } from "lucide-react";
import { Button, useToast } from "@/components/ui";
import { formatMoney } from "@/lib/format";

export default function CompletePage() {
  const router = useRouter();
  const toast = useToast();
  const [info, setInfo] = useState<{ code: string; change: number; balance?: number } | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("pos_complete");
    if (raw) setInfo(JSON.parse(raw));
    else router.replace("/pos");
  }, [router]);

  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-major px-section py-hero text-center">
      <div className="flex items-center gap-tight text-success">
        <CircleCheck size={28} strokeWidth={1.5} />
        <h1 className="type-h1 text-2xl text-fg">Ticket issued</h1>
      </div>

      {info && (
        <>
          {/* The brand moment — a literal ticket stub with a perforated tear line. */}
          <div className="relative w-full">
            <div className="rounded-md bg-ink px-section pb-major pt-major text-paper">
              <p className="type-label text-[11px] text-faint">Booking reference</p>
              <p className="mt-tight font-mono text-3xl tracking-tight">{info.code}</p>
            </div>
            {/* perforation */}
            <div className="relative flex items-center">
              <span className="absolute -left-2 h-4 w-4 rounded-full bg-surface" aria-hidden />
              <span className="absolute -right-2 h-4 w-4 rounded-full bg-surface" aria-hidden />
              <span className="mx-major flex-1 border-t-2 border-dashed border-paper/40" aria-hidden />
            </div>
            <div className="rounded-md bg-ink px-section pb-major pt-tight text-paper">
              <p className="font-mono text-[12px] text-faint">Present at the gate · scan to check in</p>
            </div>
          </div>

          {info.change > 0 && (
            <p className="type-body text-muted">
              Change due <span className="font-mono text-fg">{formatMoney(info.change)}</span>
            </p>
          )}
          {(info.balance ?? 0) > 0 && (
            <p className="type-body text-muted">
              Balance due at arrival <span className="font-mono text-fg">{formatMoney(info.balance!)}</span>
            </p>
          )}

          {/* Receipt step — Print · SMS · None */}
          <div className="flex w-full gap-tight">
            <button type="button" onClick={() => toast.success("Receipt sent to the printer.")} className="flex h-14 flex-1 items-center justify-center gap-inline rounded-sm border border-line bg-card text-sm active:bg-ember/10"><Printer size={16} strokeWidth={1.5} /> Print</button>
            <button type="button" onClick={() => toast.success("Receipt sent by SMS.")} className="flex h-14 flex-1 items-center justify-center gap-inline rounded-sm border border-line bg-card text-sm active:bg-ember/10"><MessageSquare size={16} strokeWidth={1.5} /> SMS</button>
            <button type="button" onClick={() => router.push("/pos")} className="h-14 flex-1 rounded-sm border border-line bg-card text-sm text-muted active:bg-ember/10">No receipt</button>
          </div>
        </>
      )}

      <Button size="lg" fullWidth onClick={() => router.push("/pos")}>New sale</Button>
    </main>
  );
}
