import { categoryById, REQUIRED_SECTIONS } from "@/lib/events/catalog";
import type { PageLook, PageSectionId, Product, ProductPage } from "@/lib/api/types";

/**
 * Every item's page — the page a customer reads before booking.
 *
 * An item never has no page. Until the operator designs one, `pageOf` returns
 * the default for its kind, built from what the item already knows (its name,
 * photos, description, tickets, policies and venue), so the Page step in the
 * wizard opens on a finished page and is for improving it, never for filling
 * it in. See docs/catalog.md §5 and §9.3.
 *
 * Events (BT-15) take their kind's designed look and section set from
 * lib/events/catalog. Every other item takes the standard page.
 */

/** What the standard page can draw, in its canonical order. Hero (the name,
 *  photos and facts) and tickets (the booking panel) are always drawn. */
export const STANDARD_SECTIONS: PageSectionId[] = ["hero", "about", "highlights", "included", "know", "gallery", "video", "faq", "venue", "tickets"];

/** Shown by default on a standard page: the ones that are already true from
 *  what the item knows. Highlights, video and FAQ wait until there is
 *  something to say — a section with sample text in it is a promise nobody
 *  made. */
export const STANDARD_DEFAULT: PageSectionId[] = ["hero", "about", "included", "know", "gallery", "venue", "tickets"];

/** Sections that cannot be hidden. */
export const REQUIRED_PAGE_SECTIONS: PageSectionId[] = REQUIRED_SECTIONS;

export const isEventItem = (p: Pick<Product, "bookingType">) => p.bookingType === "BT-15";

/** The looks an item can choose between. An event can take any of the six
 *  designed looks (a club night may want the editorial look); every other item
 *  has the standard page. */
export function looksFor(p: Pick<Product, "bookingType">): PageLook[] {
  return isEventItem(p) ? ["entertainment", "sports", "business", "arts", "travel", "nightlife"] : ["standard"];
}

/** The sections a look can draw. */
export function sectionsFor(look: PageLook): PageSectionId[] {
  return look === "standard" ? STANDARD_SECTIONS : categoryById(look).sections.concat(["video", "sponsors", "schedule"]).filter((s, i, a) => a.indexOf(s) === i);
}

/** The page an item gets before anyone designs it. */
export function defaultPage(p: Pick<Product, "bookingType" | "event">): ProductPage {
  if (isEventItem(p) && p.event) {
    const cat = categoryById(p.event.kind);
    return {
      look: p.event.kind,
      accent: cat.theme.accent,
      displayFont: cat.theme.display,
      bodyFont: cat.theme.body,
      variant: cat.variants[0],
      sections: cat.sections,
      stats: [],
      highlights: [],
      info: [],
      faq: [],
      lineup: [],
      sponsors: [],
    };
  }
  return { look: "standard", sections: STANDARD_DEFAULT, stats: [], highlights: [], info: [], faq: [], lineup: [], sponsors: [] };
}

/** The item's page as it will be drawn: what was designed, or the default. */
export const pageOf = (p: Pick<Product, "bookingType" | "event" | "page">): ProductPage => p.page ?? defaultPage(p);

/** Is it published anywhere a customer can read its page? Not online means no
 *  page, so the wizard skips the Page step for a counter-only item. */
export const hasPublicPage = (p: Pick<Product, "channels">) => p.channels.includes("online");

/** Listed on the storefront, or only at its own link. */
export const isListed = (p: Pick<Product, "channels" | "online">) => p.channels.includes("online") && (p.online ?? "listed") === "listed";

/** The item's own link, relative to the site. */
export const itemPath = (slug: string) => `/b/${slug}`;
