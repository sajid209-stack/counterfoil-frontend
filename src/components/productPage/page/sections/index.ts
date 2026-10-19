import type { ComponentType } from "react";
import type { PageSectionId } from "@/lib/api/types";
import { AboutSection } from "./About";
import { CtaSection } from "./Cta";
import { FaqSection } from "./Faq";
import { GallerySection } from "./Gallery";
import { HighlightsSection } from "./Highlights";
import { HostSection } from "./Host";
import { IncludedSection } from "./Included";
import { KnowSection } from "./Know";
import { LineupSection } from "./Lineup";
import { ProgrammeSection } from "./Programme";
import { QuoteSection } from "./Quote";
import { SponsorsSection } from "./Sponsors";
import { StepsSection } from "./Steps";
import { TextSection } from "./TextBlock";
import { VenueSection } from "./Venue";
import { VideoSection } from "./Video";

export { sectionHasContent } from "./has";

/**
 * The body sections, by id. CONTRACT: each is a component with no props that
 * reads `usePage()`, renders its own `<section id={sectionAnchor(id)}>` and
 * returns null when it has nothing to draw. hero, countdown and stats are drawn
 * by the shell; tickets by `TicketOptions`.
 */
export const BODY_SECTIONS: Partial<Record<PageSectionId, ComponentType>> = {
  about: AboutSection,
  highlights: HighlightsSection,
  included: IncludedSection,
  know: KnowSection,
  lineup: LineupSection,
  schedule: ProgrammeSection,
  gallery: GallerySection,
  video: VideoSection,
  venue: VenueSection,
  sponsors: SponsorsSection,
  faq: FaqSection,
  quote: QuoteSection,
  host: HostSection,
  steps: StepsSection,
  text: TextSection,
  cta: CtaSection,
};
