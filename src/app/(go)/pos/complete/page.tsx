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
    <main className="mx-auto flex max-w-md flex-col items-center gap-section px-section py-hero text-center">
      <CircleCheck size={64} strokeWidth={1.5} className="text-success" />
      <h1 className="type-h1 text-2xl">Ticket issued</h1>
      {info && (
        <>
          <div className="w-full rounded-sm bg-neutral-900 px-section py-major">
            <p className="font-mono text-2xl text-paper">{info.code}</p>
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
