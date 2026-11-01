/* Prices and the marketplace comparison, from the deck (Sales.tsx): the real
   Bangladesh price list. One source for the grid and the chart. */

export const taka = (v: number) => `৳${Math.round(v).toLocaleString("en-US")}`;

export type Plan = {
  name: string;
  who: string;
  monthly: number;
  yearly: number;
  lines: string[];
  featured?: boolean;
};

export const PLANS: Plan[] = [
  { name: "Lite", who: "One counter, getting started", monthly: 0, yearly: 0, lines: ["1 seat · 1 location", "500 SMS a month", "Chat support"] },
  {
    name: "Starter",
    who: "A venue with a few staff",
    monthly: 2990,
    yearly: 29900,
    lines: ["3 seats · 1 location", "1,000 SMS, emails and form replies", "250 waivers a month", "Memberships, retail, food & drink"],
  },
  {
    name: "Growth",
    who: "Several counters, or two sites",
    monthly: 9990,
    yearly: 99900,
    featured: true,
    lines: ["10 seats · 2 locations", "3,000 SMS, emails and form replies", "1,000 waivers a month", "Agents and kitchen display", "Full API, priority chat"],
  },
  {
    name: "Advanced",
    who: "Groups and busy operations",
    monthly: 14990,
    yearly: 149900,
    lines: ["25 seats · 3 locations", "5,000 SMS, emails and form replies", "2,000 waivers a month", "Agents and kitchen display", "Full API, phone support"],
  },
];

export const EVENTS_LINES = ["Unlimited seats and locations", "Pay as you go on every meter", "Full API"];

export const GROWTH = PLANS[2];
export const TICKET_PRICE = 500;
export const SHARE_LOW = 0.065;
export const SHARE_HIGH = 0.12;
export const share = (tickets: number, rate: number) => tickets * TICKET_PRICE * rate;
/** Tickets a month at which the flat fee meets a marketplace share at `rate`. */
export const evenAt = (rate: number) => GROWTH.monthly / (TICKET_PRICE * rate);
