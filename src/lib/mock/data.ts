/* ───────────────────────────────────────────────────────────────────────────
   Realistic seed data for the mock API layer.

   IMPORTANT: nothing outside `src/lib/api/client.ts` may import this file.
   Components talk to `src/lib/api/*` only. Money is minor units (paisa) in BDT.
   ────────────────────────────────────────────────────────────────────────── */
import type {
  BookingRule,
  Category,
  Counter,
  Customer,
  Device,
  Hold,
  LoyaltyEntry,
  LoyaltyProgram,
  Membership,
  MembershipTier,
  Location,
  Coupon,
  LayoutSeat,
  ManualDiscountPolicy,
  Operator,
  PaymentAccount,
  PriceRule,
  Product,
  Promotion,
  Resource,
  Role,
  SeatLayout,
  Staff,
  TaxConfig,
} from "@/lib/api/types";
import { generateSales } from "./generate";
import { demoDay } from "@/lib/schedule";
import { buildOrderLines } from "@/lib/orderMath";
import type { Order } from "@/lib/api/types";

const T = "2026-01-15T10:00:00+06:00"; // stable seed timestamp

export const operator: Operator = {
  id: "op_lalbagh",
  name: "Lalbagh Heritage Attractions",
  currency: "BDT",
  defaultTimezone: "Asia/Dhaka",
  taxRatePct: 15,
  reducedRatePct: 7.5,
  createdAt: T,
  updatedAt: T,
};

// Money setup (M1): one live bKash merchant-of-record account + tax config.
export const paymentAccounts: PaymentAccount[] = [
  {
    id: "pacct_bkash",
    locationId: null,
    provider: "bkash",
    posture: "merchant_of_record",
    status: "active",
    chargesEnabled: true,
    payoutsEnabled: true,
    requirementsDue: [],
    country: "BD",
    defaultCurrency: "BDT",
    providerAccountRef: "bka_live_8842",
    createdAt: T,
    updatedAt: T,
  },
];

export const taxConfig: TaxConfig = {
  mode: "exclusive",
  rateBasisPoints: 1500, // 15% VAT
  taxName: "VAT",
  registrationNumber: "BIN-000123456-0201",
};

// Seat maps (M1): a cinema hall — 8 rows × 12, Stalls (A–F) + Balcony (G–H),
// a few seats pre-sold so the POS picker shows real unavailability.
function buildCinemaSeats(): LayoutSeat[] {
  const rows = 8, per = 12;
  const sold = new Set(["A5", "A6", "D7", "D8", "G1", "G2"]);
  const seats: LayoutSeat[] = [];
  let order = 0;
  for (let r = 0; r < rows; r++) {
    const label = String.fromCharCode(65 + r);
    const catId = r < 6 ? "cat_stalls" : "cat_balcony";
    for (let c = 0; c < per; c++) {
      const name = `${label}${c + 1}`;
      seats.push({
        id: `seat_${name}`, name, posX: c, posY: r, seatRow: label, seatNumber: c + 1,
        seatCategoryId: catId, isAvailable: !sold.has(name), capacity: 1,
        shape: "square", width: 1, height: 1, rotation: 0, assignOrder: order++,
      });
    }
  }
  return seats;
}

export const seatLayouts: SeatLayout[] = [
  {
    id: "layout_cinema",
    locationId: null,
    name: "Main Hall",
    rows: 8,
    seatsPerRow: 12,
    rowLabels: ["A", "B", "C", "D", "E", "F", "G", "H"],
    bufferAfterMinutes: 15,
    seatCount: 96,
    categories: [
      { uid: "cat_stalls", name: "Stalls", color: "#F94A00", price: 40000, pricingMode: "fixed", isGeneralAdmission: false },
      { uid: "cat_balcony", name: "Balcony", color: "#2563EB", price: 70000, pricingMode: "fixed", isGeneralAdmission: false },
    ],
    seats: buildCinemaSeats(),
    createdAt: T,
    updatedAt: T,
  },
];

// Promotions (M1): a coupon %-off, an automatic BXGY, and the cashier policy.
export const promotions: Promotion[] = [
  {
    id: "promo_welcome", locationId: null, name: "Welcome 10%", kind: "percentage_off", source: "coupon",
    percentBps: 1000, maxDiscountAmount: 50000,
    eligibility: { channels: ["counter", "online"], minSubtotal: 20000 },
    stacking: { stackable: true, exclusive: false },
    maxUsesTotal: 500, maxUsesPerCustomer: 1, status: "active", createdAt: T, updatedAt: T,
  },
  {
    id: "promo_bxgy", locationId: null, name: "Buy 3 tours, 4th half price", kind: "buy_x_get_y", source: "automatic",
    buyXGetY: { buyQuantity: 3, getQuantity: 1, getDiscountBps: 5000 },
    eligibility: { channels: ["counter", "online"], eligibleCategories: ["cat_tours"] },
    stacking: { stackable: false, exclusive: true }, status: "active", createdAt: T, updatedAt: T,
  },
];

export const coupons: Coupon[] = [
  { id: "cpn_welcome", promotionId: "promo_welcome", code: "WELCOME10", status: "active", maxUsesTotal: 500, maxUsesPerCustomer: 1, createdAt: T, updatedAt: T },
];

export const manualDiscountPolicy: ManualDiscountPolicy = {
  locationId: null,
  maxPercentBps: 1000, // cashiers can give up to 10% ad-hoc
  requireReason: true,
};

export const categories: Category[] = [
  { id: "cat_entry", name: "Admission", sortOrder: 1, active: true, createdAt: T, updatedAt: T },
  { id: "cat_tours", name: "Guided Tours", sortOrder: 2, active: true, createdAt: T, updatedAt: T },
  { id: "cat_events", name: "Events", sortOrder: 3, active: true, createdAt: T, updatedAt: T },
  { id: "cat_addons", name: "Add-ons", sortOrder: 4, active: true, createdAt: T, updatedAt: T },
];

export const locations: Location[] = [
  {
    id: "loc_fort",
    name: "Lalbagh Fort",
    addressLine1: "Lalbagh Rd",
    city: "Dhaka",
    country: "Bangladesh",
    timezone: "Asia/Dhaka",
    openingHours: [
      { dayOfWeek: 0, intervals: [{ opensAt: "10:00", closesAt: "18:00" }] },
      { dayOfWeek: 1, intervals: [] },
      { dayOfWeek: 2, intervals: [{ opensAt: "10:00", closesAt: "18:00" }] },
      { dayOfWeek: 3, intervals: [{ opensAt: "10:00", closesAt: "18:00" }] },
      { dayOfWeek: 4, intervals: [{ opensAt: "10:00", closesAt: "18:00" }] },
      { dayOfWeek: 5, intervals: [{ opensAt: "14:30", closesAt: "20:00" }] },
      { dayOfWeek: 6, intervals: [{ opensAt: "10:00", closesAt: "20:00" }] },
    ],
    status: "active",
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "loc_museum",
    name: "Ahsan Manzil Museum",
    addressLine1: "Kumartoli",
    city: "Dhaka",
    country: "Bangladesh",
    timezone: "Asia/Dhaka",
    openingHours: [
      { dayOfWeek: 6, intervals: [{ opensAt: "10:00", closesAt: "17:30" }] },
      { dayOfWeek: 0, intervals: [{ opensAt: "10:00", closesAt: "17:30" }] },
    ],
    status: "active",
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "loc_garden",
    name: "Baldha Garden",
    addressLine1: "Wari",
    city: "Dhaka",
    country: "Bangladesh",
    timezone: "Asia/Dhaka",
    openingHours: [],
    status: "inactive",
    createdAt: T,
    updatedAt: T,
  },
];

export const products: Product[] = [
  {
    id: "prd_admission",
    name: "General Admission",
    description: "Same-day entry to the grounds. Come any time we're open.",
    images: [],
    categoryId: "cat_entry",
    bookingType: "BT-01",
    tiers: [
      { id: "tier_adult", name: "Adult", price: 50000, admits: 1, active: true },
      { id: "tier_child", name: "Child", price: 30000, maxPerOrder: 6, admits: 1, ageNote: "5–12", active: true },
      { id: "tier_senior", name: "Senior", price: 40000, admits: 1, active: true },
      { id: "tier_family", name: "Family", price: 140000, admits: 4, ageNote: "2 adults + 2 children", active: true },
    ],
    locationIds: ["loc_fort"],
    channels: ["counter", "online"],
    status: "active",
    archivedAt: null,
    schedule: null,
    maxPerOrder: 20,
    validityMode: "same_day",
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "prd_winter",
    name: "Winter Exhibition Pass",
    description: "Valid any day from 1 December to 28 February. Pick a date.",
    images: [{ id: "img_winter", url: "/seed/winter.jpg", alt: "Winter exhibition gallery" }],
    categoryId: "cat_events",
    bookingType: "BT-02",
    tiers: [
      { id: "tier_w_adult", name: "Adult", price: 80000, active: true },
      { id: "tier_w_child", name: "Child", price: 50000, active: true },
    ],
    locationIds: ["loc_museum"],
    channels: ["counter", "online"],
    status: "active",
    archivedAt: null,
    schedule: null,
    maxPerOrder: 10,
    validityDays: 90,
    windowMode: "fixed",
    windowStart: "2026-12-01",
    windowEnd: "2027-02-28",
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "prd_planetarium",
    name: "Planetarium Show",
    description: "A 45-minute show. Pick a start time.",
    images: [{ id: "img_planetarium", url: "/seed/planetarium.jpg", alt: "Planetarium dome show" }],
    categoryId: "cat_events",
    bookingType: "BT-03",
    tiers: [
      { id: "tier_p_adult", name: "Adult", price: 60000, active: true },
      { id: "tier_p_child", name: "Child", price: 40000, active: true },
    ],
    locationIds: ["loc_museum"],
    channels: ["counter", "online"],
    status: "active",
    archivedAt: null,
    schedule: {
      slotMinutes: 45,
      sessionMinutes: 45,
      startTime: "11:00",
      endTime: "16:30",
      capacityPerSession: 40,
      dailyCapacity: null,
      openDays: [0, 2, 3, 4, 5, 6],
      guideIds: [],
      exceptions: [],
    },
    sessionNames: { "11:00": "Morning show", "16:15": "Twilight show" },
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "prd_garden",
    name: "Sculpture Garden",
    description: "Open daily. Capped so it never gets crowded.",
    images: [],
    categoryId: "cat_entry",
    bookingType: "BT-06",
    tiers: [{ id: "tier_g_flat", name: "Entry", price: 35000, active: true }],
    locationIds: ["loc_fort"],
    channels: ["counter", "online"],
    status: "active",
    archivedAt: null,
    schedule: {
      slotMinutes: 30,
      sessionMinutes: 30,
      startTime: "10:00",
      endTime: "18:00",
      capacityPerSession: 0,
      dailyCapacity: 200,
      openDays: [0, 1, 2, 3, 4, 5, 6],
      guideIds: [],
      exceptions: [],
    },
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "prd_tour",
    name: "Heritage Walking Tour",
    description: "A guided walk. Pick a departure — a guide leads each one.",
    images: [{ id: "img_tour", url: "/seed/tour.jpg", alt: "Old city heritage street" }],
    categoryId: "cat_tours",
    bookingType: "BT-09",
    tiers: [
      { id: "tier_t_adult", name: "Adult", price: 120000, active: true },
      { id: "tier_t_child", name: "Child", price: 80000, active: true },
    ],
    locationIds: ["loc_fort", "loc_museum"],
    channels: ["counter", "online"],
    status: "active",
    archivedAt: null,
    minAge: 8,
    schedule: {
      slotMinutes: 240,
      sessionMinutes: 90,
      startTime: "10:00",
      endTime: "14:00",
      capacityPerSession: 15,
      dailyCapacity: null,
      openDays: [5, 6, 0],
      guideIds: ["stf_ayesha", "stf_rahim"],
      exceptions: [],
    },
    minPartyToRun: 4,
    meetingPoint: "Fort main gate",
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "prd_tour2",
    name: "Sculpture Garden Tour",
    description: "A guided garden walk — same guides as the heritage tour, so 10:00 can only run one of them.",
    images: [],
    categoryId: "cat_tours",
    bookingType: "BT-09",
    tiers: [{ id: "tier_t2_all", name: "Ticket", price: 90000, active: true }],
    locationIds: ["loc_fort"],
    channels: ["counter", "online"],
    status: "active",
    archivedAt: null,
    schedule: {
      slotMinutes: 240, sessionMinutes: 90, startTime: "10:00", endTime: "14:00",
      capacityPerSession: 12, dailyCapacity: null, openDays: [5, 6, 0],
      guideIds: ["stf_ayesha", "stf_rahim"], exceptions: [],
    },
    minPartyToRun: 3,
    meetingPoint: "Garden gate",
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "prd_reentry",
    name: "All-Day Re-entry Pass",
    description: "Come and go all day — the gate re-admits while it's valid.",
    images: [],
    categoryId: "cat_entry",
    bookingType: "BT-01",
    tiers: [{ id: "tier_re", name: "Day pass", price: 80000, active: true }],
    locationIds: ["loc_fort"],
    channels: ["counter", "online"],
    status: "active",
    archivedAt: null,
    schedule: null,
    validityMode: "same_day",
    policies: { salesWindowDays: 90, cutoffMinutes: 0, cancellation: "free_until", cancelHours: 24, cancelFeePct: 0, reschedule: "until", rescheduleHours: 24, reentry: "same_day", deposit: "full", depositPct: 0, partyMin: 1, partyMax: 20 },
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "prd_football", name: "Football — Turf", description: "Book a field for an hour. A team per slot.", images: [], categoryId: "cat_events", bookingType: "BT-04",
    tiers: [{ id: "tier_fb_slot", name: "Slot", price: 150000, active: true }],
    locationIds: ["loc_fort"], channels: ["counter", "online"], status: "active", archivedAt: null,
    schedule: { slotMinutes: 60, sessionMinutes: 60, startTime: "06:00", endTime: "23:00", capacityPerSession: 1, dailyCapacity: null, openDays: [0, 1, 2, 3, 4, 5, 6], dayOverrides: { 5: { startTime: "14:00", endTime: "23:00" } }, guideIds: [], exceptions: [] },
    resourceIds: ["res_field_1", "res_field_2"], resourceExclusive: true, bufferMinutes: 15,
    pricingRules: [{ id: "pr_fb_wknd", days: [5, 6], fromTime: "18:00", toTime: "23:00", price: 250000 }, { id: "pr_fb_eve", days: [], fromTime: "18:00", toTime: "23:00", price: 200000 }],
    addOns: [{ id: "add_fb_bibs", name: "Bib set", price: 20000, perPerson: false }],
    createdAt: T, updatedAt: T,
  },
  {
    id: "prd_cricket", name: "Cricket — Turf", description: "Same fields as football — availability is shared.", images: [{ id: "img_cricket", url: "/seed/cricket.jpg", alt: "Cricket pitch" }], categoryId: "cat_events", bookingType: "BT-04",
    tiers: [{ id: "tier_cr_slot", name: "Slot", price: 150000, active: true }],
    locationIds: ["loc_fort"], channels: ["counter", "online"], status: "active", archivedAt: null,
    schedule: { slotMinutes: 60, sessionMinutes: 60, startTime: "06:00", endTime: "23:00", capacityPerSession: 1, dailyCapacity: null, openDays: [0, 1, 2, 3, 4, 5, 6], dayOverrides: { 5: { startTime: "14:00", endTime: "23:00" } }, guideIds: [], exceptions: [] },
    resourceIds: ["res_field_1", "res_field_2"], resourceExclusive: true, bufferMinutes: 15,
    pricingRules: [{ id: "pr_cr_wknd", days: [5, 6], fromTime: "18:00", toTime: "23:00", price: 250000 }, { id: "pr_cr_eve", days: [], fromTime: "18:00", toTime: "23:00", price: 200000 }],
    createdAt: T, updatedAt: T,
  },
  {
    id: "prd_bowling", name: "Bowling Lane", description: "Book a lane by the hour.", images: [{ id: "img_bowling", url: "/seed/bowling.jpg", alt: "Bowling lanes" }], categoryId: "cat_events", bookingType: "BT-05",
    tiers: [{ id: "tier_bw_hr", name: "Per hour", price: 80000, active: true }],
    locationIds: ["loc_fort"], channels: ["counter", "online"], status: "active", archivedAt: null,
    schedule: { slotMinutes: 60, sessionMinutes: 60, startTime: "10:00", endTime: "22:00", capacityPerSession: 1, dailyCapacity: null, openDays: [0, 1, 2, 3, 4, 5, 6], guideIds: [], exceptions: [] },
    resourceIds: ["res_lane_1", "res_lane_2", "res_lane_3", "res_lane_4"], resourceExclusive: true, bufferMinutes: 0, flexibleDurations: [60, 90, 120, 150, 180], pricingBasis: "per_booking",
    // The shape a bowling alley actually sells: an hour is a round number,
    // you can extend in quarter-hours, and the two-hour price is a deal the
    // formula would never produce (2 hr would be 2,000 on the arithmetic).
    durationConfig: {
      minMinutes: 60, maxMinutes: 180, incrementMinutes: 15,
      pricingModel: "base_extension", basePrice: 100000, extensionPrice: 25000,
      priceOverrides: { 120: 175000 },
      mustEndByClose: true, walkInRoundMinutes: 15, leadTimeMinutes: 0,
    },
    pricingRules: [{ id: "pr_bw_eve", days: [], fromTime: "18:00", toTime: "23:00", price: 120000 }],
    addOns: [{ id: "add_bw_shoes", name: "Shoe hire", price: 10000, perPerson: true }],
    createdAt: T, updatedAt: T,
  },
  {
    id: "prd_massage", name: "Deep Tissue Massage", description: "Book a therapist for 60 or 90 minutes.", images: [], categoryId: "cat_tours", bookingType: "BT-10",
    tiers: [{ id: "tier_ms_60", name: "60 min", price: 300000, active: true }, { id: "tier_ms_90", name: "90 min", price: 450000, active: true }],
    locationIds: ["loc_fort"], channels: ["counter", "online"], status: "active", archivedAt: null, schedule: null,
    providerIds: ["stf_nadia", "stf_karim"], providerNoun: "Therapist", providerPickable: true, flexibleDurations: [60, 90],
    providerPremiums: { stf_karim: 50000 },
    providerDurations: { stf_nadia: [60, 90], stf_karim: [60, 90] },
    addOns: [{ id: "add_ms_oils", name: "Premium oils", price: 30000, perPerson: false }],
    policies: { salesWindowDays: 60, cutoffMinutes: 60, cancellation: "fee", cancelHours: 12, cancelFeePct: 50, reschedule: "until", rescheduleHours: 12, reentry: "single", deposit: "percent", depositPct: 50, partyMin: 1, partyMax: 2, waiver: true },
    createdAt: T, updatedAt: T,
  },
  {
    id: "prd_film", name: "Evening Film", description: "Pick your section.", images: [], categoryId: "cat_events", bookingType: "BT-07",
    tiers: [{ id: "tier_flm", name: "Ticket", price: 40000, active: true }],
    sections: [{ id: "sec_stalls", name: "Stalls", capacity: 120, price: 40000 }, { id: "sec_balcony", name: "Balcony", capacity: 40, price: 70000 }],
    layoutId: "layout_cinema",
    locationIds: ["loc_museum"], channels: ["counter", "online"], status: "active", archivedAt: null,
    createdAt: T, updatedAt: T,
  },
  {
    id: "prd_bundle", name: "Day Pass Bundle", description: "Admission + Garden + Planetarium in one ticket.", images: [], categoryId: "cat_entry", bookingType: "BT-08",
    tiers: [{ id: "tier_bn", name: "Bundle", price: 100000, active: true }],
    bundleComponentIds: ["prd_admission", "prd_garden", "prd_planetarium"],
    locationIds: ["loc_fort"], channels: ["counter", "online"], status: "active", archivedAt: null,
    createdAt: T, updatedAt: T,
  },
  {
    id: "prd_yoga_pack", name: "10-Class Yoga Pack", description: "Ten credits to spend on yoga sessions.", images: [], categoryId: "cat_entry", bookingType: "BT-12",
    tiers: [{ id: "tier_yp", name: "Pack", price: 400000, active: true }],
    credits: { count: 10, expiryDays: 90, productIds: ["prd_yoga"] },
    creditsPerBooking: 1,
    locationIds: ["loc_fort"], channels: ["counter", "online"], status: "active", archivedAt: null,
    createdAt: T, updatedAt: T,
  },
  {
    id: "prd_swim", name: "Beginner Swim Course", description: "Eight sessions, one enrolment.", images: [], categoryId: "cat_tours", bookingType: "BT-13",
    tiers: [{ id: "tier_sw", name: "Course", price: 800000, active: true }],
    courseDates: ["2026-08-04", "2026-08-06", "2026-08-11", "2026-08-13", "2026-08-18", "2026-08-20", "2026-08-25", "2026-08-27"],
    joinPartway: false,
    locationIds: ["loc_fort"], channels: ["counter", "online"], status: "active", archivedAt: null,
    createdAt: T, updatedAt: T,
  },
  {
    // The overflow stress test — long names must truncate, never collide.
    id: "prd_stress",
    name: "Grand Heritage Architectural Walking Tour of Old Dhaka with Rooftop Iftar Experience",
    description: "The stress-test product: nothing may overflow, collide, or clip.",
    images: [], categoryId: "cat_tours", bookingType: "BT-03",
    tiers: [
      { id: "tier_st_adult", name: "Adult", price: 250000, active: true },
      { id: "tier_st_senior", name: "Senior Citizen (65+, valid ID required)", price: 180000, active: true },
    ],
    locationIds: ["loc_fort"], channels: ["counter"], status: "active", archivedAt: null,
    schedule: { slotMinutes: 60, sessionMinutes: 90, startTime: "17:00", endTime: "19:00", capacityPerSession: 18, dailyCapacity: null, openDays: [0, 1, 2, 3, 4, 5, 6], guideIds: [], exceptions: [] },
    createdAt: T, updatedAt: T,
  },
  {
    id: "prd_parking", name: "Parking Pass", description: "Issued at the gate against a plate number.", images: [], categoryId: null, bookingType: "BT-14",
    tiers: [{ id: "tier_pk", name: "Pass", price: 10000, active: true }],
    locationIds: ["loc_fort"], channels: ["counter"], status: "active", archivedAt: null,
    flexibleDurations: [30, 60, 120, 180],
    passIdentifierLabel: "Plate number",
    taxClass: "exempt",
    createdAt: T, updatedAt: T,
  },
  {
    id: "prd_yoga", name: "Yoga Session", description: "Drop-in class, capped — join the waitlist when full.", images: [], categoryId: "cat_tours", bookingType: "BT-06",
    tiers: [{ id: "tier_yg", name: "Drop-in", price: 50000, active: true }],
    locationIds: ["loc_fort"], channels: ["counter", "online"], status: "active", archivedAt: null, waitlistEnabled: true,
    schedule: { slotMinutes: 60, sessionMinutes: 60, startTime: "07:00", endTime: "19:00", capacityPerSession: 0, dailyCapacity: 20, openDays: [0, 1, 2, 3, 4, 5, 6], guideIds: [], exceptions: [] },
    createdAt: T, updatedAt: T,
  },
  {
    id: "prd_donation", name: "Support the Museum", description: "A voluntary donation — pay what you want.", images: [], categoryId: "cat_entry", bookingType: "BT-01",
    tiers: [{ id: "tier_donation", name: "Donation", price: 5000, donation: true, admits: 0, active: true }],
    locationIds: ["loc_fort", "loc_museum"], channels: ["counter", "online"], status: "active", archivedAt: null,
    createdAt: T, updatedAt: T,
  },
];

export const counters: Counter[] = [
  {
    id: "cnt_fort_main",
    name: "Fort Main Gate",
    locationId: "loc_fort",
    allowedProductIds: "all",
    allowedPaymentMethods: ["cash", "bkash", "bangla_qr", "card_terminal"],
    status: "active",
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "cnt_fort_group",
    name: "Fort Group Desk",
    locationId: "loc_fort",
    allowedProductIds: ["prd_tour"],
    allowedPaymentMethods: ["cash", "voucher", "credit"],
    status: "active",
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "cnt_museum_lobby",
    name: "Museum Lobby",
    locationId: "loc_museum",
    allowedProductIds: "all",
    allowedPaymentMethods: ["cash", "bkash", "bangla_qr"],
    status: "inactive",
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "cnt_fort_kiosk",
    name: "Fort Self-Service Kiosk",
    locationId: "loc_fort",
    allowedProductIds: ["prd_admission", "prd_garden"],
    allowedPaymentMethods: ["card_terminal", "bangla_qr"],
    status: "active",
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "cnt_museum_group",
    name: "Museum Group Desk",
    locationId: "loc_museum",
    allowedProductIds: ["prd_planetarium", "prd_tour"],
    allowedPaymentMethods: ["cash", "voucher", "credit"],
    status: "active",
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "cnt_garden_gate",
    name: "Garden Gate",
    locationId: "loc_garden",
    allowedProductIds: "all",
    allowedPaymentMethods: ["cash", "bkash"],
    status: "inactive",
    createdAt: T,
    updatedAt: T,
  },
];

export const roles: Role[] = [
  {
    id: "role_manager",
    name: "Manager",
    permissions: ["products.manage", "orders.refund", "reports.view", "staff.manage", "settings.manage"],
    refundLimit: null,
    discountLimitPct: null,
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "role_supervisor",
    name: "Supervisor",
    permissions: ["orders.refund", "reports.view", "pos.sell"],
    refundLimit: 500000,
    discountLimitPct: 25,
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "role_cashier",
    name: "Cashier",
    permissions: ["pos.sell", "scan.validate"],
    refundLimit: 0,
    discountLimitPct: 10,
    createdAt: T,
    updatedAt: T,
  },
];

export const staff: Staff[] = [
  {
    id: "stf_rahim",
    name: "Rahim Uddin",
    email: "rahim@lalbagh.example",
    phone: "+8801711000001",
    roleId: "role_manager",
    locationIds: ["loc_fort", "loc_museum"],
    counterIds: [],
    status: "active",
    lastActiveAt: "2026-07-29T08:40:00+06:00",
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "stf_nadia",
    name: "Nadia Islam",
    email: "nadia@lalbagh.example",
    phone: null,
    roleId: "role_supervisor",
    locationIds: ["loc_fort"],
    counterIds: ["cnt_fort_main", "cnt_fort_group"],
    status: "active",
    lastActiveAt: "2026-07-29T09:05:00+06:00",
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "stf_karim",
    name: "Karim Hossain",
    email: null,
    phone: "+8801711000003",
    roleId: "role_cashier",
    locationIds: ["loc_fort"],
    counterIds: ["cnt_fort_main"],
    status: "active",
    lastActiveAt: "2026-07-28T18:20:00+06:00",
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "stf_tania",
    name: "Tania Akter",
    email: "tania@lalbagh.example",
    phone: "+8801711000004",
    roleId: "role_cashier",
    locationIds: ["loc_museum"],
    counterIds: ["cnt_museum_lobby"],
    status: "invited",
    lastActiveAt: null,
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "stf_former",
    name: "Imran Chowdhury",
    email: "imran@lalbagh.example",
    phone: null,
    roleId: "role_cashier",
    locationIds: ["loc_fort"],
    counterIds: [],
    status: "suspended",
    lastActiveAt: "2026-05-30T17:00:00+06:00",
    createdAt: "2025-11-01T10:00:00+06:00",
    updatedAt: "2026-06-01T10:00:00+06:00",
  },
  { id: "stf_sabbir", name: "Sabbir Ahmed", email: "sabbir@lalbagh.example", phone: "+8801711000006", roleId: "role_cashier", locationIds: ["loc_fort"], counterIds: ["cnt_fort_kiosk"], status: "active", lastActiveAt: "2026-07-29T07:55:00+06:00", createdAt: T, updatedAt: T },
  { id: "stf_farhana", name: "Farhana Yasmin", email: "farhana@lalbagh.example", phone: null, roleId: "role_supervisor", locationIds: ["loc_museum"], counterIds: ["cnt_museum_lobby", "cnt_museum_group"], status: "active", lastActiveAt: "2026-07-28T16:10:00+06:00", createdAt: T, updatedAt: T },
  { id: "stf_jamal", name: "Jamal Hossain", email: null, phone: "+8801711000007", roleId: "role_cashier", locationIds: ["loc_fort"], counterIds: ["cnt_fort_main"], status: "active", lastActiveAt: "2026-07-29T09:12:00+06:00", createdAt: T, updatedAt: T },
  { id: "stf_ruma", name: "Ruma Begum", email: "ruma@lalbagh.example", phone: "+8801711000008", roleId: "role_cashier", locationIds: ["loc_museum"], counterIds: ["cnt_museum_group"], status: "invited", lastActiveAt: null, createdAt: T, updatedAt: T },
  { id: "stf_arif", name: "Arif Rahman", email: "arif@lalbagh.example", phone: "+8801711000009", roleId: "role_manager", locationIds: ["loc_fort", "loc_museum", "loc_garden"], counterIds: [], status: "active", lastActiveAt: "2026-07-29T08:00:00+06:00", createdAt: T, updatedAt: T },
  { id: "stf_shila", name: "Shila Akter", email: "shila@lalbagh.example", phone: null, roleId: "role_cashier", locationIds: ["loc_fort"], counterIds: ["cnt_fort_group"], status: "active", lastActiveAt: "2026-07-27T15:30:00+06:00", createdAt: T, updatedAt: T },
  { id: "stf_mizan", name: "Mizanur Rahman", email: "mizan@lalbagh.example", phone: "+8801711000011", roleId: "role_supervisor", locationIds: ["loc_fort"], counterIds: ["cnt_fort_main", "cnt_fort_kiosk"], status: "suspended", lastActiveAt: "2026-06-15T12:00:00+06:00", createdAt: "2025-12-01T10:00:00+06:00", updatedAt: "2026-06-16T10:00:00+06:00" },
  { id: "stf_ayesha", name: "Ayesha Siddiqua", email: "ayesha@lalbagh.example", phone: "+8801711000012", roleId: "role_cashier", locationIds: ["loc_fort", "loc_museum"], counterIds: ["cnt_fort_group"], status: "active", lastActiveAt: "2026-07-29T09:20:00+06:00", createdAt: T, updatedAt: T },
];

export const bookingRules: BookingRule[] = [
  { id: "brl_museum_slots", name: "Museum timed-entry slots", productId: "prd_planetarium", locationId: "loc_museum", capacity: 30, slotMinutes: 30, daysOfWeek: [6, 0], blackoutDates: ["2026-08-15"], status: "active", createdAt: T, updatedAt: T },
  { id: "brl_tour_capacity", name: "Heritage tour capacity", productId: "prd_tour", locationId: null, capacity: 12, slotMinutes: 90, daysOfWeek: [2, 3, 4, 5, 6], blackoutDates: [], status: "active", createdAt: T, updatedAt: T },
  { id: "brl_evening", name: "Evening pass window", productId: "prd_garden", locationId: "loc_fort", capacity: 200, slotMinutes: 120, daysOfWeek: [5], blackoutDates: [], status: "active", createdAt: T, updatedAt: T },
  { id: "brl_fort_default", name: "Fort general capacity", productId: null, locationId: "loc_fort", capacity: 500, slotMinutes: 60, daysOfWeek: [0, 2, 3, 4, 5, 6], blackoutDates: ["2026-12-16"], status: "active", createdAt: T, updatedAt: T },
];

export const priceRules: PriceRule[] = [
  { id: "prc_weekend_peak", name: "Weekend peak surcharge", productId: null, locationId: "loc_fort", channel: "all", kind: "peak", adjustmentPct: 20, status: "active", createdAt: T, updatedAt: T },
  { id: "prc_online_off", name: "Online early-bird", productId: null, locationId: null, channel: "online", kind: "off_peak", adjustmentPct: -10, status: "active", createdAt: T, updatedAt: T },
  { id: "prc_museum_std", name: "Museum standard", productId: "prd_planetarium", locationId: "loc_museum", channel: "all", kind: "standard", adjustmentPct: 0, status: "active", createdAt: T, updatedAt: T },
  { id: "prc_evening_peak", name: "Evening premium", productId: "prd_garden", locationId: "loc_fort", channel: "counter", kind: "peak", adjustmentPct: 15, status: "inactive", createdAt: T, updatedAt: T },
];

export const devices: Device[] = [
  { id: "dev_fort_ipad1", name: "Fort iPad 1", counterId: "cnt_fort_main", pairingCode: "PAIR-4821", status: "active", lastSeenAt: "2026-07-29T09:10:00+06:00", createdAt: T, updatedAt: T },
  { id: "dev_fort_ipad2", name: "Fort iPad 2", counterId: "cnt_fort_kiosk", pairingCode: "PAIR-7734", status: "active", lastSeenAt: "2026-07-28T18:02:00+06:00", createdAt: T, updatedAt: T },
  { id: "dev_museum_ipad", name: "Museum Tablet", counterId: "cnt_museum_lobby", pairingCode: "PAIR-1290", status: "inactive", lastSeenAt: null, createdAt: T, updatedAt: T },
];

export const resources: Resource[] = [
  { id: "res_court_1", name: "Championship Court 1 — Centre (Covered)", nounSingular: "Court", nounPlural: "Courts", locationId: "loc_fort", outOfService: false, outOfServiceReason: null, status: "active", createdAt: T, updatedAt: T },
  { id: "res_field_1", name: "Field 1", nounSingular: "Field", nounPlural: "Fields", locationId: "loc_fort", outOfService: false, outOfServiceReason: null, status: "active", createdAt: T, updatedAt: T },
  { id: "res_field_2", name: "Field 2", nounSingular: "Field", nounPlural: "Fields", locationId: "loc_fort", outOfService: false, outOfServiceReason: null, status: "active", createdAt: T, updatedAt: T },
  { id: "res_lane_1", name: "Lane 1", nounSingular: "Lane", nounPlural: "Lanes", locationId: "loc_fort", outOfService: false, outOfServiceReason: null, status: "active", createdAt: T, updatedAt: T },
  { id: "res_lane_2", name: "Lane 2", nounSingular: "Lane", nounPlural: "Lanes", locationId: "loc_fort", outOfService: false, outOfServiceReason: null, status: "active", createdAt: T, updatedAt: T },
  { id: "res_lane_3", name: "Lane 3", nounSingular: "Lane", nounPlural: "Lanes", locationId: "loc_fort", outOfService: false, outOfServiceReason: null, status: "active", createdAt: T, updatedAt: T },
  { id: "res_lane_4", name: "Lane 4", nounSingular: "Lane", nounPlural: "Lanes", locationId: "loc_fort", outOfService: false, outOfServiceReason: null, rateOverride: { kind: "replace", amount: 100000 }, status: "active", createdAt: T, updatedAt: T },
];

// Transactional data — generated deterministically (see generate.ts).
const sales = generateSales({
  products,
  locations,
  staff,
  taxRatePct: operator.taxRatePct,
  reducedRatePct: operator.reducedRatePct,
});

// F12 permanent stress order: 6 lines incl. 2 add-on children, both discount
// levels, the long product/resource/tier strings and a long customer name —
// every list, detail and receipt must render it without overflow.
const stressSale = buildOrderLines(
  [
    { productId: "prd_stress", productName: "Grand Heritage Architectural Walking Tour of Old Dhaka with Rooftop Iftar Experience", tierId: "tier_st_adult", tierName: "Adult", admits: 1, quantity: 2, unitPrice: 250000, taxClass: "standard", taxRate: 0.15, booking: { date: "2026-07-29", startTime: "17:00", endTime: "18:30", guests: 3, durationMinutes: 90 } },
    { productId: "prd_stress", productName: "Grand Heritage Architectural Walking Tour of Old Dhaka with Rooftop Iftar Experience", tierId: "tier_st_senior", tierName: "Senior Citizen (65+, valid ID required)", admits: 1, quantity: 1, unitPrice: 180000, lineDiscount: 18000, taxClass: "standard", taxRate: 0.15 },
    { productId: "addon_add_ms_oils", productName: "Premium oils", tierName: "Each", admits: 0, quantity: 1, unitPrice: 30000, parentIndex: 0, taxClass: "standard", taxRate: 0.15 },
    { productId: "prd_football", productName: "Football — Turf", tierName: "Championship Court 1 — Centre (Covered)", admits: 4, quantity: 1, unitPrice: 150000, taxClass: "standard", taxRate: 0.15, booking: { date: "2026-07-29", startTime: "18:00", endTime: "19:00", resourceId: "res_court_1", resourceName: "Championship Court 1 — Centre (Covered)", guests: 4, durationMinutes: 60 } },
    { productId: "addon_add_fb_bibs", productName: "Bib set", tierName: "Each", admits: 0, quantity: 4, unitPrice: 20000, parentIndex: 3, taxClass: "standard", taxRate: 0.15 },
    { productId: "prd_admission", productName: "General Admission", tierId: "tier_adult", tierName: "Adult", admits: 1, quantity: 2, unitPrice: 50000, taxClass: "standard", taxRate: 0.15 },
  ],
  50000, // 5%-ish cart discount, allocated pro rata by the engine
  "CF-2026-999001",
);
const stressOrder: Order = {
  id: "ord_stress", reference: "CF-2026-999001", status: "paid", channel: "counter",
  locationId: "loc_fort", counterId: "cnt_fort_main", staffId: "stf_nadia",
  customerId: "cus_stress",
  customerName: "Mohammad Abdur Rahman Chowdhury",
  lines: stressSale.lines, payments: [{ id: "CF-2026-999001-P0", method: "cash", amount: stressSale.totals.total, tendered: stressSale.totals.total, change: 0, status: "confirmed", createdAt: "2026-07-29T11:05:00+06:00" }],
  ...stressSale.totals,
  createdAt: "2026-07-29T11:05:00+06:00", updatedAt: "2026-07-29T11:05:00+06:00",
};

/* Customers: the deterministic roster the generator attached to orders, plus
   the hand-authored detail a screen needs to be real — a marketing consent
   trail, an internal note, and one flagged guest. The stress order's customer
   is added here so the long-name overflow case has a record too. */
const cus = structuredClone(sales.customers);
const findCustomer = (name: string) => cus.find((c) => c.name === name);

const consent = (
  name: string,
  channel: "email" | "sms",
  granted: boolean,
  capturedAt: string,
  source: "counter" | "online" | "import" | "manager",
) => findCustomer(name)?.consents.push({ channel, granted, capturedAt, source });

consent("Ayesha Siddika", "email", true, "2026-03-14T10:20:00+06:00", "online");
consent("Ayesha Siddika", "sms", true, "2026-03-14T10:20:00+06:00", "online");
consent("Tanvir Ahmed", "email", true, "2026-01-08T16:05:00+06:00", "counter");
// Withdrawn later — the log keeps both decisions; the latest one is what counts.
consent("Tanvir Ahmed", "email", false, "2026-06-22T09:40:00+06:00", "manager");
consent("Nusrat Jahan", "sms", true, "2026-05-02T11:15:00+06:00", "counter");
consent("Sadia Rahman", "email", true, "2026-02-19T13:30:00+06:00", "import");
consent("Zahid Chowdhury", "email", true, "2026-04-11T08:55:00+06:00", "online");
consent("Nabila Anjum", "sms", false, "2026-06-30T17:45:00+06:00", "counter");

const zahid = findCustomer("Zahid Chowdhury");
if (zahid) {
  zahid.tags = ["corporate"];
  zahid.notes.push({
    at: "2026-04-11T09:00:00+06:00",
    who: "Nadia Islam",
    text: "Books the whole gallery for company visits — invoice to the company, not the card.",
  });
}

const sabbir = findCustomer("Sabbir Alam");
if (sabbir) {
  sabbir.flag = {
    reason: "Repeated no-shows on booked tours. Take payment in full at booking.",
    at: "2026-06-18T14:10:00+06:00",
    who: "Nadia Islam",
  };
}

const rumana = findCustomer("Rumana Begum");
if (rumana) {
  rumana.tags = ["member"];
}

// The overflow stress case, as a customer record.
cus.push({
  id: "cus_stress",
  name: "Mohammad Abdur Rahman Chowdhury",
  email: "mohammad.abdur.rahman.chowdhury@averylongdomainname.com.bd",
  phone: "01712-345678",
  phoneKey: "1712345678",
  emailKey: "mohammad.abdur.rahman.chowdhury@averylongdomainname.com.bd",
  consents: [{ channel: "sms", granted: true, capturedAt: "2026-07-29T11:05:00+06:00", source: "counter" }],
  notes: [],
  flag: null,
  tags: [],
  mergedIntoId: null,
  erasedAt: null,
  status: "active",
  createdAt: "2026-07-29T11:05:00+06:00",
  updatedAt: "2026-07-29T11:05:00+06:00",
});

export const customers: Customer[] = cus;

/* ── Memberships and loyalty (Milestone 2 part 2) ───────────────────────────
   Three tiers that between them exercise every mechanism a screen has to
   handle: an unlimited individual annual, a family membership covering four
   people, and a monthly tier whose discount is scoped to one category rather
   than everything. The memberships held cover every state — active, expiring
   within the month, lapsed, paused and cancelled — so the list screen has
   something in each tab without anyone having to fabricate it. */
export const membershipTiers: MembershipTier[] = [
  {
    id: "mtr_friend",
    name: "Friend of the Museum",
    description: "Unlimited entry all year, 10% off everything else, and two guest passes.",
    price: 350000,
    billingPeriod: "annual",
    autoRenew: true,
    renewalNoticeDays: 14,
    discountBps: 1000,
    discountScope: "all",
    discountCategoryIds: [],
    discountProductIds: [],
    includedVisits: null,
    includedProductIds: ["prd_admission"],
    maxMembers: 1,
    guestPassesPerPeriod: 2,
    status: "active",
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "mtr_family",
    name: "Family Membership",
    description: "Covers four named people. Unlimited entry, 15% off tours and events.",
    price: 900000,
    billingPeriod: "annual",
    autoRenew: true,
    renewalNoticeDays: 21,
    discountBps: 1500,
    discountScope: "categories",
    discountCategoryIds: ["cat_tours", "cat_events"],
    discountProductIds: [],
    includedVisits: null,
    includedProductIds: ["prd_admission"],
    maxMembers: 4,
    guestPassesPerPeriod: 4,
    status: "active",
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "mtr_explorer",
    name: "Explorer",
    description: "Six visits a month and 5% off guided tours. Cancel any time.",
    price: 80000,
    billingPeriod: "monthly",
    autoRenew: true,
    renewalNoticeDays: 5,
    discountBps: 500,
    discountScope: "categories",
    discountCategoryIds: ["cat_tours"],
    discountProductIds: [],
    includedVisits: 6,
    includedProductIds: ["prd_admission", "prd_garden"],
    maxMembers: 1,
    guestPassesPerPeriod: 0,
    status: "active",
    createdAt: T,
    updatedAt: T,
  },
];

// Dates are written relative to the real today so the states stay true however
// long this seed lives — a membership seeded as "expiring soon" must not
// quietly become "lapsed" a month later.
const dayShift = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const membershipRow = (
  id: string,
  seq: number,
  customerName: string,
  tierId: string,
  tierName: string,
  startedDays: number,
  expiresDays: number,
  extra: Partial<Membership> = {},
): Membership => ({
  id,
  customerId: cus.find((c) => c.name === customerName)?.id ?? "cus_001",
  tierId,
  tierName,
  code: `CF-M-${String(seq).padStart(6, "0")}`,
  status: "active",
  startedAt: dayShift(startedDays),
  expiresAt: dayShift(expiresDays),
  autoRenew: true,
  visitsUsed: 0,
  guestPassesUsed: 0,
  members: [],
  orderId: null,
  pausedAt: null,
  cancelledAt: null,
  createdAt: T,
  updatedAt: T,
  ...extra,
});

export const memberships: Membership[] = [
  // Active, most of the year still to run.
  membershipRow("mbs_001", 1, "Ayesha Siddika", "mtr_friend", "Friend of the Museum", -95, 270),
  // A family membership with its four named people.
  membershipRow("mbs_002", 2, "Zahid Chowdhury", "mtr_family", "Family Membership", -140, 225, {
    members: [
      { name: "Zahid Chowdhury" },
      { name: "Rehana Chowdhury" },
      { name: "Tahmid Chowdhury", note: "Child" },
      { name: "Zara Chowdhury", note: "Child" },
    ],
    guestPassesUsed: 1,
  }),
  // Expiring inside the notice window — the case the Expiring tab exists for.
  membershipRow("mbs_003", 3, "Nusrat Jahan", "mtr_explorer", "Explorer", -348, 12, {
    visitsUsed: 4,
  }),
  // Ran out last month and was never renewed.
  membershipRow("mbs_004", 4, "Rafiqul Islam", "mtr_explorer", "Explorer", -400, -26, {
    visitsUsed: 6,
    autoRenew: false,
  }),
  // Paused while the member is abroad; resuming pushes the expiry out.
  membershipRow("mbs_005", 5, "Shirin Akter", "mtr_friend", "Friend of the Museum", -200, 165, {
    status: "paused",
    pausedAt: new Date(Date.now() - 18 * 86400000).toISOString(),
  }),
  // Cancelled with a reason on the record.
  membershipRow("mbs_006", 6, "Sabbir Alam", "mtr_explorer", "Explorer", -300, 40, {
    status: "cancelled",
    autoRenew: false,
    cancelledAt: new Date(Date.now() - 9 * 86400000).toISOString(),
    cancelReason: "Moving out of Dhaka.",
  }),
];

export const loyaltyProgram: LoyaltyProgram = {
  enabled: true,
  pointsPerUnit: 1, // one point per taka spent
  pointValue: 25, // 100 points = ৳25
  minRedeemPoints: 100,
  expiryMonths: 12,
};

/* The points ledger. Built from the orders these customers actually placed, so
   a balance can be traced back to a sale rather than appearing from nowhere.
   One entry is deliberately close to expiry, and one member has already spent
   points, so the "expiring soon" and "spent" paths both have real data. */
const loyaltyMembers = [
  "Ayesha Siddika",
  "Zahid Chowdhury",
  "Nusrat Jahan",
  "Tasnim Ferdous",
  "Arif Mahmud",
  "Kamrul Hasan",
];
const pointEntries: LoyaltyEntry[] = [];
let pointSeq = 0;
for (const name of loyaltyMembers) {
  const customer = cus.find((c) => c.name === name);
  if (!customer) continue;
  const theirOrders = sales.orders
    .filter((o) => o.customerId === customer.id && o.status === "paid")
    .slice(0, 4);
  for (const o of theirOrders) {
    pointSeq += 1;
    pointEntries.push({
      id: `lyp_${String(pointSeq).padStart(4, "0")}`,
      customerId: customer.id,
      kind: "earn",
      points: Math.floor(o.total / 100),
      orderId: o.id,
      at: o.createdAt,
      // Earned a year ago on this seed's clock, so most have a while to run —
      // except Ayesha's oldest, deliberately inside the 60-day warning window.
      expiresAt: dayShift(name === "Ayesha Siddika" && theirOrders[0].id === o.id ? 34 : 300),
    });
  }
}
// Someone who has already spent points, and a manager goodwill adjustment.
const tasnim = cus.find((c) => c.name === "Tasnim Ferdous");
if (tasnim) {
  pointSeq += 1;
  pointEntries.push({
    id: `lyp_${String(pointSeq).padStart(4, "0")}`,
    customerId: tasnim.id,
    kind: "spend",
    points: 200,
    at: new Date(Date.now() - 21 * 86400000).toISOString(),
    note: "Spent at the counter",
  });
}
const nusrat = cus.find((c) => c.name === "Nusrat Jahan");
if (nusrat) {
  pointSeq += 1;
  pointEntries.push({
    id: `lyp_${String(pointSeq).padStart(4, "0")}`,
    customerId: nusrat.id,
    kind: "adjust",
    points: 250,
    note: "Goodwill after a cancelled session.",
    at: new Date(Date.now() - 40 * 86400000).toISOString(),
    expiresAt: dayShift(320),
  });
}
export const loyaltyEntries: LoyaltyEntry[] = pointEntries;

/* Holds (§61). One of each mechanism, so every branch of the availability
   engine and the "why can I not sell this?" explanation has real data behind
   it: a named school group holding places, a locked-off session, a resource
   held for maintenance, and one that has already expired. */
// Anchored to the DEMO clock, not the wall clock: a hold has to land on the
// same day the product's schedule is offering, or it blocks a session nobody
// can see.
const holdDate = (days: number) => demoDay(days);
const holdAt = (days: number, time: string) => `${holdDate(days)}T${time}:00+06:00`;

export const holds: Hold[] = [
  {
    id: "hld_school",
    productId: "prd_planetarium",
    productName: "Planetarium Show",
    locationId: "loc_museum",
    kind: "capacity",
    date: holdDate(3),
    slotStart: holdAt(3, "11:00"),
    quantity: 25,
    heldFor: "Sunbeams School — Class 6",
    reason: "Confirmed by phone, paying on the day.",
    placedBy: "Nadia Islam",
    expiresAt: null,
    status: "held",
    convertedOrderId: null,
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "hld_session_lock",
    productId: "prd_tour",
    productName: "Heritage Walking Tour",
    locationId: "loc_fort",
    kind: "session",
    date: holdDate(2),
    slotStart: holdAt(2, "14:00"),
    quantity: 0,
    heldFor: "Private event",
    reason: "Booked out for a corporate visit — no public sales.",
    placedBy: "Nadia Islam",
    expiresAt: null,
    status: "held",
    convertedOrderId: null,
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "hld_lane_maintenance",
    productId: "prd_bowling",
    productName: "Bowling Lane",
    locationId: "loc_fort",
    kind: "resource",
    date: holdDate(1),
    slotStart: holdAt(1, "09:00"),
    slotEnd: holdAt(1, "13:00"),
    quantity: 0,
    resourceId: "res_lane_3",
    resourceName: "Lane 3",
    heldFor: "Maintenance",
    reason: "Pinsetter service booked in.",
    placedBy: "Rahim Uddin",
    expiresAt: null,
    status: "held",
    convertedOrderId: null,
    createdAt: T,
    updatedAt: T,
  },
  {
    // Already past its expiry — proves holds release themselves without a job.
    id: "hld_expired",
    productId: "prd_garden",
    productName: "Sculpture Garden",
    locationId: "loc_fort",
    kind: "capacity",
    date: holdDate(0),
    slotStart: null,
    quantity: 40,
    heldFor: "Tour operator provisional",
    reason: "Never confirmed.",
    placedBy: "Nadia Islam",
    expiresAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    status: "held",
    convertedOrderId: null,
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "hld_released",
    productId: "prd_admission",
    productName: "General Admission",
    locationId: "loc_fort",
    kind: "capacity",
    date: holdDate(5),
    slotStart: null,
    quantity: 60,
    heldFor: "City Tours Ltd",
    reason: "Partner allocation, given back when they did not take it up.",
    placedBy: "Nadia Islam",
    expiresAt: null,
    status: "released",
    convertedOrderId: null,
    createdAt: T,
    updatedAt: T,
  },
];

export const orders = [...sales.orders, stressOrder];

// A sold 10-Class Yoga Pack with 3 credits already spent — its code is the
// pass a customer hands over at POS ("Redeem a pass" → 7 credits left).
const yogaPassTicket = {
  id: "tkt_pass_demo", code: "CF-2026-PASS01", orderId: "ord_seed", productId: "prd_yoga_pack",
  tierName: "Pack", status: "issued" as const, validFor: "2026-07-20", redeemedAt: null, creditsUsed: 3,
};
export const tickets = [...sales.tickets, yogaPassTicket];

// Explicit turf bookings on Field 1 — created via Football but they block the
// field for Cricket too (shared availability). Evenings mostly sold; some today.
const bk = (id: string, field: string, date: string, time: string) => ({
  id, orderId: "ord_seed", productId: "prd_football", locationId: "loc_fort",
  resourceId: field, slotStart: `${date}T${time}:00+06:00`, partySize: 1, status: "confirmed" as const,
});
const turfBookings = [
  bk("bkg_f1_today18", "res_field_1", "2026-07-29", "18:00"),
  bk("bkg_f1_today19", "res_field_1", "2026-07-29", "19:00"),
  bk("bkg_f2_today20", "res_field_2", "2026-07-29", "20:00"),
  bk("bkg_f1_sat18", "res_field_1", "2026-08-01", "18:00"),
  bk("bkg_f1_sat19", "res_field_1", "2026-08-01", "19:00"),
  bk("bkg_f1_sat20", "res_field_1", "2026-08-01", "20:00"),
  bk("bkg_f2_sat21", "res_field_2", "2026-08-01", "21:00"),
];

// Ayesha already leads the Saturday 10:00 walking tour — guides are capacity
// owners, so any other 10:00 departure that day offers only Rahim.
const guidedBookings = [
  {
    id: "bkg_tour_sat10", orderId: "ord_seed", productId: "prd_tour", locationId: "loc_fort",
    resourceId: "stf_ayesha", slotStart: "2026-08-01T10:00:00+06:00", slotEnd: "2026-08-01T11:30:00+06:00",
    partySize: 6, status: "confirmed" as const,
  },
];
export const bookings = [...sales.bookings, ...turfBookings, ...guidedBookings];
