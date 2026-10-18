"use client";

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { Sheet } from "@/components/ui";
import type { HoldView } from "@/lib/api";
import { formatClock, formatClockRange, formatDay } from "@/lib/format";
import { GoCard } from "../_components/Tiles";

/** "17:00" from an ISO date-time written with the venue's own offset. */
const timeOf = (iso: string) => iso.slice(11, 16);

/** The clock time a hold's expiry falls on, in the device's own time. */
function untilOf(iso: string) {
  const d = new Date(iso);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `${formatDay(ymd, { weekday: true })}, ${formatClock(hm)}`;
}

/**
 * The places this venue is holding for people: one card each, with who it is
 * for, what and when, and the two things a counter does with a hold — sell it
 * to them now, or put it back on sale.
 */
export function HeldSheet({
  open,
  holds,
  nameOf,
  onClose,
  onSell,
  onPutBack,
}: {
  open: boolean;
  holds: HoldView[];
  nameOf: (h: HoldView) => string;
  onClose: () => void;
  onSell: (h: HoldView) => void;
  onPutBack: (h: HoldView) => void;
}) {
  const t = useTranslations("pos");
  return (
    <Sheet open={open} onClose={onClose} title={t("held.title")} closeLabel={t("held.close")} className="mx-auto max-w-xl">
      <ul className="flex flex-col gap-comfortable px-section pb-section pt-comfortable">
        {holds.map((h) => {
          const place = h.kind === "resource" ? h.resourceName : h.kind === "seats" ? (h.seatLabels ?? []).join(", ") : null;
          const when = h.slotStart
            ? h.slotEnd
              ? formatClockRange(timeOf(h.slotStart), timeOf(h.slotEnd))
              : formatClock(timeOf(h.slotStart))
            : t("held.allDay");
          const count = h.kind === "resource" ? 0 : h.kind === "seats" ? (h.seatLabels ?? []).length : h.quantity;
          const mins = h.minutesToExpiry;
          const until = !h.expiresAt
            ? t("held.untilPutBack")
            : mins != null && mins >= 0 && mins < 90
              ? t("held.forMin", { count: Math.max(1, mins) })
              : mins != null && mins >= 0 && mins < 24 * 60
                ? t("held.forHours", { count: Math.round(mins / 60) })
                : t("held.until", { when: untilOf(h.expiresAt) });
          return (
            <li key={h.id}>
              <GoCard as="div" className="p-comfortable" bodyClassName="flex flex-col gap-comfortable">
                <div className="flex items-start gap-comfortable">
                  <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-subtle text-fg">
                    <Lock size={20} strokeWidth={1.75} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="break-words text-md font-bold leading-snug text-fg">{h.heldFor}</p>
                    <p className="break-words text-base text-fg">
                      {[nameOf(h), place && place !== nameOf(h) ? place : null, count > 0 ? t("held.places", { count }) : null].filter(Boolean).join(" · ")}
                    </p>
                    <p className="break-words text-sm text-muted">
                      {formatDay(h.date, { weekday: true })} · {when} · {until}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-tight">
                  <button
                    type="button"
                    onClick={() => onPutBack(h)}
                    className="-ml-2 inline-flex h-11 min-w-0 items-center justify-center rounded-full px-comfortable text-base font-semibold text-fg-secondary transition-colors duration-quick hover:bg-nav-hover active:bg-nav-selected"
                  >
                    {t("held.putBack")}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSell(h)}
                    className="inline-flex h-11 min-w-24 shrink-0 items-center justify-center rounded-full bg-card px-section text-base font-semibold text-fg ring-1 ring-inset ring-fg transition-transform duration-quick active:scale-[0.98]"
                  >
                    {t("held.sell")}
                  </button>
                </div>
              </GoCard>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

/**
 * The button that opens the list: a pill with the lock and the word "Held",
 * the count as a small badge inside it (never hung off the corner, where it
 * clips). 44px tall. The caller draws it only while there are holds.
 */
export function HeldButton({ count, onClick }: { count: number; onClick: () => void }) {
  const t = useTranslations("pos");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("held.buttonAria", { count })}
      className="card-surface flex h-11 shrink-0 items-center gap-tight rounded-full pl-comfortable pr-tight text-base font-semibold text-fg active:bg-muted-wash"
    >
      <Lock size={18} strokeWidth={1.75} aria-hidden />
      <span aria-hidden>{t("held.button")}</span>
      <span aria-hidden className="flex h-6 min-w-6 items-center justify-center rounded-full bg-ember-solid px-1.5 text-sm font-semibold leading-none text-on-solid">
        {count}
      </span>
    </button>
  );
}
