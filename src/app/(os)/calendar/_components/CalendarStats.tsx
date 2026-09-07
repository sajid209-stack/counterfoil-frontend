"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { delta, type WindowStats } from "./model";

/**
 * What the period on screen contains, before you read the grid.
 *
 * A calendar answers "what is on at 11 on Thursday" well and "how is the week
 * going" not at all — the grid holds the numbers but makes you count them.
 * These four state the shape of the window at a glance, and every one moves
 * when you step to the next week, so they describe what is actually on screen
 * rather than a fixed "last 7 days" unrelated to where you navigated.
 *
 * Two lines, not four. The first build gave each card a heading, a period, a
 * value and a comparison, and cost 144px of desktop and 280px of phone before
 * the grid began — 81% of a phone screen was chrome. The period line went
 * because the toolbar states the range directly underneath it, and the
 * comparison moved up beside the delta it qualifies.
 */
export function CalendarStats({
  now,
  previous,
  comparisonLabel,
  labels,
  compact = false,
}: {
  now: WindowStats;
  previous: WindowStats;
  /** "vs last week" — the baseline, beside the number it qualifies. */
  comparisonLabel: string;
  labels: { bookings: string; arrived: string; noshow: string; holds: string };
  /** Phone: one scrolling row rather than two rows of cards. */
  compact?: boolean;
}) {
  const rate = (n: number, of: number) => (of === 0 ? null : Math.round((n / of) * 100));

  const cards = [
    {
      key: "bookings",
      label: labels.bookings,
      value: String(now.bookings),
      change: delta(now.bookings, previous.bookings),
      /* More bookings is good; more no-shows is not. The arrow follows the
         number, the colour follows whether that direction is welcome. */
      goodWhen: "up" as const,
    },
    {
      key: "arrived",
      label: labels.arrived,
      value: rate(now.arrived, now.bookings) === null ? "—" : `${rate(now.arrived, now.bookings)}%`,
      change: delta(now.arrived, previous.arrived),
      goodWhen: "up" as const,
    },
    {
      key: "noshow",
      label: labels.noshow,
      value: rate(now.noshow, now.bookings) === null ? "—" : `${rate(now.noshow, now.bookings)}%`,
      change: delta(now.noshow, previous.noshow),
      goodWhen: "down" as const,
    },
    {
      key: "holds",
      label: labels.holds,
      value: String(now.holds),
      change: delta(now.holds, previous.holds),
      goodWhen: "down" as const,
    },
  ];

  return (
    <div
      className={cn(
        compact
          ? // Scrolls rather than clips: every card stays reachable, and the
            // row costs 68px instead of the 280px two rows of them did.
            "-mx-comfortable flex gap-tight overflow-x-auto px-comfortable pb-inline [scrollbar-width:none]"
          : "grid grid-cols-2 gap-tight lg:grid-cols-4 lg:gap-comfortable",
      )}
    >
      {cards.map((c) => {
        const up = (c.change ?? 0) > 0;
        const flat = c.change === 0 || c.change === null;
        const good = c.goodWhen === "up" ? up : !up;
        return (
          <div
            key={c.key}
            className={cn(
              "card-surface flex flex-col justify-center gap-tight px-comfortable py-comfortable",
              // Squat cards read as a toolbar rather than as figures worth
              // reading. This is the height the numbers earn.
              "min-h-[5.25rem]",
              compact && "min-w-[9.5rem] shrink-0",
            )}
          >
            <span className="type-label truncate text-[12px] text-muted">{c.label}</span>
            <span className="flex flex-wrap items-baseline gap-tight">
              <span className="text-2xl font-semibold tracking-tight tabular-nums">{c.value}</span>
              {!flat && (
                <span
                  className={cn(
                    "flex items-center gap-0.5 rounded-full px-tight text-[12px] font-medium",
                    good ? "bg-success/10 text-success" : "bg-danger/10 text-danger",
                  )}
                >
                  {up ? (
                    <ArrowUpRight size={12} strokeWidth={2.5} aria-hidden />
                  ) : (
                    <ArrowDownRight size={12} strokeWidth={2.5} aria-hidden />
                  )}
                  {Math.abs(c.change as number)}%
                </span>
              )}
              {!flat && !compact && (
                <span className="text-[12px] text-muted">{comparisonLabel}</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
