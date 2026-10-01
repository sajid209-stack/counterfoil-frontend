"use client";

import { listRoles, listStaff, type Role } from "@/lib/api";
import { roleCan } from "@/lib/permissions";
import { DEMO_STAFF_ID } from "@/lib/session";
import { useApiQuery } from "@/lib/useApi";

/**
 * Who is signed in at this till, and what their role lets them do without a
 * manager — read once, used by both the refund and the discount flows.
 *
 * A cashier and a supervisor tap the same buttons; what happens next (a
 * request that waits, or money that moves right away) depends on the role
 * behind the name. One place reads that role, so the schedule board and
 * check-in never disagree about what Nadia is allowed to do on her own say-so.
 */
export interface Actor {
  loading: boolean;
  name: string;
  role: Role | null;
  /** Permitted to refund at all (`orders.refund`). */
  canRefund: boolean;
  /** Minor units; null = unlimited. Meaningless when `canRefund` is false. */
  refundLimit: number | null;
  /** Integer percent of an order's total; null = unlimited. */
  discountLimitPct: number | null;
}

export function useActor(): Actor {
  const staffQ = useApiQuery(() => listStaff({ pageSize: 200 }), []);
  const rolesQ = useApiQuery(() => listRoles({ pageSize: 200 }), []);
  const me = staffQ.data?.data.find((s) => s.id === DEMO_STAFF_ID) ?? null;
  const role = rolesQ.data?.data.find((r) => r.id === me?.roleId) ?? null;
  return {
    loading: staffQ.loading || rolesQ.loading,
    name: me?.name ?? "Counter",
    role,
    canRefund: role ? roleCan(role, "orders.refund") : false,
    refundLimit: role?.refundLimit ?? null,
    discountLimitPct: role?.discountLimitPct ?? null,
  };
}

/** Can this actor refund this amount themselves, with nobody else asked? */
export function canRefundDirectly(actor: Pick<Actor, "canRefund" | "refundLimit">, amount: number): boolean {
  if (!actor.canRefund) return false;
  return actor.refundLimit == null || amount <= actor.refundLimit;
}
