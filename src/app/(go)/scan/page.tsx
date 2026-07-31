"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScanLine } from "lucide-react";
import { Button } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { findTicketByCode, listTickets, peekProducts, redeemTicket, ticketAdmits } from "@/lib/api";

export default function ScanPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const samplesQ = useApiQuery(() => listTickets({ pageSize: 4 }), []);

  const submit = async (value: string) => {
    const c = value.trim();
    if (!c) return;
    const t = findTicketByCode(c);
    let outcome: { accept: boolean; code: string; reason: string; group?: { ticketId: string; tierName: string; admits: number; admitted: number } };
    if (!t) outcome = { accept: false, code: c, reason: "Ticket not found" };
    else if (t.status === "redeemed") outcome = { accept: false, code: t.code, reason: "Already redeemed" };
    else if (t.status === "void") outcome = { accept: false, code: t.code, reason: "Void / refunded" };
    else {
      const admits = ticketAdmits(t);
      const productName = peekProducts().find((p) => p.id === t.productId)?.name ?? "";
      if (admits > 1) {
        // Group ticket (a Family admits 4): the result screen takes the count.
        outcome = { accept: true, code: t.code, reason: `${productName} · ${t.tierName}`, group: { ticketId: t.id, tierName: t.tierName, admits, admitted: t.admitted ?? 0 } };
      } else {
        await redeemTicket(t.id);
        outcome = { accept: true, code: t.code, reason: [productName, t.tierName].filter(Boolean).join(" · ") || "Valid ticket" };
      }
    }
    sessionStorage.setItem("scan_result", JSON.stringify(outcome));
    router.push("/scan/result");
  };

  return (
    <main className="mx-auto flex max-w-md flex-col gap-section px-section py-hero">
      <div>
        <p className="type-label text-[13px] text-ember">Gate</p>
        <h1 className="type-h1 mt-tight text-2xl">Scan a ticket</h1>
      </div>

      <div className="flex h-40 flex-col items-center justify-center gap-tight rounded-sm border border-dashed border-neutral-200 text-neutral-400">
        <ScanLine size={40} strokeWidth={1.5} />
        <span className="text-[12px]">Camera scan (mock) — enter a code below</span>
      </div>

      <div className="flex gap-tight">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit(code)}
          placeholder="CF-2026-…"
          className="h-12 flex-1 rounded-sm border border-neutral-200 bg-white px-section font-mono text-sm outline-none focus:border-ink"
        />
        <Button size="lg" onClick={() => submit(code)}>Check</Button>
      </div>

      {samplesQ.data && samplesQ.data.data.length > 0 && (
        <div className="flex flex-col gap-inline">
          <span className="type-label text-[11px] text-neutral-400">Try a real ticket</span>
          <div className="flex flex-wrap gap-inline">
            {samplesQ.data.data.map((t) => (
              <button key={t.id} type="button" onClick={() => submit(t.code)} className="rounded-xs border border-neutral-200 bg-white px-tight py-inline font-mono text-[11px] active:bg-ember/10">
                {t.code}
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
