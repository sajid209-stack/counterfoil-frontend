"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button, EmptyState, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { checkInBooking, extendBooking, isResourceFreeFor, listBookings, listProducts, type Booking } from "@/lib/api";
import { toMinutes, toTime } from "@/lib/schedule";

const TODAY = "2026-07-29";
const TOMORROW = "2026-07-30";
const time = (iso: string) => iso.slice(11, 16);

export default function CheckInPage() {
  const [date, setDate] = useState(TODAY);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<string | null>(null);
  const bookingsQ = useApiQuery(() => listBookings({ pageSize: 1000 }), []);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100 }), []);
  const productName = (id: string) => productsQ.data?.data.find((p) => p.id === id)?.name ?? "—";

  const groups = useMemo(() => {
    const day = (bookingsQ.data?.data ?? []).filter((b) => b.status === "confirmed" && b.slotStart.slice(0, 10) === date);
    const map = new Map<string, Booking[]>();
    day.forEach((b) => {
      const key = `${b.productId}|${b.slotStart}`;
      map.set(key, [...(map.get(key) ?? []), b]);
    });
    return [...map.entries()].sort((a, b) => a[0].split("|")[1].localeCompare(b[0].split("|")[1]));
  }, [bookingsQ.data, date]);

  const toast = useToast();
  const checkIn = async (b: Booking, count: number) => {
    setPending(b.id);
    await checkInBooking(b.id, count);
    setPending(null);
    bookingsQ.reload();
  };

  // Post-sale extend: one increment, only when the lane is free right behind.
  const extendOf = (b: Booking) => {
    if (!b.resourceId || !b.slotEnd) return null;
    const p = productsQ.data?.data.find((x) => x.id === b.productId);
    const cfg = p?.durationConfig;
    if (!p || !cfg) return null;
    const endTime = b.slotEnd.slice(11, 16);
    const current = toMinutes(endTime) - toMinutes(b.slotStart.slice(11, 16));
    if (current + cfg.incrementMinutes > cfg.maxMinutes) return null;
    return { p, cfg, endTime };
  };

  const extend = async (b: Booking) => {
    const x = extendOf(b);
    if (!x) return;
    if (!isResourceFreeFor(b.resourceId!, b.slotStart.slice(0, 10), x.endTime, x.cfg.incrementMinutes, x.p.bufferMinutes ?? 0)) {
      toast.error("Booked right after — can't extend.");
      return;
    }
    setPending(b.id);
    const newEnd = `${b.slotStart.slice(0, 10)}T${toTime(toMinutes(x.endTime) + x.cfg.incrementMinutes)}:00+06:00`;
    const res = await extendBooking(b.id, newEnd);
    setPending(null);
    if (res.ok) { toast.success(`Extended to ${newEnd.slice(11, 16)} — collect the difference at the counter.`); bookingsQ.reload(); }
    else toast.error(res.error.message);
  };

  const dateBtn = (v: string, label: string) => (
    <button key={v} type="button" onClick={() => setDate(v)} className={`h-10 rounded-sm border px-comfortable text-sm ${date === v ? "border-ink bg-ink text-paper" : "border-neutral-200 bg-white"}`}>{label}</button>
  );

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-section px-section py-section">
      <div>
        <p className="type-label text-[13px] text-ember">Gate</p>
        <h1 className="type-h1 mt-tight text-2xl">Check-in</h1>
      </div>
      <div className="flex gap-tight">{dateBtn(TODAY, "Today")}{dateBtn(TOMORROW, "Tomorrow")}<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 rounded-sm border border-neutral-200 bg-white px-comfortable text-sm" /></div>

      {bookingsQ.loading ? (
        <p className="text-[13px] text-neutral-400">Loading…</p>
      ) : groups.length === 0 ? (
        <EmptyState title="No bookings" message="No sessions booked for this day." />
      ) : (
        <div className="flex flex-col gap-tight">
          {groups.map(([key, items]) => {
            const expected = items.reduce((s, b) => s + b.partySize, 0);
            const inCount = items.reduce((s, b) => s + (b.checkedIn ?? 0), 0);
            const [pid, iso] = key.split("|");
            const isOpen = open[key];
            return (
              <div key={key} className="rounded-md border border-neutral-200 bg-white">
                <button type="button" onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))} className="flex w-full items-center gap-section p-comfortable text-left">
                  {isOpen ? <ChevronDown size={16} strokeWidth={1.5} /> : <ChevronRight size={16} strokeWidth={1.5} />}
                  <span className="w-14 font-mono text-sm">{time(iso)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{productName(pid)}</span>
                  <span className={`font-mono text-[13px] ${inCount >= expected ? "text-success" : "text-neutral-600"}`}>{inCount}/{expected}</span>
                </button>
                {isOpen && (
                  <div className="flex flex-col gap-tight border-t border-neutral-200 p-comfortable">
                    {items.map((b) => {
                      const done = (b.checkedIn ?? 0) >= b.partySize;
                      return (
                        <div key={b.id} className="flex items-center gap-tight text-sm">
                          <span className="flex-1 font-mono text-[12px] text-neutral-600">{b.orderId} · party {b.partySize}</span>
                          <span className="font-mono text-[12px]">{b.checkedIn ?? 0}/{b.partySize} in</span>
                          {extendOf(b) && (
                            <Button size="sm" variant="secondary" loading={pending === b.id} onClick={() => extend(b)}>
                              Extend +{extendOf(b)!.cfg.incrementMinutes}m
                            </Button>
                          )}
                          {!done && (
                            <>
                              {b.partySize > 1 && (b.checkedIn ?? 0) < b.partySize - 1 && (
                                <Button size="sm" variant="secondary" loading={pending === b.id} onClick={() => checkIn(b, (b.checkedIn ?? 0) + 1)}>+1</Button>
                              )}
                              <Button size="sm" loading={pending === b.id} onClick={() => checkIn(b, b.partySize)}>Check in all</Button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
