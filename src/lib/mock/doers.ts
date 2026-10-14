/* ───────────────────────────────────────────────────────────────────────────
   Demo business: The Doers Club, Dhaka — "A social experience club. Spend a
   day creating, not just consuming." Small-group workshops with a seat cap
   (matcha, sushi, tea) and a monthly social.

   A prospect demo, so it is a whole business rather than a product filter on
   the default seed: its own venue, counter, storefront, shelf and catalogue.
   Prices, times and seat counts are illustrative — set them with the owner.

   The venue keeps the id `loc_fort` and the counter `cnt_fort_main` on
   purpose: they are internal, never shown, and the session's paired counter
   (lib/session) and the shared staff are keyed to them. Renaming the records
   is the demo; re-keying every reference would be a second seed.

   IMPORTANT: like data.ts, nothing outside `src/lib/api/client.ts` imports this.
   ────────────────────────────────────────────────────────────────────────── */
import type { Counter, InventoryItem, Location, Product, StockMovement, Storefront } from "@/lib/api/types";
import { demoDay } from "@/lib/schedule";

const T = "2026-06-01T10:00:00+06:00";
const LOC = "loc_fort";

export const doersOperator = {
  name: "The Doers Club",
  currency: "BDT",
  contactPhone: undefined,
  contactEmail: undefined,
  website: "instagram.com/thedoersclub_dhaka",
  receiptFooter: "Thanks for making something with us. See you at the next one.",
};

export const doersLocations: Location[] = [
  {
    id: LOC,
    name: "The Doers Club",
    addressLine1: "Address sent with your booking",
    city: "Dhaka",
    country: "Bangladesh",
    timezone: "Asia/Dhaka",
    openingHours: [
      { dayOfWeek: 0, intervals: [{ opensAt: "16:00", closesAt: "21:00" }] },
      { dayOfWeek: 1, intervals: [] },
      { dayOfWeek: 2, intervals: [] },
      { dayOfWeek: 3, intervals: [{ opensAt: "16:00", closesAt: "21:00" }] },
      { dayOfWeek: 4, intervals: [{ opensAt: "16:00", closesAt: "22:00" }] },
      { dayOfWeek: 5, intervals: [{ opensAt: "10:30", closesAt: "21:00" }] },
      { dayOfWeek: 6, intervals: [{ opensAt: "10:30", closesAt: "21:00" }] },
    ],
    status: "active",
    createdAt: T,
    updatedAt: T,
  },
];

export const doersCounters: Counter[] = [
  {
    id: "cnt_fort_main",
    name: "Front desk",
    locationId: LOC,
    allowedProductIds: "all",
    allowedPaymentMethods: ["cash", "bkash", "bangla_qr", "card_terminal"],
    status: "active",
    createdAt: T,
    updatedAt: T,
  },
];

const POLICY = {
  salesWindowDays: 60, cutoffMinutes: 120, cancellation: "free_until" as const, cancelHours: 48, cancelFeePct: 0,
  reschedule: "until" as const, rescheduleHours: 24, reentry: "single" as const, deposit: "full" as const, depositPct: 0,
  partyMin: 1, partyMax: 6,
};

export const doersProducts: Product[] = [
  {
    id: "prd_doers_matcha",
    name: "Matcha Whisking Workshop",
    description:
      "Learn to whisk a proper bowl of matcha the traditional way — sift, whisk, taste, repeat. 90 minutes, all tools and tea included. Small group, so book your seat.",
    images: [],
    bookingType: "BT-03",
    tiers: [
      { id: "tier_dm_seat", name: "Seat", price: 250000, active: true, note: "Everything you need is at your station" },
      { id: "tier_dm_pair", name: "Two seats (bring a friend)", price: 460000, admits: 2, active: true, note: "Save ৳400 when you come together" },
    ],
    locationIds: [LOC],
    channels: ["counter", "online"],
    status: "active",
    archivedAt: null,
    schedule: {
      slotMinutes: 300, sessionMinutes: 90, startTime: "11:00", endTime: "17:30",
      capacityPerSession: 12, dailyCapacity: null, openDays: [3, 5, 6], guideIds: [], exceptions: [],
      dayOverrides: { 3: { startTime: "18:00", endTime: "19:30" } },
    },
    sessionNames: { "11:00": "Morning session", "16:00": "Afternoon session", "18:00": "After-work session" },
    policies: POLICY,
    addOns: [{ id: "add_dm_kit", name: "Take-home matcha kit", price: 180000, perPerson: false, itemId: "inv_doers_kit" }],
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "prd_doers_sushi",
    name: "Sushi Making Class",
    description:
      "Roll your own maki and nigiri with a chef. Two hours at the counter, then you eat what you made. Fish and vegetarian options on the day.",
    images: [],
    bookingType: "BT-03",
    tiers: [
      { id: "tier_ds_seat", name: "Seat", price: 350000, active: true, note: "Ingredients and your rolls to eat" },
      { id: "tier_ds_pair", name: "Two seats (bring a friend)", price: 650000, admits: 2, active: true, note: "Save ৳500 when you come together" },
    ],
    locationIds: [LOC],
    channels: ["counter", "online"],
    status: "active",
    archivedAt: null,
    schedule: {
      slotMinutes: 300, sessionMinutes: 120, startTime: "12:00", endTime: "19:00",
      capacityPerSession: 10, dailyCapacity: null, openDays: [5, 6], guideIds: [], exceptions: [],
    },
    sessionNames: { "12:00": "Lunch class", "17:00": "Evening class" },
    policies: POLICY,
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "prd_doers_tea",
    name: "Tea Tasting Session",
    description:
      "Six teas from leaf to cup — how they're grown, how to brew them and how to taste them. 75 minutes, slow and social.",
    images: [],
    bookingType: "BT-03",
    tiers: [{ id: "tier_dt_seat", name: "Seat", price: 180000, active: true, note: "Six teas and small bites" }],
    locationIds: [LOC],
    channels: ["counter", "online"],
    status: "active",
    archivedAt: null,
    schedule: {
      slotMinutes: 75, sessionMinutes: 75, startTime: "17:00", endTime: "18:15",
      capacityPerSession: 14, dailyCapacity: null, openDays: [0, 3], guideIds: [], exceptions: [],
    },
    sessionNames: { "17:00": "Sunset tasting" },
    policies: POLICY,
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "prd_doers_social",
    name: "Doers Social Night",
    description:
      "Meet people who make things. Short show-and-tell, a mini hands-on challenge and a long chat over drinks. Come alone — most people do.",
    images: [],
    bookingType: "BT-03",
    tiers: [
      { id: "tier_dn_gen", name: "Entry", price: 120000, active: true, note: "Includes one drink" },
    ],
    locationIds: [LOC],
    channels: ["counter", "online"],
    status: "active",
    archivedAt: null,
    schedule: {
      slotMinutes: 120, sessionMinutes: 120, startTime: "19:00", endTime: "21:00",
      capacityPerSession: 30, dailyCapacity: null, openDays: [4], guideIds: [], exceptions: [],
    },
    policies: { ...POLICY, partyMax: 4 },
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "prd_doers_pass",
    name: "Doers Pass — 5 workshops",
    description: "Five workshop credits to use on any matcha, sushi or tea session within 90 days.",
    images: [],
    bookingType: "BT-12",
    tiers: [{ id: "tier_dp", name: "Pass", price: 1100000, active: true, note: "Five workshops, about ৳2,200 each" }],
    credits: { count: 5, expiryDays: 90, productIds: ["prd_doers_matcha", "prd_doers_sushi", "prd_doers_tea"] },
    creditsPerBooking: 1,
    locationIds: [LOC],
    channels: ["counter", "online"],
    status: "active",
    archivedAt: null,
    createdAt: T,
    updatedAt: T,
  },
];

export const doersStorefronts: Storefront[] = [
  {
    id: `sf_${LOC}`,
    locationId: LOC,
    slug: "thedoersclub",
    published: true,
    headline: "Spend a day creating, not just consuming.",
    intro:
      "The Doers Club is a social experience club in Dhaka. Small-group workshops where you make something with your own hands — whisk matcha, roll sushi, taste tea — and meet the people who came to do the same. Seats are limited, so book ahead.",
    featured: ["prd_doers_matcha", "prd_doers_sushi", "prd_doers_tea", "prd_doers_social", "prd_doers_pass"],
    links: [
      { id: "sfl_doers_ig", label: "Follow us on Instagram", url: "https://www.instagram.com/thedoersclub_dhaka/" },
      { id: "sfl_doers_fb", label: "Find us on Facebook", url: "https://www.facebook.com/profile.php?id=61592627544790" },
    ],
    accent: "green",
    createdAt: T,
    updatedAt: T,
  },
];

export const doersInventoryItems: InventoryItem[] = [
  {
    id: "inv_doers_kit", name: "Take-home matcha kit", sku: "DC-MATCHA-KIT", kind: "merch", unit: "each",
    price: 180000, cost: 95000, taxClass: "standard", tracked: true, returnable: false, lowAt: 5,
    locationIds: [LOC], atCounter: true, status: "active", createdAt: T, updatedAt: T,
  },
  {
    id: "inv_doers_tote", name: "Doers Club tote bag", sku: "DC-TOTE", kind: "merch", unit: "each",
    price: 80000, cost: 30000, taxClass: "standard", tracked: true, returnable: false, lowAt: 8,
    locationIds: [LOC], atCounter: true, status: "active", createdAt: T, updatedAt: T,
  },
];

const at = (days: number) => `${demoDay(days)}T09:00:00+06:00`;
export const doersStockMovements: StockMovement[] = [
  { id: "mv_dc_1", itemId: "inv_doers_kit", locationId: LOC, kind: "received", quantity: 30, reason: "Opening stock", by: "Nadia Islam", at: at(-30) },
  { id: "mv_dc_2", itemId: "inv_doers_tote", locationId: LOC, kind: "received", quantity: 40, reason: "Opening stock", by: "Nadia Islam", at: at(-30) },
  { id: "mv_dc_3", itemId: "inv_doers_kit", locationId: LOC, kind: "sold", quantity: -24, by: "Counter", at: at(-3) },
  { id: "mv_dc_4", itemId: "inv_doers_tote", locationId: LOC, kind: "sold", quantity: -11, by: "Counter", at: at(-2) },
];
