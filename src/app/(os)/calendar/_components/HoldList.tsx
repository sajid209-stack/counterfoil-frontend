"use client";

import { Modal, StatusPill } from "@/components/ui";
import type { HoldView } from "@/lib/api";

/**
 * Everything currently held, in one list.
 *
 * The register that used to be at `/holds` had one job worth keeping: showing
 * you every hold you have. The grid cannot do that — it only ever draws the
 * days somebody has navigated to, so a school group sitting on twenty-five
 * places in November is invisible in July, and dead capacity accumulates where
 * nothing reports it.
 *
 * So the held figure opens this. It is not the old page: no tabs, no history,
 * no search, no place-a-hold form — those belong to the panel on the grid. It
 * is the answer to "what have we got held, and is any of it stale", and every
 * row goes to the day it is on, where it can be read in full and released.
 */
export function HoldList({
  holds,
  onGo,
  onClose,
  t,
  dayLabel,
}: {
  /** Active holds, whatever window is on screen. */
  holds: HoldView[];
  /** Go to the day this hold is on and open it. */
  onGo: (hold: HoldView) => void;
  onClose: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
  dayLabel: (iso: string) => string;
}) {
  /** What the hold takes off sale, in the operator's own terms. */
  const what = (h: HoldView) =>
    h.kind === "session"
      ? t("holdListWhole")
      : h.kind === "resource"
        ? (h.resourceName ?? t("holdListResource"))
        : h.kind === "seats"
          ? t("holdListSeats", { count: h.seatLabels?.length ?? 0 })
          : t("holdListPlaces", { count: h.quantity });

  /** When it gives the capacity back — the question a stale hold answers badly. */
  const when = (h: HoldView) => {
    if (h.expiresAt == null) return t("holdListUntilReleased");
    const days = Math.round((h.minutesToExpiry ?? 0) / (60 * 24));
    return days >= 1 ? t("holdListInDays", { count: days }) : t("holdListSoon");
  };

  return (
    <Modal open onClose={onClose} size="md" title={t("holdListTitle")} description={t("holdListHelp")}>
      {holds.length === 0 ? (
        <p className="text-[13px] text-muted">{t("holdListEmpty")}</p>
      ) : (
        <ul className="flex flex-col">
          {holds.map((h) => (
            <li key={h.id} className="border-b border-hairline last:border-0">
              <button
                type="button"
                onClick={() => onGo(h)}
                className="flex w-full flex-col gap-inline py-comfortable text-left transition-colors duration-quick hover:bg-muted-wash sm:flex-row sm:items-center sm:gap-section"
              >
                {/* The day leads: a hold is read as "what is blocked when". */}
                <span className="w-32 shrink-0 text-[13px] font-medium">{dayLabel(h.date)}</span>
                <span className="min-w-0 flex-1">
                  {/* The party is the whole reason the block is allowed to exist,
                      so it is the line that reads as the title — and it keeps
                      the width: a pill in the right-hand group squeezed
                      "Private event" to "Priv…". */}
                  <span className="block truncate text-[13px] font-medium">{h.heldFor}</span>
                  <span className="flex min-w-0 items-center gap-tight">
                    {h.kind === "session" && <StatusPill tone="danger">{t("holdListWhole")}</StatusPill>}
                    <span className="min-w-0 truncate text-[12px] text-muted">
                      {h.kind === "session" ? h.productName : `${what(h)} · ${h.productName}`}
                      {h.slotStart ? ` · ${h.slotStart.slice(11, 16)}` : ` · ${t("holdListAllDay")}`}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 whitespace-nowrap text-[12px] text-muted">{when(h)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
