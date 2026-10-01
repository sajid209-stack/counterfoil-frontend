"use client";

import type { Resource } from "@/lib/api";
import { useTranslations } from "next-intl";
import { usesBuffer } from "@/lib/schedule";
import { BufferField } from "./BufferField";
import { type BookingSetupResult } from "./BookingSetup";

/**
 * "Time between bookings", wherever a kind's own schedule/timing is set.
 *
 * A field, court or lane (BT-04/05) and a timed session or guided tour
 * (BT-03/09) all have a "when" step — this renders there. An appointment
 * (BT-10) has none (availability comes from who is free, not a weekly
 * pattern), so it asks the same question inside `BookingSetup`'s own
 * provider step instead; this component still reads/writes the same value
 * for BT-10 (via `booking.provider.bufferMinutes`) so the booking editor,
 * which has no step structure, can show it in one place for every kind.
 *
 * Nothing renders for a kind that does not use a buffer at all (open entry,
 * a date pass, a daily cap, a course, a bundle, a credits pack).
 */
export function ScheduleBufferField({
  booking,
  onChange,
  resources,
  /** The editor has no `booking.provider` to read a noun off (an
   *  appointment's provider list is edited straight from the product, not
   *  reconstructed into `booking` — see `ProductForm.fromProduct`), so it
   *  passes the product's own `providerNoun` here instead. */
  fallbackNoun,
}: {
  booking: BookingSetupResult;
  onChange: (next: BookingSetupResult) => void;
  resources: Resource[];
  fallbackNoun?: string;
}) {
  const t = useTranslations("catalog.fields");
  if (!usesBuffer(booking.bookingType)) return null;

  const noun = booking.resource
    ? resources.find((r) => booking.resource!.resourceIds.includes(r.id))?.nounSingular
    : (booking.provider?.noun ?? fallbackNoun);
  const value = booking.resource
    ? (booking.resource.bufferMinutes ?? 0)
    : booking.provider
      ? (booking.provider.bufferMinutes ?? 0)
      : (booking.bufferMinutes ?? 0);

  const set = (minutes: number) => {
    if (booking.resource) return onChange({ ...booking, resource: { ...booking.resource, bufferMinutes: minutes } });
    if (booking.provider) return onChange({ ...booking, provider: { ...booking.provider, bufferMinutes: minutes } });
    return onChange({ ...booking, bufferMinutes: minutes });
  };

  return <BufferField value={value} onChange={set} noun={noun ?? t("bufferDefaultNoun")} />;
}
