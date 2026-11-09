/* ───────────────────────────────────────────────────────────────────────────
   Demo business: Breakfast Club Dhaka — "Bangladesh's morning culture
   movement". Pop-up morning raves: good coffee, DJ sets and breakfast at
   partner cafés from 9 AM, plus bigger specials like Decks & Deck, the
   Season 2 finale on a boat down the Padma.

   A prospect demo, built like The Doers Club (doers.ts): its own venue,
   counter, storefront, shelf and catalogue. Photos and the Decks & Deck
   prices, times and schedule are from the club's public Facebook page; the
   morning and workshop prices are illustrative — set them with the founders.

   The venue keeps `loc_fort` and the counter `cnt_fort_main` on purpose, as
   doers.ts explains: internal ids the session and shared staff are keyed to.

   IMPORTANT: like data.ts, nothing outside `src/lib/api/client.ts` imports this.
   ────────────────────────────────────────────────────────────────────────── */
import type { Counter, InventoryItem, LayoutSeat, Location, Product, ProductPage, ScheduleException, SeatLayout, StockMovement, Storefront } from "@/lib/api/types";
import { seedDay as demoDay } from "@/lib/schedule";

const T = "2026-11-01T09:00:00+06:00";
const LOC = "loc_fort";
const FINALE = "2026-12-19";
const ph = (file: string, alt: string, i: number, id: string) => ({ id: `img_${id}_${i}`, url: `/demo/bcd/${file}`, alt });
const imgs = (id: string, list: [string, string][]) => list.map(([f, a], i) => ph(f, a, i, id));

/** Every Saturday from now to the end of January except the finale: Decks &
 *  Deck sells one date only, and the regular morning steps aside for it. */
function saturdays(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T12:00:00`);
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
  for (; d <= new Date(`${to}T12:00:00`); d.setDate(d.getDate() + 7)) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  return out;
}
const closed = (dates: string[]): ScheduleException[] => dates.map((date) => ({ date, kind: "closed" as const }));
const notFinale = saturdays("2026-11-01", "2027-03-31").filter((d) => d !== FINALE);

export const bcdOperator = {
  name: "Breakfast Club Dhaka",
  currency: "BDT",
  contactPhone: undefined,
  contactEmail: "breakfastclub.dhaka@gmail.com",
  website: "instagram.com/breakfastclub.dhaka",
  receiptFooter: "Good mornings only. See you on the dance floor.",
};

export const bcdLocations: Location[] = [
  {
    id: LOC,
    name: "Breakfast Club Dhaka",
    addressLine1: "A different café every edition — sent with your pass",
    city: "Dhaka",
    country: "Bangladesh",
    timezone: "Asia/Dhaka",
    openingHours: [
      { dayOfWeek: 0, intervals: [] },
      { dayOfWeek: 1, intervals: [] },
      { dayOfWeek: 2, intervals: [] },
      { dayOfWeek: 3, intervals: [] },
      { dayOfWeek: 4, intervals: [] },
      { dayOfWeek: 5, intervals: [{ opensAt: "11:00", closesAt: "12:30" }] },
      { dayOfWeek: 6, intervals: [{ opensAt: "09:00", closesAt: "18:00" }] },
    ],
    status: "active",
    createdAt: T,
    updatedAt: T,
  },
];

export const bcdCounters: Counter[] = [
  {
    id: "cnt_fort_main",
    name: "Door",
    locationId: LOC,
    allowedProductIds: "all",
    allowedPaymentMethods: ["cash", "bkash", "bangla_qr", "card_terminal"],
    status: "active",
    createdAt: T,
    updatedAt: T,
  },
];

const POLICY = {
  salesWindowDays: 60, cutoffMinutes: 60, cancellation: "none" as const, cancelHours: 0, cancelFeePct: 0,
  reschedule: "none" as const, rescheduleHours: 0, reentry: "single" as const, deposit: "full" as const, depositPct: 0,
  partyMin: 1, partyMax: 10,
};

const baseProducts: Product[] = [
  {
    id: "prd_bcd_deck",
    name: "Decks & Deck — Season 2 Finale",
    description:
      "Our last gathering of 2026, on the water. We set sail from Shitalakkha Ghat at 10 AM and cruise towards the Padma with DJs on the deck all day. The dance floor is on the 2nd deck, completely under shade, and a floating experience zone has all-day food, massage, pottery and art for when your feet need a break. Breakfast is on us.",
    images: imgs("prd_bcd_deck", [
      ["deck-poster.jpg", "Decks & Deck, Season 2 Finale, 19 December, 10 AM to 6 PM"],
      ["deck-ship.jpg", "The Breakfast Club Dhaka boat on the river"],
      ["deck-schedule.jpg", "The day: shuttle at 8:30, set sail at 10, back at the ghat at 6"],
      ["crew.jpg", "The Breakfast Club crew"],
    ]),
    bookingType: "BT-03",
    tiers: [
      { id: "tier_bcd_deck_reg", name: "Regular pass", price: 300000, active: true, note: "Entry for 1 + breakfast" },
      { id: "tier_bcd_deck_grp", name: "Group pass", price: 1300000, admits: 5, active: true, note: "Entry for 5 + breakfast — save ৳2,000" },
    ],
    locationIds: [LOC],
    channels: ["counter", "online"],
    status: "active",
    archivedAt: null,
    schedule: {
      slotMinutes: 540, sessionMinutes: 480, startTime: "10:00", endTime: "18:00",
      capacityPerSession: 180, dailyCapacity: null, openDays: [6], guideIds: [], exceptions: closed(notFinale),
    },
    sessionNames: { "10:00": "All day on the river" },
    policies: { ...POLICY, salesWindowDays: 90 },
    addOns: [{ id: "add_bcd_shuttle", name: "Shuttle from Banani (pick-up & drop-off)", price: 49900, perPerson: true }],
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "prd_bcd_morning",
    name: "Breakfast Club Morning",
    description:
      "The original. Every other Saturday we take over a café from 9 AM: good coffee, a DJ, breakfast and a dance floor full of people who would rather start the day than end the night. A different café and a different line-up each edition.",
    images: imgs("prd_bcd_morning", [
      ["crowd-night.jpg", "Friends dancing at a Breakfast Club edition"],
      ["fans.jpg", "The crowd singing along"],
      ["morning-1.jpg", "Friends at a Breakfast Club morning"],
      ["hero.jpg", "A DJ playing to a packed morning crowd"],
      ["morning-2.jpg", "The crowd at a morning edition"],
      ["morning-3.jpg", "Families and friends on the dance floor"],
      ["morning-4.jpg", "Dancing by the decks"],
      ["friends.jpg", "Big smiles at 10 AM"],
      ["smoke.jpg", "Hands up when the drop lands"],
    ]),
    bookingType: "BT-03",
    tiers: [{ id: "tier_bcd_morning", name: "Regular pass", price: 200000, active: true, note: "Entry + one drink + small bites" }],
    locationIds: [LOC],
    channels: ["counter", "online"],
    status: "active",
    archivedAt: null,
    schedule: {
      slotMinutes: 300, sessionMinutes: 240, startTime: "09:00", endTime: "13:00",
      capacityPerSession: 220, dailyCapacity: null, openDays: [6], guideIds: [], exceptions: closed([FINALE]),
    },
    sessionNames: { "09:00": "Morning edition" },
    policies: POLICY,
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "prd_bcd_workshop",
    name: "Behind the Decks — Your First DJ Set",
    description:
      "Learn to DJ from the ground up, from reading a track to mixing your first transition, with Tonmoy (OMDG), co-founder of Breakfast Club Dhaka. Small group, hands on the decks the whole time. No gear or experience needed.",
    images: imgs("prd_bcd_workshop", [
      ["dj-decks.jpg", "A DJ at the controller, lit in red and blue"],
      ["decks-hands.jpg", "Hands on the mixer"],
      ["workshop-poster.jpg", "Behind the Decks: your first DJ set, 11:00 AM to 12:20 PM"],
      ["workshop-dj.jpg", "A DJ with headphones at the decks"],
      ["stage.jpg", "The lights over the floor"],
    ]),
    bookingType: "BT-03",
    tiers: [{ id: "tier_bcd_ws", name: "Seat", price: 350000, active: true, note: "80 minutes, your own time on the decks" }],
    locationIds: [LOC],
    channels: ["counter", "online"],
    status: "active",
    archivedAt: null,
    schedule: {
      slotMinutes: 120, sessionMinutes: 80, startTime: "11:00", endTime: "12:20",
      capacityPerSession: 12, dailyCapacity: null, openDays: [5], guideIds: [], exceptions: [],
    },
    sessionNames: { "11:00": "Workshop" },
    policies: { ...POLICY, partyMax: 2 },
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "prd_bcd_tables",
    name: "Decks & Deck — Reserve a Table",
    description:
      "Want a home base for the day? Reserve a booth, a deck table or a seat on the rail on the 2nd deck, next to the dance floor and in the shade. Each table comes with breakfast for everyone at it; entry passes are included.",
    images: imgs("prd_bcd_tables", [
      ["deck-ship.jpg", "The Breakfast Club Dhaka boat on the river"],
      ["stage.jpg", "The lights over the floor"],
    ]),
    bookingType: "BT-07",
    tiers: [{ id: "tier_bcd_tbl", name: "Table", price: 300000, active: true }],
    layoutId: "layout_bcd_boat",
    locationIds: [LOC],
    /* Counter only: the storefront cannot draw a seating plan yet, and selling a
       table online as a plain quantity would sell nobody a particular table. */
    channels: ["counter"],
    status: "active",
    archivedAt: null,
    schedule: {
      slotMinutes: 540, sessionMinutes: 480, startTime: "10:00", endTime: "18:00",
      capacityPerSession: 120, dailyCapacity: null, openDays: [6], guideIds: [], exceptions: closed(notFinale),
    },
    sessionNames: { "10:00": "All day on the river" },
    policies: { ...POLICY, salesWindowDays: 90 },
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "prd_bcd_private",
    name: "A Private Morning for Your Team",
    description:
      "Breakfast Club, just for you: an office offsite, a launch or a birthday. We bring the DJ, the coffee bar and the crew to your space or a partner café, from 9 AM. You pick the date; we plan the rest with you.",
    images: imgs("prd_bcd_private", [
      ["crew-wide.jpg", "The Breakfast Club crew"],
      ["crew.jpg", "The crew at a partner café"],
      ["mic.jpg", "A guest artist on the mic"],
    ]),
    bookingType: "BT-03",
    tiers: [
      { id: "tier_bcd_pv_40", name: "Up to 40 guests", price: 6000000, active: true, note: "DJ, sound, coffee bar and crew for the morning" },
      { id: "tier_bcd_pv_80", name: "Up to 80 guests", price: 10000000, active: true, note: "The same, with a second DJ and a bigger bar" },
    ],
    locationIds: [LOC],
    channels: ["online"],
    online: "link",
    pricingBasis: "per_booking",
    status: "active",
    archivedAt: null,
    schedule: {
      slotMinutes: 300, sessionMinutes: 240, startTime: "09:00", endTime: "13:00",
      capacityPerSession: 1, dailyCapacity: null, openDays: [0, 1, 2, 3, 4], guideIds: [], exceptions: [],
    },
    sessionNames: { "09:00": "Your morning" },
    policies: { ...POLICY, deposit: "percent", depositPct: 30, cancelHours: 168, partyMax: 1 },
    createdAt: T,
    updatedAt: T,
  },
];

const page = (p: Partial<ProductPage> & Pick<ProductPage, "look" | "sections">): ProductPage => ({
  stats: [], highlights: [], info: [], faq: [], lineup: [], sponsors: [],
  countdown: { mode: "off", hideAtZero: true },
  ...p,
});

const PAGES: Record<string, { slug: string; page: ProductPage }> = {
  prd_bcd_deck: {
    slug: "decks-and-deck",
    page: page({
      look: "travel",
      styleSource: "custom",
      /* The finale's own retro poster: tomato red, cream and mustard, set in Bebas. */
      style: { primary: "#d93a2b", secondary: "#e8a33d", background: "#f6ead2", surface: "#fff8ea", text: "#2a1712", headingFont: "bebas", bodyFont: "dm-sans", headingWeight: 400, headingCase: "upper", typeScale: "large", corners: "soft", buttonStyle: "solid", cardStyle: "bordered", hero: "collage", dividers: "line", texture: "grain", imageTone: "none", badge: "Season 2 Finale", ctaLabel: "Get your pass" },
      tagline: "One day on the river. Decks on the deck.",
      sections: ["hero", "countdown", "stats", "highlights", "lineup", "about", "gallery", "faq", "know", "tickets"],
      countdown: { mode: "date", at: `${FINALE}T10:00:00+06:00`, label: "We set sail in", hideAtZero: true },
      stats: [
        { id: "s1", value: "8 hr", label: "on the river" },
        { id: "s2", value: "2", label: "decks" },
        { id: "s3", value: "1", label: "last party of 2026" },
      ],
      highlights: [
        { id: "h1", label: "A shaded dance floor", description: "Too much sun? The dance floor is on the 2nd deck, completely under shade." },
        { id: "h2", label: "The floating experience zone", description: "When your feet need a break: all-day food, massage, pottery and art." },
        { id: "h3", label: "Breakfast included", description: "Every pass comes with breakfast on board." },
        { id: "h4", label: "Shuttle from Banani", description: "Add pick-up and drop-off at Banani for ৳499 and skip the ghat traffic." },
      ],
      lineup: [
        { id: "l1", kind: "session", at: "8:30 AM", name: "Shuttle leaves Banani", role: "From Pagla Baburchi" },
        { id: "l2", kind: "session", at: "10:00 AM", name: "We set sail", role: "From Shitalakkha Ghat, cruising towards the Padma" },
        { id: "l3", kind: "session", at: "All day", name: "DJs on the deck", role: "Breakfast, food, massage, pottery and art in between" },
        { id: "l4", kind: "session", at: "6:00 PM", name: "Back at the ghat", role: "We dock the boat and head home" },
      ],
      faq: [
        { id: "f1", q: "What does the group pass cover?", a: "Entry and breakfast for five people, for ৳13,000 — ৳2,000 less than five regular passes." },
        { id: "f2", q: "How do I get to the ghat?", a: "Add the shuttle when you book. It leaves Banani at 8:30 AM and brings you back after we dock." },
        { id: "f3", q: "Can I leave early?", a: "We're on the river until 6 PM, so plan to stay for the whole day." },
      ],
    }),
  },
  prd_bcd_morning: {
    slug: "breakfast-club-morning",
    page: page({
      look: "entertainment",
      /* Sunrise: a full-bleed crowd photo, yolk and ink, round shapes and a big display face. */
      styleSource: "custom",
      coverUrl: "/demo/bcd/crowd-night.jpg",
      style: { primary: "#f2a900", secondary: "#e4572e", background: "#fff6dc", surface: "#ffffff", text: "#1c1406", headingFont: "unbounded", bodyFont: "figtree", headingWeight: 700, typeScale: "large", corners: "round", buttonStyle: "pill", cardStyle: "shadow", hero: "cover", heroHeight: "tall", coverFocus: "50% 35%", overlay: 40, spacing: "airy", imageTone: "warm", badge: "Every other Saturday", ctaLabel: "Save me a spot" },
      tagline: "Coffee, a DJ and breakfast. From 9 AM.",
      sections: ["hero", "stats", "gallery", "highlights", "about", "faq", "know", "tickets"],
      stats: [
        { id: "s1", value: "9 AM", label: "doors open" },
        { id: "s2", value: "16K", label: "on Instagram" },
        { id: "s3", value: "1", label: "drink + bites included" },
      ],
      highlights: [
        { id: "h1", label: "A new café each time", description: "We pick places with good light, good coffee and room to dance." },
        { id: "h2", label: "Local and visiting DJs", description: "Dhaka's best selectors, and friends from London, Bangkok and Colombo." },
        { id: "h3", label: "Bring everyone", description: "Students, parents, kids and people in their fifties all turn up." },
      ],
      faq: [
        { id: "f1", q: "Is there alcohol?", a: "No. It's a sober morning: coffee, juice and good music." },
        { id: "f2", q: "Can I bring my kids?", a: "Yes. Many editions have a kids' corner." },
        { id: "f3", q: "Where is it this time?", a: "The café is announced on Instagram and sent with your pass." },
      ],
    }),
  },
  prd_bcd_workshop: {
    slug: "behind-the-decks",
    page: page({
      look: "nightlife",
      /* After hours: near-black, booth-light orange, a tech grotesk and hard edges. */
      styleSource: "custom",
      coverUrl: "/demo/bcd/dj-decks.jpg",
      style: { primary: "#ff7a2f", secondary: "#38bdf8", background: "#0b0b0d", surface: "#17171b", text: "#f4f4f5", headingFont: "space-grotesk", bodyFont: "plex", headingWeight: 700, headingCase: "upper", typeScale: "standard", corners: "sharp", buttonStyle: "solid", cardStyle: "bordered", hero: "editorial", coverFocus: "45% 40%", spacing: "tight", dividers: "line", texture: "lines", iconStroke: "bold", badge: "12 seats", ctaLabel: "Save my seat" },
      tagline: "Your first DJ set, in eighty minutes.",
      sections: ["hero", "highlights", "lineup", "about", "gallery", "faq", "know", "tickets"],
      highlights: [
        { id: "h1", label: "Taught by OMDG", description: "Tonmoy D Gupta, co-founder of Breakfast Club Dhaka and one of the city's leading DJs." },
        { id: "h2", label: "Hands on the decks", description: "Twelve seats, so everyone mixes, not just watches." },
        { id: "h3", label: "Nothing to bring", description: "Controllers and headphones are ready for you." },
      ],
      lineup: [
        { id: "w1", kind: "session", at: "11:00", name: "Reading a track", role: "Beats, bars and where a song changes" },
        { id: "w2", kind: "session", at: "11:25", name: "Your first blend", role: "Matching tempo by ear" },
        { id: "w3", kind: "session", at: "11:50", name: "The transition", role: "EQ, the fader and timing" },
        { id: "w4", kind: "session", at: "12:10", name: "Your set", role: "Three tracks, start to finish" },
      ],
      faq: [{ id: "f1", q: "Do I need my own controller?", a: "No. Bring headphones if you have a pair you like." }],
    }),
  },
  prd_bcd_private: {
    slug: "private-morning",
    page: page({
      look: "business",
      /* Quiet and formal for the people who sign the invoice: white, a serif, underlined links. */
      styleSource: "custom",
      coverUrl: "/demo/bcd/crew-wide.jpg",
      style: { primary: "#1f2937", secondary: "#f2a900", background: "#ffffff", surface: "#f7f5f0", text: "#111827", headingFont: "instrument", bodyFont: "inter", headingWeight: 400, typeScale: "large", corners: "soft", buttonStyle: "underline", cardStyle: "flat", hero: "split", coverFocus: "50% 45%", width: "narrow", spacing: "airy", dividers: "line", imageTone: "mono", badge: "By invitation link", ctaLabel: "Hold a date" },
      tagline: "Your people, our DJs, a morning nobody forgets.",
      sections: ["hero", "about", "included", "highlights", "faq", "know", "tickets"],
      highlights: [
        { id: "h1", label: "We come to you", description: "Your office, a rooftop or one of our partner cafés." },
        { id: "h2", label: "One crew, start to finish", description: "DJ, sound, coffee bar and someone to run the morning." },
        { id: "h3", label: "Sober and early", description: "Done by lunch, so everyone is back at their desks." },
      ],
      faq: [
        { id: "f1", q: "How far ahead should we book?", a: "Three weeks is comfortable. A 30% deposit holds the date." },
        { id: "f2", q: "Can you play our playlist?", a: "Send it over. The DJ will build the set around it." },
      ],
    }),
  },
};

/* ── The boat's 2nd deck, as a seating plan ──────────────────────────────────
   Drawn for the meeting: the DJ booth and dance floor at the bow, VIP booths
   either side of the floor, deck tables behind them, a row of rail seats along
   the side and the bar at the stern. Ids are written out (not minted) so the
   server and the browser draw the same plan. */
const seat = (id: string, name: string, kind: LayoutSeat["kind"], posX: number, posY: number, cat: string, o: Partial<LayoutSeat> = {}): LayoutSeat => ({
  id, name, kind, posX, posY, seatRow: "", seatNumber: 1, seatCategoryId: cat, isAvailable: true,
  capacity: 1, shape: "square", width: 1, height: 1, rotation: 0, assignOrder: 0, ...o,
});
const boatSeats: LayoutSeat[] = [
  // VIP booths: six people, either side of the dance floor
  seat("bt_v1", "V1", "table", 0, 2.6, "cat_bcd_vip", { capacity: 6, seatNumber: 6, shape: "rounded", width: 3.1, height: 2.2, assignOrder: 0 }),
  seat("bt_v2", "V2", "table", 0, 5.4, "cat_bcd_vip", { capacity: 6, seatNumber: 6, shape: "rounded", width: 3.1, height: 2.2, assignOrder: 1 }),
  seat("bt_v3", "V3", "table", 14.9, 2.6, "cat_bcd_vip", { capacity: 6, seatNumber: 6, shape: "rounded", width: 3.1, height: 2.2, assignOrder: 2 }),
  seat("bt_v4", "V4", "table", 14.9, 5.4, "cat_bcd_vip", { capacity: 6, seatNumber: 6, shape: "rounded", width: 3.1, height: 2.2, assignOrder: 3 }),
  // GA: the dance floor itself
  { ...seat("bt_floor", "Dance floor", "ga", 4.5, 2.4, "cat_bcd_floor", { capacity: 120, shape: "rounded", width: 9, height: 5.2 }) },
  // Deck tables for four
  ...[0, 1, 2, 3, 4].map((i) => seat(`bt_t${i + 1}`, `T${i + 1}`, "table", 1 + i * 3.4, 9, "cat_bcd_deck", { capacity: 4, seatNumber: 4, shape: "circle", width: 1.9, height: 1.9, assignOrder: 10 + i })),
  ...[0, 1, 2, 3].map((i) => seat(`bt_t${i + 6}`, `T${i + 6}`, "table", 2.7 + i * 3.4, 11.6, "cat_bcd_deck", { capacity: 4, seatNumber: 4, shape: "circle", width: 1.9, height: 1.9, assignOrder: 15 + i })),
  // Rail seats along the starboard side, two by two
  ...Array.from({ length: 10 }, (_, i) => seat(`bt_r${i + 1}`, `R${i + 1}`, "seat", 1 + i * 1.6, 14.2, "cat_bcd_rail", { seatRow: "R", seatNumber: i + 1, assignOrder: 30 + i })),
];
/* A few already gone, so the plan reads like a week before the finale. */
for (const id of ["bt_v2", "bt_t3", "bt_t7", "bt_r4", "bt_r5"]) {
  const s = boatSeats.find((x) => x.id === id);
  if (s) s.isAvailable = false;
}

export const bcdSeatLayouts: SeatLayout[] = [
  {
    id: "layout_bcd_boat",
    locationId: LOC,
    name: "The boat — 2nd deck",
    rows: 1,
    seatsPerRow: boatSeats.length,
    rowLabels: ["R"],
    bufferAfterMinutes: 0,
    seatCount: boatSeats.length,
    experience: "restaurant",
    categories: [
      { uid: "cat_bcd_vip", name: "VIP booth (6)", color: "#F94A00", price: 2400000, pricingMode: "fixed", isGeneralAdmission: false },
      { uid: "cat_bcd_deck", name: "Deck table (4)", color: "#2563EB", price: 1400000, pricingMode: "fixed", isGeneralAdmission: false },
      { uid: "cat_bcd_rail", name: "Rail seat", color: "#16A34A", price: 350000, pricingMode: "fixed", isGeneralAdmission: false },
      { uid: "cat_bcd_floor", name: "Dance floor", color: "#F59E0B", price: 300000, pricingMode: "fixed", isGeneralAdmission: true, gaCapacity: 120 },
    ],
    seats: boatSeats,
    fixtures: [
      { id: "fx_bcd_dj", kind: "stage", label: "DJ BOOTH", posX: 6, posY: 0, width: 6, height: 1.6, rotation: 0 },
      { id: "fx_bcd_bow", kind: "text", label: "BOW", posX: 7.5, posY: -1.4, width: 3, height: 0.75, rotation: 0 },
      { id: "fx_bcd_bar", kind: "bar", label: "Bar & breakfast", posX: 3, posY: 16, width: 7, height: 1.25, rotation: 0 },
      { id: "fx_bcd_gang", kind: "door", label: "Gangway", posX: 12.5, posY: 16.4, width: 2, height: 0.5, rotation: 0 },
    ],
    createdAt: T,
    updatedAt: T,
  },
];

export const bcdProducts: Product[] = baseProducts.map((p) => ({ ...p, ...PAGES[p.id] }));

export const bcdStorefronts: Storefront[] = [
  {
    id: `sf_${LOC}`,
    locationId: LOC,
    slug: "breakfastclubdhaka",
    published: true,
    headline: "Good mornings only.",
    intro:
      "Bangladesh's morning culture movement. Coffee, DJ sets and breakfast at cozy cafés across Dhaka from 9 AM — a daytime alternative to the late night, for anyone who wants to start the day dancing. Pick your morning and get your pass.",
    featured: ["prd_bcd_deck", "prd_bcd_morning", "prd_bcd_workshop"],
    contactEmail: "breakfastclub.dhaka@gmail.com",
    links: [
      { id: "sfl_bcd_ig", label: "Follow us on Instagram", url: "https://www.instagram.com/breakfastclub.dhaka/" },
      { id: "sfl_bcd_fb", label: "Find us on Facebook", url: "https://www.facebook.com/people/Breakfast-Club-Dhaka/61575612057518/" },
    ],
    accent: "orange",
    heroImage: "/demo/bcd/hero.jpg",
    logo: "/demo/bcd/logo-ink.png",
    /* The club's brand: black ink on warm cream, a yolk yellow, set in Bebas over DM Sans. */
    style: { primary: "#111111", secondary: "#f2a900", background: "#faf6ec", surface: "#ffffff", text: "#111111", headingFont: "bebas", bodyFont: "dm-sans", headingWeight: 400, headingCase: "upper", typeScale: "large", corners: "soft", buttonStyle: "pill", cardStyle: "bordered", hero: "split", texture: "grain", imageTone: "warm" },
    createdAt: T,
    updatedAt: T,
  },
];

export const bcdInventoryItems: InventoryItem[] = [
  {
    id: "inv_bcd_rafiki", name: "Rafiki tee (limited edition, with Elaka)", sku: "BCD-TEE-RAFIKI", kind: "merch", unit: "each",
    price: 100000, cost: 45000, taxClass: "standard", tracked: true, returnable: false, lowAt: 10,
    locationIds: [LOC], atCounter: true, status: "active", createdAt: T, updatedAt: T,
  },
  {
    id: "inv_bcd_coffee", name: "Iced Americano", sku: "BCD-ICED-AMERICANO", kind: "food", unit: "each",
    price: 35000, cost: 12000, taxClass: "standard", tracked: false, returnable: false, lowAt: 0,
    locationIds: [LOC], atCounter: true, status: "active", createdAt: T, updatedAt: T,
  },
];

const at = (days: number) => `${demoDay(days)}T09:00:00+06:00`;
export const bcdStockMovements: StockMovement[] = [
  { id: "mv_bcd_1", itemId: "inv_bcd_rafiki", locationId: LOC, kind: "received", quantity: 120, reason: "Opening stock", by: "Tawsif Alam Khan", at: at(-21) },
  { id: "mv_bcd_2", itemId: "inv_bcd_rafiki", locationId: LOC, kind: "sold", quantity: -64, by: "Door", at: at(-7) },
];
