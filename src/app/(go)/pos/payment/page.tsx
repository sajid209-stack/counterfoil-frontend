"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { Keypad } from "../../_components/Keypad";

export default function PaymentPage() {
  const router = useRouter();
  const [total, setTotal] = useState(0);
  const [tenderTaka, setTenderTaka] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem("pos_sale");
    if (raw) setTotal(JSON.parse(raw).total ?? 0);
    else router.replace("/pos");
  }, [router]);

  const tenderedMinor = (parseInt(tenderTaka || "0", 10) || 0) * 100;
  const change = tenderedMinor - total;
  const enough = tenderedMinor >= total;

  const complete = () => {
    const seq = String(Math.floor(Date.parse(new Date().toISOString()) % 900000) + 100000);
    sessionStorage.setItem("pos_complete", JSON.stringify({ code: `CF-2026-${seq}`, change }));
    router.push("/pos/complete");
  };

  return (
    <main className="mx-auto grid max-w-3xl grid-cols-1 gap-major px-section py-section lg:grid-cols-2">
      <div className="flex flex-col gap-section">
        <div>
          <p className="type-label text-[13px] text-ember">Payment</p>
          <h1 className="type-h1 mt-tight text-2xl">Cash</h1>
        </div>
        <div className="rounded-sm border border-neutral-200 bg-white p-section">
          <div className="flex justify-between text-neutral-600"><span>Amount due</span><span className="font-mono text-lg">{formatMoney(total)}</span></div>
          <div className="mt-tight flex justify-between"><span>Tendered</span><span className="font-mono text-lg">{formatMoney(tenderedMinor)}</span></div>
          <div className={`mt-tight flex justify-between text-xl font-medium ${enough ? "text-success" : "text-neutral-400"}`}>
            <span>Change</span><span className="font-mono">{enough ? formatMoney(change) : "—"}</span>
          </div>
        </div>
        <div className="flex gap-tight">
          {[total / 100, Math.ceil(total / 10000) * 100, Math.ceil(total / 50000) * 500].map((amt, i) => (
            <button key={i} type="button" onClick={() => setTenderTaka(String(Math.round(amt)))} className="h-12 flex-1 rounded-sm border border-neutral-200 bg-white font-mono text-sm active:bg-neutral-200">
              ৳{Math.round(amt)}
            </button>
          ))}
        </div>
        <Button size="lg" fullWidth disabled={!enough} onClick={complete}>Complete sale</Button>
      </div>

      <div>
        <Keypad onKey={(d) => setTenderTaka((t) => (t + d).slice(0, 7))} onBackspace={() => setTenderTaka((t) => t.slice(0, -1))} />
      </div>
    </main>
  );
}
