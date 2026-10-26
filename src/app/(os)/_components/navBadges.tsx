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
 * The count a row draws: its own, or — for a parent whose children are not on
 * screen — the sum of what waits under it, so a closed group still says that
 * something inside it needs answering.
 */
export function badgeCount(
  d: NavDestination,
  badges: Partial<Record<NonNullable<NavDestination["badge"]>, number>>,
  childrenShown: boolean,
): number | undefined {
  if (d.badge) return badges[d.badge];
  if (childrenShown || !d.children) return undefined;
  const sum = d.children.reduce((n, c) => n + (c.badge ? badges[c.badge] ?? 0 : 0), 0);
  return sum > 0 ? sum : undefined;
}

/**
 * A small pill with a number. Hidden at 0.
 *
 * Solid primary with white figures and no ring (the owner's call, 2026-10-26):
 * a count here is something waiting for a manager's answer, so it is allowed to
 * stand out. Expanded it sits at the right end of the row. Collapsed (the 64px
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
        "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-ember-solid px-1.5 text-xs font-semibold leading-none tabular-nums text-on-solid",
        corner && "absolute -right-1 -top-1 h-4 min-w-4 px-1",
        className,
      )}
    >
      {text}
    </span>
  );
}
