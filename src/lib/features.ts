/* ── Features the UI hides because the backend has not built them yet ──────
 *
 * Promotions, memberships and loyalty points are fully built here — entities,
 * seed data, engines and screens — but the real backend does not implement
 * them, so showing them to an operator would be promising something the
 * platform cannot yet keep.
 *
 * They are HIDDEN, not deleted. Every flag below is a single boolean, and
 * turning one back to `true` restores its navigation entry, its till controls
 * and its screens exactly as they were. Nothing under `lib/api`, nothing in
 * the seed and none of the routes have been removed, so there is no
 * reconstruction work waiting on the other side of that flag — which is the
 * whole reason it is a flag rather than a revert.
 *
 * Rules for using these:
 *
 * - Gate the UI, never the arithmetic. `priceSale` and `buildOrderLines` still
 *   accept a member discount or a coupon; what changes is that no screen can
 *   produce one. That keeps the money engine identical to the one the backend
 *   team is reading, and means a re-enabled feature does not need its maths
 *   re-derived.
 * - Gate the WRITE too, not only the control. A points ledger must not gain
 *   entries from a sale made while points are hidden, or the balances waiting
 *   behind the flag would be wrong when it is lifted.
 * - A cashier's manual discount is NOT a promotion. It is a role-and-policy
 *   thing that works with no promotions engine at all, so it stays on.
 */
export const FEATURES = {
  /** Coupons and automatic promotions (the quote engine and /promotions). */
  promotions: false,
  /** Membership tiers, member pricing, and the CF-M- card at the gate. */
  memberships: false,
  /** The points ledger, /settings/loyalty, and spending points at the till. */
  loyalty: false,
} as const;
