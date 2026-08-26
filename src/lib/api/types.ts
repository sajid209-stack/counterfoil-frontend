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
/** A resource-level price adjustment (centre court costs more than court 4).
 *  Resolution order: pricing model → time-band rules → this override. */
export interface ResourceRateOverride {
  kind: "premium" | "replace";
  amount: Minor; // premium: added per booking · replace: the hourly rate
}

export interface Resource {
  id: ID;
  name: string; // "Field 1"
  nounSingular: string; // "Field"
  nounPlural: string; // "Fields"
  locationId: ID | null;
  outOfService: boolean;
  outOfServiceReason: string | null;
  rateOverride?: ResourceRateOverride | null;
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
  smsTemplate?: string; // ticket SMS body with {{placeholders}}
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
export type OperatorPatch = Partial<
  Pick<Operator, "name" | "currency" | "defaultTimezone" | "taxRatePct" | "reducedRatePct" | "smsTemplate">
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
  price: Minor; // for donation tiers this is the MINIMUM (suggested floor)
  maxPerOrder?: number; // tier cap; must be ≤ Product.maxPerOrder if both set
  admits?: number; // how many people this ticket admits (default 1; Family = 4)
  ageNote?: string; // e.g. "5–12" — printed on the ticket
  donation?: boolean; // pay-what-you-want: the buyer/staff enters the amount (≥ price)
  active: boolean;
}

// ── The duration engine (liquid time — flexible resource products) ──────────
export type DurationPricingModel = "list" | "hourly" | "base_extension";

/** How a flexible product books time. Valid durations = min + n×increment.
 *  Time-band PricingRules layer on top of whichever model is chosen. */
export interface DurationConfig {
  minMinutes: number; // nothing shorter is bookable
  maxMinutes: number; // cap per booking
  incrementMinutes: number; // must divide (max − min)
  pricingModel: DurationPricingModel;
  priceList?: Record<number, Minor>; // "list": explicit price per duration
  hourlyRate?: Minor; // "hourly": one rate, prorated per increment
  basePrice?: Minor; // "base_extension": the first block (minMinutes)
  extensionPrice?: Minor; // "base_extension": each additional increment
  mustEndByClose: boolean; // on: latest start = close − duration
  walkInRoundMinutes: number; // "Start now" rounds to this
  leadTimeMinutes: number; // minimum notice before start
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
  waiver?: boolean; // requires waiver acknowledgement at sale
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
  validityMode?: "unlimited" | "days" | "same_day"; // BT-01 validity after purchase
  validityDays?: number; // BT-01 ("days" mode) / BT-02 window length
  windowMode?: "rolling" | "fixed"; // BT-02: N days from purchase vs season dates
  windowStart?: ISODate; // BT-02 fixed/season window
  windowEnd?: ISODate;
  schedule?: ProductSchedule | null; // slot/capacity timing (BT-03/04/06/09)
  sessionNames?: Record<string, string>; // BT-03: "11:00" → "Morning show"
  // Resource booking (BT-04 exclusive fields, BT-05 flexible lanes):
  resourceIds?: ID[]; // resources this product can be booked on
  resourceExclusive?: boolean; // one booking at a time per resource (BT-04) vs shared (BT-05)
  bufferMinutes?: number; // gap between bookings for changeover/cleaning
  flexibleDurations?: number[]; // BT-05 selectable durations (derived from durationConfig)
  durationConfig?: DurationConfig | null; // BT-05/BT-14 — the duration engine
  pricingRules?: PricingRule[]; // time/day price overrides, first match wins
  sections?: ProductSection[]; // BT-07 named sections (Stalls/Balcony/VIP)
  providerIds?: ID[]; // BT-10 people who deliver this
  providerNoun?: string; // "Therapist" / "Instructor"
  providerPickable?: boolean; // BT-10 choose by name vs first-available
  providerPremiums?: Record<ID, Minor>; // per-provider surcharge (Karim +৳500)
  providerDurations?: Record<ID, number[]>; // per-provider offered durations
  minPartyToRun?: number; // BT-09: departure runs only with N+ booked
  meetingPoint?: string; // BT-09: printed on the ticket
  creditsPerBooking?: number; // BT-12: credits one booking costs (default 1)
  joinPartway?: boolean; // BT-13: can enrol after the course starts
  passIdentifierLabel?: string; // BT-14: "Plate number"
  bundleComponentIds?: ID[]; // BT-08 products combined into this ticket
  credits?: { count: number; expiryDays: number; productIds: ID[] } | null; // BT-12
  courseDates?: ISODate[]; // BT-13 session dates
  waitlistEnabled?: boolean; // BT-11
  pricingBasis?: "per_person" | "per_booking"; // tiers × people vs flat per session
  taxClass?: TaxClass; // which tax rate applies (default standard)
  addOns?: AddOn[]; // optional extras offered at POS
  policies?: ProductPolicies; // operational policies (sales window, cancellation…)
  layoutId?: ID | null; // BT-07 seated: the seat layout this product sells (M1)
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
export type OrderStatus = "paid" | "pending" | "partial" | "refunded" | "partly_refunded" | "cancelled";

/** What was booked, snapshotted onto the line at time of sale. */
export interface OrderLineBooking {
  date: ISODate;
  startTime?: string; // "18:00"
  endTime?: string;
  resourceId?: ID;
  resourceName?: string; // snapshot — renaming Field 1 must not rewrite history
  providerId?: ID;
  providerName?: string;
  durationMinutes?: number;
  guests?: number;
}

/** One sold thing. EVERYTHING here is a snapshot at time of sale — names,
 *  prices and rates are stored, never looked up, so reports can't change
 *  retrospectively when a product is edited. Revenue attributes per line. */
export interface OrderLine {
  id: ID;
  parentLineId?: ID; // set on add-on lines (bib hire under the Field 1 booking)
  productId: ID;
  productName: string;
  tierId?: ID;
  tierName: string;
  admits: number; // people per unit (Family = 4); 0 for add-ons
  quantity: number;
  unitPrice: Minor; // resolved price at time of sale
  subtotal: Minor; // unitPrice × quantity
  lineDiscount: Minor; // applied directly to this line
  allocatedOrderDiscount: Minor; // this line's pro-rata share of the cart discount
  taxableAmount: Minor; // subtotal − lineDiscount − allocatedOrderDiscount
  taxClass: TaxClass;
  taxRate: number; // snapshot fraction, e.g. 0.15
  taxAmount: Minor;
  total: Minor; // taxableAmount + taxAmount
  booking?: OrderLineBooking;
  // structure now, UI later
  refundedQuantity: number;
  refundedAmount: Minor;
}

export type PaymentStatus = "pending" | "confirmed" | "failed";
export interface Payment {
  id: ID;
  method: PaymentMethod;
  amount: Minor;
  tendered?: Minor; // cash
  change?: Minor; // cash
  reference?: string; // bKash txn id etc.
  status: PaymentStatus;
  createdAt: ISODateTime;
}

export interface Order {
  id: ID;
  reference: string; // "CF-2026-008479"
  status: OrderStatus;
  channel: Channel;
  locationId: ID;
  counterId: ID | null;
  staffId: ID | null;
  shiftId?: ID | null;
  customerName: string | null;
  lines: OrderLine[];
  payments: Payment[];
  subtotal: Minor; // sum of line subtotals
  lineDiscountTotal: Minor; // sum of line-level discounts
  orderDiscount: Minor; // cart-level discount, before allocation
  discountTotal: Minor; // lineDiscountTotal + orderDiscount
  taxTotal: Minor; // SUM OF LINE TAXES — never computed on the order total
  total: Minor;
  /** Who did what and when — refunds, resends, date changes. */
  history?: { at: ISODateTime; who: string; text: string }[];
  /** Internal notes, never shown to guests. */
  notes?: { at: ISODateTime; who: string; text: string }[];
  /** Balance cleared without a refund (bad debt / dispute / goodwill). */
  writeOffs?: { at: ISODateTime; who: string; amount: Minor; category: WriteOffCategory; reason: string }[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
export type WriteOffCategory = "uncollectible" | "customer_dispute" | "business_decision" | "administrative";

export type TicketStatus = "issued" | "redeemed" | "void";
export interface Ticket {
  id: ID;
  code: string; // "CF-2026-008479-01"
  orderId: ID;
  lineId?: ID; // which order line minted it — a scan traces back to the sale
  productId: ID;
  tierName: string;
  admits?: number; // snapshot from the line (Family = 4); fallback: tier lookup
  status: TicketStatus;
  validFor: ISODate;
  redeemedAt: ISODateTime | null;
  creditsUsed?: number; // BT-12 packs: credits spent against this pass so far
  admitted?: number; // group tickets: people through the gate so far (3 of 4)
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
  noShow?: boolean; // recorded no-show (with an optional reason)
  noShowReason?: string;
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

// ═══════════════════════════════════════════════════════════════════════════
// Milestone 1 — surfaces modeled on the real backend OpenAPI contracts.
// Field names/enums mirror `counterfoil-app/application` so the eventual
// client.ts → SDK swap is mechanical. Money stays INTEGER minor units.
// ═══════════════════════════════════════════════════════════════════════════

// ── payments.v2 · PaymentAccount — the operator's connected PSP account ──────
export type PaymentProvider = "stripe" | "sslcommerz" | "bkash";
export type PaymentPosture = "merchant_of_record" | "connect";
export type PaymentAccountStatus =
  | "pending_onboarding"
  | "active"
  | "restricted"
  | "disabled";
export interface PaymentAccount {
  id: ID;
  locationId: ID | null; // null = tenant-wide
  provider: PaymentProvider;
  posture: PaymentPosture;
  status: PaymentAccountStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirementsDue: string[]; // outstanding onboarding items
  country: string; // ISO-3166 alpha-2
  defaultCurrency: CurrencyCode;
  providerAccountRef?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
export type PaymentAccountInput = Pick<
  PaymentAccount,
  "provider" | "posture" | "locationId" | "country" | "defaultCurrency"
>;
/** Hosted onboarding link returned when connecting a provider. */
export interface AccountLink {
  url: string;
  expiresAt: ISODateTime;
}

// ── settings.v2 · TaxConfig — tenant/location tax mode + rate ────────────────
export type TaxMode = "inclusive" | "exclusive";
export interface TaxConfig {
  mode: TaxMode;
  rateBasisPoints: number; // 1500 = 15%
  taxName: string; // "VAT"
  registrationNumber?: string;
}

// ── catalog.v1 · seat maps (layouts / seats / seat-categories) ───────────────
export type SeatPricingMode = "fixed" | "inherit";
export interface SeatCategory {
  uid: ID;
  name: string; // "Stalls", "Balcony", "VIP"
  color: string; // hex for the map (e.g. "#F94A00")
  price: Minor;
  pricingMode: SeatPricingMode;
  isGeneralAdmission: boolean;
  gaCapacity?: number; // when GA, capacity of the standing area
}
export type SeatShape = "square" | "circle";
export interface LayoutSeat {
  id: ID;
  name: string; // seat label, e.g. "A1"
  posX: number; // grid column (0-based)
  posY: number; // grid row (0-based)
  seatRow: string; // row label, e.g. "A"
  seatNumber: number;
  seatCategoryId: ID | null; // null = not for sale / aisle gap
  isAvailable: boolean; // false = blocked/held/sold
  capacity: number; // seats admitted (usually 1; GA blocks > 1)
  shape: SeatShape;
  width: number;
  height: number;
  rotation: number;
  assignOrder: number; // best-available fill order
}
export interface SeatLayout {
  id: ID;
  locationId: ID | null;
  name: string;
  rows: number;
  seatsPerRow: number;
  rowLabels: string[]; // ["A","B",…]
  bufferAfterMinutes: number;
  seatCount: number;
  categories: SeatCategory[];
  seats: LayoutSeat[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
export type SeatLayoutInput = Pick<
  SeatLayout,
  "name" | "locationId" | "rows" | "seatsPerRow" | "rowLabels" | "bufferAfterMinutes"
>;
/** Read shape for the POS/storefront seat picker (catalog available-seats). */
export interface AvailableSeat {
  label: string;
  available: boolean;
  section: string; // category name
  categoryUid: ID;
  categoryName: string;
  color: string;
  price: Minor;
  posX: number;
  posY: number;
}
/** Link between a product and a seat layout (ConfigLayoutLink). */
export interface ConfigLayoutLink {
  layoutId: ID;
  name: string;
  isPrimary: boolean;
  seatCount: number;
}

// ── promotions.v2 · discounts, coupons, manual-discount policy ───────────────
export type PromotionKind =
  | "percentage_off"
  | "fixed_amount_off"
  | "buy_x_get_y"
  | "fixed_price"
  | "bundle_price";
export type PromotionSource = "coupon" | "manual" | "membership" | "automatic";
export interface BuyXGetYConfig { buyQuantity: number; getQuantity: number; getDiscountBps: number; }
export interface BundleConfig { bundlePrice: Minor; componentSkus: ID[]; }
export interface PromotionEligibility {
  channels: Channel[];
  minSubtotal?: Minor;
  minQuantity?: number;
  firstPurchaseOnly?: boolean;
  eligibleCategories?: ID[];
  excludedCategories?: ID[];
}
export interface PromotionStacking { stackable: boolean; exclusive: boolean; }
export interface Promotion {
  id: ID;
  locationId: ID | null;
  name: string;
  kind: PromotionKind;
  source: PromotionSource;
  percentBps?: number; // percentage_off (1000 = 10%)
  amount?: Minor; // fixed_amount_off / fixed_price
  buyXGetY?: BuyXGetYConfig;
  bundle?: BundleConfig;
  maxDiscountAmount?: Minor;
  eligibility: PromotionEligibility;
  stacking: PromotionStacking;
  maxUsesTotal?: number;
  maxUsesPerCustomer?: number;
  validFrom?: ISODate;
  validTo?: ISODate;
  status: Lifecycle;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
export type PromotionInput = Omit<Promotion, "id" | "createdAt" | "updatedAt">;
export interface Coupon {
  id: ID;
  promotionId: ID;
  code: string;
  status: "active" | "disabled" | "exhausted";
  maxUsesTotal?: number;
  maxUsesPerCustomer?: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
export interface ManualDiscountPolicy {
  locationId: ID | null;
  maxPercentBps: number; // cap on ad-hoc cashier %
  maxAmount?: Minor;
  requireReason: boolean;
}
export interface AppliedPromotion {
  promotionId: ID;
  kind: PromotionKind;
  source: PromotionSource;
  code?: string;
  name: string;
  discount: Minor; // total minor units discounted
}
/** A cart line as the promotions engine sees it (promotions QuoteRequest). */
export interface QuoteLine {
  lineId: string;
  quantity: number;
  unitAmount: Minor;
  categoryId?: ID | null;
}
export interface PromotionQuote {
  subtotal: Minor;
  discountTotal: Minor;
  netTotal: Minor;
  applied: AppliedPromotion[];
  rejected: { code: string; reason: string }[];
}
