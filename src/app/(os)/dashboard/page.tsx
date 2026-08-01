"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronDown, ChevronRight } from "lucide-react";
import { Button, Modal, PageShell, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import {
  cancelSessionBookings,
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
  updateProduct,
  type Booking,
  type Order,
  type Product,
} from "@/lib/api";
import { isResourceType, isSlotBased, toMinutes } from "@/lib/schedule";
import { formatMoney } from "@/lib/format";

const TODAY = "2026-07-29";
const NOW_MIN = 12 * 60; // mock clock: noon
const dayShift = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** Count-up over 320ms for the hero figures. */
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
  const toast = useToast();
  const op = useApiQuery(() => getOperator(), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100, filters: { status: "active" } }), []);
  const counters = useApiQuery(() => listCounters({ pageSize: 1 }), []);
  const staffQ = useApiQuery(() => listStaff({ pageSize: 1 }), []);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100, filters: { status: "active" } }), []);
  const devicesQ = useApiQuery(() => listDevices({ pageSize: 100 }), []);
  const ordersQ = useApiQuery(() => listOrders({ pageSize: 1000 }), []);
  const bookingsQ = useApiQuery(() => listBookings({ pageSize: 1000 }), []);
  const resourcesQ = useApiQuery(() => listResources({ pageSize: 100 }), []);

  const [locationId, setLocationId] = useState<string>("all");
  const [scope, setScope] = useState<"today" | "week">("today");
  const [openSession, setOpenSession] = useState<string | null>(null); // inline bookings
  const [capModal, setCapModal] = useState<{ product: Product; value: number } | null>(null);
  const [cancelModal, setCancelModal] = useState<{ product: Product; time: string; slotISO: string; affected: number } | null>(null);
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

  const scopeDays = useMemo(() => (scope === "today" ? [TODAY] : Array.from({ length: 7 }, (_, i) => dayShift(TODAY, i - 6))), [scope]);
  const prevDays = useMemo(() => scopeDays.map((d) => dayShift(d, -7)), [scopeDays]);

  // ── Hero: revenue ─────────────────────────────────────────────────────────
  const revenueIn = (days: string[]) => orders.filter((o) => paidish(o) && days.includes(o.createdAt.slice(0, 10))).reduce((s, o) => s + o.total, 0);
  const revenue = revenueIn(scopeDays);
  const revenuePrev = revenueIn(prevDays);
  const revenueAnimated = useCountUp(revenue);
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => revenueIn([dayShift(TODAY, i - 6)])), [orders]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Hero: capacity — the number no other system can show ─────────────────
  const capacityFor = (days: string[]) => {
    let cap = 0;
    for (const d of days) {
      for (const p of products) {
        if (!p.schedule) continue;
        if (p.schedule.dailyCapacity) cap += p.schedule.dailyCapacity;
        else if (isResourceType(p.bookingType)) cap += getResourceMatrix(p, d).reduce((s, r) => s + r.slots.length, 0);
        else if (isSlotBased(p.bookingType)) cap += getSlots(p, d).reduce((s, x) => s + x.capacity, 0);
      }
    }
    return cap;
  };
  const soldFor = (days: string[]) => bookings.filter((b) => b.status === "confirmed" && days.includes(b.slotStart.slice(0, 10))).reduce((s, b) => s + b.partySize, 0);
  const capacity = useMemo(() => capacityFor(scopeDays), [scopeDays, products]); // eslint-disable-line react-hooks/exhaustive-deps
  const sold = soldFor(scopeDays);
  const soldPrev = soldFor(prevDays);
  const soldPct = capacity > 0 ? Math.round((sold / capacity) * 100) : 0;

  // ── Hero: arrived / no-show ───────────────────────────────────────────────
  const scoped = bookings.filter((b) => b.status === "confirmed" && scopeDays.includes(b.slotStart.slice(0, 10)));
  const arrived = scoped.reduce((s, b) => s + (b.checkedIn ?? 0), 0);
  const noShowPct = sold > 0 ? Math.round(((sold - arrived) / sold) * 100) : 0;

  // ── Hero: booked ahead — committed revenue, next 7 days ──────────────────
  const bookedAhead = (from: number, to: number) => {
    const ids = new Set(
      bookings
        .filter((b) => { const d = b.slotStart.slice(0, 10); return b.status === "confirmed" && d >= dayShift(TODAY, from) && d <= dayShift(TODAY, to); })
        .map((b) => b.orderId),
    );
    return orders.filter((o) => ids.has(o.id) && paidish(o)).reduce((s, o) => s + o.total, 0);
  };
  const ahead = bookedAhead(1, 7);
  const aheadPrev = bookedAhead(8, 14);

  // ── Today's sessions — management, never selling ─────────────────────────
  interface Session { key: string; time: string; slotISO: string; label: string; who?: string; sold: number; cap: number; state: "OPEN" | "FULL" | "OUT"; product: Product; adjustable: boolean }
  const sessions = useMemo<Session[]>(() => {
    const out: Session[] = [];
    for (const p of products) {
      if (isResourceType(p.bookingType) && !p.flexibleDurations) {
        for (const r of getResourceMatrix(p, TODAY)) {
          for (const s of r.slots) {
            if (toMinutes(s.time) < NOW_MIN) continue;
            out.push({ key: `${p.id}|${r.resource.id}|${s.time}`, time: s.time, slotISO: `${TODAY}T${s.time}:00+06:00`, label: p.name, who: r.resource.name, sold: s.available ? 0 : 1, cap: 1, state: r.resource.outOfService ? "OUT" : s.available ? "OPEN" : "FULL", product: p, adjustable: false });
          }
        }
      } else if (isSlotBased(p.bookingType)) {
        for (const s of getSlots(p, TODAY)) {
          if (toMinutes(s.time) < NOW_MIN) continue;
          out.push({ key: `${p.id}|${s.time}`, time: s.time, slotISO: `${TODAY}T${s.time}:00+06:00`, label: p.name, who: p.schedule?.guideIds.length ? "Guided" : undefined, sold: s.sold, cap: s.capacity, state: s.remaining <= 0 ? "FULL" : "OPEN", product: p, adjustable: true });
        }
      }
    }
    return out.sort((a, b) => a.time.localeCompare(b.time)).slice(0, 9);
  }, [products]);

  const sessionBookings = (s: Session): Booking[] =>
    bookings.filter((b) => b.productId === s.product.id && b.slotStart === s.slotISO && b.status === "confirmed");

  const saveCapacity = async () => {
    if (!capModal) return;
    const p = capModal.product;
    const sch = p.schedule!;
    const patch = sch.dailyCapacity ? { schedule: { ...sch, dailyCapacity: capModal.value } } : { schedule: { ...sch, capacityPerSession: capModal.value } };
    const res = await updateProduct(p.id, patch as never);
    if (res.ok) { toast.success(`Capacity set to ${capModal.value}.`); productsQ.reload(); }
    else toast.error(res.error.message);
    setCapModal(null);
  };

  const doCancelSession = async () => {
    if (!cancelModal) return;
    const res = await cancelSessionBookings(cancelModal.product.id, cancelModal.slotISO);
    if (res.ok) { toast.success(`Session cancelled — ${res.data.cancelled} booking${res.data.cancelled === 1 ? "" : "s"} released.`); bookingsQ.reload(); productsQ.reload(); }
    setCancelModal(null);
  };

  // ── Live activity ────────────────────────────────────────────────────────
  const activity = useMemo(() =>
    [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6).map((o) => {
      const mins = Math.max(0, Math.round((Date.parse(`${TODAY}T12:00:00+06:00`) - Date.parse(o.createdAt)) / 60000));
      const rel = mins < 60 ? `${mins} min ago` : mins < 1440 ? `${Math.round(mins / 60)} hr ago` : `${Math.round(mins / 1440)} d ago`;
      return { id: o.id, ref: o.reference, what: o.status === "refunded" ? "Refund" : "Sale", product: o.lines[0]?.productName ?? "—", amount: o.total, rel };
    }), [orders]);

  // ── Right rail ───────────────────────────────────────────────────────────
  const attention = useMemo(() => {
    const items: { text: string; href?: string }[] = [];
    // Cash variance on a closed shift — derived from the mock shift record.
    items.push({ text: "Fort Main Gate closed ৳2,000 short yesterday", href: "/reports/sales" });
    resources.filter((r) => r.outOfService).forEach((r) => items.push({ text: `${r.name} is out of service${r.outOfServiceReason ? ` — ${r.outOfServiceReason}` : ""}`, href: "/settings/resources" }));
    // The silent failure: nothing bookable beyond a date.
    for (const p of products) {
      if (p.courseDates?.length) {
        const last = [...p.courseDates].sort().at(-1)!;
        if (last <= dayShift(TODAY, 30)) items.push({ text: `${p.name} has no sessions after ${last}`, href: `/products/${p.id}` });
      }
      if (p.windowMode === "fixed" && p.windowEnd && p.windowEnd <= dayShift(TODAY, 30)) {
        items.push({ text: `${p.name} stops selling ${p.windowEnd}`, href: `/products/${p.id}` });
      }
    }
    const wl = peekWaitlist().length;
    if (wl > 0) items.push({ text: `${wl} waitlist request${wl === 1 ? "" : "s"} waiting for an offer`, href: "/schedule" });
    // Arrivals today still owing a balance.
    const owing = bookings
      .filter((b) => b.status === "confirmed" && b.slotStart.slice(0, 10) === TODAY)
      .map((b) => orders.find((o) => o.id === b.orderId))
      .filter((o): o is Order => !!o && o.status === "partial");
    if (owing.length) {
      const due = owing.reduce((s, o) => s + (o.total - o.payments.reduce((x, p) => x + p.amount, 0)), 0);
      items.push({ text: `${owing.length} arrival${owing.length === 1 ? "" : "s"} today owe ${formatMoney(due)}`, href: "/checkin" });
    }
    (devicesQ.data?.data ?? []).forEach((d) => {
      if (!d.lastSeenAt || d.lastSeenAt.slice(0, 10) <= dayShift(TODAY, -7)) items.push({ text: `${d.name} not seen in 7+ days`, href: "/settings/devices" });
    });
    return items;
  }, [resources, products, bookings, orders, devicesQ.data]);

  // Idle capacity — unsold places in the next 48h, priced.
  const idle = useMemo(() => {
    const out: { text: string; value: number; href: string }[] = [];
    for (const d of [TODAY, dayShift(TODAY, 1)]) {
      for (const p of products) {
        if (!isSlotBased(p.bookingType) || isResourceType(p.bookingType)) continue;
        for (const s of getSlots(p, d)) {
          if (d === TODAY && toMinutes(s.time) < NOW_MIN) continue;
          if (s.capacity > 1 && s.sold / s.capacity < 0.3) {
            const price = Math.min(...p.tiers.filter((t) => t.active).map((t) => t.price));
            out.push({ text: `${d === TODAY ? "" : "Tomorrow "}${s.time} ${p.name} · ${s.sold}/${s.capacity}`, value: s.remaining * price, href: `/products/${p.id}` });
          }
        }
      }
    }
    return out.sort((a, b) => b.value - a.value).slice(0, 4);
  }, [products]);

  const mix = useMemo(() => {
    const m = new Map<string, number>();
    orders.filter((o) => paidish(o) && o.createdAt.slice(0, 10) === TODAY).forEach((o) => o.payments.forEach((p) => m.set(p.method, (m.get(p.method) ?? 0) + p.amount)));
    const label: Record<string, string> = { cash: "Cash", bkash: "bKash", bangla_qr: "QR", card_terminal: "Card", voucher: "Voucher", credit: "Credit" };
    return [...m.entries()].map(([k, v]) => ({ label: label[k] ?? k, amount: v })).sort((a, b) => b.amount - a.amount);
  }, [orders]);
  const mixMax = Math.max(...mix.map((m) => m.amount), 1);

  const top = useMemo(() => {
    const m = new Map<string, { qty: number; rev: number }>();
    orders.filter((o) => paidish(o) && o.createdAt.slice(0, 10) === TODAY).forEach((o) => o.lines.forEach((l) => {
      if (l.unitPrice <= 0) return;
      const cur = m.get(l.productName) ?? { qty: 0, rev: 0 };
      m.set(l.productName, { qty: cur.qty + l.quantity, rev: cur.rev + l.unitPrice * l.quantity });
    }));
    return [...m.entries()].sort((a, b) => b[1].rev - a[1].rev).slice(0, 5);
  }, [orders]);

  // ── Setup checklist (replaces the hero until finished) ───────────────────
  const steps = [
    { key: "business", label: "Name your business", done: !!op.data?.name, href: "/settings/business" },
    { key: "location", label: "Add a location", done: locations.length > 0, href: "/settings/locations/new" },
    { key: "counter", label: "Add a counter", done: has(counters), href: "/settings/counters/new" },
    { key: "team", label: "Invite a team member", done: has(staffQ), href: "/settings/team/new" },
    { key: "product", label: "Create a product", done: products.length > 0, href: "/products/new" },
    { key: "device", label: "Register a device", done: (devicesQ.data?.page.total ?? 0) > 0, href: "/settings/devices/new" },
  ];
  const complete = steps.filter((s) => s.done || skipped[s.key]).length;
  const allDone = complete === steps.length;

  const dateLabel = new Date(`${TODAY}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const card = "rounded-md border border-line bg-card shadow-sm";

  return (
    <PageShell
      title={op.data?.name || "Dashboard"}
      description={dateLabel}
      actions={
        <div className="flex items-center gap-tight">
          {locations.length > 1 && (
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="h-11 rounded-sm border border-line bg-card px-comfortable text-sm outline-none focus:border-inverse">
              <option value="all">All locations</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
          {/* Scope, not actions — a dashboard is a place to look. */}
          <div className="relative grid h-11 grid-cols-2 rounded-sm bg-line/60 p-inline">
            <span aria-hidden className="absolute inset-y-inline rounded-xs bg-inverse transition-[left] duration-quick ease-counterfoil" style={{ width: "calc(50% - 8px)", left: scope === "today" ? 4 : "calc(50% + 4px)" }} />
            {(["today", "week"] as const).map((s) => (
              <button key={s} type="button" onClick={() => setScope(s)} className={`relative z-10 px-comfortable text-[13px] transition-colors duration-quick ${scope === s ? "font-medium text-inverse-fg" : "text-muted"}`}>{s === "today" ? "Today" : "This week"}</button>
            ))}
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="grid grid-cols-2 gap-tight lg:grid-cols-4" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`${card} animate-pulse p-section`}><div className="h-3 w-1/2 rounded-xs bg-line" /><div className="mt-tight h-8 w-2/3 rounded-xs bg-line" /></div>
          ))}
        </div>
      ) : !allDone ? (
        <div className={`${card} mb-major p-major`}>
          <div className="mb-section flex items-center justify-between">
            <h2 className="type-h2 text-base">Finish setting up</h2>
            <span className="font-mono text-[12px] text-faint">{complete} of {steps.length}</span>
          </div>
          <div className="mb-major h-1.5 w-full overflow-hidden rounded-full bg-line">
            <div className="h-full bg-ember transition-all" style={{ width: `${(complete / steps.length) * 100}%` }} />
          </div>
          <div className="flex flex-col gap-tight">
            {steps.map((s, i) => {
              const done = s.done || skipped[s.key];
              return (
                <div key={s.key} className="flex items-center gap-section rounded-sm border border-line p-comfortable">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-[13px] ${done ? "bg-success text-white" : "bg-line text-muted"}`}>
                    {done ? <Check size={16} strokeWidth={2} /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium">{s.label}</span>
                  {done ? (
                    <span className="font-mono text-[11px] text-faint">{s.done ? "Done" : "Skipped"}</span>
                  ) : (
                    <div className="flex items-center gap-tight">
                      <button type="button" onClick={() => skip(s.key)} className="text-[12px] text-faint hover:text-fg">Skip</button>
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
            <p className="type-label text-[12px] text-faint">Revenue {scope === "today" ? "today" : "this week"}</p>
            <p className="mt-tight whitespace-nowrap font-mono text-3xl tabular-nums">{formatMoney(revenueAnimated)}</p>
            <div className="mt-inline"><DeltaPill now={revenue} then={revenuePrev} /></div>
            <Sparkline points={week} />
          </div>
          <div className={`${card} p-section`}>
            <p className="type-label text-[12px] text-faint">Capacity sold</p>
            <p className="mt-tight whitespace-nowrap font-mono text-3xl tabular-nums">{sold} <span className="text-lg text-faint">/ {capacity}</span></p>
            <div className="mt-inline flex items-center gap-tight">
              <span className="font-mono text-[12px] tabular-nums text-muted">{soldPct}%</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line"><span className={`block h-full ${soldPct >= 80 ? "bg-ember" : "bg-strong"}`} style={{ width: `${Math.min(100, soldPct)}%` }} /></span>
              <DeltaPill now={sold} then={soldPrev} />
            </div>
          </div>
          <div className={`${card} p-section`}>
            <p className="type-label text-[12px] text-faint">Arrived</p>
            <p className="mt-tight whitespace-nowrap font-mono text-3xl tabular-nums">{arrived} <span className="text-lg text-faint">of {sold}</span></p>
            <p className={`mt-inline font-mono text-[12px] tabular-nums ${noShowPct >= 30 ? "text-danger" : "text-muted"}`}>{noShowPct}% no-show</p>
          </div>
          <div className={`${card} p-section`}>
            <p className="type-label text-[12px] text-faint">Booked ahead · next 7 days</p>
            <p className="mt-tight whitespace-nowrap font-mono text-3xl tabular-nums">{formatMoney(ahead)}</p>
            <div className="mt-inline"><DeltaPill now={ahead} then={aheadPrev} /></div>
          </div>
        </div>
      )}

      {!loading && (
        <div className="mt-major grid gap-tight lg:grid-cols-3">
          {/* Left ⅔ — Today's sessions (management, never selling) + activity */}
          <div className="flex flex-col gap-tight lg:col-span-2">
            <div className={card}>
              <p className="type-label border-b border-line px-section py-tight text-[11px] text-muted">Today&apos;s sessions</p>
              {sessions.length === 0 ? (
                <p className="px-section py-major text-[13px] text-faint">No more sessions today.</p>
              ) : (
                sessions.map((u) => {
                  const open = openSession === u.key;
                  const list = sessionBookings(u);
                  return (
                    <div key={u.key} className="border-b border-line last:border-0">
                      <div className="flex min-h-12 items-center gap-section px-section">
                        <button type="button" aria-label="Bookings" onClick={() => setOpenSession(open ? null : u.key)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-faint hover:text-fg">
                          {open ? <ChevronDown size={15} strokeWidth={1.5} /> : <ChevronRight size={15} strokeWidth={1.5} />}
                        </button>
                        <span className="w-12 shrink-0 font-mono text-sm tabular-nums">{u.time}</span>
                        <span className="min-w-0 flex-1 truncate text-sm">{u.label}{u.who ? <span className="text-faint"> · {u.who}</span> : null}</span>
                        {u.cap > 1 && (
                          <span className="flex shrink-0 items-center gap-tight">
                            <span className="whitespace-nowrap font-mono text-[12px] tabular-nums text-muted">{u.sold}/{u.cap}</span>
                            <span className="h-0.5 w-16 overflow-hidden rounded-full bg-line"><span className={`block h-full ${u.sold / u.cap >= 0.8 ? "bg-ember" : "bg-strong"}`} style={{ width: `${(u.sold / u.cap) * 100}%` }} /></span>
                          </span>
                        )}
                        {u.state !== "OPEN" && (
                          <span className="shrink-0 rounded-xs bg-[repeating-linear-gradient(45deg,#D6D4CE,#D6D4CE_2px,transparent_2px,transparent_5px)] px-tight font-mono text-[10px] text-muted dark:bg-[repeating-linear-gradient(45deg,#3a3a36,#3a3a36_2px,transparent_2px,transparent_5px)]">{u.state === "OUT" ? "OUT OF SERVICE" : "FULL"}</span>
                        )}
                        {u.adjustable && (
                          <button type="button" onClick={() => setCapModal({ product: u.product, value: u.product.schedule?.dailyCapacity ?? u.product.schedule?.capacityPerSession ?? 0 })} className="shrink-0 text-[12px] text-muted hover:text-fg">Adjust</button>
                        )}
                        <button type="button" onClick={() => setCancelModal({ product: u.product, time: u.time, slotISO: u.slotISO, affected: list.length })} className="shrink-0 text-[12px] text-danger/80 hover:text-danger">Cancel</button>
                      </div>
                      {open && (
                        <div className="border-t border-line bg-subtle px-section py-tight">
                          {list.length === 0 ? (
                            <p className="text-[12px] text-faint">No bookings on this session.</p>
                          ) : (
                            list.map((b) => (
                              <div key={b.id} className="flex h-9 items-center gap-section text-[13px]">
                                <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-muted">{b.orderId}</span>
                                <span className="font-mono text-[12px] tabular-nums">party {b.partySize}</span>
                                <span className="font-mono text-[12px] tabular-nums text-muted">{b.checkedIn ?? 0} in</span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className={card}>
              <p className="type-label border-b border-line px-section py-tight text-[11px] text-muted">Live activity</p>
              {activity.map((a) => (
                <div key={a.id} className="flex h-12 items-center gap-section border-b border-line px-section last:border-0">
                  <span className={`w-12 shrink-0 text-[12px] ${a.what === "Refund" ? "text-danger" : "text-muted"}`}>{a.what}</span>
                  <span className="shrink-0 font-mono text-[12px] text-faint">{a.ref}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{a.product}</span>
                  <span className="shrink-0 whitespace-nowrap font-mono text-[13px] tabular-nums">{formatMoney(a.amount)}</span>
                  <span className="w-16 shrink-0 text-right font-mono text-[11px] text-faint">{a.rel}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right ⅓ — priority order */}
          <div className="flex flex-col gap-tight">
            <div className={`${card} p-section`}>
              <p className="type-label mb-tight text-[11px] text-muted">Needs attention</p>
              {attention.length === 0 ? (
                <p className="text-[13px] text-success">All clear.</p>
              ) : (
                attention.map((a, i) => (
                  <button key={i} type="button" onClick={() => a.href && router.push(a.href)} className="block w-full border-b border-line py-tight text-left text-[13px] last:border-0 hover:text-ember">
                    {a.text}
                  </button>
                ))
              )}
            </div>

            <div className={`${card} p-section`}>
              <p className="type-label mb-tight text-[11px] text-muted">Idle capacity · next 48h</p>
              {idle.length === 0 ? (
                <p className="text-[13px] text-faint">Nothing under 30% fill.</p>
              ) : (
                idle.map((x, i) => (
                  <button key={i} type="button" onClick={() => router.push(x.href)} className="flex w-full items-center justify-between gap-tight border-b border-line py-tight text-left text-[13px] last:border-0 hover:text-ember">
                    <span className="min-w-0 truncate">{x.text}</span>
                    <span className="shrink-0 whitespace-nowrap font-mono text-[12px] tabular-nums text-muted">{formatMoney(x.value)} unsold</span>
                  </button>
                ))
              )}
            </div>

            <div className={`${card} p-section`}>
              <p className="type-label mb-tight text-[11px] text-muted">Open shifts now</p>
              {/* Mock shift record — the Shift entity is a backend-lane item. */}
              <div className="flex items-center justify-between text-[13px]">
                <span>Nadia Islam · Fort Main Gate</span>
                <span className="font-mono text-[12px] tabular-nums text-muted">3:24 · ৳47,850</span>
              </div>
            </div>

            <div className={`${card} p-section`}>
              <p className="type-label mb-tight text-[11px] text-muted">Payment mix today</p>
              {mix.length === 0 ? <p className="text-[13px] text-faint">No payments yet.</p> : mix.map((m) => (
                <div key={m.label} className="mb-tight last:mb-0">
                  <div className="flex justify-between text-[12px]"><span>{m.label}</span><span className="font-mono tabular-nums">{formatMoney(m.amount)}</span></div>
                  <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full bg-inverse" style={{ width: `${(m.amount / mixMax) * 100}%` }} /></div>
                </div>
              ))}
            </div>

            {/* Useful, not urgent — below the fold. */}
            <div className={`${card} p-section`}>
              <p className="type-label mb-tight text-[11px] text-muted">Top products today</p>
              {top.length === 0 ? <p className="text-[13px] text-faint">Nothing sold yet.</p> : top.map(([name, t]) => (
                <div key={name} className="flex h-9 items-center justify-between gap-tight border-b border-line text-[13px] last:border-0">
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  <span className="shrink-0 font-mono text-[11px] text-faint">{t.qty}×</span>
                  <span className="shrink-0 whitespace-nowrap font-mono text-[12px] tabular-nums">{formatMoney(t.rev)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Adjust capacity — the decision a manager makes when a session is full. */}
      <Modal
        open={!!capModal}
        onClose={() => setCapModal(null)}
        title={capModal ? `Capacity — ${capModal.product.name}` : ""}
        footer={<><Button variant="secondary" onClick={() => setCapModal(null)}>Cancel</Button><Button onClick={saveCapacity}>Save</Button></>}
      >
        {capModal && (
          <div className="flex flex-col gap-tight">
            <div className="flex items-center justify-between rounded-sm border border-line bg-card p-comfortable">
              <span className="text-sm">{capModal.product.schedule?.dailyCapacity ? "Places per day" : "Places per session"}</span>
              <div className="flex items-center gap-tight">
                <button type="button" aria-label="Fewer" onClick={() => setCapModal((m) => m && { ...m, value: Math.max(1, m.value - 1) })} className="h-11 w-11 rounded-sm border border-line text-lg">−</button>
                <span className="w-10 text-center font-mono tabular-nums">{capModal.value}</span>
                <button type="button" aria-label="More" onClick={() => setCapModal((m) => m && { ...m, value: m.value + 1 })} className="h-11 w-11 rounded-sm border border-line text-lg">+</button>
              </div>
            </div>
            <p className="text-[12px] text-faint">Applies to the whole weekly pattern — per-date overrides are a backend feature.</p>
          </div>
        )}
      </Modal>

      {/* Cancel session — the warning names how many bookings are affected. */}
      <Modal
        open={!!cancelModal}
        onClose={() => setCancelModal(null)}
        title={cancelModal ? `Cancel ${cancelModal.time} — ${cancelModal.product.name}?` : ""}
        footer={<><Button variant="secondary" onClick={() => setCancelModal(null)}>Keep session</Button><Button variant="destructive" onClick={doCancelSession}>Cancel session</Button></>}
      >
        {cancelModal && (
          <p className="text-sm text-muted">
            {cancelModal.affected === 0
              ? "No bookings are on this session yet."
              : `${cancelModal.affected} booking${cancelModal.affected === 1 ? " is" : "s are"} on this session — they will be released. Refunds are handled from Orders.`}
          </p>
        )}
      </Modal>
    </PageShell>
  );
}
