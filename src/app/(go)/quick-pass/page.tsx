"use client";

import { useMemo, useState } from "react";
import { CircleCheck } from "lucide-react";
import { Button, FormField } from "@/components/ui";
import { checkout, listProducts } from "@/lib/api";
import { useApiQuery } from "@/lib/useApi";
import { formatDuration } from "@/lib/duration";
import { formatMoney } from "@/lib/format";

// BT-14 — field-issued pass. Quick issue on the spot: duration, price and the
// identifier the product's config asks for ("Plate number"). Not in the grid.
export default function QuickPassPage() {
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100, filters: { status: "active" } }), []);
  const passProduct = useMemo(() => productsQ.data?.data.find((p) => p.bookingType === "BT-14"), [productsQ.data]);
  const durations = passProduct?.flexibleDurations ?? [30, 60, 120, 180];
  const idLabel = passProduct?.passIdentifierLabel || "Identifier";
  const baseMinor = passProduct?.tiers.find((t) => t.active)?.price ?? 10000; // per hour

  const [duration, setDuration] = useState(60);
  const [priceEdit, setPriceEdit] = useState<string | null>(null); // null = follow config
  const [identifier, setIdentifier] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  const price = priceEdit ?? String(Math.round((baseMinor * duration) / 60) / 100);

  const issue = async () => {
    setIssuing(true);
    const minor = Math.round((parseFloat(price) || 0) * 100);
    const res = await checkout({
      channel: "counter",
      locationId: passProduct?.locationIds[0] ?? "loc_fort",
      counterId: null,
      staffId: null,
      lines: [{ productId: passProduct?.id ?? "quick_pass", productName: `${passProduct?.name ?? "Pass"} · ${formatDuration(duration)}`, tierName: identifier || "Pass", admits: 1, quantity: 1, unitPrice: minor, taxRate: 0 }],
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
        <div className="w-full rounded-sm bg-inverse px-section py-major"><span className="font-mono text-2xl text-inverse-fg">{code}</span></div>
        <Button size="lg" fullWidth onClick={() => { setCode(null); setIdentifier(""); }}>Issue another</Button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-section px-section py-hero">
      <div>
        <p className="type-label text-[13px] text-ember">Gate</p>
        <h1 className="type-h1 mt-tight text-2xl">Quick pass</h1>
        <p className="type-body mt-tight text-muted">Issue a timed pass on the spot.</p>
      </div>

      <div className="flex flex-col gap-tight">
        <span className="type-label text-[12px] text-muted">Duration</span>
        <div className="flex gap-tight">
          {durations.map((d) => (
            <button key={d} type="button" onClick={() => { setDuration(d); setPriceEdit(null); }} className={`h-12 flex-1 rounded-sm border text-sm ${duration === d ? "border-inverse bg-inverse text-inverse-fg" : "border-line bg-card"}`}>{formatDuration(d)}</button>
          ))}
        </div>
      </div>

      <FormField label="Price (৳)" variant="number" value={price} onChange={(e) => setPriceEdit(e.target.value)} help={priceEdit == null ? "From the pass configuration — edit to override." : undefined} />
      <FormField label={idLabel} placeholder={idLabel} value={identifier} onChange={(e) => setIdentifier(e.target.value)} />

      <Button size="lg" fullWidth loading={issuing} onClick={issue}>Issue pass · {formatMoney(Math.round((parseFloat(price) || 0) * 100))}</Button>
    </main>
  );
}
