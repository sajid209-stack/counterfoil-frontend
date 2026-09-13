import type { EventRecord } from "@/lib/api/events";
import { categoryById, type CategoryId } from "@/lib/events/catalog";

/**
 * One seeded event per category, so every template has real content to draw and
 * the six themes can be compared side by side rather than described.
 *
 * Content is deliberately local — Dhaka, Sylhet, Chattogram — matching the rest
 * of the fixture. A template that only ever renders "Event Name" and "Lorem"
 * hides exactly the failures that matter: a long Bangla-adjacent title wrapping,
 * a nine-name lineup overflowing, a five-tier ticket table.
 */
const iso = (d: string) => `${d}+06:00`;

function base(
  id: string,
  categoryId: CategoryId,
  subtype: string,
  fields: Partial<EventRecord>,
): EventRecord {
  const cat = categoryById(categoryId);
  return {
    id,
    status: "active",
    published: true,
    slug: id.replace("evt_", ""),
    title: "",
    categoryId,
    subtype,
    startsAt: iso("2026-10-10T19:00:00"),
    venueName: "",
    stats: [],
    highlights: [],
    info: [],
    sponsors: [],
    lineup: [],
    faq: [],
    tiers: [],
    customisation: {
      accent: cat.theme.accent,
      displayFont: cat.theme.display,
      bodyFont: cat.theme.body,
      variant: cat.variants[0],
      sections: cat.sections,
    },
    createdAt: iso("2026-09-01T10:00:00"),
    updatedAt: iso("2026-09-08T10:00:00"),
    ...fields,
  } as EventRecord;
}

export const events: EventRecord[] = [
  base("evt_megaconcert", "entertainment", "concert", {
    title: "Nogor Baul: The Return",
    subtitle: "One night, one stage, three decades of sound",
    startsAt: iso("2026-11-14T18:30:00"),
    endsAt: iso("2026-11-14T23:30:00"),
    venueName: "Army Stadium",
    venueAddress: "Banani, Dhaka 1213",
    description:
      "Thirty years of Bangla rock, played loud and in order. Gates at 18:30, first set at 19:30, and the main act closes the night.",
    stats: [
      { id: "s1", value: "25,000+", label: "Fans across 3 cities" },
      { id: "s2", value: "12", label: "Shows completed" },
      { id: "s3", value: "2026", label: "Tour season" },
    ],
    highlights: [
      { id: "h1", label: "Backstage" },
      { id: "h2", label: "Soundcheck" },
      { id: "h3", label: "Merch drop" },
      { id: "h4", label: "The venue" },
    ],
    info: [
      { id: "i1", label: "Venue", value: "Army Stadium, Dhaka — open-air, standing only" },
      { id: "i2", label: "Doors open", value: "16:00. Show starts 18:00 sharp." },
      { id: "i3", label: "Capacity", value: "8,000 standing. No seats, no barriers." },
    ],
    lineup: [
      { id: "l1", name: "Nogor Baul", role: "Headline", at: "21:30" },
      { id: "l2", name: "Arbovirus", role: "Support", at: "20:15" },
      { id: "l3", name: "Shonar Bangla Circus", role: "Opening", at: "19:30" },
    ],
    faq: [
      { id: "f1", q: "Can I re-enter?", a: "No re-entry once scanned. Plan your break before you come in." },
      { id: "f2", q: "Is there parking?", a: "Limited paid parking at the north gate. Ride-share drop-off is at gate 3." },
    ],
    tiers: [
      { id: "t1", name: "Early bird", price: 120000, quantity: 500, sold: 500, salesEnd: iso("2026-10-01T23:59:00") },
      { id: "t2", name: "General admission", price: 180000, quantity: 4000, sold: 1240, description: "General standing. The whole floor is open.", perks: ["General standing area", "Access to food and drink stalls", "Festival wristband"] },
      { id: "t3", name: "Front standing", price: 350000, quantity: 600, sold: 310, description: "First 20 metres, own entrance.", perks: ["Front pit access", "Priority entry and fast lane", "Dedicated bar"] },
      { id: "t4", name: "VIP box", price: 900000, quantity: 60, sold: 22, description: "Seated, covered, with service.", maxPerOrder: 4, perks: ["Covered seating", "Table service all night", "Private entrance and washrooms", "Meet and greet lottery"] },
    ],
  }),

  base("evt_turfcup", "sports", "tournament", {
    title: "Chattogram Turf Cup",
    subtitle: "Sixteen sides. One weekend. Floodlights on.",
    startsAt: iso("2026-10-24T16:00:00"),
    endsAt: iso("2026-10-25T22:00:00"),
    venueName: "Port City Turf Arena",
    venueAddress: "Agrabad, Chattogram",
    description:
      "Two days of seven-a-side across four pitches, group stage on Saturday and knockouts under lights on Sunday.",
    stats: [
      { id: "s1", value: "16", label: "Teams" },
      { id: "s2", value: "\u09f32,00,000", label: "Prize pool" },
      { id: "s3", value: "3", label: "Days of football" },
    ],
    highlights: [
      { id: "h1", label: "The draw" },
      { id: "h2", label: "Format" },
      { id: "h3", label: "Teams" },
      { id: "h4", label: "The ground" },
    ],
    info: [
      { id: "i1", label: "Ground", value: "Chattogram Turf \u2014 floodlit, 7-a-side" },
      { id: "i2", label: "First whistle", value: "09:00 daily. Final at 18:00 Sunday." },
      { id: "i3", label: "Format", value: "Group stage, then straight knockout" },
    ],
    lineup: [
      { id: "l1", name: "Group stage", role: "All four pitches", at: "Sat 16:00" },
      { id: "l2", name: "Quarter-finals", role: "Pitch 1 and 2", at: "Sun 16:00" },
      { id: "l3", name: "Semi-finals", role: "Pitch 1", at: "Sun 19:00" },
      { id: "l4", name: "Final", role: "Pitch 1, under lights", at: "Sun 21:00" },
    ],
    faq: [
      { id: "f1", q: "How many in a squad?", a: "Seven on the pitch, up to eleven registered. Rolling substitutions." },
      { id: "f2", q: "What if it rains?", a: "The turf drains. Play continues unless lightning is called." },
    ],
    tiers: [
      { id: "t1", name: "Team entry", price: 1200000, quantity: 16, sold: 13, description: "Covers both days and all fixtures.", maxPerOrder: 1 },
      { id: "t2", name: "Spectator — day pass", price: 30000, quantity: 800, sold: 268 },
      { id: "t3", name: "Spectator — weekend", price: 50000, quantity: 400, sold: 141 },
    ],
  }),

  base("evt_techsummit", "business", "conference", {
    title: "Sylhet Tech Summit 2026",
    subtitle: "Building for the next hundred million",
    startsAt: iso("2026-12-03T09:00:00"),
    endsAt: iso("2026-12-04T17:30:00"),
    venueName: "Sylhet International Convention Centre",
    venueAddress: "Airport Road, Sylhet 3100",
    description:
      "Two days on payments, logistics and the infrastructure underneath both. Single track in the morning, three rooms after lunch.",
    stats: [
      { id: "s1", value: "24", label: "Speakers" },
      { id: "s2", value: "3", label: "Tracks" },
      { id: "s3", value: "600", label: "Seats" },
      { id: "s4", value: "2", label: "Days" },
    ],
    /* Benefits, not chips: this layout draws them as an argument beside the
       ticket panel, and "Wi-Fi" is not an argument. */
    highlights: [
      { id: "h1", label: "Gain real-world insights", description: "Learn from the teams running the products you use, not from a deck." },
      { id: "h2", label: "Expand your network", description: "Meet the product teams, investors and peers working on the same problems." },
      { id: "h3", label: "Build what's next", description: "Leave with practical ways to scale what you have already built." },
    ],
    info: [
      { id: "i1", label: "Doors", value: "08:30 registration. Keynote at 09:30." },
      { id: "i2", label: "Included", value: "Lunch, coffee and every session recorded" },
      { id: "i3", label: "Getting there", value: "20 minutes from the airport. Parking on site." },
    ],
    /* The day carries the grouping and `at` carries the clock. Concatenating
       them into one string, which this seed used to do, meant the agenda could
       only ever be one flat column — the tab strip needs a field to group on. */
    lineup: [
      { id: "l1", kind: "session" as const, name: "Registration and coffee", day: "Day 1", at: "08:30" },
      { id: "l2", name: "Farhana Rahman", role: "Keynote \u2014 CTO, bKash", day: "Day 1", at: "09:30" },
      { id: "l3", name: "Imran Chowdhury", role: "Head of Platform, Pathao", day: "Day 1", at: "11:00" },
      { id: "l4", kind: "session" as const, name: "Lunch", day: "Day 1", at: "12:30" },
      { id: "l5", name: "Dr. Nusrat Jahan", role: "Bangladesh Bank \u2014 regulation track", day: "Day 1", at: "14:00" },
      { id: "l6", kind: "session" as const, name: "Workshop: settling at scale", role: "Hall C, 40 places", day: "Day 1", at: "15:45" },
      { id: "l7", name: "Tanvir Ahmed", role: "Founder, ShopUp", day: "Day 2", at: "10:00" },
      { id: "l11", name: "Sadia Islam", role: "Director of Engineering, Robi", day: "Day 2", at: "14:00" },
      { id: "l12", name: "Arif Hossain", role: "Partner, Anchorless Bangladesh", day: "Day 2", at: "15:15" },
      { id: "l8", kind: "session" as const, name: "Panel: what merchants actually ask for", role: "Halls A and B", day: "Day 2", at: "11:30" },
      { id: "l9", kind: "session" as const, name: "Lunch", day: "Day 2", at: "12:30" },
      { id: "l10", kind: "session" as const, name: "Closing remarks", role: "Hall A", day: "Day 2", at: "16:30" },
    ],
    /* Blender's "Big Buck Bunny": Creative Commons, permanently hosted, and
       unmistakably placeholder footage rather than something that could be
       taken for the operator's own. Verified live before it was seeded. */
    videoUrl: "https://www.youtube.com/watch?v=YE7VzlLtp-4",
    organiser: {
      name: "Sylhet Digital Forum",
      blurb: "A non-profit running developer and founder events across Sylhet since 2019.",
    },
    sponsors: [
      { id: "sp1", name: "bKash", tier: "Headline" },
      { id: "sp2", name: "Pathao", tier: "Headline" },
      { id: "sp3", name: "Brac Bank", tier: "Partner" },
      { id: "sp4", name: "Robi Axiata", tier: "Partner" },
      { id: "sp5", name: "ShopUp", tier: "Partner" },
      { id: "sp6", name: "Sylhet Chamber of Commerce", tier: "Supporter" },
      { id: "sp7", name: "SUST Computer Science", tier: "Supporter" },
      { id: "sp8", name: "Kite Games", tier: "Supporter" },
    ],
    faq: [
      { id: "f1", q: "Are talks recorded?", a: "Yes. Ticket holders get the recordings a week after the summit." },
      { id: "f2", q: "Is lunch included?", a: "Both days, for every ticket type." },
    ],
    tiers: [
      {
        id: "t4",
        name: "Student pass",
        price: 100000,
        quantity: 150,
        sold: 88,
        description: "Valid student ID checked at the door.",
        perks: ["Both days, single track", "Lunch and coffee", "Session recordings"],
      },
      {
        id: "t2",
        name: "Full summit",
        price: 650000,
        quantity: 600,
        sold: 414,
        description: "Everything across both days.",
        perks: [
          "Both days, every track",
          "Lunch, coffee and the evening reception",
          "Session recordings and slides",
          "Workshop places, first come",
        ],
      },
      {
        id: "t3",
        name: "Team of five",
        price: 2800000,
        quantity: 40,
        sold: 11,
        description: "Five passes, one invoice.",
        maxPerOrder: 2,
        perks: ["Five full-summit passes", "One invoice and one PO", "Reserved block seating", "A named contact on the day"],
      },
      { id: "t1", name: "Early bird", price: 450000, quantity: 200, sold: 200, salesEnd: iso("2026-10-15T23:59:00") },
    ],
  }),

  base("evt_exhibition", "arts", "exhibition", {
    title: "Threads of the Delta",
    subtitle: "Textile, memory and the river — forty works, six weeks",
    startsAt: iso("2026-10-05T11:00:00"),
    endsAt: iso("2026-11-16T19:00:00"),
    venueName: "Bengal Gallery of Fine Arts",
    venueAddress: "Dhanmondi, Dhaka 1209",
    description:
      "Forty works across weaving, dye and photography, tracing what the rivers carry and what they take. Curated by Shireen Haque.",
    stats: [
      { id: "s1", value: "40", label: "Works on show" },
      { id: "s2", value: "9", label: "Artists" },
      { id: "s3", value: "6", label: "Weeks" },
    ],
    highlights: [
      { id: "h1", label: "The artists" },
      { id: "h2", label: "The curator" },
      { id: "h3", label: "Catalogue" },
      { id: "h4", label: "The space" },
    ],
    info: [
      { id: "i1", label: "Gallery", value: "Bengal Arts Centre, ground floor" },
      { id: "i2", label: "Open", value: "Tue\u2013Sun, 11:00\u201319:00. Closed Mondays." },
      { id: "i3", label: "Entry", value: "Timed entry every 30 minutes" },
    ],
    lineup: [
      { id: "l1", name: "Runa Islam", role: "Weaving, 12 works" },
      { id: "l2", name: "Kamrul Hasan Jr.", role: "Indigo and resist dye" },
      { id: "l3", name: "Ayesha Sultana", role: "Photography, silver gelatin" },
    ],
    faq: [
      { id: "f1", q: "Is photography allowed?", a: "Without flash, yes, except in the indigo room." },
      { id: "f2", q: "Are there guided walks?", a: "Every Friday at 16:00, included with entry." },
    ],
    tiers: [
      { id: "t1", name: "Entry", price: 30000, quantity: 3000, sold: 612 },
      { id: "t2", name: "Entry + curator's walk", price: 75000, quantity: 240, sold: 96, description: "Fridays, 16:00, limited to 20 a walk." },
      { id: "t3", name: "Members", price: 0, quantity: 500, sold: 173, description: "Free for Bengal Foundation members." },
    ],
  }),

  base("evt_sundarbans", "travel", "tour", {
    title: "Sundarbans: Three Days on the Water",
    subtitle: "Khulna to Kotka and back, on a live-aboard",
    startsAt: iso("2026-11-20T06:00:00"),
    endsAt: iso("2026-11-22T20:00:00"),
    venueName: "Departs Khulna Launch Ghat",
    venueAddress: "Rupsha, Khulna",
    description:
      "Three days through the world's largest mangrove forest, sleeping on board. Small group, two guides, all meals.",
    stats: [
      { id: "s1", value: "3", label: "Days on the water" },
      { id: "s2", value: "4", label: "Stops" },
      { id: "s3", value: "18", label: "Travellers max" },
    ],
    highlights: [
      { id: "h1", label: "The route" },
      { id: "h2", label: "The boat" },
      { id: "h3", label: "Meals" },
      { id: "h4", label: "What to pack" },
    ],
    info: [
      { id: "i1", label: "Departs", value: "Khulna launch ghat, 07:00" },
      { id: "i2", label: "Duration", value: "3 days, 2 nights aboard" },
      { id: "i3", label: "Group", value: "18 travellers, 2 guides, 1 cook" },
    ],
    lineup: [
      { id: "l1", name: "Day 1 — Khulna to Harbaria", role: "Board at dawn, forest walk in the afternoon", at: "Day 1" },
      { id: "l2", name: "Day 2 — Kotka and Jamtola", role: "Sunrise at the watchtower, beach walk, night on deck", at: "Day 2" },
      { id: "l3", name: "Day 3 — Karamjal and return", role: "Crocodile centre, back to Khulna by evening", at: "Day 3" },
    ],
    faq: [
      { id: "f1", q: "What should I bring?", a: "Closed shoes, a hat, and long sleeves. Everything else is on board." },
      { id: "f2", q: "Is there a permit?", a: "Included. We file it for you with your booking." },
    ],
    tiers: [
      { id: "t1", name: "Shared cabin", price: 1450000, quantity: 24, sold: 17 },
      { id: "t2", name: "Private cabin", price: 2400000, quantity: 8, sold: 5, maxPerOrder: 2 },
      { id: "t3", name: "Deck berth", price: 950000, quantity: 12, sold: 9, description: "Open deck, mattress and mosquito net." },
    ],
  }),

  base("evt_underground", "nightlife", "rave", {
    title: "DHAKA UNDERGROUND — VOL. 07",
    subtitle: "Warehouse. Sunset to sunrise. Location on the day.",
    startsAt: iso("2026-10-31T22:00:00"),
    endsAt: iso("2026-11-01T06:00:00"),
    venueName: "Location released 6 hours before",
    venueAddress: "Tejgaon industrial area, Dhaka",
    description:
      "Eight hours, two rooms, no phones on the floor. The address goes out to ticket holders at 16:00 on the day.",
    stats: [
      { id: "s1", value: "2", label: "Rooms" },
      { id: "s2", value: "8", label: "Hours" },
      { id: "s3", value: "4", label: "DJs" },
    ],
    highlights: [
      { id: "h1", label: "The rooms" },
      { id: "h2", label: "The sound" },
      { id: "h3", label: "Door policy" },
      { id: "h4", label: "Location" },
    ],
    info: [
      { id: "i1", label: "Location", value: "Tejgaon. Address sent 6 hours before." },
      { id: "i2", label: "Doors", value: "22:00 until sunrise" },
      { id: "i3", label: "Age", value: "21+. Photo ID checked at the door." },
    ],
    lineup: [
      { id: "l1", name: "AFTERMATH", role: "Room 1 · closing", at: "03:00" },
      { id: "l2", name: "NAJ", role: "Room 1", at: "01:00" },
      { id: "l3", name: "SUBCONTINENT", role: "Room 2 · all night", at: "22:00" },
      { id: "l4", name: "RIA b2b TAAL", role: "Room 1 · opening", at: "22:30" },
    ],
    faq: [
      { id: "f1", q: "Age?", a: "21+. Photo ID checked at the door, no exceptions." },
      { id: "f2", q: "Where is it?", a: "Ticket holders get the address by SMS at 16:00 on the day." },
    ],
    tiers: [
      { id: "t1", name: "First release", price: 150000, quantity: 200, sold: 200, salesEnd: iso("2026-10-10T23:59:00") },
      { id: "t2", name: "Second release", price: 220000, quantity: 300, sold: 287 },
      { id: "t3", name: "Final release", price: 300000, quantity: 300, sold: 64 },
    ],
  }),
];
