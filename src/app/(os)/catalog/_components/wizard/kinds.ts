import type { BookingKind } from "@/lib/catalog";
import type { CategoryId } from "@/lib/events/catalog";
import type { SetupStart } from "../booking/BookingSetup";

/*
 * Server pages read this file to decide where an address goes, so it holds no
 * runtime import from the data layer (`@/lib/catalog` pulls in the whole API
 * store, which is client-only). The kinds are listed here instead.
 */

/**
 * The kinds the add wizard opens for: `/catalog/new/<kind>`.
 *
 * The eight kinds of booking, and `event`. `booking` is the door for somebody
 * who is not sure ("Not sure?" in the chooser): no kind, so the first step
 * asks the whole question tree.
 */
export type WizardKind = Exclude<BookingKind, "event"> | "event" | "booking";

/** The kinds that have a card in the chooser, and so an address of their own. */
export const ROUTE_KINDS: readonly string[] = ["entry", "timed", "tour", "space", "appointment", "course", "pass", "bundle", "event"];

export const isRouteKind = (s: string | null | undefined): s is Exclude<WizardKind, "booking"> =>
  !!s && ROUTE_KINDS.includes(s);

export const EVENT_TYPES: CategoryId[] = ["entertainment", "sports", "business", "arts", "travel", "nightlife"];

export const isEventType = (s: string | null | undefined): s is CategoryId =>
  !!s && (EVENT_TYPES as string[]).includes(s);

/** Where a chooser card lands in the questions — or already answered, where
 *  the card itself was the whole answer. */
export function presetFor(kind: WizardKind): { start: SetupStart; answer?: "BT-03" | "BT-09" } {
  switch (kind) {
    case "entry": return { start: "entry" };
    case "timed": return { start: "q3", answer: "BT-03" };
    case "tour": return { start: "q3", answer: "BT-09" };
    case "space": return { start: "resource" };
    case "appointment": return { start: "provider" };
    case "course": return { start: "course" };
    case "pass": return { start: "credits" };
    case "bundle": return { start: "bundle" };
    default: return { start: "q1" };
  }
}

/** A booking sold per person starts with an Adult ticket; one sold per lane,
 *  per appointment or per pack starts with a single Standard price. A real
 *  first row, not a placeholder that only looks like one. */
export const PER_THING: WizardKind[] = ["space", "appointment", "pass", "bundle", "course"];
