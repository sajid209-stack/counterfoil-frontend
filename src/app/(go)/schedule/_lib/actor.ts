"use client";

import { listRoles, listStaff, type CounterActionMode, type Role } from "@/lib/api";
import { counterAction, roleCan } from "@/lib/permissions";
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
  /** What this role may do at the counter, set in Settings → Roles:
   *  "off" hides the button, "request" asks a manager, "direct" does it on the
   *  spot. See `counterAction` in lib/permissions. */
  refundMode: CounterActionMode;
  rescheduleMode: CounterActionMode;
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
    refundMode: counterAction(role, "refund"),
    rescheduleMode: counterAction(role, "reschedule"),
  };
}

/**
 * Can this actor refund this amount themselves, with nobody else asked?
 *
 * Only when the role is set to "direct" — and even then a refund above the
 * role's own limit still becomes a request. "request" and "off" never refund
 * on the spot, whatever the limit says.
 */
export function canRefundDirectly(actor: Pick<Actor, "refundMode" | "refundLimit">, amount: number): boolean {
  if (actor.refundMode !== "direct") return false;
  return actor.refundLimit == null || amount <= actor.refundLimit;
}
