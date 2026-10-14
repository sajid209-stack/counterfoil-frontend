import type { CalEvent } from "./model";

type T = (key: string, values?: Record<string, string | number>) => string;

/** "Booked on Viator · VT-123456" — the reference is what a dispute with the
 *  marketplace is argued with, so it travels with the name when there is one. */
export const bookedOnLine = (t: T, s: NonNullable<CalEvent["source"]>): string =>
  s.reference
    ? t("bookedOnRef", { name: s.name, reference: s.reference })
    : t("bookedOn", { name: s.name });
