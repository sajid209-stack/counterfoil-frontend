export interface DemoBusiness {
  id: string;
  name: string;
  currency: string;
  tagline: string;
  types: string;
  productIds: string[];
  /** A whole-business demo with its own venue, shelf and storefront (lib/api/client BUNDLES). */
  bundle?: boolean;
  /** Shown in its own row on the demo wall — "trusther" for the US partner demos. */
  group?: "trusther";
}

// Five coherent demo businesses. Selecting one swaps the whole mock state so a
// prospect sees Counterfoil as *their* kind of business.
export const DEMOS: DemoBusiness[] = [
  {
    id: "bcd",
    name: "Breakfast Club Dhaka",
    currency: "BDT",
    tagline: "Morning raves — coffee, DJs and breakfast from 9 AM",
    types: "Dated special · group pass · shuttle add-on · weekly mornings · workshop · merch",
    productIds: [],
    bundle: true,
  },
  {
    id: "doers",
    name: "The Doers Club",
    currency: "BDT",
    tagline: "Small-group workshops — matcha, sushi, tea and social nights",
    types: "Timed sessions · seat caps · pair tickets · workshop pass · web page",
    productIds: [],
    bundle: true,
  },
  {
    id: "museum",
    name: "Dhaka National Museum",
    currency: "BDT",
    tagline: "Admission, timed slots, guided tours",
    types: "Open · date-range · slots · daily cap · guided ×2 · re-entry",
    productIds: ["prd_admission", "prd_reentry", "prd_winter", "prd_planetarium", "prd_garden", "prd_tour", "prd_tour2"],
  },
  {
    id: "turf",
    name: "Victory Turf Arena",
    currency: "BDT",
    tagline: "Cricket, futsal and badminton across three surfaces",
    types: "Shared field · indoor & outdoor · variable duration · peak pricing",
    productIds: ["prd_cricket", "prd_futsal", "prd_badminton"],
  },
  {
    id: "bowling",
    name: "Strike Bowling",
    currency: "BDT",
    tagline: "Four lanes, flexible hours",
    types: "Resource · flexible duration · add-ons",
    productIds: ["prd_bowling"],
  },
  {
    id: "spa",
    name: "Serenity Spa",
    currency: "BDT",
    tagline: "Therapists, durations, deposits",
    types: "Provider · per-duration · deposit policy",
    productIds: ["prd_massage"],
  },
  {
    id: "cinema",
    name: "Galaxy Cinema & Fun Zone",
    currency: "BDT",
    tagline: "Sections, bundles, credits, courses",
    types: "Sections · bundle · credits · course · waitlist",
    productIds: ["prd_film", "prd_bundle", "prd_yoga_pack", "prd_swim", "prd_yoga"],
  },
  // TrustHer partner demos — US businesses, dollars, sales tax and US payments
  // (lib/mock/trusther, lib/region).
  {
    id: "kinks",
    name: "Kinks & Crowns Hair Studio",
    currency: "USD",
    tagline: "Silk presses, braids and locs in Detroit",
    types: "Pick a stylist · deposits · add-ons · retail at the counter",
    productIds: [],
    bundle: true,
    group: "trusther",
  },
  {
    id: "sweat",
    name: "Sweat Sisters Studio",
    currency: "USD",
    tagline: "Sculpt, dance cardio and yoga in Atlanta",
    types: "Class timetable · capped classes · intro offer · 10-class pack",
    productIds: [],
    bundle: true,
    group: "trusther",
  },
  {
    id: "velvet",
    name: "The Velvet Hour",
    currency: "USD",
    tagline: "Day parties, mixers and paint & sip in Miami",
    types: "Ticketed events · booths for six · lounge hire by the hour",
    productIds: [],
    bundle: true,
    group: "trusther",
  },
  {
    id: "mamajos",
    name: "Mama Jo's Supper Club",
    currency: "USD",
    tagline: "Sunday suppers and Creole cooking in New Orleans",
    types: "Seatings · cooking class · private dining by link · retail",
    productIds: [],
    bundle: true,
    group: "trusther",
  },
];
