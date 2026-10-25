"use client";

import { useTranslations } from "next-intl";
import { listLocations } from "@/lib/api";
import { refundSummary, useRefundVersion } from "@/lib/api/refundRequests";
import { useWriteOffVersion, writeOffSummary } from "@/lib/api/writeOffRequests";
import { useActiveLocation } from "@/lib/activeLocation";
import { useApiQuery } from "@/lib/useApi";
import { cn } from "@/lib/cn";
import type { NavDestination } from "./nav";

/**
 * The counts drawn on menu rows: what is WAITING for the venue in the top bar.
 *
 * Read in the browser only. The requests are seeded with the real clock, so the
 * server cannot draw the same number the browser will — and a count that flips
 * on hydration is worse than a count that arrives a beat later. Nothing is
 * returned until the venues have loaded and the active one is known, which is
 * after hydration, so the first paint is always badge-free.
 *
 * Re-read whenever a request is made, answered or taken back anywhere
 * (`useRefundVersion` / `useWriteOffVersion`), so the number drops the moment a
 * manager approves one.
 */
export function useNavBadges(): Partial<Record<NonNullable<NavDestination["badge"]>, number>> {
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const { id, pending } = useActiveLocation(locationsQ.data?.data ?? []);
  useRefundVersion();
  useWriteOffVersion();
  if (pending) return {};
  return { refunds: refundSummary(id).waiting, writeOffs: writeOffSummary(id).waiting };
}

/**
 * How many things are waiting across every counted row — refunds and write-offs
 * — for the menu button's dot. Zero while the venues are still loading, which
 * is the same "nothing until the browser has taken over" rule as above, so the
 * server's first paint and the browser's agree.
 */
export function useWaitingTotal(): number {
  const badges = useNavBadges();
  return (badges.refunds ?? 0) + (badges.writeOffs ?? 0);
}

/**
 * A small neutral pill with a number. Hidden at 0.
 *
 * Neutral on purpose — a white pill with a hairline ring, not orange. In this
 * product orange means "act here", and a count on a menu row is only
 * information. Expanded it sits at the right end of the row. Collapsed (the 64px
 * rail) it is a tiny count on the icon's corner, so the rail still tells you
 * something is waiting. The number is `aria-hidden`; the row's own accessible
 * name carries the words ("3 waiting").
 */
export function NavBadge({ count, corner = false, className }: { count: number | undefined; corner?: boolean; className?: string }) {
  const t = useTranslations("nav");
  if (!count || count < 1) return null;
  const text = count > 99 ? "99+" : String(count);
  return (
    <span
      aria-hidden
      title={t("waiting", { count })}
      data-nav-badge={count}
      className={cn(
        "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-card px-1.5 text-xs font-medium leading-none tabular-nums text-fg-secondary ring-1 ring-inset ring-line",
        corner && "absolute -right-1 -top-1 h-4 min-w-4 px-1",
        className,
      )}
    >
      {text}
    </span>
  );
}
