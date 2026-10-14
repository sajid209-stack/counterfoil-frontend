"use client";

import { useState } from "react";
import { Lock, LockOpen, UserCheck } from "lucide-react";
import { Button, MarketBadge, Modal, StatusPill, type PillTone } from "@/components/ui";
import { orderOutstanding, peekCustomers, peekOrders } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { clockRangeOf, type CalEvent, type EventTone } from "./model";

/** Status is a word here, never only a colour — a block on the grid can get
 *  away with a coloured bar because this panel is what names it. */
const TONE_PILL: Record<EventTone, PillTone> = {
  booked: "info",
  arrived: "success",
  noshow: "neutral",
  held: "warning",
  locked: "danger",
};

const TONE_KEY: Record<EventTone, string> = {
  booked: "keyBooked",
  arrived: "keyArrived",
  noshow: "keyNoShow",
  held: "keyHeld",
  locked: "keyLocked",
};

/**
 * What a booking actually is, in full.
 *
 * The reason this exists: at week density a block is 53px wide on a desktop
 * and 21px on a phone, so 26 of 27 blocks were clipping their own title and
 * the only way to read one was the `title` attribute — a tooltip, which a
 * touch screen never shows. Distinguishing names need complete access by a
 * visible path, and a hover tooltip is not one.
 *
 * Clicking a block used to navigate straight to the order: a whole page load
 * in answer to "what is this?". Now the click opens this, and the navigation
 * is a button inside it — reading a booking costs nothing, and going to it is
 * still one more click.
 */
export function EventDetail({
  event,
  onClose,
  onOpen,
  canOpen,
  dayLabel,
  t,
  onComplete,
  onRelease,
  blockedReason,
  busy = false,
}: {
  event: CalEvent | null;
  onClose: () => void;
  /** Where the primary action goes: the order behind a booking. */
  onOpen: (event: CalEvent) => void;
  /** A booking with no order behind it has nowhere to go; don't offer it. */
  canOpen: boolean;
  /** The page owns date formatting, as it does for the grids. */
  dayLabel: (d: Date) => string;
  t: (key: string, values?: Record<string, string | number>) => string;
  /** No longer used: locking is not offered from this panel (the lock API is
   *  unchanged). Kept optional so the page need not change in the same pass. */
  onLock?: (event: CalEvent, lock: boolean, reason: string) => void;
  /** Everyone in the party is here. */
  onComplete?: (event: CalEvent) => void;
  /** Put a hold's capacity back on public sale. The hold already says who it
   *  was for, so this needs no reason — but it does need asking, because the
   *  places go back on sale the moment it lands. */
  onRelease?: (event: CalEvent) => void;
  /** Why this booking cannot be changed, when it cannot — from the one
   *  `bookingEditable` every edit path in the app asks. */
  blockedReason?: string | null;
  busy?: boolean;
}) {
  const [asking, setAsking] = useState<null | "release">(null);

  if (!event) return null;

  const when = event.allDay ? t("allDayLong") : clockRangeOf(event.start, event.end);
  /* Only a booking can be locked or completed. A hold has one action of its
     own — release — and it is here rather than in a register of its own,
     because this is where a manager meets the hold: on the day it is blocking,
     next to the capacity it is holding back. */
  const isBooking = event.kind === "booking";
  const canComplete = isBooking && event.tone === "booked" && !blockedReason;
  /* What a desk needs at a glance, read off the order: a phone to ring and
     whether money is still owed. Read here, not carried on the event. */
  const order = isBooking && event.orderId ? peekOrders().find((o) => o.id === event.orderId) : undefined;
  const phone = order?.customerId ? peekCustomers().find((c) => c.id === order.customerId)?.phone ?? null : null;
  const owed = order && order.status !== "cancelled" && order.status !== "refunded" ? orderOutstanding(order) : 0;
  const total = event.partySize ?? 0;
  const partyText = (event.checkedIn ?? 0) > 0 && total > 0 ? t("partyIn", { in: event.checkedIn ?? 0, total }) : event.party ?? "";
  /* The subtitle is "guest · party · place": the place is whatever is left. */
  const place = (event.subtitle ?? "").split(" · ").filter((x) => x && x !== event.guest && x !== event.party).join(" · ");
  const close = () => {
    setAsking(null);
    onClose();
  };

  return (
    <Modal
      open
      onClose={close}
      size="sm"
      title={event.title}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={close}>
            {t("close")}
          </Button>
          {canOpen && (
            <Button size="sm" onClick={() => onOpen(event)}>
              {t("openOrder")}
            </Button>
          )}
          {/* A hold's one action goes where a booking's does — the footer,
              where the eye lands. It was a secondary button in the body,
              quieter than Close, in the panel that exists to release it. */}
          {!isBooking && onRelease && asking !== "release" && (
            <Button size="sm" onClick={() => setAsking("release")}>
              <LockOpen size={14} strokeWidth={1.5} aria-hidden />
              {t("releaseHold")}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-comfortable">
        <div className="flex flex-wrap items-center gap-tight">
          <StatusPill tone={TONE_PILL[event.tone]}>{t(TONE_KEY[event.tone])}</StatusPill>
          {event.locked && !event.hold && (
            <span className="flex items-center gap-inline text-xs text-muted">
              <Lock size={12} strokeWidth={2} aria-hidden />
              {t("lockedNote")}
            </span>
          )}
        </div>

        <dl className="flex flex-col gap-tight">
          <div className="flex flex-wrap items-baseline gap-tight">
            <dt className="w-16 shrink-0 text-xs font-medium text-muted">{t("detailWhen")}</dt>
            <dd className="min-w-0 text-sm">
              <span className="tabular-nums">{when}</span>
              <span className="text-muted"> · {dayLabel(event.start)}</span>
            </dd>
          </div>
          {isBooking && event.guest && (
            <div className="flex flex-wrap items-baseline gap-tight">
              <dt className="w-16 shrink-0 text-xs font-medium text-muted">{t("detailGuest")}</dt>
              <dd className="min-w-0 break-words text-sm">
                {event.guest}
                {phone && (
                  <>
                    <span className="text-muted"> · </span>
                    <a href={`tel:${phone.replace(/[^d+]/g, "")}`} className="font-medium underline decoration-line underline-offset-2 hover:decoration-fg">
                      {phone}
                    </a>
                  </>
                )}
              </dd>
            </div>
          )}
          {isBooking && partyText && (
            <div className="flex flex-wrap items-baseline gap-tight">
              <dt className="w-16 shrink-0 text-xs font-medium text-muted">{t("detailParty")}</dt>
              <dd className="min-w-0 text-sm">{partyText}</dd>
            </div>
          )}
          {isBooking && place && (
            <div className="flex flex-wrap items-baseline gap-tight">
              <dt className="w-16 shrink-0 text-xs font-medium text-muted">{t("detailPlace")}</dt>
              <dd className="min-w-0 break-words text-sm">{place}</dd>
            </div>
          )}
          {isBooking && owed > 0 && (
            <div className="flex flex-wrap items-baseline gap-tight">
              <dt className="w-16 shrink-0 text-xs font-medium text-muted">{t("detailPayment")}</dt>
              <dd className="min-w-0 text-sm">
                <StatusPill tone="warning">{t("stillOwes", { amount: formatMoney(owed) })}</StatusPill>
              </dd>
            </div>
          )}
          {/* Where it was booked, with the marketplace's own reference - the
              one thing a desk is asked for when a guest quotes a voucher. */}
          {event.source && (
            <div className="flex flex-wrap items-baseline gap-tight">
              <dt className="w-16 shrink-0 text-xs font-medium text-muted">{t("detailSource")}</dt>
              <dd className="flex min-w-0 items-start gap-tight text-sm">
                <MarketBadge id={event.source.id} className="mt-0.5" />
                <span className="min-w-0 break-words">{event.source.reference ? `${event.source.name} · ${event.source.reference}` : event.source.name}</span>
              </dd>
            </div>
          )}
          {event.hold && (
            <>
              <div className="flex flex-wrap items-baseline gap-tight">
                <dt className="w-16 shrink-0 text-xs font-medium text-muted">{t("detailHolds")}</dt>
                <dd className="min-w-0 text-sm">{event.hold.what}</dd>
              </div>
              <div className="flex flex-wrap items-baseline gap-tight">
                <dt className="w-16 shrink-0 text-xs font-medium text-muted">{t("detailReleases")}</dt>
                <dd className="min-w-0 text-sm">{event.hold.releases ?? t("detailUntilReleased")}</dd>
              </div>
              <div className="flex flex-wrap items-baseline gap-tight">
                <dt className="w-16 shrink-0 text-xs font-medium text-muted">{t("detailPlacedBy")}</dt>
                <dd className="min-w-0 text-sm">{event.hold.placedBy}</dd>
              </div>
              <div className="flex flex-wrap items-baseline gap-tight">
                <dt className="w-16 shrink-0 text-xs font-medium text-muted">{t("detailWhat")}</dt>
                <dd className="min-w-0 break-words text-sm">{event.hold.product}</dd>
              </div>
            </>
          )}
        </dl>
        {/* The three things a manager does to a booking they have just found
            on the grid. They were only ever on the order page, which meant
            finding the order first — a page load in answer to "stop selling
            this one". */}
        {!isBooking && onRelease && asking === "release" && (
          <div className="flex flex-col gap-tight border-t border-hairline pt-comfortable">
            <p className="text-sm">{t("releaseAsk")}</p>
            <div className="flex flex-wrap gap-tight">
              <Button size="sm" loading={busy} onClick={() => { onRelease(event); setAsking(null); }}>
                {t("releaseConfirm")}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setAsking(null)}>
                {t("cancel")}
              </Button>
            </div>
          </div>
        )}

        {isBooking && onComplete && (canComplete || (blockedReason && !event.locked)) && (
          <div className="flex flex-col gap-tight border-t border-hairline pt-comfortable">
            {blockedReason && !event.locked && (
              <p role="status" className="text-sm text-muted">{blockedReason}</p>
            )}
            {canComplete && (
              <div className="flex flex-wrap gap-tight">
                <Button variant="secondary" size="sm" loading={busy} onClick={() => onComplete(event)}>
                  <UserCheck size={14} strokeWidth={1.5} aria-hidden />
                  {t("markArrived")}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
