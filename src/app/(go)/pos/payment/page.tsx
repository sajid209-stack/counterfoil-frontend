"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@/components/ui";
import { checkout, type CheckoutBooking, type CheckoutLine } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { Keypad } from "../../_components/Keypad";

interface Cart {
  total: number;
  taxPct: number;
  locationId: string;
  lines: CheckoutLine[];
  bookings?: CheckoutBooking[];
}

export default function PaymentPage() {
  const router = useRouter();
  const toast = useToast();
  const [cart, setCart] = useState<Cart | null>(null);
  const [tenderTaka, setTenderTaka] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("pos_cart");
    if (raw) setCart(JSON.parse(raw));
    else router.replace("/pos");
  }, [router]);

  const total = cart?.total ?? 0;
  const tenderedMinor = (parseInt(tenderTaka || "0", 10) || 0) * 100;
  const change = tenderedMinor - total;
  const enough = tenderedMinor >= total;

  const complete = async () => {
    if (!cart) return;
    setSaving(true);
    const res = await checkout({
      channel: "counter",
      locationId: cart.locationId,
      counterId: null,
      staffId: null,
      lines: cart.lines,
      bookings: cart.bookings,
      taxPct: cart.taxPct,
      method: "cash",
      amountTendered: tenderedMinor,
    });
    setSaving(false);
    if (res.ok) {
      sessionStorage.setItem("pos_complete", JSON.stringify({ code: res.data.firstTicketCode, change }));
      sessionStorage.removeItem("pos_cart");
      router.push("/pos/complete");
    } else {
      toast.error(res.error.message);
    }
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
        <Button size="lg" fullWidth disabled={!enough} loading={saving} onClick={complete}>Complete sale</Button>
      </div>

      <div>
        <Keypad onKey={(d) => setTenderTaka((t) => (t + d).slice(0, 7))} onBackspace={() => setTenderTaka((t) => t.slice(0, -1))} />
      </div>
    </main>
  );
}
