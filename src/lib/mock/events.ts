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
      { id: "t2", name: "General admission", price: 180000, quantity: 4000, sold: 1240 },
      { id: "t3", name: "Front standing", price: 350000, quantity: 600, sold: 310, description: "First 20 metres, own entrance." },
      { id: "t4", name: "VIP box", price: 900000, quantity: 60, sold: 22, description: "Seated, covered, with service.", maxPerOrder: 4 },
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
    lineup: [
      { id: "l1", name: "Farhana Rahman", role: "CTO, Bkash", at: "Day 1 · 09:30" },
      { id: "l2", name: "Imran Chowdhury", role: "Head of Platform, Pathao", at: "Day 1 · 11:00" },
      { id: "l3", name: "Dr. Nusrat Jahan", role: "Bangladesh Bank", at: "Day 1 · 14:00" },
      { id: "l4", name: "Tanvir Ahmed", role: "Founder, ShopUp", at: "Day 2 · 10:00" },
    ],
    faq: [
      { id: "f1", q: "Are talks recorded?", a: "Yes. Ticket holders get the recordings a week after the summit." },
      { id: "f2", q: "Is lunch included?", a: "Both days, for every ticket type." },
    ],
    tiers: [
      { id: "t1", name: "Early bird", price: 450000, quantity: 200, sold: 200, salesEnd: iso("2026-10-15T23:59:00") },
      { id: "t2", name: "Standard", price: 650000, quantity: 600, sold: 214 },
      { id: "t3", name: "Team of five", price: 2800000, quantity: 40, sold: 11, description: "Five passes, one invoice.", maxPerOrder: 2 },
      { id: "t4", name: "Student", price: 100000, quantity: 150, sold: 88, description: "Valid student ID required at the door." },
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
