import { ACCENT_CHOICES, type CategoryId } from "@/lib/events/catalog";
import { parseEventVideo } from "@/lib/events/video";
import { ALL_PAGE_SECTIONS, REQUIRED_PAGE_SECTIONS, lookDefaults } from "@/lib/productPage";
import type { PageCountdown, PageLook, PageSectionId, Product, ProductPage } from "@/lib/api/types";

/**
 * Pure changes to a ProductPage — what the designer's controls do, kept out of
 * the components so each can be read (and tested) on its own.
 *
 * One designer for every booking (docs/catalog.md §10.5): nothing here asks
 * what kind of booking it is. The rule they share: editing the words of a
 * section removes it from `samples`, because the operator has now chosen those
 * words. (No new page is given sample text; only a page saved before that may
 * still carry some.)
 */

/** Hero is always drawn and always first; tickets is always drawn. */
export const isRequired = (id: PageSectionId) => REQUIRED_PAGE_SECTIONS.includes(id as never);

/**
 * "Programme (people and times)" is ONE row to the operator and TWO sections on
 * the page: the people (`lineup`) and the times (`schedule`). They show, hide and
 * move together, and `page.sections` keeps them side by side. The row is
 * called by the first id.
 */
export const PROGRAMME: PageSectionId[] = ["lineup", "schedule"];
const isProgramme = (id: PageSectionId) => PROGRAMME.includes(id);

/** The row an id belongs to: the Programme row answers to both of its ids. */
export const rowOf = (id: PageSectionId): PageSectionId => (id === "schedule" ? "lineup" : id);
/** Every section a row stands for. */
const idsOf = (row: PageSectionId): PageSectionId[] => (rowOf(row) === "lineup" ? PROGRAMME : [row]);

/** Sections as rows: the Programme's two ids gathered where the first stood. */
function toRows(sections: PageSectionId[]): PageSectionId[][] {
  const rows: PageSectionId[][] = [];
  const programme = PROGRAMME.filter((p) => sections.includes(p));
  let placed = false;
  for (const s of sections) {
    if (isProgramme(s)) {
      if (!placed) rows.push(programme);
      placed = true;
    } else rows.push([s]);
  }
  return rows;
}
const flatten = (rows: PageSectionId[][]) => rows.flat();

/** Every row the designer lists, in the page's usual order. */
const ALL_ROWS = ALL_PAGE_SECTIONS.filter((s) => s !== "schedule");

/** Shown rows in page order, then the ones that are off. The Programme is one row, named "lineup". */
export function rowsOf(page: ProductPage): { shown: PageSectionId[]; hidden: PageSectionId[] } {
  const shown = toRows(page.sections.filter((s) => ALL_PAGE_SECTIONS.includes(s))).map((r) => rowOf(r[0]));
  return { shown, hidden: ALL_ROWS.filter((s) => !shown.includes(s)) };
}

/** The first position a row may take: nothing goes above the hero. */
const floorOf = (rows: PageSectionId[][]) => (rows[0]?.[0] === "hero" ? 1 : 0);

export function canMove(page: ProductPage, id: PageSectionId, dir: -1 | 1): boolean {
  const rows = toRows(page.sections);
  const i = rows.findIndex((r) => r.includes(id));
  if (i < 0 || id === "hero") return false;
  const j = i + dir;
  return j >= floorOf(rows) && j < rows.length;
}

export function moveSection(page: ProductPage, id: PageSectionId, dir: -1 | 1): ProductPage {
  if (!canMove(page, id, dir)) return page;
  const rows = toRows(page.sections);
  const i = rows.findIndex((r) => r.includes(id));
  [rows[i], rows[i + dir]] = [rows[i + dir], rows[i]];
  return { ...page, sections: flatten(rows) };
}

/** Drag one row onto another: it takes that row's place. */
export function moveBefore(page: ProductPage, id: PageSectionId, targetId: PageSectionId): ProductPage {
  const rows = toRows(page.sections);
  const from = rows.findIndex((r) => r.includes(id));
  const to = rows.findIndex((r) => r.includes(targetId));
  if (from < 0 || to < 0 || from === to || id === "hero") return page;
  const [moved] = rows.splice(from, 1);
  const target = rows.findIndex((r) => r.includes(targetId));
  rows.splice(Math.max(floorOf(rows), target + (from < to ? 1 : 0)), 0, moved);
  return { ...page, sections: flatten(rows) };
}

/** Show a hidden section where it belongs in the usual order, or hide a shown one.
 *  The Programme's two sections go together. */
export function toggleSection(page: ProductPage, id: PageSectionId): ProductPage {
  if (isRequired(id)) return page;
  const ids = idsOf(id);
  if (ids.some((x) => page.sections.includes(x))) return { ...page, sections: page.sections.filter((s) => !ids.includes(s)) };
  const rank = ALL_PAGE_SECTIONS.indexOf(rowOf(id));
  const rows = toRows(page.sections);
  let at = floorOf(rows);
  for (let i = rows.length - 1; i >= 0; i--) {
    if (ALL_PAGE_SECTIONS.indexOf(rows[i][0]) < rank) { at = i + 1; break; }
  }
  rows.splice(at, 0, ids);
  return { ...page, sections: flatten(rows) };
}

/** Does this row still show sample text nobody has confirmed? */
export const rowHasSample = (page: ProductPage, id: PageSectionId): boolean =>
  idsOf(id).some((x) => page.sections.includes(x) && !!page.samples?.includes(x));

/** Apply a change made to a section's words: those words are the operator's now. */
export function edited(page: ProductPage, id: PageSectionId, patch: Partial<ProductPage>): ProductPage {
  const gone = idsOf(id);
  const samples = page.samples?.filter((s) => !gone.includes(s));
  return { ...page, ...patch, samples: samples && samples.length ? samples : undefined };
}

/** A page saved before revision 2 may still show sample text in a section; the
 *  operator can decide the words stand as written. */
export function keepSample(page: ProductPage, id: PageSectionId): ProductPage {
  return edited(page, id, {});
}

/**
 * Change the look. The look's own colour, faces and layout variant replace the
 * old ones; the sections, their order and every word stay exactly as they were.
 * Going back to Classic clears the themed values (Classic has none of its own).
 */
export function switchLook(page: ProductPage, look: PageLook): ProductPage {
  if (look === page.look) return page;
  const d = lookDefaults(look);
  return { ...page, look, accent: d.accent, displayFont: d.displayFont, bodyFont: d.bodyFont, variant: d.variant };
}

/** The accent choices for a themed look. Classic has no list of its own; the caller supplies it. */
export const eventAccents = (look: PageLook): string[] => (look === "standard" ? [] : (ACCENT_CHOICES[look as CategoryId] ?? []));

export const newId = (prefix: string) => `${prefix}_${globalThis.crypto.randomUUID().slice(0, 8)}`;

/* ── Countdown ───────────────────────────────────────────────────────────── */

/** The first day to count down to, when the booking has one. */
export const firstDayOf = (product: Pick<Product, "event">): string | null => product.event?.startsAt ?? null;

/** What the countdown is set to now. Absent settings read the way the page does:
 *  to the first day for a dated booking that has the section, otherwise off. */
export function countdownMode(product: Pick<Product, "event">, page: ProductPage): PageCountdown["mode"] {
  if (!page.sections.includes("countdown")) return "off";
  const mode = page.countdown?.mode ?? (firstDayOf(product) ? "start" : "off");
  return mode === "start" && !firstDayOf(product) ? "off" : mode;
}

/** "2026-10-24T16:00:00+06:00" → its stored date and clock, as typed. */
export const splitMoment = (at: string | undefined): { date: string; time: string } =>
  at ? { date: at.slice(0, 10), time: at.slice(11, 16) } : { date: "", time: "" };

/** A date and a clock time, written the way the contract stores an instant
 *  (the operator's own +06:00). Empty until both are known. */
export const joinMoment = (date: string, time: string): string | undefined => (date && time ? `${date}T${time}:00+06:00` : undefined);

/**
 * Change the countdown. Choosing a way to count adds the "countdown" section if
 * it is missing; choosing Off takes it out. Anything else (the label, the
 * moment, hiding at zero) just changes the setting.
 */
export function setCountdown(page: ProductPage, patch: Partial<PageCountdown>): ProductPage {
  const next: PageCountdown = { hideAtZero: true, ...page.countdown, mode: page.countdown?.mode ?? "off", ...patch };
  let sections = page.sections;
  if (patch.mode === "off") sections = sections.filter((s) => s !== "countdown");
  else if (patch.mode && !sections.includes("countdown")) sections = toggleSection(page, "countdown").sections;
  return { ...page, countdown: next, sections };
}

/** The eye on the Countdown row: showing it needs a way to count, so it starts
 *  on the first day when there is one and otherwise waits for a date. */
export function toggleCountdownRow(page: ProductPage, product: Pick<Product, "event">): ProductPage {
  if (page.sections.includes("countdown")) return setCountdown(page, { mode: "off" });
  return setCountdown(page, { mode: firstDayOf(product) ? "start" : "date" });
}

/* ── Is there anything to draw? ──────────────────────────────────────────── */

export type SectionFill = "fixed" | "written" | "empty";

/**
 * Does a section have words (or a fact the booking knows) to draw? A section
 * with nothing in it is not drawn; its row says so instead of leaving the
 * operator to wonder why it is missing from the page.
 */
export function sectionFill(id: PageSectionId, product: Product, page: ProductPage): SectionFill {
  const has = (b: boolean): SectionFill => (b ? "written" : "empty");
  switch (id) {
    case "hero":
    case "tickets":
      return "fixed";
    case "countdown": {
      const mode = countdownMode(product, page);
      return has((mode === "start" && !!firstDayOf(product)) || (mode === "date" && !!page.countdown?.at));
    }
    case "stats":
      return has(page.stats.some((s) => s.value.trim()));
    case "highlights":
      return has(page.highlights.some((h) => h.label.trim()));
    case "about":
      return has(product.description.trim().length > 0);
    case "included":
      return has(product.tiers.some((x) => x.active && (x.note?.trim() || (x.perks?.length ?? 0) > 0)));
    case "know":
      return has(!!product.policies || !!product.minAge || page.info.some((i) => i.label.trim() && i.value.trim()));
    case "lineup":
      return has(page.lineup.some((l) => l.name.trim()));
    case "schedule":
      return has(page.lineup.some((l) => l.name.trim() && l.at));
    case "gallery":
      return has(product.images.length > 0);
    case "video":
      return has(!!parseEventVideo(page.videoUrl));
    case "faq":
      return has(page.faq.some((f) => f.q.trim() && f.a.trim()));
    case "venue":
      return has(!!product.event?.venueName?.trim() || product.locationIds.length > 0);
    case "sponsors":
      return has(page.sponsors.some((s) => s.name.trim()));
    case "quote":
      return has((page.blocks?.quotes ?? []).some((q) => q.text.trim() && q.who.trim()));
    case "host":
      return has(!!page.blocks?.host?.name.trim());
    case "steps":
      return has((page.blocks?.steps?.items ?? []).some((i) => i.title.trim()));
    case "text":
      return has(!!page.blocks?.text?.body.trim());
    case "cta":
      return has(!!page.blocks?.cta?.title.trim());
    default:
      return "written";
  }
}
