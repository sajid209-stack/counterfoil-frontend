export interface DemoBusiness {
  id: string;
  name: string;
  currency: string;
  tagline: string;
  types: string;
  productIds: string[];
}

// Five coherent demo businesses. Selecting one swaps the whole mock state so a
// prospect sees Counterfoil as *their* kind of business.
export const DEMOS: DemoBusiness[] = [
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
];
