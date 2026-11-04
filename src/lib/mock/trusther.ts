/* ───────────────────────────────────────────────────────────────────────────
   TrustHer partner demos: four US businesses, each a whole business like The
   Doers Club — its own venue, counter, catalogue, shelf and storefront — so a
   TrustHer operator sees Counterfoil as *her* kind of business.

     kinks    Kinks & Crowns Hair Studio, Detroit     appointments with a stylist
     sweat    Sweat Sisters Studio, Atlanta           classes and a class pack
     velvet   The Velvet Hour, Miami                  ticketed events, lounge hire
     mamajos  Mama Jo's Supper Club, New Orleans      seatings, a class, private dining

   The businesses are invented. Prices are in US cents, tax is the state's sales
   tax, and payments are cash, card and Cash App Pay at the counter (lib/region).

   Like doers.ts, the venue keeps the internal id `loc_fort` and the counter
   `cnt_fort_main`: the session's paired counter and the shared staff are keyed
   to them. Staff keep their ids too and only change names (see `usStaff`).

   IMPORTANT: like data.ts, nothing outside `src/lib/api/client.ts` imports this.
   ────────────────────────────────────────────────────────────────────────── */
import type {
  Counter, InventoryItem, Location, PaymentAccount, Product, ProductPage, Resource, Staff, StockMovement, Storefront, TaxConfig,
} from "@/lib/api/types";
import { seedDay as demoDay } from "@/lib/schedule";

const T = "2026-06-01T10:00:00-04:00";
const LOC = "loc_fort";

export type TrustherId = "kinks" | "sweat" | "velvet" | "mamajos";

export interface TrustherDemo {
  id: TrustherId;
  slug: string;
  operator: { name: string; currency: string; defaultTimezone: string; taxRatePct: number; reducedRatePct: number; contactPhone: string; contactEmail: string; website: string; receiptFooter: string };
  tax: TaxConfig;
  locations: Location[];
  counters: Counter[];
  products: Product[];
  storefronts: Storefront[];
  inventoryItems: InventoryItem[];
  stockMovements: StockMovement[];
  resources: Resource[];
  /** Seed staff id → this business's person. */
  staffNames: Record<string, { name: string; email: string | null }>;
  /** Area code for the generated customers' phones. */
  areaCode: string;
}

/* ── Shared bits ───────────────────────────────────────────────────────── */

const hours = (open: string, close: string, closedDays: number[] = []): Location["openingHours"] =>
  ([0, 1, 2, 3, 4, 5, 6] as const).map((d) => ({ dayOfWeek: d, intervals: closedDays.includes(d) ? [] : [{ opensAt: open, closesAt: close }] }));

const location = (name: string, addressLine1: string, city: string, timezone: string, openingHours: Location["openingHours"]): Location => ({
  id: LOC, name, addressLine1, city, country: "United States", timezone, openingHours, status: "active", createdAt: T, updatedAt: T,
});

const counter = (name: string): Counter => ({
  id: "cnt_fort_main", name, locationId: LOC, allowedProductIds: "all",
  allowedPaymentMethods: ["cash", "card_terminal", "cashapp"], status: "active", createdAt: T, updatedAt: T,
});

const salesTax = (bps: number, state: string): TaxConfig => ({
  mode: "exclusive", rateBasisPoints: bps, taxName: "Sales tax", registrationNumber: `${state} sales tax permit`, showOnReceipts: true,
});

/** A card processor that is live, so the till offers card and Cash App Pay. */
export const usPaymentAccounts: PaymentAccount[] = [
  {
    id: "pacct_stripe_us", locationId: null, provider: "stripe", posture: "connect", status: "active",
    chargesEnabled: true, payoutsEnabled: true, requirementsDue: [], country: "US", defaultCurrency: "USD",
    providerAccountRef: "acct_demo_us", createdAt: T, updatedAt: T,
  },
];

const POLICY = {
  salesWindowDays: 60, cutoffMinutes: 120, cancellation: "free_until" as const, cancelHours: 24, cancelFeePct: 0,
  reschedule: "until" as const, rescheduleHours: 24, reentry: "single" as const, deposit: "full" as const, depositPct: 0,
  partyMin: 1, partyMax: 6,
};

const page = (p: Partial<ProductPage> & Pick<ProductPage, "look" | "sections">): ProductPage => ({
  stats: [], highlights: [], info: [], faq: [], lineup: [], sponsors: [],
  countdown: { mode: "off", hideAtZero: true },
  ...p,
});

/** Photos live in public/demo/<id>/. A file is only used once it is listed in
 *  that demo's PHOTOS_PRESENT, so a photo not yet added never shows broken. */
function photoKit(id: TrustherId, present: string[], map: Record<string, { file: string; alt: string }[]>) {
  const has = (file: string) => present.includes(file);
  return {
    hero: has("hero.jpg") ? `/demo/${id}/hero.jpg` : null,
    images: (productId: string) =>
      (map[productId] ?? []).filter((ph) => has(ph.file)).map((ph, i) => ({ id: `img_${productId}_${i}`, url: `/demo/${id}/${ph.file}`, alt: ph.alt })),
  };
}

const item = (id: string, name: string, sku: string, price: number, cost: number, lowAt = 5): InventoryItem => ({
  id, name, sku, kind: "merch", unit: "each", price, cost, taxClass: "standard", tracked: true, returnable: false, lowAt,
  locationIds: [LOC], atCounter: true, status: "active", createdAt: T, updatedAt: T,
});

const at = (days: number) => `${demoDay(days)}T10:00:00-04:00`;
const stock = (prefix: string, by: string, rows: [string, number, number][]): StockMovement[] =>
  rows.flatMap(([itemId, received, sold], i) => [
    { id: `mv_${prefix}_${i}_in`, itemId, locationId: LOC, kind: "received" as const, quantity: received, reason: "Opening stock", by, at: at(-30) },
    { id: `mv_${prefix}_${i}_out`, itemId, locationId: LOC, kind: "sold" as const, quantity: -sold, by: "Counter", at: at(-2) },
  ]);

/* ═══ 1 · Kinks & Crowns Hair Studio — Detroit ═══════════════════════════ */

const KINKS_PHOTOS: string[] = ["hero.jpg", "silk-press.jpg", "braids.jpg", "locs.jpg", "twist-out.jpg"];
const kinksPh = photoKit("kinks", KINKS_PHOTOS, {
  prd_kc_silk: [{ file: "silk-press.jpg", alt: "A fresh silk press, glossy and full of movement" }],
  prd_kc_braids: [{ file: "braids.jpg", alt: "Long knotless braids, neatly parted" }],
  prd_kc_locs: [{ file: "locs.jpg", alt: "A loc retwist in progress at the chair" }],
  prd_kc_twist: [{ file: "twist-out.jpg", alt: "A defined twist-out on natural hair" }],
});

const STYLISTS = ["stf_nadia", "stf_karim", "stf_tania"];
const stylistService = (
  id: string, name: string, description: string, price: number, minutes: number, extra: Partial<Product> = {},
): Product => ({
  id, name, description, images: [], bookingType: "BT-10",
  tiers: [{ id: `tier_${id}`, name, price, active: true }],
  locationIds: [LOC], channels: ["counter", "online"], status: "active", archivedAt: null, schedule: null,
  providerIds: STYLISTS, providerNoun: "Stylist", providerPickable: true, flexibleDurations: [minutes],
  providerPremiums: { stf_nadia: 1500 },
  providerDurations: Object.fromEntries(STYLISTS.map((s) => [s, [minutes]])),
  policies: { ...POLICY, cancellation: "fee", cancelHours: 24, cancelFeePct: 50, deposit: "percent", depositPct: 25, partyMax: 1 },
  createdAt: T, updatedAt: T,
  ...extra,
});

const kinksBase: Product[] = [
  stylistService("prd_kc_silk", "Silk Press", "Wash, deep condition, blow-out and a press that moves. Heat protectant on every pass, and a trim if you want one.", 9500, 120, {
    addOns: [{ id: "add_kc_trim", name: "Dusting trim", price: 1500, perPerson: false }],
  }),
  stylistService("prd_kc_braids", "Knotless Braids", "Medium knotless braids to mid-back, hair included. Plan on most of the day — bring a charger and a show to watch.", 25000, 300),
  stylistService("prd_kc_locs", "Loc Retwist", "Wash, retwist and style for established locs. Ask about a detox add-on for buildup.", 11000, 120, {
    addOns: [{ id: "add_kc_detox", name: "Loc detox", price: 2500, perPerson: false }],
  }),
  stylistService("prd_kc_twist", "Wash & Twist-Out", "Cleanse, condition and two-strand twists set for a defined twist-out. Natural hair, any length.", 8500, 90),
];

const KC = { primary: "#7a3b2e", secondary: "#b8902a", background: "#f8f1e8", surface: "#fffaf4", text: "#2a1a14" };
const kinksPages: Record<string, { slug: string; page: ProductPage }> = {
  prd_kc_silk: {
    slug: "silk-press",
    page: page({
      look: "standard", tagline: "Swing, shine and no heat damage.",
      sections: ["hero", "highlights", "about", "included", "gallery", "faq", "know", "venue", "tickets"],
      highlights: [
        { id: "h1", label: "Healthy heat", description: "Low temperature, more passes, protectant every time." },
        { id: "h2", label: "Choose your stylist", description: "Book the person who knows your hair." },
        { id: "h3", label: "Two hours, start to finish", description: "Wash, treatment, blow-out and press." },
      ],
      faq: [
        { id: "f1", q: "How long will it last?", a: "Two to three weeks with a satin bonnet and no sweat sessions. We'll show you how to wrap it." },
        { id: "f2", q: "Why is there a deposit?", a: "It holds your stylist's chair. It comes off the price on the day." },
      ],
    }),
  },
  prd_kc_braids: {
    slug: "knotless-braids",
    page: page({
      look: "arts", styleSource: "custom", style: { hero: "collage", badge: "Hair included" },
      tagline: "Light on your scalp from day one.",
      sections: ["hero", "stats", "about", "included", "gallery", "faq", "know", "venue", "tickets"],
      stats: [
        { id: "s1", value: "5 hr", label: "in the chair" },
        { id: "s2", value: "6–8", label: "weeks of wear" },
        { id: "s3", value: "25%", label: "deposit to book" },
      ],
      faq: [
        { id: "f1", q: "Do I need to bring hair?", a: "No. Pre-stretched braiding hair is included in your colour." },
        { id: "f2", q: "Should I come washed?", a: "Yes — washed, blow-dried and detangled, so the time goes on the braids." },
      ],
    }),
  },
  prd_kc_locs: {
    slug: "loc-retwist",
    page: page({
      look: "standard", tagline: "Fresh roots, clean locs.",
      sections: ["hero", "about", "included", "gallery", "faq", "know", "venue", "tickets"],
      faq: [{ id: "f1", q: "How often should I come in?", a: "Every four to six weeks keeps your roots neat without stressing them." }],
    }),
  },
  prd_kc_twist: {
    slug: "wash-and-twist-out",
    page: page({
      look: "standard", tagline: "Definition that lasts all week.",
      sections: ["hero", "about", "included", "gallery", "faq", "know", "venue", "tickets"],
      faq: [{ id: "f1", q: "Will you teach me to keep it?", a: "Yes. We'll show you how to pineapple and refresh it at home." }],
    }),
  },
};

const kinks: TrustherDemo = {
  id: "kinks",
  slug: "kinksandcrowns",
  operator: {
    name: "Kinks & Crowns Hair Studio", currency: "USD", defaultTimezone: "America/Detroit", taxRatePct: 6, reducedRatePct: 0,
    contactPhone: "(313) 555-0142", contactEmail: "hello@kinksandcrowns.example", website: "kinksandcrowns.example",
    receiptFooter: "Thank you for trusting us with your crown. Wrap it tonight!",
  },
  tax: salesTax(600, "Michigan"),
  locations: [location("Kinks & Crowns Hair Studio", "4620 Woodward Ave", "Detroit, MI 48201", "America/Detroit", hours("09:00", "19:00", [0, 1]))],
  counters: [counter("Front desk")],
  products: kinksBase.map((p) => ({ ...p, ...kinksPages[p.id], images: kinksPh.images(p.id) })),
  storefronts: [{
    id: `sf_${LOC}`, locationId: LOC, slug: "kinksandcrowns", published: true,
    headline: "Natural hair, handled with care.",
    intro: "A Black woman–owned studio in Midtown Detroit for silk presses, braids, locs and natural styles. Pick your stylist, pick your time, and pay a small deposit to hold the chair.",
    featured: ["prd_kc_silk", "prd_kc_braids", "prd_kc_locs", "prd_kc_twist"],
    contactPhone: "(313) 555-0142", contactEmail: "hello@kinksandcrowns.example",
    links: [{ id: "sfl_kc_ig", label: "See our work on Instagram", url: "https://instagram.com/" }],
    accent: "rose", heroImage: kinksPh.hero,
    style: { ...KC, headingFont: "playfair", bodyFont: "dm-sans", headingWeight: 600, corners: "soft", buttonStyle: "pill", cardStyle: "bordered", hero: "split", dividers: "line", imageTone: "warm", ctaLabel: "Book your chair" },
    createdAt: T, updatedAt: T,
  }],
  inventoryItems: [
    item("inv_kc_edge", "Edge control", "KC-EDGE", 1400, 500),
    item("inv_kc_bonnet", "Satin bonnet", "KC-BONNET", 1800, 600),
    item("inv_kc_oil", "Scalp & hair oil", "KC-OIL", 2200, 800),
  ],
  stockMovements: stock("kc", "Tasha Monroe", [["inv_kc_edge", 40, 17], ["inv_kc_bonnet", 30, 12], ["inv_kc_oil", 24, 9]]),
  resources: [],
  staffNames: {
    stf_rahim: { name: "Tasha Monroe", email: "tasha@kinksandcrowns.example" },
    stf_nadia: { name: "Imani Brooks", email: "imani@kinksandcrowns.example" },
    stf_karim: { name: "Keisha Williams", email: "keisha@kinksandcrowns.example" },
    stf_tania: { name: "Aaliyah Grant", email: "aaliyah@kinksandcrowns.example" },
  },
  areaCode: "313",
};

/* ═══ 2 · Sweat Sisters Studio — Atlanta ═════════════════════════════════ */

const SWEAT_PHOTOS: string[] = ["hero.jpg", "sculpt.jpg", "dance.jpg", "yoga.jpg", "pack.jpg"];
const sweatPh = photoKit("sweat", SWEAT_PHOTOS, {
  prd_ss_sculpt: [{ file: "sculpt.jpg", alt: "A full sculpt class lifting dumbbells together" }],
  prd_ss_dance: [{ file: "dance.jpg", alt: "Women dancing in a bright studio, mid-move" }],
  prd_ss_yoga: [{ file: "yoga.jpg", alt: "A slow yoga flow in warm evening light" }],
  prd_ss_pack: [{ file: "pack.jpg", alt: "Mats, water bottles and grip socks laid out" }],
});

const classTiers = (id: string, price: number) => [
  { id: `tier_${id}_drop`, name: "Drop-in", price, active: true, note: "One class" },
  { id: `tier_${id}_intro`, name: "First class with us", price: 1500, active: true, note: "New here? Your first class is $15" },
];

const sweatBase: Product[] = [
  {
    id: "prd_ss_sculpt", name: "Sculpt & Tone", images: [], bookingType: "BT-03",
    description: "Forty-five minutes of strength work with light weights and bands. Every move has an easier and a harder version.",
    tiers: classTiers("ss_sculpt", 2800), locationIds: [LOC], channels: ["counter", "online"], status: "active", archivedAt: null,
    schedule: { slotMinutes: 360, sessionMinutes: 45, startTime: "06:00", endTime: "18:45", capacityPerSession: 20, dailyCapacity: null, openDays: [1, 2, 3, 4, 5, 6], guideIds: [], exceptions: [] },
    sessionNames: { "06:00": "Sunrise sculpt", "12:00": "Lunch break sculpt", "18:00": "After-work sculpt" },
    policies: { ...POLICY, cancelHours: 12, partyMax: 2 }, createdAt: T, updatedAt: T,
  },
  {
    id: "prd_ss_dance", name: "Afrobeats Dance Cardio", images: [], bookingType: "BT-03",
    description: "An hour of Afrobeats, amapiano and dancehall choreography that sneaks in a serious workout. No dance experience needed.",
    tiers: classTiers("ss_dance", 3000), locationIds: [LOC], channels: ["counter", "online"], status: "active", archivedAt: null,
    schedule: { slotMinutes: 60, sessionMinutes: 60, startTime: "19:00", endTime: "19:00", capacityPerSession: 25, dailyCapacity: null, openDays: [2, 4, 6], guideIds: [], exceptions: [], dayOverrides: { 6: { startTime: "10:00", endTime: "10:00" } } },
    policies: { ...POLICY, cancelHours: 12, partyMax: 4 }, createdAt: T, updatedAt: T,
  },
  {
    id: "prd_ss_yoga", name: "Slow Flow Yoga", images: [], bookingType: "BT-03",
    description: "Sixty unhurried minutes of stretching, breath and rest. Good after a hard week, or a hard sculpt class.",
    tiers: classTiers("ss_yoga", 2500), locationIds: [LOC], channels: ["counter", "online"], status: "active", archivedAt: null,
    schedule: { slotMinutes: 690, sessionMinutes: 60, startTime: "08:00", endTime: "19:30", capacityPerSession: 18, dailyCapacity: null, openDays: [0, 3], guideIds: [], exceptions: [] },
    sessionNames: { "08:00": "Morning flow", "19:30": "Evening wind-down" },
    policies: { ...POLICY, cancelHours: 12, partyMax: 2 }, createdAt: T, updatedAt: T,
  },
  {
    id: "prd_ss_pack", name: "10-Class Pack", images: [], bookingType: "BT-12",
    description: "Ten classes to use on any sculpt, dance or yoga session within four months.",
    tiers: [{ id: "tier_ss_pack", name: "Pack", price: 22000, active: true, note: "Ten classes, $22 each" }],
    credits: { count: 10, expiryDays: 120, productIds: ["prd_ss_sculpt", "prd_ss_dance", "prd_ss_yoga"] },
    creditsPerBooking: 1, locationIds: [LOC], channels: ["counter", "online"], status: "active", archivedAt: null, createdAt: T, updatedAt: T,
  },
];

const sweatPages: Record<string, { slug: string; page: ProductPage }> = {
  prd_ss_sculpt: {
    slug: "sculpt-and-tone",
    page: page({
      look: "sports", tagline: "Strong, not punished.",
      sections: ["hero", "stats", "about", "schedule", "gallery", "faq", "know", "venue", "tickets"],
      stats: [
        { id: "s1", value: "45", label: "minutes" },
        { id: "s2", value: "20", label: "women a class" },
        { id: "s3", value: "$15", label: "your first class" },
      ],
      faq: [
        { id: "f1", q: "I haven't worked out in years. Can I come?", a: "Yes. Every move has an easier version, and the coach will show it to you." },
        { id: "f2", q: "What do I bring?", a: "Water and grip socks. We have mats and weights." },
      ],
    }),
  },
  prd_ss_dance: {
    slug: "afrobeats-dance-cardio",
    page: page({
      look: "nightlife", styleSource: "custom",
      style: { primary: "#ff5a36", secondary: "#ffd23f", background: "#141014", surface: "#211a21", text: "#fbf6f0", headingFont: "unbounded", bodyFont: "jakarta", corners: "round", buttonStyle: "pill", cardStyle: "tinted", hero: "cover", heroHeight: "tall", overlay: 50, badge: "No dance experience needed", ctaLabel: "Save my spot" },
      tagline: "Sweat to the songs you already love.",
      sections: ["hero", "highlights", "about", "schedule", "gallery", "faq", "venue", "tickets"],
      highlights: [
        { id: "h1", label: "Afrobeats, amapiano, dancehall", description: "A new playlist every month." },
        { id: "h2", label: "Choreography in small pieces", description: "Learned slowly, then danced fast." },
      ],
      faq: [{ id: "f1", q: "Will I look silly?", a: "Everyone does in week one. Nobody minds." }],
    }),
  },
  prd_ss_yoga: {
    slug: "slow-flow-yoga",
    page: page({
      look: "travel", styleSource: "custom",
      style: { primary: "#3d6b5a", secondary: "#c98b5a", background: "#f6f2ea", surface: "#fffdf8", text: "#1f2a24", headingFont: "cormorant", bodyFont: "lora", headingWeight: 600, typeScale: "large", corners: "soft", buttonStyle: "outline", cardStyle: "bordered", hero: "editorial", width: "narrow", ctaLabel: "Book a mat" },
      tagline: "Slow down on purpose.",
      sections: ["hero", "about", "schedule", "gallery", "faq", "know", "venue", "tickets"],
      faq: [{ id: "f1", q: "Is it hot yoga?", a: "No. The room is warm, never hot." }],
    }),
  },
  prd_ss_pack: {
    slug: "ten-class-pack",
    page: page({
      look: "entertainment", tagline: "Ten classes. Your schedule.",
      sections: ["hero", "stats", "highlights", "about", "faq", "tickets"],
      stats: [
        { id: "s1", value: "10", label: "classes" },
        { id: "s2", value: "4", label: "months to use them" },
        { id: "s3", value: "$22", label: "a class" },
      ],
      highlights: [{ id: "h1", label: "Any class", description: "Sculpt, dance or yoga — mix them however you like." }],
      faq: [{ id: "f1", q: "Can I bring a friend on my pack?", a: "Yes. Book two spots and two classes come off." }],
    }),
  },
};

const sweat: TrustherDemo = {
  id: "sweat",
  slug: "sweatsisters",
  operator: {
    name: "Sweat Sisters Studio", currency: "USD", defaultTimezone: "America/New_York", taxRatePct: 8.9, reducedRatePct: 0,
    contactPhone: "(404) 555-0178", contactEmail: "hey@sweatsisters.example", website: "sweatsisters.example",
    receiptFooter: "Proud of you. Drink some water.",
  },
  tax: salesTax(890, "Georgia"),
  locations: [location("Sweat Sisters Studio", "780 Ralph David Abernathy Blvd SW", "Atlanta, GA 30310", "America/New_York", hours("05:45", "21:00"))],
  counters: [counter("Check-in desk")],
  products: sweatBase.map((p) => ({ ...p, ...sweatPages[p.id], images: sweatPh.images(p.id) })),
  storefronts: [{
    id: `sf_${LOC}`, locationId: LOC, slug: "sweatsisters", published: true,
    headline: "Move with women who get it.",
    intro: "A Black woman–owned fitness studio in West End, Atlanta. Strength, dance cardio and slow yoga in small classes, coached by women who want you to come back. Your first class is $15.",
    featured: ["prd_ss_sculpt", "prd_ss_dance", "prd_ss_yoga", "prd_ss_pack"],
    contactPhone: "(404) 555-0178", contactEmail: "hey@sweatsisters.example",
    links: [{ id: "sfl_ss_ig", label: "Follow the studio", url: "https://instagram.com/" }],
    accent: "orange", heroImage: sweatPh.hero,
    style: { primary: "#e4572e", secondary: "#1b998b", background: "#fffdf8", surface: "#ffffff", text: "#141414", headingFont: "archivo-black", bodyFont: "jakarta", headingCase: "upper", typeScale: "compact", corners: "sharp", buttonStyle: "solid", cardStyle: "flat", hero: "cover", heroHeight: "medium", overlay: 45, spacing: "tight", iconStroke: "bold", ctaLabel: "Book a class" },
    createdAt: T, updatedAt: T,
  }],
  inventoryItems: [
    item("inv_ss_bottle", "Sweat Sisters water bottle", "SS-BOTTLE", 2400, 900),
    item("inv_ss_socks", "Grip socks", "SS-SOCKS", 1400, 400, 10),
  ],
  stockMovements: stock("ss", "Monique Hayes", [["inv_ss_bottle", 50, 21], ["inv_ss_socks", 80, 37]]),
  resources: [],
  staffNames: {
    stf_rahim: { name: "Monique Hayes", email: "monique@sweatsisters.example" },
    stf_nadia: { name: "Brianna Lewis", email: "brianna@sweatsisters.example" },
    stf_karim: { name: "Jada Coleman", email: "jada@sweatsisters.example" },
    stf_tania: { name: "Nia Robinson", email: "nia@sweatsisters.example" },
  },
  areaCode: "404",
};

/* ═══ 3 · The Velvet Hour — Miami ════════════════════════════════════════ */

const VELVET_PHOTOS: string[] = ["hero.jpg", "brunch.jpg", "mixer.jpg", "paint-sip.jpg", "rental.jpg"];
const velvetPh = photoKit("velvet", VELVET_PHOTOS, {
  prd_vh_brunch: [{ file: "brunch.jpg", alt: "A sunny day party with a DJ and brunch tables" }],
  prd_vh_mixer: [{ file: "mixer.jpg", alt: "Women talking in small groups at an evening mixer" }],
  prd_vh_paint: [{ file: "paint-sip.jpg", alt: "Easels, paint and wine glasses at a paint and sip" }],
  prd_vh_rental: [{ file: "rental.jpg", alt: "The lounge set up for a private event" }],
});

const velvetBase: Product[] = [
  {
    id: "prd_vh_brunch", name: "Brunch & Vinyl Day Party", images: [], bookingType: "BT-03",
    description: "Sunday brunch, a DJ playing records from the 90s and 2000s, and the whole lounge to dance in. Four hours, from noon.",
    tiers: [
      { id: "tier_vh_br_gen", name: "General", price: 3500, active: true, note: "Entry and one drink" },
      { id: "tier_vh_br_mim", name: "Brunch + bottomless mimosas", price: 6500, active: true, note: "The brunch plate and two hours of mimosas" },
      { id: "tier_vh_br_booth", name: "Booth for six", price: 45000, admits: 6, active: true, note: "A reserved booth, brunch and a bottle" },
    ],
    locationIds: [LOC], channels: ["counter", "online"], status: "active", archivedAt: null,
    schedule: { slotMinutes: 240, sessionMinutes: 240, startTime: "12:00", endTime: "12:00", capacityPerSession: 120, dailyCapacity: null, openDays: [0], guideIds: [], exceptions: [] },
    policies: { ...POLICY, cancelHours: 48, partyMax: 6 }, createdAt: T, updatedAt: T,
  },
  {
    id: "prd_vh_mixer", name: "Women Who Build Mixer", images: [], bookingType: "BT-03",
    description: "An evening for founders, freelancers and women building something of their own. Short talks, real introductions, good drinks.",
    tiers: [
      { id: "tier_vh_mx_gen", name: "General", price: 2500, active: true, note: "Entry and one drink" },
      { id: "tier_vh_mx_head", name: "Mixer + headshot", price: 5500, active: true, note: "A professional headshot taken on the night" },
    ],
    locationIds: [LOC], channels: ["counter", "online"], status: "active", archivedAt: null,
    schedule: { slotMinutes: 180, sessionMinutes: 180, startTime: "19:00", endTime: "19:00", capacityPerSession: 80, dailyCapacity: null, openDays: [4], guideIds: [], exceptions: [] },
    policies: { ...POLICY, partyMax: 4 }, createdAt: T, updatedAt: T,
  },
  {
    id: "prd_vh_paint", name: "Paint & Sip", images: [], bookingType: "BT-03",
    description: "Two and a half hours with an artist, a canvas and a glass of wine. You go home with a painting, whatever it looks like.",
    tiers: [
      { id: "tier_vh_ps_seat", name: "Seat", price: 4800, active: true, note: "Canvas, paints and two drinks" },
      { id: "tier_vh_ps_pair", name: "Two seats", price: 9000, admits: 2, active: true, note: "Save $6 when you come together" },
    ],
    locationIds: [LOC], channels: ["counter", "online"], status: "active", archivedAt: null,
    schedule: { slotMinutes: 150, sessionMinutes: 150, startTime: "19:00", endTime: "19:00", capacityPerSession: 30, dailyCapacity: null, openDays: [5, 6], guideIds: [], exceptions: [] },
    policies: { ...POLICY, partyMax: 6 }, createdAt: T, updatedAt: T,
  },
  {
    id: "prd_vh_rental", name: "Lounge hire", images: [], bookingType: "BT-05",
    description: "The whole lounge for your birthday, baby shower or launch — sound system, lighting and bar included. Book by the hour.",
    tiers: [{ id: "tier_vh_rent_hr", name: "Per hour", price: 25000, active: true }],
    locationIds: [LOC], channels: ["counter", "online"], status: "active", archivedAt: null,
    schedule: { slotMinutes: 60, sessionMinutes: 60, startTime: "10:00", endTime: "22:00", capacityPerSession: 1, dailyCapacity: null, openDays: [1, 2, 3, 4, 5, 6], guideIds: [], exceptions: [] },
    resourceIds: ["res_vh_lounge"], resourceExclusive: true, bufferMinutes: 60, flexibleDurations: [120, 180, 240, 300, 360], pricingBasis: "per_booking",
    durationConfig: {
      minMinutes: 120, maxMinutes: 360, incrementMinutes: 60,
      pricingModel: "base_extension", basePrice: 50000, extensionPrice: 25000,
      mustEndByClose: true, walkInRoundMinutes: 60, leadTimeMinutes: 0,
    },
    policies: { ...POLICY, cancellation: "fee", cancelHours: 168, cancelFeePct: 50, deposit: "percent", depositPct: 30, partyMax: 1 },
    createdAt: T, updatedAt: T,
  },
];

const VH_NIGHT = { primary: "#c0447e", secondary: "#e8b04a", background: "#120b14", surface: "#1d1320", text: "#f6eef3" };
const velvetPages: Record<string, { slug: string; page: ProductPage }> = {
  prd_vh_brunch: {
    slug: "brunch-and-vinyl",
    page: page({
      look: "nightlife", tagline: "Records, mimosas and the whole afternoon.",
      sections: ["hero", "stats", "lineup", "about", "gallery", "faq", "know", "venue", "tickets"],
      stats: [
        { id: "s1", value: "4 hr", label: "from noon" },
        { id: "s2", value: "120", label: "guests" },
        { id: "s3", value: "1", label: "drink with every ticket" },
      ],
      lineup: [
        { id: "l1", kind: "session", at: "12:00", name: "Doors and brunch" },
        { id: "l2", kind: "session", at: "1:00", name: "Vinyl set", role: "90s and 2000s R&B, only on records" },
        { id: "l3", kind: "session", at: "3:00", name: "Line dances and requests" },
      ],
      faq: [
        { id: "f1", q: "Is there a dress code?", a: "Brunch best. Comfortable shoes — you will dance." },
        { id: "f2", q: "Can I book a booth?", a: "Yes, for six. It comes with brunch for the table and a bottle." },
      ],
    }),
  },
  prd_vh_mixer: {
    slug: "women-who-build",
    page: page({
      look: "business", styleSource: "custom",
      style: { primary: "#1f1a24", secondary: "#c0447e", background: "#ffffff", surface: "#f7f3f6", text: "#1f1a24", headingFont: "instrument", bodyFont: "inter", headingWeight: 400, typeScale: "large", corners: "sharp", buttonStyle: "underline", cardStyle: "flat", hero: "split", width: "narrow", dividers: "line", ctaLabel: "Get my ticket" },
      tagline: "Bring a business card. Leave with a friend.",
      sections: ["hero", "highlights", "about", "lineup", "faq", "venue", "tickets"],
      highlights: [
        { id: "h1", label: "Three short talks", description: "Women a few steps ahead, saying what they wish they'd known." },
        { id: "h2", label: "Hosted introductions", description: "We make sure you meet the people you came for." },
      ],
      lineup: [
        { id: "l1", kind: "session", at: "7:00 PM", name: "Doors and a drink" },
        { id: "l2", kind: "session", at: "7:45 PM", name: "Three talks, ten minutes each" },
        { id: "l3", kind: "session", at: "8:30 PM", name: "Introductions and open floor" },
      ],
      faq: [{ id: "f1", q: "Do I need to own a business?", a: "No. Building one, thinking about it, or just curious — all welcome." }],
    }),
  },
  prd_vh_paint: {
    slug: "paint-and-sip",
    page: page({
      look: "arts", styleSource: "custom", style: { hero: "collage", badge: "No experience needed" },
      tagline: "A canvas, a glass, and no pressure.",
      sections: ["hero", "about", "included", "gallery", "faq", "know", "venue", "tickets"],
      faq: [{ id: "f1", q: "I can't paint. Is that a problem?", a: "Nobody can on the night. The artist walks you through every step." }],
    }),
  },
  prd_vh_rental: {
    slug: "lounge-hire",
    page: page({
      look: "business", tagline: "Your party. Our lounge.",
      sections: ["hero", "stats", "highlights", "about", "gallery", "faq", "know", "venue", "tickets"],
      stats: [
        { id: "s1", value: "2–6 hr", label: "bookings" },
        { id: "s2", value: "80", label: "guests standing" },
        { id: "s3", value: "30%", label: "deposit to hold it" },
      ],
      highlights: [
        { id: "h1", label: "Sound and lighting", description: "Plug in your playlist or bring your DJ." },
        { id: "h2", label: "Bar on request", description: "Our bartenders, your menu." },
      ],
      faq: [{ id: "f1", q: "Can we decorate?", a: "Yes. Setup time before your booking is free." }],
    }),
  },
};

const velvet: TrustherDemo = {
  id: "velvet",
  slug: "thevelvethour",
  operator: {
    name: "The Velvet Hour", currency: "USD", defaultTimezone: "America/New_York", taxRatePct: 7, reducedRatePct: 0,
    contactPhone: "(305) 555-0163", contactEmail: "events@thevelvethour.example", website: "thevelvethour.example",
    receiptFooter: "Thank you for spending your evening with us.",
  },
  tax: salesTax(700, "Florida"),
  locations: [location("The Velvet Hour", "1320 NW 2nd Ave", "Miami, FL 33136", "America/New_York", hours("10:00", "23:59"))],
  counters: [counter("Door & bar")],
  products: velvetBase.map((p) => ({ ...p, ...velvetPages[p.id], images: velvetPh.images(p.id) })),
  storefronts: [{
    id: `sf_${LOC}`, locationId: LOC, slug: "thevelvethour", published: true,
    headline: "Good evenings, on purpose.",
    intro: "A Black woman–owned lounge in Overtown, Miami. Day parties, mixers and paint-and-sips most weekends — and the whole room for your own celebration on the others.",
    featured: ["prd_vh_brunch", "prd_vh_mixer", "prd_vh_paint", "prd_vh_rental"],
    contactPhone: "(305) 555-0163", contactEmail: "events@thevelvethour.example",
    links: [{ id: "sfl_vh_ig", label: "What's on this month", url: "https://instagram.com/" }],
    accent: "rose", heroImage: velvetPh.hero,
    style: { ...VH_NIGHT, preset: "night", headingFont: "dm-serif", bodyFont: "inter", corners: "round", buttonStyle: "pill", cardStyle: "tinted", hero: "cover", heroHeight: "tall", overlay: 55, gallery: "strip", ctaLabel: "Get tickets" },
    createdAt: T, updatedAt: T,
  }],
  inventoryItems: [
    item("inv_vh_candle", "Velvet Hour signature candle", "VH-CANDLE", 3200, 1100),
    item("inv_vh_tote", "Velvet Hour tote bag", "VH-TOTE", 2000, 600),
  ],
  stockMovements: stock("vh", "Simone Baptiste", [["inv_vh_candle", 30, 11], ["inv_vh_tote", 40, 14]]),
  resources: [
    { id: "res_vh_lounge", name: "The Lounge", nounSingular: "Room", nounPlural: "Rooms", locationId: LOC, outOfService: false, outOfServiceReason: null, status: "active", createdAt: T, updatedAt: T },
  ],
  staffNames: {
    stf_rahim: { name: "Simone Baptiste", email: "simone@thevelvethour.example" },
    stf_nadia: { name: "Destiny Pierre", email: "destiny@thevelvethour.example" },
    stf_karim: { name: "Kiara Thomas", email: "kiara@thevelvethour.example" },
    stf_tania: { name: "Renee Joseph", email: "renee@thevelvethour.example" },
  },
  areaCode: "305",
};

/* ═══ 4 · Mama Jo's Supper Club — New Orleans ════════════════════════════ */

const MAMAJOS_PHOTOS: string[] = ["hero.jpg", "supper.jpg", "gumbo.jpg", "cooking-class.jpg", "private.jpg", "pralines.jpg"];
const mamajosPh = photoKit("mamajos", MAMAJOS_PHOTOS, {
  prd_mj_sunday: [
    { file: "supper.jpg", alt: "Guests passing dishes down a long candlelit table" },
    { file: "pralines.jpg", alt: "Pecan pralines and house hot sauce from the counter" },
  ],
  prd_mj_gumbo: [{ file: "gumbo.jpg", alt: "Gumbo, cornbread, greens and shrimp, served family-style" }],
  prd_mj_class: [{ file: "cooking-class.jpg", alt: "Hands stirring a dark roux at a cooking class" }],
  prd_mj_private: [{ file: "private.jpg", alt: "A private dining room set for a celebration" }],
});

const mamajosBase: Product[] = [
  {
    id: "prd_mj_sunday", name: "Sunday Supper", images: [], bookingType: "BT-03",
    description: "Four courses served family-style at one long table: whatever Mama Jo's cooking that week, and always a dessert you'll ask about.",
    tiers: [
      { id: "tier_mj_su_seat", name: "Seat", price: 7500, active: true, note: "Four courses, family-style" },
      { id: "tier_mj_su_wine", name: "Seat + wine pairing", price: 10500, active: true, note: "A glass with every course" },
    ],
    locationIds: [LOC], channels: ["counter", "online"], status: "active", archivedAt: null,
    schedule: { slotMinutes: 150, sessionMinutes: 150, startTime: "17:00", endTime: "17:00", capacityPerSession: 24, dailyCapacity: null, openDays: [0], guideIds: [], exceptions: [] },
    policies: { ...POLICY, cancelHours: 48, partyMax: 8 }, createdAt: T, updatedAt: T,
  },
  {
    id: "prd_mj_gumbo", name: "Friday Gumbo Night", images: [], bookingType: "BT-03",
    description: "Seafood or chicken-and-sausage gumbo, potato salad on the side the way it should be, and bread pudding. Casual, loud and over by nine.",
    tiers: [{ id: "tier_mj_gu_seat", name: "Seat", price: 4500, active: true, note: "Gumbo, sides and dessert" }],
    locationIds: [LOC], channels: ["counter", "online"], status: "active", archivedAt: null,
    schedule: { slotMinutes: 120, sessionMinutes: 120, startTime: "19:00", endTime: "19:00", capacityPerSession: 30, dailyCapacity: null, openDays: [5], guideIds: [], exceptions: [] },
    policies: { ...POLICY, partyMax: 8 }, createdAt: T, updatedAt: T,
  },
  {
    id: "prd_mj_class", name: "Creole Cooking Class", images: [], bookingType: "BT-03",
    description: "Three hours in the kitchen with Mama Jo: a proper roux, a pot of jambalaya and pralines to take home. Then we eat what we made.",
    tiers: [{ id: "tier_mj_cl_seat", name: "Seat", price: 9500, active: true, note: "Cooking, lunch and the recipes" }],
    locationIds: [LOC], channels: ["counter", "online"], status: "active", archivedAt: null,
    schedule: { slotMinutes: 180, sessionMinutes: 180, startTime: "11:00", endTime: "11:00", capacityPerSession: 12, dailyCapacity: null, openDays: [6], guideIds: [], exceptions: [] },
    addOns: [{ id: "add_mj_spice", name: "Take-home spice kit", price: 1800, perPerson: false, itemId: "inv_mj_spice" }],
    policies: { ...POLICY, cancelHours: 72, partyMax: 4 }, createdAt: T, updatedAt: T,
  },
  {
    // Sent to groups who ask, never listed on the storefront.
    id: "prd_mj_private", name: "Private dining", images: [], bookingType: "BT-03",
    description: "The supper club to yourselves for a birthday, rehearsal dinner or team night. A menu planned with you, and Mama Jo at the table.",
    tiers: [
      { id: "tier_mj_pv_12", name: "Up to 12 guests", price: 120000, active: true, note: "Four courses for up to 12" },
      { id: "tier_mj_pv_20", name: "Up to 20 guests", price: 180000, active: true, note: "The same, for a bigger party" },
    ],
    locationIds: [LOC], channels: ["online"], online: "link", status: "active", archivedAt: null,
    schedule: { slotMinutes: 180, sessionMinutes: 180, startTime: "18:00", endTime: "18:00", capacityPerSession: 1, dailyCapacity: null, openDays: [1, 2, 3, 4], guideIds: [], exceptions: [] },
    policies: { ...POLICY, deposit: "percent", depositPct: 30, cancelHours: 168, partyMax: 1 },
    createdAt: T, updatedAt: T,
  },
];

const mamajosPages: Record<string, { slug: string; page: ProductPage }> = {
  prd_mj_sunday: {
    slug: "sunday-supper",
    page: page({
      look: "standard", tagline: "One long table. Everybody eats.",
      sections: ["hero", "about", "lineup", "included", "gallery", "faq", "know", "venue", "tickets"],
      lineup: [
        { id: "m1", kind: "session", at: "First", name: "Something to start", role: "Fried green tomatoes or a cup of bisque" },
        { id: "m2", kind: "session", at: "Second", name: "Greens and cornbread" },
        { id: "m3", kind: "session", at: "Third", name: "The main", role: "Smothered chicken, red beans or shrimp and grits" },
        { id: "m4", kind: "session", at: "Last", name: "Dessert", role: "Bread pudding, sweet potato pie or bananas Foster" },
      ],
      faq: [
        { id: "f1", q: "Can you work around allergies?", a: "Tell us when you book. Mama Jo will plan your plate." },
        { id: "f2", q: "Can I sit with my friends?", a: "Book together and we'll seat you together." },
      ],
    }),
  },
  prd_mj_gumbo: {
    slug: "friday-gumbo-night",
    page: page({
      look: "entertainment", styleSource: "custom", style: { hero: "text", badge: "Every Friday" },
      tagline: "Gumbo, music and somebody's auntie telling stories.",
      sections: ["hero", "about", "included", "faq", "venue", "tickets"],
      faq: [{ id: "f1", q: "Seafood or chicken?", a: "Both pots are on every Friday. Choose at the table." }],
    }),
  },
  prd_mj_class: {
    slug: "creole-cooking-class",
    page: page({
      look: "travel", tagline: "First you make a roux.",
      sections: ["hero", "highlights", "about", "included", "gallery", "faq", "know", "venue", "tickets"],
      highlights: [
        { id: "h1", label: "Twelve cooks", description: "Small enough that you stir the pot yourself." },
        { id: "h2", label: "Lunch is what you made", description: "Jambalaya, at the long table." },
        { id: "h3", label: "Recipes to keep", description: "Printed, with Mama Jo's notes in the margins." },
      ],
      faq: [{ id: "f1", q: "Do I need to know how to cook?", a: "No. If you can stir, you can make a roux." }],
    }),
  },
  prd_mj_private: {
    slug: "private-dining",
    page: page({
      look: "business", styleSource: "custom",
      style: { primary: "#2b1b12", secondary: "#8c2f1b", background: "#ffffff", surface: "#f8f4ee", text: "#2b1b12", headingFont: "instrument", bodyFont: "lora", headingWeight: 400, typeScale: "large", corners: "sharp", buttonStyle: "underline", cardStyle: "flat", hero: "split", width: "narrow", dividers: "line", imageTone: "warm", ctaLabel: "Plan your dinner" },
      tagline: "The whole table, for your people.",
      sections: ["hero", "stats", "about", "included", "gallery", "faq", "know", "venue", "tickets"],
      stats: [
        { id: "s1", value: "20", label: "guests at most" },
        { id: "s2", value: "3 hr", label: "at the table" },
        { id: "s3", value: "30%", label: "to hold the date" },
      ],
      faq: [{ id: "f1", q: "Why isn't this on your website?", a: "We send it to groups who ask. The link is the invitation." }],
    }),
  },
};

const mamajos: TrustherDemo = {
  id: "mamajos",
  slug: "mamajos",
  operator: {
    name: "Mama Jo's Supper Club", currency: "USD", defaultTimezone: "America/Chicago", taxRatePct: 9.45, reducedRatePct: 0,
    contactPhone: "(504) 555-0127", contactEmail: "table@mamajos.example", website: "mamajos.example",
    receiptFooter: "Thank you for eating with us, baby. Come back hungry.",
  },
  tax: salesTax(945, "Louisiana"),
  locations: [location("Mama Jo's Supper Club", "2219 St Claude Ave", "New Orleans, LA 70117", "America/Chicago", hours("10:00", "22:00", [1]))],
  counters: [counter("Host stand")],
  products: mamajosBase.map((p) => ({ ...p, ...mamajosPages[p.id], images: mamajosPh.images(p.id) })),
  storefronts: [{
    id: `sf_${LOC}`, locationId: LOC, slug: "mamajos", published: true,
    headline: "Come hungry. Leave family.",
    intro: "A Black woman–owned supper club in the Marigny, New Orleans. Family-style Sunday suppers, Friday gumbo nights and Saturday Creole cooking classes, at one long table. Seats go fast.",
    featured: ["prd_mj_sunday", "prd_mj_gumbo", "prd_mj_class"],
    contactPhone: "(504) 555-0127", contactEmail: "table@mamajos.example",
    links: [{ id: "sfl_mj_ig", label: "This week's menu", url: "https://instagram.com/" }],
    accent: "amber", heroImage: mamajosPh.hero,
    style: { preset: "journal", primary: "#8c2f1b", secondary: "#2e5e4e", background: "#fbf5ea", surface: "#fffaf1", text: "#2b1b12", headingFont: "fraunces", bodyFont: "lora", headingWeight: 600, corners: "soft", buttonStyle: "outline", cardStyle: "bordered", hero: "editorial", width: "narrow", dividers: "line", texture: "grain", imageTone: "warm", ctaLabel: "Save my seat" },
    createdAt: T, updatedAt: T,
  }],
  inventoryItems: [
    item("inv_mj_pralines", "Pecan pralines, box of six", "MJ-PRALINE", 1600, 500, 8),
    item("inv_mj_sauce", "Mama Jo's hot sauce", "MJ-SAUCE", 900, 250, 12),
    item("inv_mj_book", "Mama Jo's Kitchen cookbook", "MJ-BOOK", 3500, 1400, 4),
    item("inv_mj_spice", "Take-home spice kit", "MJ-SPICE", 1800, 600),
  ],
  stockMovements: stock("mj", "Josephine Batiste", [["inv_mj_pralines", 60, 28], ["inv_mj_sauce", 72, 31], ["inv_mj_book", 20, 6], ["inv_mj_spice", 30, 9]]),
  resources: [],
  staffNames: {
    stf_rahim: { name: "Josephine Batiste", email: "jo@mamajos.example" },
    stf_nadia: { name: "Gabrielle Landry", email: "gabby@mamajos.example" },
    stf_karim: { name: "Tamika Broussard", email: "tamika@mamajos.example" },
    stf_tania: { name: "Charmaine Dupre", email: "charmaine@mamajos.example" },
  },
  areaCode: "504",
};

export const TRUSTHER_DEMOS: Record<TrustherId, TrustherDemo> = { kinks, sweat, velvet, mamajos };

/** The seed staff, renamed for a US business. Ids, roles and counters stay —
 *  the till's signed-in person (stf_nadia) is keyed to them — but nobody keeps
 *  a Dhaka name or a +880 number. Anyone not renamed is left out. */
export function usStaff(seedStaff: Staff[], d: TrustherDemo): Staff[] {
  return seedStaff
    .filter((s) => d.staffNames[s.id])
    .map((s) => ({ ...s, name: d.staffNames[s.id].name, email: d.staffNames[s.id].email, phone: null, status: "active" as const, hasPin: true, pinLength: 4, locationIds: [LOC], counterIds: s.counterIds.length ? ["cnt_fort_main"] : [] }));
}

/** Who buys, for the generated sales: US names, the city's area code. */
export function usRoster(areaCode: string): { name: string; phone: string | null; email: string | null }[] {
  const people: [string, boolean][] = [
    ["Ebony Johnson", true], ["Tiana Brooks", true], ["Danielle Moore", false], ["Kendra Wallace", true],
    ["Simone Carter", true], ["Ashley Washington", true], ["Latoya Harris", false], ["Jasmine Reed", true],
    ["Crystal Jenkins", true], ["Brittany Scott", true], ["Monica Davis", false], ["Shanice Turner", true],
    ["Alicia Bell", true], ["Precious Howard", true], ["Kayla Mitchell", false], ["Rochelle Adams", true],
    ["Nicole Edwards", true], ["Tamara Green", true], ["Erica Coleman", true], ["Erica Colman", false],
  ];
  return people.map(([name, hasEmail], i) => ({
    name,
    // The last row is the near-miss the walk-up matcher exists for: the same
    // number as Erica Coleman, typed with the country code.
    phone: i === 19 ? `+1${areaCode}5550118` : `(${areaCode}) 555-${String(100 + i).padStart(4, "0")}`,
    email: hasEmail ? `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@gmail.com` : null,
  }));
}
