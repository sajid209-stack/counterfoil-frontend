"use client";

import { useCallback, useMemo } from "react";
import { useApiQuery } from "@/lib/useApi";
import {
  filterSalesOrders,
  listCounters,
  listLocations,
  listSalesOrders,
  listStaff,
  sortSalesOrders,
  summariseSales,
  type Order,
} from "@/lib/api";
import { useActiveLocation } from "@/lib/activeLocation";
import { toQuery, type SalesFilters } from "./filters";

/**
 * Who and where, by name.
 *
 * An order carries ids — `staffId`, `counterId`, `locationId` — and every place
 * that draws a name (the table, the filter chips, the summary, the CSV, the
 * printout) needs the same resolved text, so it is resolved once, here, from
 * the staff, counter and venue records. Until those have arrived a name comes
 * back empty rather than as a raw id: an id on screen is a flash of nonsense.
 */
export function useDirectory() {
  const staffQ = useApiQuery(() => listStaff({ pageSize: 500 }), []);
  const countersQ = useApiQuery(() => listCounters({ pageSize: 500 }), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const staff = useMemo(() => staffQ.data?.data ?? [], [staffQ.data]);
  const counters = useMemo(() => countersQ.data?.data ?? [], [countersQ.data]);
  const locations = useMemo(() => locationsQ.data?.data ?? [], [locationsQ.data]);
  const ready = !staffQ.loading && !countersQ.loading && !locationsQ.loading;

  const staffName = useCallback((id: string | null): string => (id ? (staff.find((s) => s.id === id)?.name ?? (ready ? id : "")) : ""), [staff, ready]);
  const counterName = useCallback((id: string | null): string => (id ? (counters.find((c) => c.id === id)?.name ?? (ready ? id : "")) : ""), [counters, ready]);
  const locationName = useCallback((id: string | null): string => (id ? (locations.find((l) => l.id === id)?.name ?? (ready ? id : "")) : ""), [locations, ready]);
  return { ready, staff, counters, locations, staffName, counterName, locationName };
}
export type Directory = ReturnType<typeof useDirectory>;

/**
 * The orders a set of filters matches, with the names resolved and the figures
 * worked out — the one read the list, the Summary, the CSV and both print pages
 * share, so the number in the panel is the number in the file.
 *
 * It fetches the venue's orders (or one customer's, at every venue) once and
 * narrows them in place: toggling a filter is then instant instead of a
 * quarter-second skeleton, and the API's own `filterSalesOrders` is the one
 * doing the narrowing, so a real backend would answer the same question the
 * same way.
 */
export function useSalesReport(f: SalesFilters, venueOverride?: string) {
  const dir = useDirectory();
  const { id: activeId, location, pending } = useActiveLocation(dir.locations);
  const venueId = venueOverride || activeId;
  const venue = dir.locations.find((l) => l.id === venueId) ?? location;
  const waiting = pending && !venueOverride;
  const scopeQ = useApiQuery(
    () =>
      waiting
        ? Promise.resolve({ ok: true as const, data: [] as Order[] })
        : listSalesOrders({ locationId: f.customerId ? undefined : venueId || undefined, customerId: f.customerId || undefined }),
    [venueId, f.customerId, waiting],
  );
  const scope = useMemo(() => scopeQ.data ?? [], [scopeQ.data]);

  const rows = useMemo(
    () => sortSalesOrders(filterSalesOrders(scope, toQuery(f, venueId)), f.sort, f.dir, { staff: dir.staffName, counter: dir.counterName }),
    // The page and size do not change which rows match.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scope, venueId, f.from, f.to, f.q, f.counters, f.staff, f.channels, f.methods, f.statuses, f.customerId, f.sort, f.dir, dir.staffName, dir.counterName],
  );
  const summary = useMemo(() => summariseSales(rows), [rows]);
  return {
    dir,
    venueId,
    venue,
    scope,
    rows,
    summary,
    loading: scopeQ.loading || waiting || !dir.ready,
    reload: scopeQ.reload,
  };
}
export type SalesReport = ReturnType<typeof useSalesReport>;
