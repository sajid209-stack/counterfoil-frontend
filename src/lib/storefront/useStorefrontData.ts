"use client";

/** Everything a live storefront route needs, fetched once and shared by the
 *  venue page, a booking page, the basket, checkout and the confirmation
 *  screen — so none of them has to remember the same four calls. */
import { useMemo } from "react";
import { useApiQuery } from "@/lib/useApi";
import { getOperator, getStorefrontPage, listResources, listStaff } from "@/lib/api";
import { demoNow } from "@/lib/schedule";

export function useStorefrontData(slug: string) {
  const now = useMemo(() => demoNow(), []);
  const pageQ = useApiQuery(() => getStorefrontPage(slug), [slug]);
  const resourcesQ = useApiQuery(() => listResources({ pageSize: 200 }), []);
  const staffQ = useApiQuery(() => listStaff({ pageSize: 200 }), []);
  const operatorQ = useApiQuery(() => getOperator(), []);

  return {
    loading: pageQ.loading,
    page: pageQ.data,
    resources: resourcesQ.data?.data ?? [],
    team: staffQ.data?.data ?? [],
    operator: operatorQ.data,
    now,
  };
}
