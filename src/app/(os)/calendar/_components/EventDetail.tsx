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
  t: (key: string) => string;
  /** Lock and unlock are one call: which one it is follows from the booking.
   *  A reason is required either way — an unexplained lock is indistinguishable
   *  from a bug six weeks later, which is the rule holds already follow. */
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
  const [asking, setAsking] = useState<null | "lock" | "unlock" | "release">(null);
  const [reason, setReason] = useState("");

  if (!event) return null;

  const when = event.allDay ? t("allDayLong") : `${hhmm(event.start)} – ${hhmm(event.end)}`;
  /* Only a booking can be locked or completed. A hold has one action of its
     own — release — and it is here rather than in a register of its own,
     because this is where a manager meets the hold: on the day it is blocking,
     next to the capacity it is holding back. */
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
          {event.hold && (
            <>
              <div className="flex flex-wrap items-baseline gap-tight">
                <dt className="type-label w-16 shrink-0 text-[12px] text-muted">{t("detailHolds")}</dt>
                <dd className="min-w-0 text-[13px]">{event.hold.what}</dd>
              </div>
              <div className="flex flex-wrap items-baseline gap-tight">
                <dt className="type-label w-16 shrink-0 text-[12px] text-muted">{t("detailReleases")}</dt>
                <dd className="min-w-0 text-[13px]">{event.hold.releases ?? t("detailUntilReleased")}</dd>
              </div>
              <div className="flex flex-wrap items-baseline gap-tight">
                <dt className="type-label w-16 shrink-0 text-[12px] text-muted">{t("detailPlacedBy")}</dt>
                <dd className="min-w-0 text-[13px]">{event.hold.placedBy}</dd>
              </div>
              <div className="flex flex-wrap items-baseline gap-tight">
                <dt className="type-label w-16 shrink-0 text-[12px] text-muted">{t("detailWhat")}</dt>
                <dd className="min-w-0 break-words text-[13px]">{event.hold.product}</dd>
              </div>
            </>
          )}
          {/* A hold's subtitle is "<what> · <product>", and both of those now
              have rows of their own — printing it again said Lane 3 twice. */}
          {event.subtitle && !event.hold && (
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
        {!isBooking && onRelease && asking === "release" && (
          <div className="flex flex-col gap-tight border-t border-hairline pt-comfortable">
            <p className="text-[13px]">{t("releaseAsk")}</p>
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
