import { categoryById, REQUIRED_SECTIONS } from "@/lib/events/catalog";
import type { PageCountdown, PageLook, PageSectionId, Product, ProductPage } from "@/lib/api/types";

/**
 * Every booking's page — the page a customer reads before booking.
 *
 * ONE system for every booking (docs/catalog.md §10.5): the same seven looks,
 * the same sections and the same countdown settings, whether it is a concert,
 * a planetarium show, a court by the hour or a pack of visits. Nothing here
 * branches on what kind of booking it is; the only thing that differs is what
 * a booking already knows to put on its page (an on-a-date booking has a first
 * day to count down to; a booking with a schedule has times).
 *
 * A booking never has no page. Until the operator designs one, `pageOf` returns
 * the default, built from what the booking already knows, so the Page step opens
 * on a finished page.
 */

/** Every look, for every booking, in the order the designer offers them.
 *  The ids are the stored values; the names people see are the look's own
 *  (`lookName`), never a category ("Classic", not "Standard"; "Floodlit", not
 *  "Sports & Activities"). */
export const ALL_LOOKS: PageLook[] = ["standard", "entertainment", "sports", "business", "arts", "travel", "nightlife"];

/** The message key (under `catalog.page.looks`) naming each look. */
export const LOOK_KEY: Record<PageLook, string> = {
  standard: "classic",
  entertainment: "poster",
  sports: "floodlit",
  business: "clean",
  arts: "gallery",
  travel: "journey",
  nightlife: "neon",
};

/** Every section any page can draw, in their canonical order. Every look draws
 *  every one of them for every booking. `hero` (the top of the page) and
 *  `tickets` (the booking panel) are always drawn. */
export const ALL_PAGE_SECTIONS: PageSectionId[] = [
  "hero",
  "countdown",
  "stats",
  "highlights",
  "about",
  "included",
  "know",
  "lineup",
  "schedule",
  "gallery",
  "video",
  "faq",
  "venue",
  "sponsors",
  "tickets",
];

/** Kept for callers written before revision 2. */
export const STANDARD_SECTIONS = ALL_PAGE_SECTIONS;

/** Shown on a new page: the sections that are already true from what the
 *  booking knows. Everything else waits until there is something written in
 *  it — an empty section on a public page is a promise nobody made. */
export const DEFAULT_SECTIONS: PageSectionId[] = ["hero", "about", "included", "know", "gallery", "venue", "tickets"];

/** Kept for callers written before revision 2. */
export const STANDARD_DEFAULT = DEFAULT_SECTIONS;

/** Sections that cannot be hidden. */
export const REQUIRED_PAGE_SECTIONS: PageSectionId[] = REQUIRED_SECTIONS;

/** An on-a-date booking (BT-15). Internal: nothing in the Catalog shows it as
 *  a type; it decides what the booking knows (days, a first day). */
export const isEventItem = (p: Pick<Product, "bookingType">) => p.bookingType === "BT-15";

/** The looks a booking can choose between: all of them, for every booking. */
export const looksFor = (): PageLook[] => ALL_LOOKS;

/** The sections a look can draw: all of them, for every look. */
export const sectionsFor = (): PageSectionId[] => ALL_PAGE_SECTIONS;

/** The page a booking gets before anyone designs it: the Classic look, the
 *  sections it can already fill, no sample text, and — for an on-a-date
 *  booking — a countdown to its first day. */
export function defaultPage(p: Pick<Product, "bookingType" | "event">): ProductPage {
  const dated = isEventItem(p);
  return {
    look: "standard",
    sections: dated ? (["hero", "countdown", ...DEFAULT_SECTIONS.slice(1)] as PageSectionId[]) : DEFAULT_SECTIONS,
    stats: [],
    highlights: [],
    info: [],
    faq: [],
    lineup: [],
    sponsors: [],
    countdown: dated ? { mode: "start", hideAtZero: true } : { mode: "off", hideAtZero: true },
  };
}

/** The look's own default colour, fonts and layout variant — what a look
 *  starts from before the operator picks a colour. */
export function lookDefaults(look: PageLook): Pick<ProductPage, "accent" | "displayFont" | "bodyFont" | "variant"> {
  if (look === "standard") return {};
  const cat = categoryById(look);
  return { accent: cat.theme.accent, displayFont: cat.theme.display, bodyFont: cat.theme.body, variant: cat.variants[0] };
}

/** The booking's page as it will be drawn: what was designed, or the default. */
export const pageOf = (p: Pick<Product, "bookingType" | "event" | "page">): ProductPage => p.page ?? defaultPage(p);

/**
 * The countdown as it will be drawn, or null when there is none to draw:
 * resolved from the page's settings and what the booking knows. A page
 * designed before revision 2 that shows the countdown section on an on-a-date
 * booking counts to the first day, as it always did.
 */
export function countdownOf(p: Pick<Product, "bookingType" | "event" | "page">, now: Date): { at: Date; label?: string } | null {
  const page = pageOf(p);
  if (!page.sections.includes("countdown")) return null;
  const c: PageCountdown = page.countdown ?? { mode: isEventItem(p) ? "start" : "off" };
  let at: Date | null = null;
  if (c.mode === "start" && p.event?.startsAt) at = new Date(p.event.startsAt);
  if (c.mode === "date" && c.at) at = new Date(c.at);
  if (!at || Number.isNaN(at.getTime())) return null;
  if (at.getTime() <= now.getTime() && c.hideAtZero !== false) return null;
  return { at, label: c.label };
}

/** Is it published anywhere a customer can read its page? Not online means no
 *  page, so the wizard skips the Page step for a counter-only booking. */
export const hasPublicPage = (p: Pick<Product, "channels">) => p.channels.includes("online");

/** Listed on the storefront, or only at its own link. */
export const isListed = (p: Pick<Product, "channels" | "online">) => p.channels.includes("online") && (p.online ?? "listed") === "listed";

/** The booking's own link, relative to the site. */
export const itemPath = (slug: string) => `/b/${slug}`;
