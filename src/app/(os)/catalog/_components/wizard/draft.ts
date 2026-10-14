import { categoryById, type CategoryId, type SectionId } from "@/lib/events/catalog";
import { defaultPage } from "@/lib/productPage";
import { isSlugFree, isSlugValid } from "@/lib/api/products";
import type { PageSectionId, ProductPage } from "@/lib/api/types";

/** A translator for one namespace: a key and, where it needs them, values. */
export type Tr = (key: string, values?: Record<string, string | number>) => string;

/** Whole taka as typed → minor units. A blank or half-typed field is 0. */
export const majorToMinor = (s: string) => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

/** The sections a kind of event seeds with specific, translated content. It is
 *  a claim about somebody else's event, so it is marked and never published
 *  unread. */
export const SAMPLE_SECTIONS: SectionId[] = ["stats", "highlights", "about"];

/**
 * The page an event starts from: its kind's look, accent, faces and section
 * order (what `defaultPage` gives every event), plus the at-a-glance content a
 * category ships with — real, specific and translated, because a template whose
 * sample content is lorem teaches an operator nothing about what the section
 * is for. Every section seeded this way is listed in `samples`, so it shows a
 * Sample tag until it is edited, hidden or kept.
 */
export function seedEventPage(type: CategoryId, te: Tr): ProductPage {
  const cat = categoryById(type);
  const base = defaultPage({ bookingType: "BT-15", event: { kind: type, subtype: "", startsAt: "", venueName: "" } });
  const stats = Array.from({ length: cat.statCount ?? 3 }, (_, i) => ({
    id: `st${i}`,
    value: te(`defaults.${type}.stat${i}.value`),
    label: te(`defaults.${type}.stat${i}.label`),
  }));
  const highlights = [0, 1, 2, 3].map((i) => ({
    id: `hl${i}`,
    label: te(`defaults.${type}.highlight${i}`),
    description: cat.variants[0] === "structured" ? te(`defaults.${type}.benefit${i}`) : undefined,
  }));
  const info = [0, 1, 2].map((i) => ({
    id: `in${i}`,
    label: te(`defaults.${type}.info${i}.label`),
    value: te(`defaults.${type}.info${i}.value`),
  }));
  return { ...base, stats, highlights, info, samples: SAMPLE_SECTIONS.filter((s) => base.sections.includes(s)) };
}

/** Sample sections still showing words nobody chose, and still on the page. */
export const unresolvedSamples = (page: ProductPage): PageSectionId[] =>
  (page.samples ?? []).filter((s) => page.sections.includes(s));

export const MAX_SLUG = 60;

/** Is this link name one that can be saved: well formed, short enough and not
 *  already another item's? SellChannels shows the reason; the wizard only needs
 *  the yes or no, to hold Continue back. */
export const slugIsFine = (slug: string) => {
  const clean = slug.trim();
  return clean !== "" && clean.length <= MAX_SLUG && isSlugValid(clean) && isSlugFree(clean);
};
