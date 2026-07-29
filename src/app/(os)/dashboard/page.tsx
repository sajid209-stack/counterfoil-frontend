import {
  getOperator,
  listCounters,
  listLocations,
  listProducts,
  listStaff,
} from "@/lib/api";
import type { ApiResult, ListResponse } from "@/lib/api";

export const metadata = { title: "Dashboard · Counterfoil OS" };

// Server component. Awaits the data layer directly — proves the mock api,
// ApiResult handling, and loading path work end-to-end. This is a smoke-test
// dashboard, not the final reporting screen (that comes later).
function total<T>(r: ApiResult<ListResponse<T>>): string {
  return r.ok ? String(r.data.page.total) : "—";
}

export default async function DashboardPage() {
  const [op, products, locations, counters, staff] = await Promise.all([
    getOperator(),
    listProducts({ pageSize: 1 }),
    listLocations({ pageSize: 1 }),
    listCounters({ pageSize: 1 }),
    listStaff({ pageSize: 1 }),
  ]);

  const stats = [
    { label: "Products", value: total(products) },
    { label: "Locations", value: total(locations) },
    { label: "Counters", value: total(counters) },
    { label: "Staff", value: total(staff) },
  ];

  return (
    <main className="px-major py-major">
      <p className="type-label text-[13px] text-neutral-400">
        {op.ok ? op.data.name : "Operator"}
      </p>
      <h1 className="type-h1 mt-inline text-3xl">Dashboard</h1>

      <div className="mt-major grid grid-cols-2 gap-tight lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-md border border-neutral-200 bg-white p-section"
          >
            <p className="type-label text-[12px] text-neutral-400">{s.label}</p>
            <p className="mt-tight font-mono text-3xl">{s.value}</p>
          </div>
        ))}
      </div>

      <p className="type-body mt-major max-w-lg text-[13px] text-neutral-600">
        Counts read live from the mock data layer via{" "}
        <span className="font-mono">@/lib/api</span>. Swap{" "}
        <span className="font-mono">client.ts</span> for real endpoints and this
        page is unchanged.
      </p>
    </main>
  );
}
