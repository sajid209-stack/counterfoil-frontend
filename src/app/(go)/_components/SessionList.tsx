"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";

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
function pressureOf(left: number, capacity: number): "gone" | "critical" | "low" | "fine" {
  if (left <= 0) return "gone";
  if (left <= 4) return "critical";
  if (left <= 10 || left <= Math.max(1, Math.floor(capacity * 0.2))) return "low";
  return "fine";
}

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
      {sessions.map((s) => {
        const sold = Math.max(0, s.capacity - s.left);
        const pctSold = s.capacity > 0 ? (sold / s.capacity) * 100 : 0;
        const full = s.left <= 0 || !!s.blockedReason;
        const closed = !!s.blockedReason && s.left > 0;
        const pressure = pressureOf(s.left, s.capacity);
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
            className={cn(
              "flex min-h-16 w-full items-center rounded-md border p-comfortable text-left transition-colors duration-quick",
              isSelected
                ? "border-ember bg-ember/10"
                : full
                  ? "border-line bg-subtle"
                  : "border-line bg-card hover:bg-subtle active:bg-ember/10",
            )}
          >
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="flex items-baseline gap-comfortable">
                {/* Time leads — it is what a cashier is scanning for. */}
                <span
                  className={cn(
                    "shrink-0 text-base font-semibold",
                    full && !isSelected ? "text-faint" : "text-fg",
                  )}
                >
                  {s.time}
                </span>
                {s.meta && (
                  <span className="min-w-0 flex-1 truncate text-[12px] text-muted">{s.meta}</span>
                )}
                {/* The state of the session, in the corner the eye lands on:
                    places left is the number being decided on. The price sits
                    on the row below, beside the fill. */}
                <span
                  className={cn(
                    "ml-auto shrink-0 whitespace-nowrap text-[13px] font-medium",
                    closed
                      ? "text-muted"
                      : pressure === "gone"
                        ? "text-danger"
                        : pressure === "critical"
                          ? "text-ember"
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

              {/* How full, at a glance — with the figure the bar is drawing. */}
              <span className="flex items-center gap-tight">
                <span className="flex h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-line" aria-hidden>
                  <span
                    className={cn(
                      "h-full rounded-full",
                      closed
                        ? "bg-strong"
                        : pressure === "gone" || pressure === "critical"
                          ? "bg-ember"
                          : pressure === "low"
                            ? "bg-warning"
                            : "bg-success",
                    )}
                    style={{ width: `${Math.min(100, pctSold)}%` }}
                  />
                </span>
                <span className="shrink-0 whitespace-nowrap text-[12px] text-muted">
                  {sold}/{s.capacity}
                </span>
                <span
                  className={cn(
                    "ml-auto shrink-0 whitespace-nowrap text-[12px]",
                    s.price === basePrice ? "text-muted" : "text-brand-foreground",
                  )}
                >
                  {formatMoney(s.price, currency)}
                </span>
              </span>

              {full && !closed && s.waitlist && (
                <span className="text-[12px] font-medium text-ember">{t("sheet.joinWaitlist")} →</span>
              )}
            </span>
          </button>
        );
      })}

      {/* What the figure on each row is the price OF. */}
      {basePrice > 0 && (
        <p className="text-[12px] text-muted">
          {t("sheet.pricePerTicket", { amount: formatMoney(basePrice, currency) })}
        </p>
      )}
    </div>
  );
}
