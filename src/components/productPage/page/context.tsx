"use client";

import { createContext, useContext } from "react";
import type { EventRecord } from "@/lib/api/events";
import type { Location, PageSectionId, Product, ProductPage } from "@/lib/api/types";
import type { usePageLabels } from "../pageText";
import type { LookDef } from "./theme";

/**
 * Everything a part of a product page needs, built ONCE by the shell
 * (`BookingPage`) and read by the hero, the booking panel and every section
 * through `usePage()`. A section never recomputes the page view, the labels or
 * the layout, so two parts of one page cannot disagree about them.
 *
 * CONTRACT (docs/product-page.md §4). Keep these fields stable.
 */
export interface PageCtx {
  product: Product;
  /** `pageView(product)`: the page's content in one shape, for any booking. */
  ev: EventRecord;
  /** `pageOf(product)`: the design (look, sections, countdown…). */
  page: ProductPage;
  look: LookDef;
  /** Every label the page needs (`usePageLabels`). */
  labels: ReturnType<typeof usePageLabels>;
  /** Good-to-know lines from the booking's policies. */
  know: string[];
  /** The countdown as the page's settings resolve it, or null. */
  countdown: { at: Date; label: string } | null;
  now: Date;
  /** How the page is laid out — by the width of its OWN box, so the designer's
   *  phone preview on a wide screen lays out as a phone.
   *  phone < 768 ≤ tablet < 1024 ≤ desktop (the booking panel appears). */
  layout: "phone" | "tablet" | "desktop";
  /** A preview: nothing navigates, opens a sheet or writes. */
  inert: boolean;
  /** Start booking: on a desktop it scrolls to and focuses the booking panel;
   *  otherwise it opens the booking sheet. `tierId` preselects one ticket of
   *  that type. A no-op when inert. */
  book: (tierId?: string) => void;
  /** The sections switched on, in the operator's order (hero/countdown/stats
   *  are drawn by the shell, the rest by `sections/`). */
  sections: PageSectionId[];
  location: Location;
  /** The cheapest ticket that can still be bought, in minor units; null when
   *  nothing is on sale. One rule (`fromPriceOf`). */
  from: number | null;
}

export const PageContext = createContext<PageCtx | null>(null);

export function usePage(): PageCtx {
  const ctx = useContext(PageContext);
  if (!ctx) throw new Error("usePage() outside a product page");
  return ctx;
}

/** The DOM id of a section's anchor, for the section nav. */
export const sectionAnchor = (id: PageSectionId) => `pg-${id}`;
