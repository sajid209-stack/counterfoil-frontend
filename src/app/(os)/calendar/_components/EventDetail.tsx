"use client";

import { useState } from "react";
import { Lock, LockOpen, UserCheck } from "lucide-react";
import { Button, Modal, StatusPill, type PillTone } from "@/components/ui";
import { hhmm, type CalEvent, type EventTone } from "./model";

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
  onLock,
  onComplete,
  blockedReason,
  busy = false,
}: {
  event: CalEvent | null;
  onClose: () => void;
  /** Where the primary action goes — the order, or the holds register. */
  onOpen: (event: CalEvent) => void;
  /** A booking with no order behind it has nowhere to go; don't offer it. */
  canOpen: boolean;
  /** The page owns date formatting, as it does for the grids. */
  dayLabel: (d: Date) => string;
  t: (key: string) => string;
  /** Lock and unlock are one call: which one it is follows from the booking.
   *  A reason is required either way — an unexplained lock is indistinguishable
   *  from a bug six weeks later, which is the rule holds already follow. */
  onLock?: (event: CalEvent, lock: boolean, reason: string) => void;
  /** Everyone in the party is here. */
  onComplete?: (event: CalEvent) => void;
  /** Why this booking cannot be changed, when it cannot — from the one
   *  `bookingEditable` every edit path in the app asks. */
  blockedReason?: string | null;
  busy?: boolean;
}) {
  const [asking, setAsking] = useState<null | "lock" | "unlock">(null);
  const [reason, setReason] = useState("");

  if (!event) return null;

  const when = event.allDay ? t("allDayLong") : `${hhmm(event.start)} – ${hhmm(event.end)}`;
  /* Only a booking can be locked or completed. A hold is released from the
     holds register, which is where its own mechanism lives. */
  const isBooking = event.kind === "booking";
  const canComplete = isBooking && event.tone === "booked" && !blockedReason;
  const close = () => {
    setAsking(null);
    setReason("");
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
              {t(event.kind === "hold" ? "openHold" : "openOrder")}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-comfortable">
        <div className="flex flex-wrap items-center gap-tight">
          <StatusPill tone={TONE_PILL[event.tone]}>{t(TONE_KEY[event.tone])}</StatusPill>
          {event.locked && (
            <span className="flex items-center gap-inline text-[12px] text-muted">
              <Lock size={12} strokeWidth={2} aria-hidden />
              {t("lockedNote")}
            </span>
          )}
        </div>

        <dl className="flex flex-col gap-tight">
          <div className="flex flex-wrap items-baseline gap-tight">
            <dt className="type-label w-16 shrink-0 text-[12px] text-muted">{t("detailWhen")}</dt>
            <dd className="min-w-0 text-[13px]">
              <span className="font-mono">{when}</span>
              <span className="text-muted"> · {dayLabel(event.start)}</span>
            </dd>
          </div>
          {event.subtitle && (
            <div className="flex flex-wrap items-baseline gap-tight">
              <dt className="type-label w-16 shrink-0 text-[12px] text-muted">{t("detailWhat")}</dt>
              {/* break-words, not truncate: this panel is the one place the
                  name is allowed all the room it needs. */}
              <dd className="min-w-0 break-words text-[13px]">{event.subtitle}</dd>
            </div>
          )}
        </dl>
        {/* The three things a manager does to a booking they have just found
            on the grid. They were only ever on the order page, which meant
            finding the order first — a page load in answer to "stop selling
            this one". */}
        {isBooking && (onLock || onComplete) && (
          <div className="flex flex-col gap-tight border-t border-hairline pt-comfortable">
            {blockedReason && !event.locked && (
              <p role="status" className="text-[13px] text-muted">{blockedReason}</p>
            )}
            {asking === null ? (
              <div className="flex flex-wrap gap-tight">
                {canComplete && onComplete && (
                  <Button variant="secondary" size="sm" loading={busy} onClick={() => onComplete(event)}>
                    <UserCheck size={14} strokeWidth={1.5} aria-hidden />
                    {t("markArrived")}
                  </Button>
                )}
                {onLock && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => { setReason(""); setAsking(event.locked ? "unlock" : "lock"); }}
                  >
                    {event.locked
                      ? <><LockOpen size={14} strokeWidth={1.5} aria-hidden />{t("unlockBooking")}</>
                      : <><Lock size={14} strokeWidth={1.5} aria-hidden />{t("lockBooking")}</>}
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-tight">
                <label className="type-label text-[12px] text-muted" htmlFor="cal-lock-reason">
                  {t(asking === "lock" ? "lockReason" : "unlockReason")}
                </label>
                <input
                  id="cal-lock-reason"
                  value={reason}
                  autoFocus
                  onChange={(e) => setReason(e.target.value)}
                  className="h-11 rounded-sm border border-line bg-card px-comfortable text-[13px] outline-none focus:border-inverse md:h-9"
                />
                <div className="flex flex-wrap gap-tight">
                  <Button
                    size="sm"
                    loading={busy}
                    disabled={!reason.trim()}
                    onClick={() => { onLock?.(event, asking === "lock", reason.trim()); setAsking(null); setReason(""); }}
                  >
                    {t(asking === "lock" ? "lockBooking" : "unlockBooking")}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => { setAsking(null); setReason(""); }}>
                    {t("cancel")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
