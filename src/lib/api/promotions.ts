import {
  createResource,
  fail,
  getManualDiscountPolicyState,
  notFoundError,
  ok,
  patchManualDiscountPolicyState,
  validationError,
} from "./client";
import type {
  ApiResult,
  Coupon,
  ListParams,
  ListResponse,
  ManualDiscountPolicy,
  Promotion,
  PromotionInput,
  PromotionQuote,
  QuoteLine,
} from "./types";

const promos = createResource<Promotion>("promotions", "Promotion", {
  search: (p, q) => p.name.toLowerCase().includes(q),
  filter: (p, f) => {
    const status = f.status as string | undefined;
    if (!status || status === "all") return p.status !== "archived" || !!f.includeArchived;
    return p.status === status;
  },
  sort: { name: (a, b) => a.name.localeCompare(b.name) },
  defaultSort: "name",
});
const coupons = createResource<Coupon>("coupons", "Coupon");

export const listPromotions = (params?: ListParams): Promise<ApiResult<ListResponse<Promotion>>> => promos.list(params);
export const getPromotion = (id: string): Promise<ApiResult<Promotion>> => promos.get(id);
export const archivePromotion = (id: string): Promise<ApiResult<Promotion>> => promos.archive(id);

export function createPromotion(input: PromotionInput): Promise<ApiResult<Promotion>> {
  if (!input.name?.trim()) return Promise.resolve(fail(validationError({ name: "Name the promotion." })));
  return promos.create(input as Omit<Promotion, "id" | "createdAt" | "updatedAt">);
}
export function updatePromotion(id: string, patch: Partial<Promotion>): Promise<ApiResult<Promotion>> {
  return promos.update(id, patch);
}

export const listCoupons = (params?: ListParams): Promise<ApiResult<ListResponse<Coupon>>> => coupons.list(params);

/** Resolve a coupon code to its coupon + promotion (promotions coupons/{code}). */
export async function resolveCoupon(code: string): Promise<ApiResult<{ coupon: Coupon; promotion: Promotion }>> {
  const c = coupons.peek().find((x) => x.code.toLowerCase() === code.trim().toLowerCase());
  if (!c) return fail(notFoundError("Coupon"));
  if (c.status !== "active") return fail({ code: "conflict", message: "This coupon is no longer active." });
  const p = promos.peek().find((x) => x.id === c.promotionId);
  if (!p || p.status !== "active") return fail({ code: "conflict", message: "This coupon's promotion is inactive." });
  return ok({ coupon: c, promotion: p });
}

/** Manual-discount policy (singleton). */
export async function getManualDiscountPolicy(): Promise<ApiResult<ManualDiscountPolicy>> {
  return ok(structuredClone(getManualDiscountPolicyState()));
}
export async function updateManualDiscountPolicy(patch: Partial<ManualDiscountPolicy>): Promise<ApiResult<ManualDiscountPolicy>> {
  return ok(structuredClone(patchManualDiscountPolicyState(patch)));
}

// ── The quote engine (mirrors promotions/engine.py semantics) ───────────────
// Pure: same code path a preview and a commit would use. Supports the coupon
// kinds POS applies today (percentage_off, fixed_amount_off, fixed_price,
// buy_x_get_y). Bundle pricing is evaluated in the OS editor only for M1.
function discountFor(promotion: Promotion, lines: QuoteLine[], subtotal: number): number {
  switch (promotion.kind) {
    case "percentage_off": {
      const raw = Math.round((subtotal * (promotion.percentBps ?? 0)) / 10000);
      return promotion.maxDiscountAmount ? Math.min(raw, promotion.maxDiscountAmount) : raw;
    }
    case "fixed_amount_off":
      return Math.min(subtotal, promotion.amount ?? 0);
    case "fixed_price": {
      // Charge a flat price for the whole eligible set: discount = subtotal − price.
      return Math.max(0, subtotal - (promotion.amount ?? subtotal));
    }
    case "buy_x_get_y": {
      const cfg = promotion.buyXGetY;
      if (!cfg) return 0;
      // Expand to unit prices, cheapest units get the "get" discount.
      const units: number[] = [];
      for (const l of lines) for (let i = 0; i < l.quantity; i++) units.push(l.unitAmount);
      units.sort((a, b) => a - b);
      const group = cfg.buyQuantity + cfg.getQuantity;
      const sets = Math.floor(units.length / group);
      let discount = 0;
      for (let s = 0; s < sets; s++) {
        for (let g = 0; g < cfg.getQuantity; g++) discount += Math.round((units[s * group + g] * cfg.getDiscountBps) / 10000);
      }
      return discount;
    }
    default:
      return 0;
  }
}

/** Quote a cart against coupon codes (+ automatic promotions). Returns the
 *  applied discounts (with line-level total) and any rejections. */
export async function quoteCart(input: { channel: "counter" | "online"; lines: QuoteLine[]; couponCodes?: string[] }): Promise<ApiResult<PromotionQuote>> {
  const subtotal = input.lines.reduce((s, l) => s + l.unitAmount * l.quantity, 0);
  const applied: PromotionQuote["applied"] = [];
  const rejected: PromotionQuote["rejected"] = [];

  const consider = (promotion: Promotion, code?: string) => {
    const e = promotion.eligibility;
    if (!e.channels.includes(input.channel)) { rejected.push({ code: code ?? promotion.name, reason: "channel_not_eligible" }); return; }
    if (e.minSubtotal && subtotal < e.minSubtotal) { rejected.push({ code: code ?? promotion.name, reason: "min_subtotal_not_met" }); return; }
    const qty = input.lines.reduce((s, l) => s + l.quantity, 0);
    if (e.minQuantity && qty < e.minQuantity) { rejected.push({ code: code ?? promotion.name, reason: "min_quantity_not_met" }); return; }
    const discount = discountFor(promotion, input.lines, subtotal);
    if (discount <= 0) { rejected.push({ code: code ?? promotion.name, reason: "no_discount" }); return; }
    applied.push({ promotionId: promotion.id, kind: promotion.kind, source: code ? "coupon" : "automatic", code, name: promotion.name, discount });
  };

  for (const code of input.couponCodes ?? []) {
    const r = await resolveCoupon(code);
    if (!r.ok) { rejected.push({ code, reason: "not_found" }); continue; }
    consider(r.data.promotion, r.data.coupon.code);
  }
  // Automatic, active, stackable promotions with no coupon.
  for (const p of promos.peek()) {
    if (p.status === "active" && p.source === "automatic") consider(p);
  }

  const discountTotal = applied.reduce((s, a) => s + a.discount, 0);
  return ok({ subtotal, discountTotal, netTotal: Math.max(0, subtotal - discountTotal), applied, rejected });
}
