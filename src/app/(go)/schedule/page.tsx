"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { Button, EmptyState, FormField, Modal, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getResourceMatrix, getSlots, listProducts, listResources, updateResource, type Product, type Resource } from "@/lib/api";
import { isResourceType, isSlotBased } from "@/lib/schedule";
import { resolveProductPrice } from "@/lib/pricing";
import { formatMoney } from "@/lib/format";

const TODAY = "2026-07-29";
const TOMORROW = "2026-07-30";

interface Row {
  time: string;
  label: string;
  state: string; // "OPEN" | "BOOKED" | "FULL" | "12/40"
  full: boolean;
  product: Product;
  resourceId?: string;
}

export default function SchedulePage() {
  const router = useRouter();
  const toast = useToast();
  const [date, setDate] = useState(TODAY);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100, filters: { status: "active" } }), []);
  const resourcesQ = useApiQuery(() => listResources({ pageSize: 100 }), []);
  const [oos, setOos] = useState<Resource | null>(null); // out-of-service dialog
  const [oosReason, setOosReason] = useState("");
  const [oosSaving, setOosSaving] = useState(false);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const p of productsQ.data?.data ?? []) {
      if (isResourceType(p.bookingType) && !p.flexibleDurations) {
        for (const r of getResourceMatrix(p, date)) {
          for (const s of r.slots) {
            out.push({ time: s.time, label: `${p.name} — ${r.resource.name}`, state: r.resource.outOfService ? "OUT" : s.available ? formatMoney(resolveProductPrice(p, date, s.time, p.tiers[0]?.price ?? 0)) : "BOOKED", full: !s.available, product: p, resourceId: r.resource.id });
          }
        }
      } else if (isSlotBased(p.bookingType)) {
        for (const s of getSlots(p, date)) {
          out.push({ time: s.time, label: p.name, state: s.remaining <= 0 ? "FULL" : `${s.sold}/${s.capacity}`, full: s.remaining <= 0, product: p });
        }
      }
    }
    return out.sort((a, b) => a.time.localeCompare(b.time));
  }, [productsQ.data, date]);

  const sell = (p: Product) => {
    sessionStorage.setItem("pos_open_product", p.id);
    router.push("/pos");
  };

  const openOos = (resourceId: string) => {
    const r = resourcesQ.data?.data.find((x) => x.id === resourceId);
    if (!r) return;
    setOos(r);
    setOosReason(r.outOfServiceReason ?? "");
  };

  const saveOos = async (outOfService: boolean) => {
    if (!oos) return;
    setOosSaving(true);
    const res = await updateResource(oos.id, { outOfService, outOfServiceReason: outOfService ? oosReason || null : null });
    setOosSaving(false);
    if (res.ok) {
      toast.success(outOfService ? `${oos.name} marked out of service.` : `${oos.name} back in service.`);
      setOos(null);
      productsQ.reload();
      resourcesQ.reload();
    } else toast.error(res.error.message);
  };

  const dateBtn = (v: string, label: string) => (
    <button key={v} type="button" onClick={() => setDate(v)} className={`h-10 rounded-sm border px-comfortable text-sm ${date === v ? "border-ink bg-ink text-paper" : "border-neutral-200 bg-white"}`}>{label}</button>
  );

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-section px-section py-section">
      <div>
        <p className="type-label text-[13px] text-ember">Front of house</p>
        <h1 className="type-h1 mt-tight text-2xl">Schedule</h1>
      </div>
      <div className="flex gap-tight">
        {dateBtn(TODAY, "Today")}
        {dateBtn(TOMORROW, "Tomorrow")}
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 rounded-sm border border-neutral-200 bg-white px-comfortable text-sm" />
      </div>

      {productsQ.loading ? (
        <p className="text-[13px] text-neutral-400">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState title="No sessions" message="This day has no timed or resourced sessions." />
      ) : (
        <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-section border-b border-neutral-200 px-section py-tight last:border-0">
              <span className="w-14 font-mono text-sm">{r.time}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{r.label}</span>
              <span className={`font-mono text-[12px] ${r.full ? "text-neutral-400" : "text-neutral-600"}`}>{r.state}</span>
              {r.full ? (
                r.product.waitlistEnabled ? <Button size="sm" variant="secondary" onClick={() => sell(r.product)}>Waitlist</Button> : <span className="w-16 text-right font-mono text-[11px] text-neutral-400">—</span>
              ) : (
                <Button size="sm" onClick={() => sell(r.product)}>Sell</Button>
              )}
              {r.resourceId && (
                <button type="button" aria-label="Row actions" onClick={() => openOos(r.resourceId!)} className="flex h-9 w-9 items-center justify-center rounded-sm border border-neutral-200 text-neutral-400 active:bg-neutral-200">
                  <MoreHorizontal size={15} strokeWidth={1.5} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!oos}
        onClose={() => setOos(null)}
        title={oos ? `${oos.name} — ${oos.outOfService ? "out of service" : "in service"}` : ""}
        footer={
          oos?.outOfService ? (
            <><Button variant="secondary" onClick={() => setOos(null)}>Cancel</Button><Button loading={oosSaving} onClick={() => saveOos(false)}>Return to service</Button></>
          ) : (
            <><Button variant="secondary" onClick={() => setOos(null)}>Cancel</Button><Button loading={oosSaving} onClick={() => saveOos(true)}>Mark out of service</Button></>
          )
        }
      >
        {oos?.outOfService ? (
          <p className="text-sm text-neutral-600">Currently out of service{oos.outOfServiceReason ? `: ${oos.outOfServiceReason}` : ""}. Returning it makes it bookable again.</p>
        ) : (
          <FormField label="Reason" placeholder="Resurfacing until Friday" value={oosReason} onChange={(e) => setOosReason(e.target.value)} help="Bookings stop while it's out of service." />
        )}
      </Modal>
    </main>
  );
}
