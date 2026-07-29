/* ───────────────────────────────────────────────────────────────────────────
   Counterfoil API contract.

   This file is the shared shape between the frontend and the (not-yet-built)
   backend. If the backend returns a different shape, integration becomes a
   rewrite instead of swapping `client.ts`. Treat every change here as a
   contract change.

   Conventions:
   - Money is INTEGER minor units (paisa/cents). Never floats. All `Minor`
     values are in the operator's single currency (`Operator.currency`).
   - Timestamps are ISO 8601 with offset. Dates are "YYYY-MM-DD".
   - Every entity carries `createdAt`/`updatedAt` and a `status` lifecycle.
   ────────────────────────────────────────────────────────────────────────── */

// ── Scalars ────────────────────────────────────────────────────────────────
export type ID = string; // ULID/UUID
export type Minor = number; // 1050 = ৳10.50, in Operator.currency
export type ISODate = string; // "2026-07-29"
export type ISODateTime = string; // "2026-07-29T09:00:00+06:00"
export type CurrencyCode = string; // ISO 4217, e.g. "BDT"

export type Channel = "counter" | "online";

/** One lifecycle pattern for every configurable entity.
 *  active   → available for use/sale
 *  inactive → hidden/paused but not deleted (toggle)
 *  archived → soft-deleted; excluded from normal lists unless asked for */
export type Lifecycle = "active" | "inactive" | "archived";

// ── Booking types ──────────────────────────────────────────────────────────
// Stream 1 scope. Kept as a data field on Product; NOT surfaced in the UI.
export type BookingTypeCode = "BT-01" | "BT-02" | "BT-03" | "BT-06" | "BT-09";

// ── Operator (tenant) ──────────────────────────────────────────────────────
export interface Operator {
  id: ID;
  name: string;
  currency: CurrencyCode; // every Minor in the system is denominated in this
  defaultTimezone: string; // "Asia/Dhaka"
  taxRatePct: number; // sales tax / VAT percent, e.g. 15
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
export type OperatorPatch = Partial<
  Pick<Operator, "name" | "currency" | "defaultTimezone" | "taxRatePct">
>;

// ── Booking rules — capacity / slots / weekly pattern / blackouts ───────────
export interface BookingRule {
  id: ID;
  name: string;
  productId: ID | null; // null = applies to all products
  locationId: ID | null; // null = all locations
  capacity: number; // guests per slot
  slotMinutes: number; // slot length
  daysOfWeek: number[]; // 0–6 the rule is active
  blackoutDates: ISODate[];
  status: Lifecycle;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
export type BookingRuleInput = Omit<BookingRule, "id" | "createdAt" | "updatedAt">;
export type BookingRulePatch = Partial<BookingRuleInput>;

// ── Pricing rules — peak/off-peak adjustments per channel/location ──────────
export type PriceRuleKind = "standard" | "peak" | "off_peak";
export interface PriceRule {
  id: ID;
  name: string;
  productId: ID | null;
  locationId: ID | null;
  channel: Channel | "all";
  kind: PriceRuleKind;
  adjustmentPct: number; // + surcharge / − discount applied to base tier price
  status: Lifecycle;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
export type PriceRuleInput = Omit<PriceRule, "id" | "createdAt" | "updatedAt">;
export type PriceRulePatch = Partial<PriceRuleInput>;

// ── Category ───────────────────────────────────────────────────────────────
export interface Category {
  id: ID;
  name: string;
  sortOrder: number;
  active: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ── Product ────────────────────────────────────────────────────────────────
export interface ProductImage {
  id: ID;
  url: string;
  alt?: string;
}

export interface PriceTier {
  id: ID;
  name: string; // "Adult", "Child", "Senior"
  price: Minor;
  maxPerOrder?: number; // tier cap; must be ≤ Product.maxPerOrder if both set
  active: boolean;
}

export interface Product {
  id: ID;
  name: string;
  description: string;
  images: ProductImage[];
  categoryId: ID | null;
  bookingType: BookingTypeCode;
  tiers: PriceTier[];
  locationIds: ID[];
  channels: Channel[];
  status: Lifecycle;
  archivedAt: ISODateTime | null; // set iff status === "archived"
  maxPerOrder?: number;
  minAge?: number;
  validityDays?: number; // BT-02 only
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ── Location ───────────────────────────────────────────────────────────────
/** A single open interval. `closesAt < opensAt` means it runs past midnight. */
export interface TimeInterval {
  opensAt: string; // "09:00"
  closesAt: string; // "18:00"
}

export interface OpeningHours {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  intervals: TimeInterval[]; // empty ⇒ closed that day
}

export interface Location {
  id: ID;
  name: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  country: string;
  timezone: string; // "Asia/Dhaka"
  openingHours: OpeningHours[];
  status: Lifecycle;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ── Counter ────────────────────────────────────────────────────────────────
export type PaymentMethod =
  | "cash"
  | "card_terminal"
  | "bkash"
  | "bangla_qr"
  | "voucher"
  | "credit";

export interface Counter {
  id: ID;
  name: string;
  locationId: ID;
  allowedProductIds: ID[] | "all";
  allowedPaymentMethods: PaymentMethod[];
  status: Lifecycle;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  // NOTE: runtime open/closed state lives on a future Shift entity, not here.
}

// ── Role ───────────────────────────────────────────────────────────────────
export type Permission = string; // tighten to a union at the Roles screen

export interface Role {
  id: ID;
  name: string;
  permissions: Permission[];
  refundLimit: Minor | null; // null = unlimited
  discountLimitPct: number | null; // integer percent 0–100; null = unlimited
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ── Staff ──────────────────────────────────────────────────────────────────
export type StaffStatus = "invited" | "active" | "suspended";

export interface Staff {
  id: ID;
  name: string;
  email: string | null; // validation: at least one of email/phone required
  phone: string | null;
  roleId: ID;
  locationIds: ID[];
  counterIds: ID[];
  status: StaffStatus;
  lastActiveAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  // POS PIN is set/verified via a dedicated auth call; never on this shape.
}

// ── Input payloads (create/update) ─────────────────────────────────────────
// Create omits server-assigned fields; update is a partial of the same.
type Assigned = "id" | "createdAt" | "updatedAt" | "archivedAt";

export type PriceTierInput = Omit<PriceTier, "id"> & { id?: ID };

export type ProductInput = Omit<Product, Assigned | "tiers"> & {
  tiers: PriceTierInput[];
};
export type ProductPatch = Partial<ProductInput>;

export type CategoryInput = Omit<Category, "id" | "createdAt" | "updatedAt">;
export type CategoryPatch = Partial<CategoryInput>;

export type LocationInput = Omit<Location, Assigned>;
export type LocationPatch = Partial<LocationInput>;

export type CounterInput = Omit<Counter, "id" | "createdAt" | "updatedAt">;
export type CounterPatch = Partial<CounterInput>;

export type RoleInput = Omit<Role, "id" | "createdAt" | "updatedAt">;
export type RolePatch = Partial<RoleInput>;

export type StaffInput = Omit<Staff, "id" | "createdAt" | "updatedAt" | "lastActiveAt">;
export type StaffPatch = Partial<StaffInput>;

// ── Orders / payments / tickets / bookings ─────────────────────────────────
export type OrderStatus = "paid" | "pending" | "partial" | "refunded" | "cancelled";

export interface OrderLine {
  id: ID;
  productId: ID;
  productName: string; // denormalised for display/audit at time of sale
  tierName: string;
  quantity: number;
  unitPrice: Minor;
}

export interface Payment {
  id: ID;
  method: PaymentMethod;
  amount: Minor;
  at: ISODateTime;
}

export interface Order {
  id: ID;
  reference: string; // "CF-2026-008479"
  status: OrderStatus;
  channel: Channel;
  locationId: ID;
  counterId: ID | null;
  staffId: ID | null;
  customerName: string | null;
  lines: OrderLine[];
  payments: Payment[];
  subtotal: Minor;
  tax: Minor;
  total: Minor;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type TicketStatus = "issued" | "redeemed" | "void";
export interface Ticket {
  id: ID;
  code: string; // "CF-2026-008479-01"
  orderId: ID;
  productId: ID;
  tierName: string;
  status: TicketStatus;
  validFor: ISODate;
  redeemedAt: ISODateTime | null;
}

export type BookingStatus = "confirmed" | "cancelled";
export interface Booking {
  id: ID;
  orderId: ID;
  productId: ID;
  locationId: ID;
  slotStart: ISODateTime;
  partySize: number;
  status: BookingStatus;
}

// ── List / pagination / filtering ──────────────────────────────────────────
export interface ListParams<F = Record<string, unknown>> {
  page?: number; // 1-based
  pageSize?: number;
  sort?: string; // field key
  order?: "asc" | "desc";
  search?: string;
  filters?: F;
}

export interface PageInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ListResponse<T> {
  data: T[];
  page: PageInfo;
}

// ── Errors ─────────────────────────────────────────────────────────────────
export type ApiErrorCode =
  | "validation"
  | "not_found"
  | "conflict"
  | "permission_denied"
  | "unauthenticated"
  | "rate_limited"
  | "network"
  | "server";

export interface ApiError {
  code: ApiErrorCode;
  message: string; // human-facing
  fieldErrors?: Record<string, string>; // form field → message (validation)
  requestId?: string;
}

/** Every api function returns this. Callers must handle the failure path. */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };
