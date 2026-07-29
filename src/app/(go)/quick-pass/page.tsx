"use client";

import { useState } from "react";
import { CircleCheck } from "lucide-react";
import { Button, FormField } from "@/components/ui";
import { checkout } from "@/lib/api";
import { formatMoney } from "@/lib/format";

const DURATIONS = [30, 60, 120, 180];

// BT-14 — field-issued pass. Quick issue on the spot: duration, price, optional
// identifier (e.g. a plate). Not in the product grid.
export default function QuickPassPage() {
  const [duration, setDuration] = useState(60);
  const [price, setPrice] = useState("100");
  const [identifier, setIdentifier] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  const issue = async () => {
    setIssuing(true);
    const minor = Math.round((parseFloat(price) || 0) * 100);
    const res = await checkout({
      channel: "counter",
      locationId: "loc_fort",
      counterId: null,
      staffId: null,
      lines: [{ productId: "quick_pass", productName: `Pass · ${duration} min`, tierName: identifier || "Pass", quantity: 1, unitPrice: minor }],
      taxPct: 0,
      method: "cash",
      amountTendered: minor,
    });
    setIssuing(false);
    if (res.ok) setCode(res.data.firstTicketCode);
  };

  if (code) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center gap-major px-section py-hero text-center">
        <CircleCheck size={48} strokeWidth={1.5} className="text-success" />
        <h1 className="type-h1 text-2xl">Pass issued</h1>
        <div className="w-full rounded-sm bg-ink px-section py-major"><span className="font-mono text-2xl text-paper">{code}</span></div>
        <Button size="lg" fullWidth onClick={() => { setCode(null); setIdentifier(""); }}>Issue another</Button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-section px-section py-hero">
      <div>
        <p className="type-label text-[13px] text-ember">Gate</p>
        <h1 className="type-h1 mt-tight text-2xl">Quick pass</h1>
        <p className="type-body mt-tight text-neutral-600">Issue a timed pass on the spot.</p>
      </div>

      <div className="flex flex-col gap-tight">
        <span className="type-label text-[12px] text-neutral-600">Duration</span>
        <div className="flex gap-tight">
          {DURATIONS.map((d) => (
            <button key={d} type="button" onClick={() => setDuration(d)} className={`h-12 flex-1 rounded-sm border text-sm ${duration === d ? "border-ink bg-ink text-paper" : "border-neutral-200 bg-white"}`}>{d} min</button>
          ))}
        </div>
      </div>

      <FormField label="Price (৳)" variant="number" value={price} onChange={(e) => setPrice(e.target.value)} />
      <FormField label="Identifier (optional)" placeholder="Plate / name" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />

      <Button size="lg" fullWidth loading={issuing} onClick={issue}>Issue pass · {formatMoney(Math.round((parseFloat(price) || 0) * 100))}</Button>
    </main>
  );
}
