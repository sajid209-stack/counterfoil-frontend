"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { Button, PageShell } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import {
  getOperator,
  getResourceMatrix,
  getSlots,
  listBookings,
  listCounters,
  listDevices,
  listLocations,
  listOrders,
  listProducts,
  listResources,
  listStaff,
  peekWaitlist,
  type Order,
  type Product,
} from "@/lib/api";
import { isResourceType, isSlotBased, toMinutes } from "@/lib/schedule";
import { formatMoney } from "@/lib/format";

const TODAY = "2026-07-29";
const NOW_MIN = 12 * 60; // mock clock: noon
const LAST_WEEK = "2026-07-22";

/** Count-up over 320ms for the hero revenue figure. */
function useCountUp(target: number, ms = 320) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

const paidish = (o: Order) => o.status === "paid" || o.status === "partial";
const dayRevenue = (orders: Order[], day: string) =>
  orders.filter((o) => paidish(o) && o.createdAt.slice(0, 10) === day).reduce((s, o) => s + o.total, 0);

function DeltaPill({ now, then }: { now: number; then: number }) {
  if (then <= 0) return null;
  const pct = Math.round(((now - then) / then) * 100);
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-inline rounded-lg px-tight py-0.5 font-mono text-[11px] ${up ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
      {up ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

function Sparkline({ points }: { points: number[] }) {
  const max = Math.max(...points, 1);
  const w = 140, h = 28;
  const path = points.map((v, i) => `${(i / (points.length - 1)) * w},${h - (v / max) * (h - 4) - 2}`).join(" ");
  return (
    <svg width={w} height={h} className="mt-tight text-ember" aria-hidden>
      <polyline points={path} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const op = useApiQuery(() => getOperator(), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100, filters: { status: "active" } }), []);
  const counters = useApiQuery(() => listCounters({ pageSize: 1 }), []);
  const staffQ = useApiQuery(() => listStaff({ pageSize: 1 }), []);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100, filters: { status: "active" } }), []);
  const devices = useApiQuery(() => listDevices({ pageSize: 1 }), []);
  const ordersQ = useApiQuery(() => listOrders({ pageSize: 1000 }), []);
  const bookingsQ = useApiQuery(() => listBookings({ pageSize: 1000 }), []);
  const resourcesQ = useApiQuery(() => listResources({ pageSize: 100 }), []);

  const [locationId, setLocationId] = useState<string>("all");
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});
  const skip = (key: string) => setSkipped((s) => ({ ...s, [key]: true }));
  const has = (q: { data?: { page: { total: number } } }) => (q.data?.page.total ?? 0) > 0;

  const loading = ordersQ.loading || bookingsQ.loading || productsQ.loading;
  const locations = locationsQ.data?.data ?? [];
  const allOrders = ordersQ.data?.data ?? [];
  const orders = locationId === "all" ? allOrders : allOrders.filter((o) => o.locationId === locationId);
  const bookings = bookingsQ.data?.data ?? [];
  const products = productsQ.data?.data ?? [];
  const resources = resourcesQ.data?.data ?? [];

  // ── Hero numbers ─────────────────────────────────────────────────────────
  const revenueToday = dayRevenue(orders, TODAY);
  const revenueLastWeek = dayRevenue(orders, LAST_WEEK);
  const revenueAnimated = useCountUp(revenueToday);
  const week = useMemo(() => {
    const days: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.parse(`${TODAY}T12:00:00Z`) - i * 86400000).toISOString().slice(0, 10);
      days.push(dayRevenue(orders, d));
    }
    return days;
  }, [orders]);

  const todaysOrders = orders.filter((o) => paidish(o) && o.createdAt.slice(0, 10) === TODAY);
  const lastWeekOrders = orders.filter((o) => paidish(o) && o.createdAt.slice(0, 10) === LAST_WEEK);
  const ticketsToday = todaysOrders.reduce((s, o) => s + o.lines.reduce((x, l) => x + Math.max(0, l.quantity), 0), 0);
  const ticketsLastWeek = lastWeekOrders.reduce((s, o) => s + o.lines.reduce((x, l) => x + Math.max(0, l.quantity), 0), 0);

  const todaysBookings = bookings.filter((b) => b.status === "confirmed" && b.slotStart.slice(0, 10) === TODAY);
  const expected = todaysBookings.reduce((s, b) => s + b.partySize, 0);
  const checkedIn = todaysBookings.reduce((s, b) => s + (b.checkedIn ?? 0), 0);
  const arriving2h = todaysBookings
    .filter((b) => { const m = toMinutes(b.slotStart.slice(11, 16)); return m >= NOW_MIN && m < NOW_MIN + 120; })
    .reduce((s, b) => s + b.partySize, 0);

  // ── Up next — sessions from now across every product ─────────────────────
  interface UpNext { time: string; label: string; who?: string; sold: number; cap: number; state: "OPEN" | "FULL" | "BOOKED" | "SOLD"; product: Product }
  const upNext = useMemo<UpNext[]>(() => {
    const out: UpNext[] = [];
    for (const p of products) {
      if (isResourceType(p.bookingType) && !p.flexibleDurations) {
        for (const r of getResourceMatrix(p, TODAY)) {
          for (const s of r.slots) {
            if (toMinutes(s.time) < NOW_MIN) continue;
            out.push({ time: s.time, label: p.name, who: r.resource.name, sold: s.available ? 0 : 1, cap: 1, state: s.available ? "OPEN" : "BOOKED", product: p });
          }
        }
      } else if (isSlotBased(p.bookingType)) {
        for (const s of getSlots(p, TODAY)) {
          if (toMinutes(s.time) < NOW_MIN) continue;
          out.push({ time: s.time, label: p.name, who: p.schedule?.guideIds.length ? "Guided" : undefined, sold: s.sold, cap: s.capacity, state: s.remaining <= 0 ? "FULL" : "SOLD", product: p });
        }
      }
    }
    return out.sort((a, b) => a.time.localeCompare(b.time)).slice(0, 9);
  }, [products]);

  const sell = (p: Product) => { sessionStorage.setItem("pos_open_product", p.id); router.push("/pos"); };

  // ── Live activity — most recent orders ───────────────────────────────────
  const activity = useMemo(() =>
    [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6).map((o) => {
      const mins = Math.max(0, Math.round((Date.parse(`${TODAY}T12:00:00+06:00`) - Date.parse(o.createdAt)) / 60000));
      const rel = mins < 60 ? `${mins} min ago` : mins < 1440 ? `${Math.round(mins / 60)} hr ago` : `${Math.round(mins / 1440)} d ago`;
      return { id: o.id, ref: o.reference, what: o.status === "refunded" ? "Refund" : "Sale", product: o.lines[0]?.productName ?? "—", amount: o.total, rel };
    }), [orders]);

  // ── Right rail ───────────────────────────────────────────────────────────
  const mix = useMemo(() => {
    const m = new Map<string, number>();
    todaysOrders.forEach((o) => o.payments.forEach((p) => m.set(p.method, (m.get(p.method) ?? 0) + p.amount)));
    const label: Record<string, string> = { cash: "Cash", bkash: "bKash", bangla_qr: "QR", card_terminal: "Card", voucher: "Voucher", credit: "Credit" };
    return [...m.entries()].map(([k, v]) => ({ label: label[k] ?? k, amount: v })).sort((a, b) => b.amount - a.amount);
  }, [todaysOrders]);
  const mixMax = Math.max(...mix.map((m) => m.amount), 1);

  const top = useMemo(() => {
    const m = new Map<string, { qty: number; rev: number }>();
    todaysOrders.forEach((o) => o.lines.forEach((l) => {
      if (l.unitPrice <= 0) return;
      const cur = m.get(l.productName) ?? { qty: 0, rev: 0 };
      m.set(l.productName, { qty: cur.qty + l.quantity, rev: cur.rev + l.unitPrice * l.quantity });
    }));
    return [...m.entries()].sort((a, b) => b[1].rev - a[1].rev).slice(0, 5);
  }, [todaysOrders]);

  const attention = useMemo(() => {
    const items: { text: string; href: string }[] = [];
    resources.filter((r) => r.outOfService).forEach((r) => items.push({ text: `${r.name} is out of service${r.outOfServiceReason ? ` — ${r.outOfServiceReason}` : ""}`, href: "/settings/resources" }));
    upNext
      .filter((u) => u.cap > 1 && toMinutes(u.time) < NOW_MIN + 180 && u.sold / u.cap < 0.3)
      .slice(0, 3)
      .forEach((u) => items.push({ text: `${u.label} ${u.time} is ${Math.round((u.sold / u.cap) * 100)}% full`, href: "/schedule" }));
    const wl = peekWaitlist().length;
    if (wl > 0) items.push({ text: `${wl} waitlist request${wl === 1 ? "" : "s"} waiting for an offer`, href: "/schedule" });
    return items;
  }, [resources, upNext]);

  // ── Setup checklist (replaces the hero band until finished) ──────────────
  const steps = [
    { key: "business", label: "Name your business", done: !!op.data?.name, href: "/settings/business" },
    { key: "location", label: "Add a location", done: locations.length > 0, href: "/settings/locations/new" },
    { key: "counter", label: "Add a counter", done: has(counters), href: "/settings/counters/new" },
    { key: "team", label: "Invite a team member", done: has(staffQ), href: "/settings/team/new" },
    { key: "product", label: "Create a product", done: products.length > 0, href: "/products/new" },
    { key: "device", label: "Register a device", done: has(devices), href: "/settings/devices/new" },
  ];
  const complete = steps.filter((s) => s.done || skipped[s.key]).length;
  const allDone = complete === steps.length;

  const dateLabel = new Date(`${TODAY}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  const card = "rounded-md border border-neutral-200 bg-white shadow-sm";

  return (
    <PageShell
      title={op.data?.name || "Dashboard"}
      description={dateLabel}
      actions={
        <div className="flex items-center gap-tight">
          {locations.length > 1 && (
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="h-11 rounded-sm border border-neutral-200 bg-white px-comfortable text-sm outline-none focus:border-ink">
              <option value="all">All locations</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
          <Button onClick={() => router.push("/pos")}>Open POS</Button>
        </div>
      }
    >
      {loading ? (
        <div className="grid grid-cols-2 gap-tight lg:grid-cols-4" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`${card} animate-pulse p-section`}><div className="h-3 w-1/2 rounded-xs bg-neutral-200" /><div className="mt-tight h-8 w-2/3 rounded-xs bg-neutral-200" /></div>
          ))}
        </div>
      ) : !allDone ? (
        <div className={`${card} mb-major p-major`}>
          <div className="mb-section flex items-center justify-between">
            <h2 className="type-h2 text-base">Finish setting up</h2>
            <span className="font-mono text-[12px] text-neutral-400">{complete} of {steps.length}</span>
          </div>
          <div className="mb-major h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
            <div className="h-full bg-ember transition-all" style={{ width: `${(complete / steps.length) * 100}%` }} />
          </div>
          <div className="flex flex-col gap-tight">
            {steps.map((s, i) => {
              const done = s.done || skipped[s.key];
              return (
                <div key={s.key} className="flex items-center gap-section rounded-sm border border-neutral-200 p-comfortable">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-[13px] ${done ? "bg-success text-white" : "bg-neutral-200 text-neutral-600"}`}>
                    {done ? <Check size={16} strokeWidth={2} /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium">{s.label}</span>
                  {done ? (
                    <span className="font-mono text-[11px] text-neutral-400">{s.done ? "Done" : "Skipped"}</span>
                  ) : (
                    <div className="flex items-center gap-tight">
                      <button type="button" onClick={() => skip(s.key)} className="text-[12px] text-neutral-400 hover:text-ink">Skip</button>
                      <Button size="sm" icon={<ArrowRight size={14} strokeWidth={1.5} />} onClick={() => router.push(s.href)}>Start</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-tight lg:grid-cols-4">
          <div className={`${card} p-section`}>
            <p className="type-label text-[12px] text-neutral-400">Today&apos;s revenue</p>
            <p className="mt-tight font-mono text-3xl tabular-nums">{formatMoney(revenueAnimated)}</p>
            <div className="mt-inline"><DeltaPill now={revenueToday} then={revenueLastWeek} /></div>
            <Sparkline points={week} />
          </div>
          <div className={`${card} p-section`}>
            <p className="type-label text-[12px] text-neutral-400">Tickets sold</p>
            <p className="mt-tight font-mono text-3xl tabular-nums">{ticketsToday}</p>
            <div className="mt-inline"><DeltaPill now={ticketsToday} then={ticketsLastWeek} /></div>
          </div>
          <div className={`${card} p-section`}>
            <p className="type-label text-[12px] text-neutral-400">Checked in</p>
            <p className="mt-tight font-mono text-3xl tabular-nums">{checkedIn}</p>
            <p className="mt-inline text-[12px] text-neutral-400">of {expected} expected</p>
          </div>
          <button type="button" onClick={() => router.push("/checkin")} className={`${card} p-section text-left transition-transform duration-quick hover:-translate-y-0.5`}>
            <p className="type-label text-[12px] text-neutral-400">Arriving next 2h</p>
            <p className="mt-tight font-mono text-3xl tabular-nums">{arriving2h}</p>
            <p className="mt-inline text-[12px] text-ember">Open Check-In →</p>
          </button>
        </div>
      )}

      {!loading && (
        <div className="mt-major grid gap-tight lg:grid-cols-3">
          {/* Left ⅔ — Up next + Live activity */}
          <div className="flex flex-col gap-tight lg:col-span-2">
            <div className={card}>
              <p className="type-label border-b border-neutral-200 px-section py-tight text-[11px] text-neutral-600">Up next</p>
              {upNext.length === 0 ? (
                <p className="px-section py-major text-[13px] text-neutral-400">No more sessions today.</p>
              ) : (
                upNext.map((u, i) => (
                  <div key={i} className="flex h-12 items-center gap-section border-b border-neutral-200 px-section last:border-0">
                    <span className="w-12 font-mono text-sm tabular-nums">{u.time}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{u.label}{u.who ? <span className="text-neutral-400"> · {u.who}</span> : null}</span>
                    {u.cap > 1 && (
                      <span className="flex items-center gap-tight">
                        <span className="font-mono text-[12px] tabular-nums text-neutral-600">{u.sold}/{u.cap}</span>
                        <span className="h-1 w-16 overflow-hidden rounded-full bg-neutral-200"><span className="block h-full bg-ember" style={{ width: `${(u.sold / u.cap) * 100}%` }} /></span>
                      </span>
                    )}
                    {u.state === "FULL" || u.state === "BOOKED" ? (
                      <span className="rounded-xs bg-[repeating-linear-gradient(45deg,#D6D4CE,#D6D4CE_2px,transparent_2px,transparent_5px)] px-tight font-mono text-[10px] text-neutral-600">{u.state}</span>
                    ) : (
                      <Button size="sm" onClick={() => sell(u.product)}>Sell</Button>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className={card}>
              <p className="type-label border-b border-neutral-200 px-section py-tight text-[11px] text-neutral-600">Live activity</p>
              {activity.map((a) => (
                <div key={a.id} className="flex h-12 items-center gap-section border-b border-neutral-200 px-section last:border-0">
                  <span className={`w-12 text-[12px] ${a.what === "Refund" ? "text-danger" : "text-neutral-600"}`}>{a.what}</span>
                  <span className="font-mono text-[12px] text-neutral-400">{a.ref}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{a.product}</span>
                  <span className="font-mono text-[13px] tabular-nums">{formatMoney(a.amount)}</span>
                  <span className="w-16 text-right font-mono text-[11px] text-neutral-400">{a.rel}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right ⅓ */}
          <div className="flex flex-col gap-tight">
            <div className={`${card} p-section`}>
              <p className="type-label mb-tight text-[11px] text-neutral-600">Payment mix today</p>
              {mix.length === 0 ? <p className="text-[13px] text-neutral-400">No payments yet.</p> : mix.map((m) => (
                <div key={m.label} className="mb-tight last:mb-0">
                  <div className="flex justify-between text-[12px]"><span>{m.label}</span><span className="font-mono tabular-nums">{formatMoney(m.amount)}</span></div>
                  <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-neutral-200"><div className="h-full bg-ink" style={{ width: `${(m.amount / mixMax) * 100}%` }} /></div>
                </div>
              ))}
            </div>

            <div className={`${card} p-section`}>
              <p className="type-label mb-tight text-[11px] text-neutral-600">Top products today</p>
              {top.length === 0 ? <p className="text-[13px] text-neutral-400">Nothing sold yet.</p> : top.map(([name, t]) => (
                <div key={name} className="flex h-9 items-center justify-between gap-tight border-b border-neutral-200 text-[13px] last:border-0">
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  <span className="font-mono text-[11px] text-neutral-400">{t.qty}×</span>
                  <span className="font-mono text-[12px] tabular-nums">{formatMoney(t.rev)}</span>
                </div>
              ))}
            </div>

            <div className={`${card} p-section`}>
              <p className="type-label mb-tight text-[11px] text-neutral-600">Needs attention</p>
              {attention.length === 0 ? (
                <p className="text-[13px] text-success">All clear.</p>
              ) : (
                attention.map((a, i) => (
                  <button key={i} type="button" onClick={() => router.push(a.href)} className="block w-full border-b border-neutral-200 py-tight text-left text-[13px] last:border-0 hover:text-ember">
                    {a.text}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
