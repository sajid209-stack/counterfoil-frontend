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
// The full 14-type classification. DERIVED from the wizard's plain questions;
// never assembled by hand and never shown (except read-only in Advanced).
export type BookingTypeCode =
  | "BT-01" // open — any time
  | "BT-02" // date, validity window
  | "BT-03" // fixed time slot
  | "BT-04" // resource, exclusive (turf field)
  | "BT-05" // resource, flexible duration (bowling lane)
  | "BT-06" // daily capacity cap
  | "BT-07" // sections / seated
  | "BT-08" // multi-attraction bundle
  | "BT-09" // guided / departure
  | "BT-10" // provider (person)
  | "BT-11" // waitlist (modifier)
  | "BT-12" // package / credits
  | "BT-13" // course / series
  | "BT-14"; // field-issued pass

// ── Resources — first-class, shared across products ─────────────────────────
// Availability is computed PER RESOURCE across every product attached to it,
// so two products on the same field block each other. Named with the operator's
// own word (Field / Court / Lane / Room / Table / Studio).
export interface Resource {
  id: ID;
  name: string; // "Field 1"
  nounSingular: string; // "Field"
  nounPlural: string; // "Fields"
  locationId: ID | null;
  outOfService: boolean;
  outOfServiceReason: string | null;
  status: Lifecycle;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
export type ResourceInput = Omit<Resource, "id" | "createdAt" | "updatedAt">;
export type ResourcePatch = Partial<ResourceInput>;

// ── Operator (tenant) ──────────────────────────────────────────────────────
export interface Operator {
  id: ID;
  name: string;
  currency: CurrencyCode; // every Minor in the system is denominated in this
  defaultTimezone: string; // "Asia/Dhaka"
  taxRatePct: number; // STANDARD sales tax / VAT percent, e.g. 15
  reducedRatePct?: number; // reduced tax class rate, e.g. 7.5
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
export type OperatorPatch = Partial<
  Pick<Operator, "name" | "currency" | "defaultTimezone" | "taxRatePct" | "reducedRatePct">
>;

export type TaxClass = "standard" | "reduced" | "exempt";

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

/** A time/day price override. Rules are checked top-to-bottom; first match wins. */
export interface PricingRule {
  id: ID;
  days: number[]; // 0–6; empty = any day
  fromTime: string; // "18:00"
  toTime: string; // "23:00"
  price: Minor; // resolved slot price when this rule matches
}

/** A named section for BT-07 (Stalls / Balcony / VIP) — sections, not seat maps. */
export interface ProductSection {
  id: ID;
  name: string;
  capacity: number;
  price: Minor;
}

export interface PriceTier {
  id: ID;
  name: string; // "Adult", "Child", "Senior"
  price: Minor;
  maxPerOrder?: number; // tier cap; must be ≤ Product.maxPerOrder if both set
  admits?: number; // how many people this ticket admits (default 1; Family = 4)
  ageNote?: string; // e.g. "5–12" — printed on the ticket
  active: boolean;
}

/** An optional extra attached to a product (shoe hire, bibs, oils). */
export interface AddOn {
  id: ID;
  name: string;
  price: Minor;
  perPerson: boolean;
}

/** Operational policies around a booking. Sensible defaults; edited post-create. */
export interface ProductPolicies {
  salesWindowDays: number; // bookable up to N days ahead
  cutoffMinutes: number; // sales cut off N min before start
  cancellation: "none" | "free_until" | "fee";
  cancelHours: number;
  cancelFeePct: number;
  reschedule: "none" | "until";
  rescheduleHours: number;
  reentry: "single" | "same_day" | "while_valid";
  deposit: "full" | "percent";
  depositPct: number;
  partyMin: number;
  partyMax: number;
}

/** A closure or custom-hours date. `times` only for kind "custom". */
export interface ScheduleException {
  date: ISODate;
  kind: "closed" | "custom";
  times?: string[];
}

/** Different hours on a specific weekday (Fri 14:00–23:00 while other days
 *  run the schedule's base hours). Keyed by day-of-week 0–6. */
export interface DayHours {
  startTime: string; // "14:00"
  endTime: string; // "23:00"
}

/** Schedule config for timed products. Present only for BT-03 / BT-06 / BT-09;
 *  null for open (BT-01) and date-range (BT-02) products.
 *  - slot-based (BT-03/09): slotMinutes/startTime/endTime/capacityPerSession
 *  - daily-capped (BT-06): dailyCapacity + openDays only */
export interface ProductSchedule {
  slotMinutes: number; // interval between session starts
  sessionMinutes: number; // how long each session lasts
  startTime: string; // "10:00"
  endTime: string; // "16:30"
  capacityPerSession: number; // seats per slot (BT-03/09)
  dailyCapacity: number | null; // BT-06 (null for slot-based)
  openDays: number[]; // 0–6
  dayOverrides?: Record<number, DayHours>; // per-day hours that differ from base
  guideIds: string[]; // BT-09 — team members who can lead
  exceptions: ScheduleException[];
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
  schedule?: ProductSchedule | null; // slot/capacity timing (BT-03/04/06/09)
  // Resource booking (BT-04 exclusive fields, BT-05 flexible lanes):
  resourceIds?: ID[]; // resources this product can be booked on
  resourceExclusive?: boolean; // one booking at a time per resource (BT-04) vs shared (BT-05)
  bufferMinutes?: number; // gap between bookings for changeover/cleaning
  flexibleDurations?: number[]; // BT-05 selectable durations, minutes
  pricingRules?: PricingRule[]; // time/day price overrides, first match wins
  sections?: ProductSection[]; // BT-07 named sections (Stalls/Balcony/VIP)
  providerIds?: ID[]; // BT-10 people who deliver this
  providerNoun?: string; // "Therapist" / "Instructor"
  providerPickable?: boolean; // BT-10 choose by name vs first-available
  providerPremiums?: Record<ID, Minor>; // per-provider surcharge (Karim +৳500)
  bundleComponentIds?: ID[]; // BT-08 products combined into this ticket
  credits?: { count: number; expiryDays: number; productIds: ID[] } | null; // BT-12
  courseDates?: ISODate[]; // BT-13 session dates
  waitlistEnabled?: boolean; // BT-11
  taxClass?: TaxClass; // which tax rate applies (default standard)
  addOns?: AddOn[]; // optional extras offered at POS
  policies?: ProductPolicies; // operational policies (sales window, cancellation…)
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

// ── Devices — tablets paired to a counter ──────────────────────────────────
export interface Device {
  id: ID;
  name: string;
  counterId: ID | null;
  pairingCode: string; // shown once at registration
  status: Lifecycle;
  lastSeenAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
export type DeviceInput = Pick<Device, "name" | "counterId" | "status">;
export type DevicePatch = Partial<DeviceInput>;

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
  creditsUsed?: number; // BT-12 packs: credits spent against this pass so far
}

export type BookingStatus = "confirmed" | "cancelled";
export interface Booking {
  id: ID;
  orderId: ID;
  productId: ID;
  locationId: ID;
  resourceId?: ID | null; // set for resource bookings; blocks that resource+slot
  slotStart: ISODateTime;
  slotEnd?: ISODateTime; // for flexible/duration bookings
  partySize: number;
  checkedIn?: number; // people checked in so far (partial groups: 3 of 4)
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
