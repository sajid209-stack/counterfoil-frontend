"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ArrowRight } from "lucide-react";
import { Button, PageShell } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import {
  getOperator,
  listCounters,
  listDevices,
  listLocations,
  listOrders,
  listProducts,
  listStaff,
} from "@/lib/api";
import { formatMoney } from "@/lib/format";

export default function DashboardPage() {
  const router = useRouter();
  const op = useApiQuery(() => getOperator(), []);
  const locations = useApiQuery(() => listLocations({ pageSize: 1 }), []);
  const counters = useApiQuery(() => listCounters({ pageSize: 1 }), []);
  const staff = useApiQuery(() => listStaff({ pageSize: 1 }), []);
  const products = useApiQuery(() => listProducts({ pageSize: 1 }), []);
  const devices = useApiQuery(() => listDevices({ pageSize: 1 }), []);
  const orders = useApiQuery(() => listOrders({ pageSize: 1000 }), []);

  const [skipped, setSkipped] = useState<Record<string, boolean>>({});
  const skip = (key: string) => setSkipped((s) => ({ ...s, [key]: true }));

  const has = (q: { data?: { page: { total: number } } }) => (q.data?.page.total ?? 0) > 0;

  const steps = [
    { key: "business", label: "Name your business", helper: "Your business name and currency.", done: !!op.data?.name, href: "/settings/business", ready: true },
    { key: "location", label: "Add a location", helper: "Where you sell and admit guests.", done: has(locations), href: "/settings/locations/new", ready: true },
    { key: "counter", label: "Add a counter", helper: "A point of sale at a location.", done: has(counters), href: "/settings/counters/new", ready: true },
    { key: "team", label: "Invite a team member", helper: "Someone to sell or scan.", done: has(staff), href: "/settings/team/new", ready: true },
    { key: "product", label: "Create a product", helper: "Something for guests to buy.", done: has(products), href: "/products/new", ready: true },
    { key: "device", label: "Register a device", helper: "Pair a tablet to a counter.", done: has(devices), href: "/settings/devices/new", ready: true },
  ];

  const complete = steps.filter((s) => s.done || skipped[s.key]).length;
  const allDone = complete === steps.length;

  // Golden-path: today's numbers reflect this session's own sales.
  const today = "2026-07-29";
  const todays = (orders.data?.data ?? []).filter((o) => o.createdAt.slice(0, 10) === today);
  const revenue = todays.filter((o) => o.status === "paid" || o.status === "partial").reduce((s, o) => s + o.total, 0);
  const checkedIn = todays.length; // proxy for arrivals

  return (
    <PageShell
      title={op.data?.name ?? "Dashboard"}
      description="Get set up, then watch today's sales roll in."
    >
      {!allDone && (
        <div className="mb-major rounded-md border border-neutral-200 bg-white p-major">
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
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{s.label}</div>
                    <div className="text-[12px] text-neutral-400">{s.helper}</div>
                  </div>
                  {done ? (
                    <span className="font-mono text-[11px] text-neutral-400">{s.done ? "Done" : "Skipped"}</span>
                  ) : s.ready ? (
                    <div className="flex items-center gap-tight">
                      <button type="button" onClick={() => skip(s.key)} className="text-[12px] text-neutral-400 hover:text-ink">Skip</button>
                      <Button size="sm" icon={<ArrowRight size={14} strokeWidth={1.5} />} onClick={() => router.push(s.href)}>Start</Button>
                    </div>
                  ) : (
                    <span className="font-mono text-[11px] text-neutral-400">soon</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-tight lg:grid-cols-4">
        <Stat label="Today's revenue" value={formatMoney(revenue)} />
        <Stat label="Orders today" value={String(todays.length)} />
        <Stat label="Check-ins today" value={String(checkedIn)} />
        <Stat label="Products" value={String(products.data?.page.total ?? 0)} />
      </div>
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-section">
      <p className="type-label text-[12px] text-neutral-400">{label}</p>
      <p className="mt-tight font-mono text-2xl">{value}</p>
    </div>
  );
}
