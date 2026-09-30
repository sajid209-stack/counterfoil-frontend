"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { sessionPressure } from "@/lib/schedule";

export interface SessionRowData {
  time: string;
  price: number;
  capacity: number;
  /** Places left after everything already in the cart. */
  left: number;
  /** Why it cannot be sold, when it cannot. Null means it can. */
  blockedReason?: string | null;
  /** Who is leading it, the room it is in — whatever distinguishes it. */
  meta?: string | null;
  /** Full and the product takes a waitlist. */
  waitlist?: boolean;
}

/** How hard a session is to get into, as one value the label and the bar both
 *  read from. Absolute thresholds, not a percentage: four seats left is four
 *  seats left whether the room holds 15 or 400, and it is the count a cashier
 *  decides on. Every tier states itself in words as well, so the colour is
 *  never carrying the meaning alone. */


/**
 * Fixed sessions as ROWS, not a grid of little time tiles.
 *
 * A tile grid makes every session look identical and hides the one number a
 * cashier is actually deciding on — how many places are left. A row has space
 * for the fill, the count and the price at once, so "push the 14:00, it has
 * two left" is readable without tapping anything.
 *
 * The occupancy bar goes ember at 80% sold and the places-left figure goes
 * ember at 20% remaining, which is the same low-availability language the rest
 * of the app already uses — not a new traffic-light scheme to learn.
 */
export function SessionList({
  sessions,
  selected,
  currency,
  onSelect,
  onBlocked,
  onWaitlist,
}: {
  sessions: SessionRowData[];
  selected?: string;
  currency: string;
  onSelect: (time: string) => void;
  onBlocked: (time: string, reason: string) => void;
  onWaitlist?: (time: string) => void;
}) {
  const t = useTranslations("pos");

  /** The commonest price in the list, for the basis line underneath. Every row
   *  states its own price: a cashier reading a departure to a customer should
   *  not have to work out whether the figure at the bottom applies to the row
   *  in front of them. */
  const basePrice = (() => {
    const tally = new Map<number, number>();
    for (const s of sessions) tally.set(s.price, (tally.get(s.price) ?? 0) + 1);
    let best = sessions[0]?.price ?? 0;
    let seen = 0;
    for (const [price, n] of tally) if (n > seen) { best = price; seen = n; }
    return best;
  })();

  return (
    <div className="mb-section flex flex-col gap-tight">
      {/* The departures as rows on ONE card, divided by hairlines — the
          Schedule's drawing. */}
      <div className="go-surface divide-y divide-line overflow-hidden rounded-go">
      {sessions.map((s) => {
        const full = s.left <= 0 || !!s.blockedReason;
        /* A stated reason wins over the count. `&& s.left > 0` meant a session
           closed for a private event, or one with no guide free, still read
           "Sold out" in danger red — about places nobody had bought. The
           reason is the truth; sold out is what is true when there is none. */
        const closed = !!s.blockedReason;
        const pressure = sessionPressure(s.left, s.capacity);
        const isSelected = selected === s.time;

        return (
          <button
            key={s.time}
            type="button"
            onClick={() => {
              if (full && s.waitlist && onWaitlist) return onWaitlist(s.time);
              if (full) return onBlocked(s.time, s.blockedReason ?? t("sheet.full"));
              onSelect(s.time);
            }}
            aria-pressed={isSelected}
            data-focus-inset
            className={cn(
              "relative flex min-h-16 w-full items-center px-comfortable py-comfortable text-left transition-colors duration-quick",
              isSelected
                ? "bg-ember-solid text-white"
                : full
                  // Flat and *below* the card: an unavailable departure is not
                  // something you can pick up. The page's own colour, which is
                  // a step down from the card in both themes.
                  ? "bg-surface"
                  : "bg-card hover:bg-muted-wash/60 active:bg-ember/10",
            )}
          >
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="flex items-baseline gap-comfortable">
                {/* Time leads — it is what a cashier is scanning for. */}
                <span
                  className={cn(
                    "shrink-0 text-base font-semibold",
                    isSelected ? "text-white" : full ? "text-muted" : "text-fg",
                  )}
                >
                  {s.time}
                </span>
                {s.meta && (
                  <span className={cn("min-w-0 flex-1 truncate text-[0.8125rem]", isSelected ? "text-white" : "text-muted")}>{s.meta}</span>
                )}
                {/* The state of the session, in the corner the eye lands on:
                    places left is the number being decided on. The price sits
                    on the row below, beside the fill. */}
                <span
                  className={cn(
                    "ml-auto shrink-0 whitespace-nowrap text-[0.9375rem] font-semibold",
                    isSelected
                      ? "text-white"
                      : closed
                      ? "text-muted"
                      : pressure === "gone"
                        ? "text-danger"
                        : pressure === "critical"
                          ? "text-brand-foreground"
                          : pressure === "low"
                            ? "text-warning"
                            : "text-success",
                  )}
                >
                  {closed
                    ? (s.blockedReason ?? t("sheet.closedSession"))
                    : pressure === "gone"
                      ? t("sheet.soldOut")
                      : pressure === "critical"
                        ? t("sheet.leftCount", { count: s.left })
                        : t("sheet.seatsLeft", { count: s.left })}
                </span>
              </span>

              {/* The price, and no fill bar: the Schedule dropped its bar
                  because a full bar read as "full" when it was full of empty
                  seats, and the words above already say how many are left. The
                  two screens now say it the same way. */}
              <span
                className={cn(
                  "whitespace-nowrap text-[0.875rem] tabular-nums",
                  isSelected ? "text-white" : s.price === basePrice ? "text-muted" : "font-semibold text-fg",
                )}
              >
                {formatMoney(s.price, currency)}
              </span>

              {full && !closed && s.waitlist && (
                <span className="text-[0.8125rem] font-medium text-brand-foreground">{t("sheet.joinWaitlist")} →</span>
              )}
            </span>
          </button>
        );
      })}
      </div>

      {/* What the figure on each row is the price OF. */}
      {basePrice > 0 && (
        <p className="text-[0.8125rem] text-muted">
          {t("sheet.pricePerTicket", { amount: formatMoney(basePrice, currency) })}
        </p>
      )}
    </div>
  );
}
