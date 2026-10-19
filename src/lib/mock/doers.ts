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
import type { Counter, InventoryItem, Location, Product, ProductPage, StockMovement, Storefront } from "@/lib/api/types";
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

const baseProducts: Product[] = [
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
  {
    // The third way to sell: online, but only by its own link — sent to groups
    // who ask, never listed on the storefront.
    id: "prd_doers_private",
    name: "Private team workshop",
    description:
      "The studio to yourselves: matcha, sushi or tea for your team, friends or a birthday, with a host from the club. Pick a date and we plan the rest with you.",
    images: [],
    bookingType: "BT-03",
    tiers: [
      { id: "tier_dpv_12", name: "Group of up to 12", price: 3000000, active: true, note: "Studio, host, ingredients and tools for up to 12" },
      { id: "tier_dpv_20", name: "Group of up to 20", price: 4500000, active: true, note: "The same, for a bigger team" },
    ],
    locationIds: [LOC],
    channels: ["online"],
    online: "link",
    status: "active",
    archivedAt: null,
    schedule: {
      slotMinutes: 240, sessionMinutes: 180, startTime: "11:00", endTime: "18:00",
      capacityPerSession: 1, dailyCapacity: null, openDays: [0, 1, 2, 4], guideIds: [], exceptions: [],
    },
    sessionNames: { "11:00": "Daytime", "15:00": "Afternoon" },
    policies: { ...POLICY, deposit: "percent", depositPct: 30, cancelHours: 168, partyMax: 1 },
    createdAt: T,
    updatedAt: T,
  },
];

/* ── Photos ────────────────────────────────────────────────────────────────
   Files in public/demo/doers/, 1600px JPEGs. A name is only used once it is in
   PHOTOS_PRESENT, so a photo not yet added never shows as a broken image. */
const PHOTOS_PRESENT: string[] = [
  "matcha-1.jpg", "matcha-2.jpg", "matcha-3.jpg",
  "sushi-1.jpg", "sushi-2.jpg", "sushi-3.jpg",
  "tea-1.jpg", "tea-2.jpg",
  "social-1.jpg", "social-2.jpg",
  "pass-1.jpg",
  "private-1.jpg", "private-2.jpg",
];
const PHOTOS: Record<string, { file: string; alt: string }[]> = {
  prd_doers_matcha: [
    { file: "matcha-1.jpg", alt: "Whisking matcha in a ceramic bowl" },
    { file: "matcha-2.jpg", alt: "Matcha stations laid out on a long table" },
    { file: "matcha-3.jpg", alt: "Friends tasting matcha together" },
  ],
  prd_doers_sushi: [
    { file: "sushi-1.jpg", alt: "Hands rolling maki on a bamboo mat" },
    { file: "sushi-2.jpg", alt: "A board of freshly made sushi" },
    { file: "sushi-3.jpg", alt: "A sushi class around a counter" },
  ],
  prd_doers_tea: [
    { file: "tea-1.jpg", alt: "Six tea cups in a row at a tasting" },
    { file: "tea-2.jpg", alt: "Loose leaf tea and a glass teapot" },
  ],
  prd_doers_social: [
    { file: "social-1.jpg", alt: "People talking at a long table at night" },
    { file: "social-2.jpg", alt: "A small group building something together" },
  ],
  prd_doers_pass: [{ file: "pass-1.jpg", alt: "Matcha, sushi and tea laid out together" }],
  prd_doers_private: [
    { file: "private-1.jpg", alt: "A team at a private workshop" },
    { file: "private-2.jpg", alt: "The studio set for a group" },
  ],
};
const photosFor = (id: string) =>
  (PHOTOS[id] ?? [])
    .filter((ph) => PHOTOS_PRESENT.includes(ph.file))
    .map((ph, i) => ({ id: `img_${id}_${i}`, url: `/demo/doers/${ph.file}`, alt: ph.alt }));

/* ── Each booking's own page, each in a different look ──────────────────────
   The point of the demo: one studio, six bookings, six pages that look nothing
   alike — Gallery, Classic, Journey, Neon, Poster and Clean — all made with the
   same page designer (docs/catalog.md §10.5). */
const page = (p: Partial<ProductPage> & Pick<ProductPage, "look" | "sections">): ProductPage => ({
  stats: [], highlights: [], info: [], faq: [], lineup: [], sponsors: [],
  countdown: { mode: "off", hideAtZero: true },
  ...p,
});

const PAGES: Record<string, { slug: string; page: ProductPage }> = {
  prd_doers_matcha: {
    slug: "matcha-whisking",
    page: page({
      look: "arts", accent: "#4F7A3A",
      /* Follows the studio brand; only the hero and the rules between sections are its own. */
      styleSource: "custom", style: { hero: "collage", dividers: "line", badge: "Only 12 seats" },
      tagline: "Ninety slow minutes with a bamboo whisk.",
      sections: ["hero", "highlights", "about", "schedule", "included", "gallery", "faq", "know", "venue", "tickets"],
      highlights: [
        { id: "h1", label: "Ceremonial-grade matcha", description: "Stone-ground tea, the grade served at a tea ceremony." },
        { id: "h2", label: "Your own station", description: "Bowl, whisk and scoop laid out for you. Nothing to bring." },
        { id: "h3", label: "Twelve seats", description: "Small enough that the host watches every whisk." },
      ],
      lineup: [
        { id: "l1", kind: "session", at: "First 20 min", name: "Sift and measure", role: "Why sifting is half the bowl" },
        { id: "l2", kind: "session", at: "20 min in", name: "The W-whisk", role: "Foam in thirty seconds, once you have it" },
        { id: "l3", kind: "session", at: "45 min in", name: "Thin tea and thick tea", role: "Usucha and koicha, side by side" },
        { id: "l4", kind: "session", at: "Last 20 min", name: "Taste and talk", role: "With something sweet from the pantry" },
      ],
      faq: [
        { id: "f1", q: "Do I need any experience?", a: "None. Most people have never held a bamboo whisk before." },
        { id: "f2", q: "Is there caffeine?", a: "Yes, about as much as a small coffee. Ask for a lighter bowl if you prefer." },
        { id: "f3", q: "Can I come alone?", a: "Most people do. You will leave knowing the people at your table." },
      ],
    }),
  },
  prd_doers_sushi: {
    slug: "sushi-making",
    page: page({
      look: "standard",
      /* The studio brand, untouched — what most of their pages would be. */
      tagline: "Roll it, slice it, eat it.",
      sections: ["hero", "about", "included", "gallery", "faq", "know", "venue", "tickets"],
      faq: [
        { id: "f1", q: "Is there a vegetarian option?", a: "Yes. Every class has a vegetable roll, and you can choose it for the whole session." },
        { id: "f2", q: "Can I take my rolls home?", a: "Eat what you like at the counter; we box the rest." },
      ],
    }),
  },
  prd_doers_tea: {
    slug: "tea-tasting",
    page: page({
      look: "travel",
      styleSource: "custom",
      style: { palette: "sand", primary: "#8a5a2b", secondary: "#3d6b5a", background: "#fbf6ee", surface: "#fffaf2", text: "#2d2116", headingFont: "cormorant", bodyFont: "lora", headingWeight: 600, typeScale: "large", corners: "soft", buttonStyle: "outline", cardStyle: "bordered", hero: "editorial", width: "narrow", dividers: "line", imageTone: "warm", iconStroke: "thin", ctaLabel: "Save a seat" },
      tagline: "Six teas, five countries, one long table.",
      sections: ["hero", "about", "lineup", "included", "gallery", "faq", "know", "venue", "tickets"],
      lineup: [
        { id: "t1", kind: "session", at: "Darjeeling", name: "First flush", role: "Light and floral, the champagne of teas" },
        { id: "t2", kind: "session", at: "Sylhet", name: "Malnicherra black", role: "Bangladesh's own, brisk and malty" },
        { id: "t3", kind: "session", at: "Fujian", name: "Silver needle", role: "A white tea made of buds alone" },
        { id: "t4", kind: "session", at: "Taiwan", name: "High-mountain oolong", role: "Rolled leaves that open in the pot" },
        { id: "t5", kind: "session", at: "Uji", name: "Sencha", role: "Green and grassy, brewed cool" },
        { id: "t6", kind: "session", at: "Yunnan", name: "Aged pu-erh", role: "Earthy and dark, and the room divides" },
      ],
      faq: [{ id: "f1", q: "Will I like tea after this?", a: "You will at least know which one you like." }],
    }),
  },
  prd_doers_social: {
    slug: "social-night",
    page: page({
      look: "nightlife",
      styleSource: "custom",
      style: { preset: "night", palette: "night-market", primary: "#ff6b35", secondary: "#ffd166", background: "#121212", surface: "#1c1c1c", text: "#f5f5f5", headingFont: "syne", bodyFont: "inter", headingWeight: 700, corners: "round", buttonStyle: "pill", cardStyle: "tinted", hero: "cover", heroHeight: "tall", overlay: 55, gallery: "strip", badge: "Every Thursday", ctaLabel: "Get on the list" },
      tagline: "Come alone. Leave with people.",
      sections: ["hero", "countdown", "stats", "about", "schedule", "gallery", "faq", "venue", "tickets"],
      stats: [
        { id: "s1", value: "30", label: "people a night" },
        { id: "s2", value: "1", label: "drink on us" },
        { id: "s3", value: "2 hr", label: "of good company" },
      ],
      lineup: [
        { id: "n1", kind: "session", at: "7:00 PM", name: "Doors and a drink" },
        { id: "n2", kind: "session", at: "7:30 PM", name: "Show and tell", role: "Three people, five minutes, one thing they made" },
        { id: "n3", kind: "session", at: "8:00 PM", name: "The mini challenge", role: "Teams of four, twenty minutes, a surprise kit" },
        { id: "n4", kind: "session", at: "8:30 PM", name: "Long table", role: "Talk until we close the doors" },
      ],
      faq: [
        { id: "f1", q: "What do people wear?", a: "Whatever you wore to work. Nobody dresses up." },
        { id: "f2", q: "Is it only for members?", a: "No. Anyone can book a place." },
      ],
      countdown: { mode: "date", at: "2026-07-30T19:00:00+06:00", label: "Next social in", hideAtZero: true },
    }),
  },
  prd_doers_pass: {
    slug: "doers-pass",
    page: page({
      look: "entertainment",
      styleSource: "custom",
      style: { palette: "clay", primary: "#a8462a", secondary: "#2f5d62", background: "#faf5ef", surface: "#ffffff", text: "#2b1d16", headingFont: "archivo-black", bodyFont: "plex", headingCase: "upper", typeScale: "compact", corners: "sharp", buttonStyle: "solid", cardStyle: "flat", hero: "text", spacing: "tight", texture: "dots", iconStroke: "bold", badge: "5 workshops, one price", ctaLabel: "Buy the pass" },
      tagline: "Five workshops. Ninety days. Your pace.",
      sections: ["hero", "stats", "highlights", "about", "faq", "know", "tickets"],
      stats: [
        { id: "s1", value: "5", label: "workshops" },
        { id: "s2", value: "90", label: "days to use them" },
        { id: "s3", value: "3", label: "kinds to choose from" },
      ],
      highlights: [
        { id: "h1", label: "Any workshop", description: "Matcha, sushi or tea. Mix them however you like." },
        { id: "h2", label: "Book with the pass", description: "Show your pass code and the seat is yours, with nothing to pay." },
      ],
      faq: [{ id: "f1", q: "Can I share my pass?", a: "Yes. Bring a friend on one of your five." }],
    }),
  },
  prd_doers_private: {
    slug: "private-team-workshop",
    page: page({
      look: "business",
      styleSource: "custom",
      style: { preset: "editorial", palette: "paper", primary: "#161616", secondary: "#c2410c", background: "#ffffff", surface: "#f6f6f4", text: "#161616", headingFont: "instrument", bodyFont: "inter", headingWeight: 400, typeScale: "large", corners: "sharp", buttonStyle: "underline", cardStyle: "flat", hero: "split", width: "narrow", dividers: "line", imageTone: "mono", iconStroke: "thin", ctaLabel: "Book your team" },
      tagline: "The whole studio, for your people.",
      sections: ["hero", "stats", "highlights", "about", "included", "gallery", "faq", "know", "venue", "tickets"],
      stats: [
        { id: "s1", value: "20", label: "people at most" },
        { id: "s2", value: "3 hr", label: "of studio time" },
        { id: "s3", value: "30%", label: "to hold the date" },
      ],
      highlights: [
        { id: "h1", label: "Pick the workshop", description: "Matcha, sushi, tea, or a little of each." },
        { id: "h2", label: "A host of your own", description: "Someone from the club runs it from start to finish." },
        { id: "h3", label: "Planned with you", description: "Dietary needs, a cake, a speech: tell us after you book." },
      ],
      faq: [
        { id: "f1", q: "Why is this page not on your website?", a: "It is sent to groups who ask. The link is the invitation." },
        { id: "f2", q: "Can we bring our own food?", a: "A cake, yes. Everything else is part of the workshop." },
      ],
    }),
  },
};

export const doersProducts: Product[] = baseProducts.map((p) => ({
  ...p,
  ...PAGES[p.id],
  images: p.images.length ? p.images : photosFor(p.id),
}));

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
    heroImage: "/demo/doers/social-1.jpg",
    /* The studio's brand: warm paper, a matcha green and a terracotta, set in
       Fraunces over DM Sans. Every page follows it unless it says otherwise. */
    style: { primary: "#3f6b35", secondary: "#c2703d", background: "#f7f3ea", surface: "#fffdf8", text: "#1f2a1c", headingFont: "fraunces", bodyFont: "dm-sans", headingWeight: 500, corners: "soft", buttonStyle: "pill", cardStyle: "bordered", hero: "split", texture: "grain", imageTone: "warm" },
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
