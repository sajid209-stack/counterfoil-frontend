import { categoryById, ACCENT_CHOICES, type CategoryId } from "@/lib/events/catalog";
import { REQUIRED_PAGE_SECTIONS, sectionsFor } from "@/lib/productPage";
import type { PageLook, PageSectionId, ProductPage } from "@/lib/api/types";

/**
 * Pure changes to a ProductPage — what the designer's controls do, kept out of
 * the components so each can be read (and tested) on its own.
 *
 * The rule they share: editing the words of a section removes it from
 * `samples`, because the operator has now chosen those words.
 */

/** Hero is always drawn and always first; tickets is always drawn. */
export const isRequired = (id: PageSectionId) => REQUIRED_PAGE_SECTIONS.includes(id as never);

/** Shown sections in page order, then the ones that are off. */
export function rowsOf(page: ProductPage): { shown: PageSectionId[]; hidden: PageSectionId[] } {
  const all = sectionsFor(page.look);
  return { shown: page.sections, hidden: all.filter((s) => !page.sections.includes(s)) };
}

/** The first position a section may take: nothing goes above the hero. */
const floorOf = (sections: PageSectionId[]) => (sections[0] === "hero" ? 1 : 0);

export function canMove(page: ProductPage, id: PageSectionId, dir: -1 | 1): boolean {
  const i = page.sections.indexOf(id);
  if (i < 0 || id === "hero") return false;
  const j = i + dir;
  return j >= floorOf(page.sections) && j < page.sections.length;
}

export function moveSection(page: ProductPage, id: PageSectionId, dir: -1 | 1): ProductPage {
  if (!canMove(page, id, dir)) return page;
  const i = page.sections.indexOf(id);
  const next = [...page.sections];
  [next[i], next[i + dir]] = [next[i + dir], next[i]];
  return { ...page, sections: next };
}

/** Drag one row onto another: it takes that row's place. */
export function moveBefore(page: ProductPage, id: PageSectionId, targetId: PageSectionId): ProductPage {
  if (id === targetId || id === "hero") return page;
  const from = page.sections.indexOf(id);
  const to = page.sections.indexOf(targetId);
  if (from < 0 || to < 0) return page;
  const next = page.sections.filter((s) => s !== id);
  const at = Math.max(floorOf(page.sections), next.indexOf(targetId) + (from < to ? 1 : 0));
  next.splice(at, 0, id);
  return { ...page, sections: next };
}

/** Show a hidden section where it belongs in the look's own order, or hide a shown one. */
export function toggleSection(page: ProductPage, id: PageSectionId): ProductPage {
  if (isRequired(id)) return page;
  if (page.sections.includes(id)) return { ...page, sections: page.sections.filter((s) => s !== id) };
  const canon = sectionsFor(page.look);
  const rank = canon.indexOf(id);
  let at = floorOf(page.sections);
  for (let i = page.sections.length - 1; i >= 0; i--) {
    if (canon.indexOf(page.sections[i]) < rank) { at = i + 1; break; }
  }
  const next = [...page.sections];
  next.splice(at, 0, id);
  return { ...page, sections: next };
}

/** Apply a change made to a section's words: those words are the operator's now. */
export function edited(page: ProductPage, id: PageSectionId, patch: Partial<ProductPage>): ProductPage {
  const samples = page.samples?.filter((s) => s !== id);
  return { ...page, ...patch, samples: samples && samples.length ? samples : undefined };
}

/** "Keep sample text": the words stand as written. */
export function keepSample(page: ProductPage, id: PageSectionId): ProductPage {
  return edited(page, id, {});
}

/** A look's own ground, colours and faces, ready to lay over a page. */
export function lookDefaults(look: PageLook): Pick<ProductPage, "look" | "accent" | "displayFont" | "bodyFont" | "variant" | "sections"> {
  if (look === "standard") return { look, accent: undefined, displayFont: undefined, bodyFont: undefined, variant: undefined, sections: sectionsFor("standard") };
  const cat = categoryById(look as CategoryId);
  return { look, accent: cat.theme.accent, displayFont: cat.theme.display, bodyFont: cat.theme.body, variant: cat.variants[0], sections: cat.sections };
}

/** Change the look. The words stay; the ground, colour, faces and section set follow the look. */
export function switchLook(page: ProductPage, look: PageLook): ProductPage {
  if (look === page.look) return page;
  const d = lookDefaults(look);
  return { ...page, ...d, samples: page.samples?.filter((s) => d.sections.includes(s)) };
}

/** The accent choices for a look. Standard has no list of its own; the caller supplies it. */
export const eventAccents = (look: PageLook): string[] => (look === "standard" ? [] : (ACCENT_CHOICES[look as CategoryId] ?? []));

export const newId = (prefix: string) => `${prefix}_${globalThis.crypto.randomUUID().slice(0, 8)}`;
