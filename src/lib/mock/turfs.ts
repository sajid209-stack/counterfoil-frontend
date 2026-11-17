/* ───────────────────────────────────────────────────────────────────────────
   Turf operator training demos — four Bangladeshi venues, each a whole business
   (its own venue, fields, catalogue, storefront and sales), so a trainee sets
   up and sells on a place that looks like theirs and nothing else is mixed in.

   1. Kickoff Turf          one turf, 90-minute slots (most turfs in Dhaka)
   2. Arena 360             indoor + outdoor turf, and a swimming pool
   3. Rally Sports Hub      one turf, one badminton court, a swimming pool
   4. Green Field Club      one turf shared by football and cricket, a pool

   Turfs and the badminton court are exclusive resources sold by the slot
   (BT-04): one booking takes the whole field for that slot. The pool is sold
   like a ticket (BT-03): a timed session with a headcount, one ticket per
   swimmer. Prices are illustrative.

   As with doers.ts, the venue keeps the internal ids `loc_fort` and
   `cnt_fort_main` (never shown) because the session's paired counter and the
   shared staff are keyed to them. Nothing outside `src/lib/api/client.ts`
   imports this file.
   ────────────────────────────────────────────────────────────────────────── */
import type { AccentColor, Booking, Counter, Location, Product, Resource, Storefront } from "@/lib/api/types";
import { seedDay as demoDay } from "@/lib/schedule";

const T = "2026-06-01T10:00:00+06:00";
const LOC = "loc_fort";
const tk = (n: number) => n * 100; // taka → minor units

export type TurfDemoId = "kickoff" | "arena" | "rally" | "greenfield";

export interface TurfDemo {
  id: TurfDemoId;
  slug: string;
  operator: { name: string; currency: "BDT"; website?: string; receiptFooter: string };
  locations: Location[];
  counters: Counter[];
  resources: Resource[];
  products: Product[];
  storefronts: Storefront[];
  /** A few bookings on today's slots so the day view and the till open busy. */
  todayBookings: Booking[];
}

/* ── shared pieces ─────────────────────────────────────────────────────────── */

const location = (name: string, addressLine1: string, opensAt = "06:00", closesAt = "23:59"): Location => ({
  id: LOC, name, addressLine1, city: "Dhaka", country: "Bangladesh", timezone: "Asia/Dhaka",
  openingHours: ([0, 1, 2, 3, 4, 5, 6] as const).map((dayOfWeek) => ({ dayOfWeek, intervals: [{ opensAt, closesAt }] })),
  status: "active", createdAt: T, updatedAt: T,
});

const counter = (name: string): Counter => ({
  id: "cnt_fort_main", name, locationId: LOC, allowedProductIds: "all",
  allowedPaymentMethods: ["cash", "bkash", "bangla_qr", "card_terminal"], status: "active", createdAt: T, updatedAt: T,
});

const field = (id: string, name: string, noun = "Turf", nounPlural = "Turfs", premium?: number): Resource => ({
  id, name, nounSingular: noun, nounPlural, locationId: LOC, outOfService: false, outOfServiceReason: null,
  ...(premium ? { rateOverride: { kind: "premium" as const, amount: tk(premium) } } : {}),
  status: "active", createdAt: T, updatedAt: T,
});

const SLOT_POLICY = {
  salesWindowDays: 30, cutoffMinutes: 0, cancellation: "free_until" as const, cancelHours: 24, cancelFeePct: 0,
  reschedule: "until" as const, rescheduleHours: 12, reentry: "single" as const, deposit: "full" as const, depositPct: 0,
  partyMin: 1, partyMax: 22,
};
const POOL_POLICY = { ...SLOT_POLICY, cancellation: "none" as const, cancelHours: 0, reschedule: "none" as const, rescheduleHours: 0, partyMax: 10 };

const IMG = {
  turf1: { url: "/demo/pages/turf-1.jpg", alt: "A small football pitch lit by floodlights at dusk with players on the grass" },
  turf2: { url: "/demo/pages/turf-2.jpg", alt: "Players chasing the ball on a small artificial-turf pitch at night" },
  turf4: { url: "/demo/pages/turf-4.jpg", alt: "A marked football pitch with goals seen from above" },
  cricket: { url: "/seed/cricket.jpg", alt: "A cricket pitch" },
  badminton: { url: "/demo/pages/badminton-1.jpg", alt: "An indoor sports hall with a badminton court marked on a wooden floor" },
  swim1: { url: "/demo/pages/swim-1.jpg", alt: "An empty swimming pool with lane ropes" },
  swim2: { url: "/demo/pages/swim-2.jpg", alt: "Swimmers in the lanes of a bright blue pool" },
};
const imgs = (p: string, ...keys: (keyof typeof IMG)[]) => keys.map((k, i) => ({ id: `img_${p}_${i + 1}`, ...IMG[k] }));

/** A turf (or court) sold by the slot: one booking takes the whole field. 90-minute
 *  slots from 7:00 AM, the last starting 10:00 PM and ending 11:30 PM. */
function slotProduct(o: {
  id: string; name: string; description: string; images: Product["images"]; resourceIds: string[];
  price: number; eveningPrice: number; weekendPrice?: number; minutes?: number; first?: string; last?: string; partyMax?: number;
}): Product {
  const minutes = o.minutes ?? 90;
  return {
    id: o.id, name: o.name, description: o.description, images: o.images, bookingType: "BT-04",
    tiers: [{ id: `${o.id}_slot`, name: minutes === 90 ? "90-minute slot" : `${minutes}-minute slot`, price: tk(o.price), active: true }],
    locationIds: [LOC], channels: ["counter", "online"], status: "active", archivedAt: null,
    schedule: {
      slotMinutes: minutes, sessionMinutes: minutes, startTime: o.first ?? "07:00", endTime: o.last ?? "22:00",
      capacityPerSession: 1, dailyCapacity: null, openDays: [0, 1, 2, 3, 4, 5, 6], guideIds: [], exceptions: [],
    },
    resourceIds: o.resourceIds, resourceExclusive: true, bufferMinutes: 0, pricingBasis: "per_booking",
    // Evenings cost more, and Friday/Saturday evenings most; first match wins.
    pricingRules: [
      ...(o.weekendPrice ? [{ id: `${o.id}_pr_wknd`, days: [5, 6], fromTime: "16:00", toTime: "23:59", price: tk(o.weekendPrice) }] : []),
      { id: `${o.id}_pr_eve`, days: [], fromTime: "16:00", toTime: "23:59", price: tk(o.eveningPrice) },
    ],
    policies: { ...SLOT_POLICY, partyMax: o.partyMax ?? 22 },
    createdAt: T, updatedAt: T,
  };
}

/** The pool, sold like a ticket: a one-hour session with a headcount, one ticket
 *  per swimmer. Mornings and late afternoons have their own named sessions. */
function poolProduct(p: string, capacity: number, adult: number, child: number): Product {
  return {
    id: `prd_${p}_pool`, name: "Swimming Pool — Session Ticket",
    description: "A one-hour swim session. One ticket per swimmer; pick a session time. Swimwear and cap required; lockers free.",
    images: imgs(`${p}_pool`, "swim1", "swim2"), bookingType: "BT-03",
    tiers: [
      { id: `tier_${p}_pool_adult`, name: "Adult", price: tk(adult), active: true },
      { id: `tier_${p}_pool_child`, name: "Child (under 12)", price: tk(child), active: true },
    ],
    locationIds: [LOC], channels: ["counter", "online"], status: "active", archivedAt: null,
    schedule: {
      slotMinutes: 60, sessionMinutes: 60, startTime: "06:00", endTime: "20:00",
      capacityPerSession: capacity, dailyCapacity: null, openDays: [0, 1, 2, 3, 4, 5, 6], guideIds: [], exceptions: [],
    },
    sessionNames: { "06:00": "Early swim", "10:00": "Ladies only", "11:00": "Ladies only", "16:00": "Kids & family", "20:00": "Night swim" },
    pricingBasis: "per_person",
    policies: POOL_POLICY,
    createdAt: T, updatedAt: T,
  };
}

const storefront = (slug: string, headline: string, intro: string, featured: string[], heroImage: string, accent: AccentColor): Storefront => ({
  id: `sf_${LOC}`, locationId: LOC, slug, published: true, headline, intro, featured, links: [], accent, heroImage, createdAt: T, updatedAt: T,
});

/** A booking on today's slot (or a few days out), for the day view. */
const booked = (id: string, productId: string, resourceId: string, day: number, time: string, minutes = 90): Booking => {
  const date = demoDay(day);
  const [h, m] = time.split(":").map(Number);
  const end = h * 60 + m + minutes;
  const hh = String(Math.floor(end / 60)).padStart(2, "0"), mm = String(end % 60).padStart(2, "0");
  return {
    id, orderId: "ord_seed", productId, locationId: LOC, resourceId,
    slotStart: `${date}T${time}:00+06:00`, slotEnd: `${date}T${hh}:${mm}:00+06:00`,
    // A whole-field booking takes the one place the slot has, whoever turns up.
    partySize: 1, status: "confirmed",
  } as Booking;
};

/* ── 1. Kickoff Turf — one turf, 90-minute slots ───────────────────────────── */

const kickoff: TurfDemo = {
  id: "kickoff",
  slug: "kickoffturf",
  operator: { name: "Kickoff Turf", currency: "BDT", website: "facebook.com/kickoffturf", receiptFooter: "Thanks for playing at Kickoff Turf. Please arrive 10 minutes before your slot." },
  locations: [location("Kickoff Turf", "Road 27, Dhanmondi")],
  counters: [counter("Turf desk")],
  resources: [field("res_ko_turf", "Main Turf")],
  products: [
    slotProduct({
      id: "prd_ko_turf", name: "Turf Booking — 90 min",
      description: "Book the whole turf for 90 minutes. 5-a-side or 7-a-side, floodlit at night. Bibs and a ball at the desk.",
      images: imgs("ko", "turf1", "turf2"), resourceIds: ["res_ko_turf"], price: 3000, eveningPrice: 4000, weekendPrice: 4500, partyMax: 14,
    }),
  ],
  storefronts: [],
  todayBookings: [
    booked("bkg_ko_1", "prd_ko_turf", "res_ko_turf", 0, "16:00"),
    booked("bkg_ko_2", "prd_ko_turf", "res_ko_turf", 0, "19:00"),
    booked("bkg_ko_3", "prd_ko_turf", "res_ko_turf", 0, "20:30"),
    booked("bkg_ko_4", "prd_ko_turf", "res_ko_turf", 1, "20:30"),
  ],
};
kickoff.storefronts = [storefront("kickoffturf", "Book the turf in 90-minute slots.", "One floodlit turf in Dhanmondi, open 7 AM to 11:30 PM every day. Pick a slot, pay with bKash, and show your ticket at the desk.", ["prd_ko_turf"], IMG.turf1.url, "green")];

/* ── 2. Arena 360 — indoor + outdoor turf, and a pool ──────────────────────── */

const arena: TurfDemo = {
  id: "arena",
  slug: "arena360",
  operator: { name: "Arena 360", currency: "BDT", website: "facebook.com/arena360bd", receiptFooter: "Thanks for coming to Arena 360. Turf players arrive 10 minutes early; swimmers bring a cap." },
  locations: [location("Arena 360", "Sector 7, Uttara")],
  counters: [counter("Front desk")],
  resources: [
    field("res_ar_out", "Outdoor Turf"),
    // Indoor is covered and air-cooled, so it costs ৳1,000 more per slot.
    field("res_ar_in", "Indoor Turf", "Turf", "Turfs", 1000),
  ],
  products: [
    slotProduct({
      id: "prd_ar_turf", name: "Turf Booking — 90 min",
      description: "Two turfs: the outdoor turf under floodlights, or the covered, air-cooled indoor turf (৳1,000 more). Pick the turf, then a 90-minute slot.",
      images: imgs("ar", "turf2", "turf4"), resourceIds: ["res_ar_out", "res_ar_in"], price: 3000, eveningPrice: 4000, weekendPrice: 4500, partyMax: 14,
    }),
    poolProduct("ar", 40, 500, 300),
  ],
  storefronts: [],
  todayBookings: [
    booked("bkg_ar_1", "prd_ar_turf", "res_ar_out", 0, "17:30"),
    booked("bkg_ar_2", "prd_ar_turf", "res_ar_out", 0, "20:30"),
    booked("bkg_ar_3", "prd_ar_turf", "res_ar_in", 0, "16:00"),
    booked("bkg_ar_4", "prd_ar_turf", "res_ar_in", 0, "19:00"),
    booked("bkg_ar_5", "prd_ar_turf", "res_ar_in", 0, "22:00"),
  ],
};
arena.storefronts = [storefront("arena360", "Indoor turf, outdoor turf and a pool.", "Arena 360 in Uttara: two turfs booked in 90-minute slots, and a swimming pool sold by the session. Book online and pay with bKash.", ["prd_ar_turf", "prd_ar_pool"], IMG.turf2.url, "blue")];

/* ── 3. Rally Sports Hub — turf, badminton court, pool ─────────────────────── */

const rally: TurfDemo = {
  id: "rally",
  slug: "rallysportshub",
  operator: { name: "Rally Sports Hub", currency: "BDT", website: "facebook.com/rallysportshub", receiptFooter: "Thanks for playing at Rally Sports Hub. Non-marking shoes on the badminton court, please." },
  locations: [location("Rally Sports Hub", "Block C, Bashundhara R/A")],
  counters: [counter("Front desk")],
  resources: [field("res_ra_turf", "Main Turf"), field("res_ra_court", "Badminton Court", "Court", "Courts")],
  products: [
    slotProduct({
      id: "prd_ra_turf", name: "Turf Booking — 90 min",
      description: "Book the whole turf for 90 minutes, floodlit at night.",
      images: imgs("ra", "turf1", "turf4"), resourceIds: ["res_ra_turf"], price: 3000, eveningPrice: 4000, weekendPrice: 4500, partyMax: 14,
    }),
    slotProduct({
      id: "prd_ra_badminton", name: "Badminton Court — 1 hour",
      description: "Book the court for an hour. Rackets and shuttles to rent at the desk.",
      images: imgs("ra_bd", "badminton"), resourceIds: ["res_ra_court"], price: 800, eveningPrice: 1000, minutes: 60, first: "07:00", last: "22:00", partyMax: 4,
    }),
    poolProduct("ra", 30, 450, 250),
  ],
  storefronts: [],
  todayBookings: [
    booked("bkg_ra_1", "prd_ra_turf", "res_ra_turf", 0, "17:30"),
    booked("bkg_ra_2", "prd_ra_turf", "res_ra_turf", 0, "20:30"),
    booked("bkg_ra_3", "prd_ra_badminton", "res_ra_court", 0, "18:00", 60),
    booked("bkg_ra_4", "prd_ra_badminton", "res_ra_court", 0, "19:00", 60),
    booked("bkg_ra_5", "prd_ra_badminton", "res_ra_court", 0, "21:00", 60),
  ],
};
rally.storefronts = [storefront("rallysportshub", "Turf, badminton and a pool, all in one place.", "Rally Sports Hub in Bashundhara: the turf in 90-minute slots, the badminton court by the hour, and the pool by the session.", ["prd_ra_turf", "prd_ra_badminton", "prd_ra_pool"], IMG.turf1.url, "orange")];

/* ── 4. Green Field Club — one turf for football and cricket, and a pool ───── */

const greenfield: TurfDemo = {
  id: "greenfield",
  slug: "greenfieldclub",
  operator: { name: "Green Field Sports Club", currency: "BDT", website: "facebook.com/greenfieldclubbd", receiptFooter: "Thanks for playing at Green Field. One turf, two games: book early on weekends." },
  locations: [location("Green Field Sports Club", "Section 12, Mirpur")],
  counters: [counter("Front desk")],
  resources: [field("res_gf_turf", "The Turf")],
  products: [
    // Football and cricket are sold on the same turf: booking one takes the
    // other off sale for that slot. That is the lesson of this demo.
    slotProduct({
      id: "prd_gf_football", name: "Football — 90 min",
      description: "The whole turf for football, 90 minutes. Shares the turf with cricket, so a cricket booking takes the same slot off sale.",
      images: imgs("gf_fb", "turf1", "turf2"), resourceIds: ["res_gf_turf"], price: 3000, eveningPrice: 4000, weekendPrice: 4500, partyMax: 14,
    }),
    slotProduct({
      id: "prd_gf_cricket", name: "Box Cricket — 90 min",
      description: "The whole turf set up for box cricket, 90 minutes. Shares the turf with football. Bat, ball and stumps at the desk.",
      images: imgs("gf_cr", "cricket", "turf4"), resourceIds: ["res_gf_turf"], price: 3500, eveningPrice: 4500, weekendPrice: 5000, partyMax: 16,
    }),
    poolProduct("gf", 35, 400, 250),
  ],
  storefronts: [],
  todayBookings: [
    booked("bkg_gf_1", "prd_gf_football", "res_gf_turf", 0, "16:00"),
    booked("bkg_gf_2", "prd_gf_cricket", "res_gf_turf", 0, "17:30"),
    booked("bkg_gf_3", "prd_gf_football", "res_gf_turf", 0, "19:00"),
    booked("bkg_gf_4", "prd_gf_cricket", "res_gf_turf", 0, "20:30"),
  ],
};
greenfield.storefronts = [storefront("greenfieldclub", "Football or cricket, on one turf. And a pool.", "Green Field Sports Club in Mirpur: one turf you can book for football or box cricket in 90-minute slots, and a pool sold by the session.", ["prd_gf_football", "prd_gf_cricket", "prd_gf_pool"], IMG.turf4.url, "green")];

export const TURF_DEMOS: Record<TurfDemoId, TurfDemo> = { kickoff, arena, rally, greenfield };
