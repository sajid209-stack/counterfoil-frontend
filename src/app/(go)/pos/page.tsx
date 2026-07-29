"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getOperator, listProducts } from "@/lib/api";
import { formatMoney } from "@/lib/format";

interface CartLine {
  key: string;
  productName: string;
  tierName: string;
  unitPrice: number;
  qty: number;
}

export default function PosPage() {
  const router = useRouter();
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100, filters: { status: "active" } }), []);
  const opQ = useApiQuery(() => getOperator(), []);
  const [cart, setCart] = useState<CartLine[]>([]);

  const currency = opQ.data?.currency ?? "BDT";
  const taxPct = opQ.data?.taxRatePct ?? 0;

  const tiles = useMemo(
    () =>
      (productsQ.data?.data ?? []).flatMap((p) =>
        p.tiers.filter((t) => t.active).map((t) => ({ key: `${p.id}:${t.id}`, productName: p.name, tierName: t.name, unitPrice: t.price })),
      ),
    [productsQ.data],
  );

  const add = (tile: { key: string; productName: string; tierName: string; unitPrice: number }) =>
    setCart((c) => {
      const found = c.find((l) => l.key === tile.key);
      if (found) return c.map((l) => (l.key === tile.key ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { ...tile, qty: 1 }];
    });
  const bump = (key: string, delta: number) =>
    setCart((c) => c.flatMap((l) => (l.key === key ? (l.qty + delta <= 0 ? [] : [{ ...l, qty: l.qty + delta }]) : [l])));
  const removeLine = (key: string) => setCart((c) => c.filter((l) => l.key !== key));

  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const tax = Math.round((subtotal * taxPct) / 100);
  const total = subtotal + tax;
  const count = cart.reduce((s, l) => s + l.qty, 0);

  const charge = () => {
    sessionStorage.setItem("pos_sale", JSON.stringify({ total, count }));
    router.push("/pos/payment");
  };

  return (
    <div className="grid h-full grid-cols-1 gap-tight p-tight lg:grid-cols-[1fr_22rem]">
      {/* Product grid */}
      <div className="overflow-y-auto">
        {productsQ.loading ? (
          <p className="p-section text-[13px] text-neutral-400">Loading…</p>
        ) : (
          <div className="grid grid-cols-2 gap-tight sm:grid-cols-3">
            {tiles.map((tile) => (
              <button
                key={tile.key}
                type="button"
                onClick={() => add(tile)}
                className="flex min-h-[5rem] flex-col justify-between rounded-sm border border-neutral-200 bg-white p-comfortable text-left active:bg-neutral-200"
              >
                <span className="text-sm font-medium leading-tight">{tile.productName}</span>
                <span className="mt-tight flex items-center justify-between">
                  <span className="font-mono text-[11px] text-neutral-400">{tile.tierName}</span>
                  <span className="font-mono text-[13px]">{formatMoney(tile.unitPrice, currency)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cart */}
      <div className="flex flex-col rounded-sm border border-neutral-200 bg-white">
        <div className="flex-1 overflow-y-auto p-comfortable">
          {cart.length === 0 ? (
            <EmptyState title="Empty cart" message="Tap a product to add it." />
          ) : (
            <div className="flex flex-col gap-tight">
              {cart.map((l) => (
                <div key={l.key} className="flex items-center gap-tight border-b border-neutral-200 pb-tight last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{l.productName}</div>
                    <div className="font-mono text-[11px] text-neutral-400">{l.tierName} · {formatMoney(l.unitPrice, currency)}</div>
                  </div>
                  <button type="button" aria-label="Decrease" onClick={() => bump(l.key, -1)} className="flex h-9 w-9 items-center justify-center rounded-sm border border-neutral-200 active:bg-neutral-200"><Minus size={16} strokeWidth={1.5} /></button>
                  <span className="w-6 text-center font-mono text-sm">{l.qty}</span>
                  <button type="button" aria-label="Increase" onClick={() => bump(l.key, 1)} className="flex h-9 w-9 items-center justify-center rounded-sm border border-neutral-200 active:bg-neutral-200"><Plus size={16} strokeWidth={1.5} /></button>
                  <button type="button" aria-label="Remove" onClick={() => removeLine(l.key)} className="flex h-9 w-9 items-center justify-center rounded-sm border border-neutral-200 text-danger active:bg-neutral-200"><Trash2 size={16} strokeWidth={1.5} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-neutral-200 p-comfortable">
          <div className="flex justify-between text-[13px] text-neutral-600"><span>Subtotal</span><span className="font-mono">{formatMoney(subtotal, currency)}</span></div>
          <div className="flex justify-between text-[13px] text-neutral-600"><span>Tax ({taxPct}%)</span><span className="font-mono">{formatMoney(tax, currency)}</span></div>
          <div className="mt-tight flex justify-between text-lg font-medium"><span>Total</span><span className="font-mono">{formatMoney(total, currency)}</span></div>
          <Button size="lg" fullWidth className="mt-tight" disabled={count === 0} onClick={charge}>
            Charge {count > 0 ? formatMoney(total, currency) : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}
