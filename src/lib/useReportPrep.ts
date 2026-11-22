"use client";

import { getOperator, getStaff } from "@/lib/api";
import { DEMO_STAFF_ID } from "@/lib/session";
import { useApiQuery } from "@/lib/useApi";

/**
 * Who is making a report, for whom, in what currency: the three facts every
 * export's header needs and no screen has to hand. `ready` is false until the
 * operator has loaded, so an export never says "Counterfoil" for a business
 * that has a name.
 */
export function useReportPrep(staffId: string = DEMO_STAFF_ID) {
  const opQ = useApiQuery(() => getOperator(), []);
  const meQ = useApiQuery(() => getStaff(staffId), [staffId]);
  return {
    ready: !opQ.loading,
    operator: opQ.data ?? null,
    business: opQ.data?.name ?? "Counterfoil",
    currency: opQ.data?.currency ?? "BDT",
    preparedBy: meQ.data?.name ?? "",
  };
}
