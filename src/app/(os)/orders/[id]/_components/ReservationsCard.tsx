"use client";

import { CalendarClock, Lock, Unlock } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { bookingEditable, type Booking, type Product } from "@/lib/api";
import { formatClock, formatDay } from "@/lib/format";
import { Section } from "./Section";

/**
 * The reservations this order made: what, when, for how many — with Change date
 * or time and Lock/Unlock, exactly as before.
 *
 * ONE question decides whether a booking can be touched (§61.7/10/12) — locked,
 * closed history, or someone else mid-edit — and every action reads the same
 * answer from `bookingEditable`, so a button is never enabled for something the
 * rules would refuse. The product's name wraps rather than truncating: it is
 * what tells one reservation from another, and "…Walking Tour of Ol…" names
 * nothing. Day and time are `lib/format`'s, in 12-hour.
 */
export function ReservationsCard({
  bookings,
  products,
  actor,
  onMove,
  onLock,
  className,
}: {
  bookings: Booking[];
  products: Product[];
  actor: string;
  onMove: (b: Booking) => void;
  onLock: (b: Booking) => void;
  className?: string;
}) {
  const t = useTranslations("orders");
  if (bookings.length === 0) return null;
  return (
    <Section title={t("cardBookings")} className={className} id="order-reservations">
      {bookings.map((b) => {
        const p = products.find((x) => x.id === b.productId);
        const edit = bookingEditable(b.id, actor);
        return (
          <div key={b.id} data-booking={b.id} className="flex flex-wrap items-center gap-x-section gap-y-tight border-b border-line py-tight text-sm first:pt-0 last:border-0 last:pb-0">
            <div className="min-w-0 flex-1 basis-48">
              <p className="break-words font-medium">{p?.name ?? b.productId}</p>
              <p className="text-[13px] tabular-nums text-muted">
                {formatDay(b.slotStart.slice(0, 10), { weekday: true })} · {formatClock(b.slotStart.slice(11, 16))} · {t("party", { size: b.partySize })}
              </p>
            </div>
            {!edit.editable && (
              <span className="flex min-w-0 items-center gap-inline rounded-sm bg-warning/10 px-tight py-0.5 text-[12px] text-warning">
                <Lock size={12} strokeWidth={2} className="shrink-0" />
                <span className="min-w-0 break-words">{edit.reason}</span>
              </span>
            )}
            <div className="flex flex-wrap items-center gap-tight">
              {p?.schedule && (p.schedule.capacityPerSession ?? 0) > 0 && (
                <Button size="sm" variant="secondary" disabled={!edit.editable} icon={<CalendarClock size={14} strokeWidth={1.5} />} onClick={() => onMove(b)}>
                  {t("changeDateTime")}
                </Button>
              )}
              <Button
                size="sm"
                variant="tertiary"
                icon={b.lockedAt ? <Unlock size={14} strokeWidth={1.5} /> : <Lock size={14} strokeWidth={1.5} />}
                onClick={() => onLock(b)}
              >
                {b.lockedAt ? t("unlockBooking") : t("lockBooking")}
              </Button>
            </div>
          </div>
        );
      })}
    </Section>
  );
}
