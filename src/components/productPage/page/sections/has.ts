import type { PageSectionId } from "@/lib/api/types";
import type { PageCtx } from "../context";
import {
  aboutOf,
  ctaOf,
  faqOf,
  galleryOf,
  highlightsOf,
  hostOf,
  includedOf,
  peopleOf,
  programmeOf,
  quotesOf,
  sponsorsOf,
  stepsOf,
  textBlockOf,
  venueOf,
  videoOf,
} from "./helpers";

/**
 * Whether a section has anything to draw for this page. The section nav links
 * only to sections that render, and a section with no content renders nothing
 * (docs/product-page.md §3.5). It asks the same selectors the sections draw
 * from (`helpers.ts`), so the two cannot disagree.
 *
 * hero, countdown and stats are drawn by the shell, not by `sections/`, so
 * they have no body section here; tickets are always there.
 */
export function sectionHasContent(id: PageSectionId, ctx: PageCtx): boolean {
  switch (id) {
    case "tickets":
      return true;
    case "hero":
    case "countdown":
    case "stats":
      return false;
    case "about":
      return aboutOf(ctx) !== null;
    case "highlights":
      return highlightsOf(ctx).length > 0;
    case "included":
      return includedOf(ctx).length > 0;
    case "know":
      return ctx.know.length > 0;
    case "lineup":
      return peopleOf(ctx).length > 0;
    case "schedule":
      return programmeOf(ctx).length > 0;
    case "gallery":
      return galleryOf(ctx).length > 0;
    case "video":
      return videoOf(ctx) !== null;
    case "venue":
      return venueOf(ctx).name !== "";
    case "sponsors":
      return sponsorsOf(ctx).length > 0;
    case "faq":
      return faqOf(ctx).length > 0;
    case "quote":
      return quotesOf(ctx).length > 0;
    case "host":
      return hostOf(ctx) !== null;
    case "steps":
      return stepsOf(ctx) !== null;
    case "text":
      return textBlockOf(ctx) !== null;
    case "cta":
      return ctaOf(ctx) !== null;
    default:
      return false;
  }
}
