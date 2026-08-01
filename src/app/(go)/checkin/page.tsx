"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search, UserPlus } from "lucide-react";
import { Button, EmptyState, FormField, Modal, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import {
  addOrderLines,
  addOrderPayment,
  checkInBooking,
  checkout,
  extendBooking,
  isResourceFreeFor,
  listBookings,
  listOrders,
  listProducts,
  markNoShow,
  type Booking,
  type Order,
  type PaymentMethod,
} from "@/lib/api";
import { toMinutes, toTime } from "@/lib/schedule";
import { formatMoney } from "@/lib/format";

const TODAY = "2026-07-29";
const TOMORROW = "2026-07-30";
const time = (iso: string) => iso.slice(11, 16);
const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" }, { value: "bkash", label: "bKash" }, { value: "bangla_qr", label: "QR" }, { value: "card_terminal", label: "Card" },
];

export default function CheckInPage() {
  const toast = useToast();
  const [date, setDate] = useState(TODAY);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const bookingsQ = useApiQuery(() => listBookings({ pageSize: 1000 }), []);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100 }), []);
  const ordersQ = useApiQuery(() => listOrders({ pageSize: 1000 }), []);
  const productName = (id: string) => productsQ.data?.data.find((p) => p.id === id)?.name ?? "—";
  const orderOf = (b: Booking): Order | undefined => ordersQ.data?.data.find((o) => o.id === b.orderId);
  const outstanding = (o?: Order) => (o ? Math.max(0, o.total - o.payments.reduce((s, p) => s + p.amount, 0)) : 0);

  // Counter workflows on an expanded booking.
  const [payFor, setPayFor] = useState<Booking | null>(null);
  const [extraFor, setExtraFor] = useState<Booking | null>(null);
  const [upgradeFor, setUpgradeFor] = useState<Booking | null>(null);
  const [noShowFor, setNoShowFor] = useState<Booking | null>(null);
  const [noShowReason, setNoShowReason] = useState("");
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkInProduct, setWalkInProduct] = useState("");
  const [walkInParty, setWalkInParty] = useState(2);
  const [walkInName, setWalkInName] = useState("");

  const reload = () => { bookingsQ.reload(); ordersQ.reload(); };

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const orders = ordersQ.data?.data ?? [];
    const day = (bookingsQ.data?.data ?? []).filter((b) => {
      if (b.status !== "confirmed" || b.slotStart.slice(0, 10) !== date) return false;
      if (!q) return true;
      const o = orders.find((x) => x.id === b.orderId);
      return (
        b.orderId.toLowerCase().includes(q) ||
        (o?.reference.toLowerCase().includes(q) ?? false) ||
        (o?.customerName?.toLowerCase().includes(q) ?? false)
      );
    });
    const map = new Map<string, Booking[]>();
    day.forEach((b) => {
      const key = `${b.productId}|${b.slotStart}`;
      map.set(key, [...(map.get(key) ?? []), b]);
    });
    return [...map.entries()].sort((a, b) => a[0].split("|")[1].localeCompare(b[0].split("|")[1]));
  }, [bookingsQ.data, ordersQ.data, date, search]);

  const checkIn = async (b: Booking, count: number) => {
    setPending(b.id);
    await checkInBooking(b.id, count);
    setPending(null);
    reload();
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
    if (res.ok) { toast.success(`Extended to ${newEnd.slice(11, 16)} — collect the difference at the counter.`); reload(); }
    else toast.error(res.error.message);
  };

  const takeBalance = async (method: PaymentMethod) => {
    if (!payFor) return;
    const o = orderOf(payFor);
    if (!o) return;
    const due = outstanding(o);
    const res = await addOrderPayment(o.id, method, due);
    if (res.ok) toast.success(`Balance of ${formatMoney(due)} taken — ${METHODS.find((m) => m.value === method)?.label}. Guest can check in.`);
    setPayFor(null);
    reload();
  };

  const addExtra = async (addOnId: string) => {
    if (!extraFor) return;
    const p = productsQ.data?.data.find((x) => x.id === extraFor.productId);
    const a = p?.addOns?.find((x) => x.id === addOnId);
    if (!p || !a) return;
    await addOrderLines(extraFor.orderId, [{ productId: `addon_${a.id}`, productName: a.name, tierName: a.perPerson ? "Per person" : "Each", admits: 0, quantity: 1, unitPrice: a.price }]);
    toast.success(`${a.name} added — take the balance before check-in.`);
    setExtraFor(null);
    reload();
  };

  const upgrade = async (tierId: string) => {
    if (!upgradeFor) return;
    const p = productsQ.data?.data.find((x) => x.id === upgradeFor.productId);
    const o = orderOf(upgradeFor);
    const target = p?.tiers.find((t) => t.id === tierId);
    if (!p || !o || !target) return;
    const currentLine = o.lines.filter((l) => l.productId === p.id && l.unitPrice > 0).sort((a, b) => a.unitPrice - b.unitPrice)[0];
    const diff = target.price - (currentLine?.unitPrice ?? 0);
    if (diff <= 0) { toast.error("That's not an upgrade — it costs the same or less."); return; }
    await addOrderLines(o.id, [{ productId: p.id, productName: p.name, tierId: target.id, tierName: `Upgrade → ${target.name}`, admits: 0, quantity: 1, unitPrice: diff }]);
    toast.success(`Upgraded to ${target.name} — difference ${formatMoney(diff)} added to the order.`);
    setUpgradeFor(null);
    reload();
  };

  const recordNoShow = async () => {
    if (!noShowFor) return;
    await markNoShow(noShowFor.id, noShowReason.trim() || undefined);
    toast.success("No-show recorded.");
    setNoShowFor(null); setNoShowReason("");
    reload();
  };

  const addWalkIn = async () => {
    const p = productsQ.data?.data.find((x) => x.id === walkInProduct);
    const tier = p?.tiers.find((t) => t.active);
    if (!p || !tier) return;
    const res = await checkout({
      channel: "counter", locationId: p.locationIds[0] ?? "loc_fort", counterId: null, staffId: null,
      customerName: walkInName.trim() || "Walk-in",
      lines: [{ productId: p.id, productName: p.name, tierId: tier.id, tierName: tier.name, admits: tier.admits ?? 1, quantity: walkInParty, unitPrice: tier.price }],
      bookings: [{ productId: p.id, slotStart: `${date}T12:00:00+06:00`, partySize: walkInParty }],
      taxPct: 0, method: "cash", amountTendered: tier.price * walkInParty,
    });
    if (res.ok) { toast.success(`Walk-in sold — ticket ${res.data.firstTicketCode}.`); setWalkInOpen(false); setWalkInName(""); setWalkInParty(2); reload(); }
    else toast.error(res.error.message);
  };

  const dateBtn = (v: string, label: string) => (
    <button key={v} type="button" onClick={() => setDate(v)} className={`h-10 rounded-sm border px-comfortable text-sm ${date === v ? "border-inverse bg-inverse text-inverse-fg" : "border-line bg-card"}`}>{label}</button>
  );

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-section px-section py-section">
      <div className="flex items-end justify-between gap-tight">
        <div>
          <p className="type-label text-[13px] text-ember">Gate</p>
          <h1 className="type-h1 mt-tight text-2xl">Check-in</h1>
        </div>
        <Button variant="secondary" icon={<UserPlus size={16} strokeWidth={1.5} />} onClick={() => { setWalkInProduct(productsQ.data?.data.find((p) => p.bookingType === "BT-01" && p.status === "active")?.id ?? ""); setWalkInOpen(true); }}>
          Add a walk-in
        </Button>
      </div>
      <div className="flex flex-wrap gap-tight">
        {dateBtn(TODAY, "Today")}{dateBtn(TOMORROW, "Tomorrow")}
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 rounded-sm border border-line bg-card px-comfortable text-sm" />
        <div className="flex h-10 min-w-40 flex-1 items-center gap-tight rounded-sm border border-line bg-card px-comfortable focus-within:border-inverse">
          <Search size={15} strokeWidth={1.5} className="shrink-0 text-faint" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or reference…" className="h-full w-full bg-transparent text-sm outline-none" />
        </div>
      </div>

      {bookingsQ.loading ? (
        <div aria-busy="true" className="flex animate-pulse flex-col gap-tight"><div className="h-4 w-1/3 rounded-xs bg-line" /><div className="h-4 w-2/3 rounded-xs bg-line" /><div className="h-4 w-1/2 rounded-xs bg-line" /></div>
      ) : groups.length === 0 ? (
        <EmptyState title="No bookings" message={search ? "Nothing matches that search." : "No sessions booked for this day."} />
      ) : (
        <div className="flex flex-col gap-tight">
          {groups.map(([key, items]) => {
            const expected = items.reduce((s, b) => s + b.partySize, 0);
            const inCount = items.reduce((s, b) => s + (b.checkedIn ?? 0), 0);
            const [pid, iso] = key.split("|");
            const isOpen = open[key];
            return (
              <div key={key} className="rounded-md border border-line bg-card">
                <button type="button" onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))} className="flex w-full items-center gap-section p-comfortable text-left">
                  {isOpen ? <ChevronDown size={16} strokeWidth={1.5} /> : <ChevronRight size={16} strokeWidth={1.5} />}
                  <span className="w-14 font-mono text-sm">{time(iso)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{productName(pid)}</span>
                  <span className={`font-mono text-[13px] ${inCount >= expected ? "text-success" : "text-muted"}`}>{inCount}/{expected}</span>
                </button>
                {isOpen && (
                  <div className="flex flex-col gap-tight border-t border-line p-comfortable">
                    {items.map((b) => {
                      const o = orderOf(b);
                      const due = outstanding(o);
                      const done = (b.checkedIn ?? 0) >= b.partySize;
                      const p = productsQ.data?.data.find((x) => x.id === b.productId);
                      return (
                        <div key={b.id} className="rounded-sm border border-line p-tight">
                          <div className="flex items-center gap-tight text-sm">
                            <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-muted">{o?.reference ?? b.orderId}{o?.customerName ? ` · ${o.customerName}` : ""} · party {b.partySize}</span>
                            {b.noShow ? (
                              <span className="shrink-0 rounded-xs bg-danger/10 px-tight py-inline font-mono text-[10px] text-danger">NO-SHOW{b.noShowReason ? ` · ${b.noShowReason}` : ""}</span>
                            ) : (
                              <span className="shrink-0 font-mono text-[12px]">{b.checkedIn ?? 0}/{b.partySize} in</span>
                            )}
                          </div>
                          {/* Paid vs outstanding — the gate opens only on a settled order. */}
                          {o && (
                            <div className="mt-inline flex flex-wrap items-center gap-tight font-mono text-[11px] tabular-nums">
                              <span className="text-muted">Paid {formatMoney(o.payments.reduce((s, x) => s + x.amount, 0))} of {formatMoney(o.total)}</span>
                              {due > 0 ? <span className="rounded-xs bg-ember px-tight text-ink">Owes {formatMoney(due)}</span> : <span className="text-success">Settled</span>}
                              <span className="min-w-0 truncate text-faint">· {o.payments.map((x) => `${x.method} ${formatMoney(x.amount)}`).join(" + ")}</span>
                            </div>
                          )}
                          <div className="mt-tight flex flex-wrap gap-tight">
                            {due > 0 && !b.noShow && <Button size="sm" onClick={() => setPayFor(b)}>Take balance</Button>}
                            {!b.noShow && (p?.addOns?.length ?? 0) > 0 && <Button size="sm" variant="secondary" onClick={() => setExtraFor(b)}>Add extra</Button>}
                            {!b.noShow && (p?.tiers.filter((t) => t.active).length ?? 0) > 1 && <Button size="sm" variant="secondary" onClick={() => setUpgradeFor(b)}>Upgrade</Button>}
                            {extendOf(b) && !b.noShow && (
                              <Button size="sm" variant="secondary" loading={pending === b.id} onClick={() => extend(b)}>Extend +{extendOf(b)!.cfg.incrementMinutes}m</Button>
                            )}
                            {!done && !b.noShow && (
                              <>
                                {b.partySize > 1 && (b.checkedIn ?? 0) < b.partySize - 1 && (
                                  <Button size="sm" variant="secondary" disabled={due > 0} loading={pending === b.id} onClick={() => checkIn(b, (b.checkedIn ?? 0) + 1)}>+1</Button>
                                )}
                                <Button size="sm" disabled={due > 0} loading={pending === b.id} onClick={() => checkIn(b, b.partySize)}>{due > 0 ? "Settle first" : "Check in all"}</Button>
                                {(b.checkedIn ?? 0) === 0 && <Button size="sm" variant="secondary" onClick={() => { setNoShowFor(b); setNoShowReason(""); }}>No-show</Button>}
                              </>
                            )}
                          </div>
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

      {/* Take the outstanding balance — any configured method works. */}
      <Modal open={!!payFor} onClose={() => setPayFor(null)} title={payFor ? `Take ${formatMoney(outstanding(orderOf(payFor)))}` : "Take balance"}>
        <p className="mb-section text-[13px] text-muted">The receipt will list every payment on the order.</p>
        <div className="grid grid-cols-2 gap-tight">
          {METHODS.map((m) => <Button key={m.value} variant="secondary" className="h-12" onClick={() => takeBalance(m.value)}>{m.label}</Button>)}
        </div>
      </Modal>

      <Modal open={!!extraFor} onClose={() => setExtraFor(null)} title="Add an extra">
        <div className="flex flex-col gap-tight">
          {(productsQ.data?.data.find((x) => x.id === extraFor?.productId)?.addOns ?? []).map((a) => (
            <Button key={a.id} variant="secondary" className="justify-between" onClick={() => addExtra(a.id)}>
              <span>{a.name}</span><span className="font-mono tabular-nums">{formatMoney(a.price)}{a.perPerson ? "/head" : ""}</span>
            </Button>
          ))}
        </div>
      </Modal>

      <Modal open={!!upgradeFor} onClose={() => setUpgradeFor(null)} title="Upgrade tier">
        <p className="mb-section text-[13px] text-muted">Only the price difference is added to the order.</p>
        <div className="flex flex-col gap-tight">
          {(productsQ.data?.data.find((x) => x.id === upgradeFor?.productId)?.tiers.filter((t) => t.active) ?? []).map((t) => (
            <Button key={t.id} variant="secondary" className="justify-between" onClick={() => upgrade(t.id)}>
              <span>{t.name}</span><span className="font-mono tabular-nums">{formatMoney(t.price)}</span>
            </Button>
          ))}
        </div>
      </Modal>

      <Modal open={!!noShowFor} onClose={() => setNoShowFor(null)} title="Record a no-show" footer={<><Button variant="secondary" onClick={() => setNoShowFor(null)}>Cancel</Button><Button onClick={recordNoShow}>Record no-show</Button></>}>
        <FormField label="Reason (optional)" placeholder="Called to cancel / never arrived" value={noShowReason} onChange={(e) => setNoShowReason(e.target.value)} />
      </Modal>

      <Modal open={walkInOpen} onClose={() => setWalkInOpen(false)} title="Add a walk-in" footer={<><Button variant="secondary" onClick={() => setWalkInOpen(false)}>Cancel</Button><Button disabled={!walkInProduct} onClick={addWalkIn}>Sell &amp; add</Button></>}>
        <div className="flex flex-col gap-section">
          <FormField label="Product" variant="select" value={walkInProduct} onChange={(e) => setWalkInProduct(e.target.value)} options={(productsQ.data?.data ?? []).filter((p) => p.status === "active" && (p.bookingType === "BT-01" || p.bookingType === "BT-06")).map((p) => ({ value: p.id, label: p.name }))} />
          <FormField label="Name (optional)" placeholder="Walk-in" value={walkInName} onChange={(e) => setWalkInName(e.target.value)} />
          <div className="flex items-center justify-between rounded-sm border border-line bg-card p-comfortable">
            <span className="text-sm">Party size</span>
            <div className="flex items-center gap-tight">
              <button type="button" aria-label="Fewer" onClick={() => setWalkInParty((g) => Math.max(1, g - 1))} className="h-11 w-11 rounded-sm border border-line text-lg">−</button>
              <span className="w-8 text-center font-mono tabular-nums">{walkInParty}</span>
              <button type="button" aria-label="More" onClick={() => setWalkInParty((g) => g + 1)} className="h-11 w-11 rounded-sm border border-line text-lg">+</button>
            </div>
          </div>
          <p className="text-[12px] text-faint">Sold cash at the first active tier&apos;s price; the group lands on this day&apos;s list.</p>
        </div>
      </Modal>
    </main>
  );
}
