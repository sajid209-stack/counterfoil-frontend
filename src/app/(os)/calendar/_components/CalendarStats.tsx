"use client";

import { DeltaPill, StatStrip } from "@/components/ui";
import type { WindowStats } from "./model";

/**
 * What the period on screen contains, before you read the grid.
 *
 * A calendar answers "what is on at 11 on Thursday" well and "how is the week
 * going" not at all — the grid holds the numbers but makes you count them.
 * These four state the shape of the window at a glance, and every one moves
 * when you step to the next week, so they describe what is actually on screen
 * rather than a fixed "last 7 days" unrelated to where you navigated.
 *
 * Drawn by the shared StatStrip, which is the dashboard's tile: this had its
 * own copy of the card — same idea, an uppercase label and a 24px figure in a
 * box 35px shorter — and three sets of top cards that disagree about their own
 * measurements is what the owner asked to end. What is particular to a
 * calendar stays here: which four figures, and that more bookings is good
 * while more no-shows is not.
 */
export function CalendarStats({
  now,
  previous,
  comparisonLabel,
  labels,
}: {
  now: WindowStats;
  previous: WindowStats;
  /** "vs last week" — the baseline. It belongs to the band rather than to
   *  each figure in it, so it travels with the pill that needs it rather than
   *  being printed under all four numbers. */
  comparisonLabel: string;
  labels: { bookings: string; arrived: string; noshow: string; holds: string };
}) {
  const rate = (n: number, of: number) => (of === 0 ? null : Math.round((n / of) * 100));
  const pct = (n: number, of: number) => (rate(n, of) === null ? "—" : `${rate(n, of)}%`);

  return (
    <StatStrip
      items={[
        {
          key: "bookings",
          label: labels.bookings,
          value: String(now.bookings),
          delta: <DeltaPill now={now.bookings} then={previous.bookings} since={comparisonLabel} />,
        },
        {
          key: "arrived",
          label: labels.arrived,
          value: pct(now.arrived, now.bookings),
          delta: <DeltaPill now={now.arrived} then={previous.arrived} since={comparisonLabel} />,
        },
        {
          key: "noshow",
          label: labels.noshow,
          value: pct(now.noshow, now.bookings),
          /* The arrow follows the number, the colour follows whether that
             direction is welcome: a week with more no-shows than the last is
             not an improvement, however the figure moved. */
          delta: <DeltaPill now={now.noshow} then={previous.noshow} goodWhen="down" since={comparisonLabel} />,
        },
        {
          key: "holds",
          label: labels.holds,
          value: String(now.holds),
          delta: <DeltaPill now={now.holds} then={previous.holds} goodWhen="down" since={comparisonLabel} />,
        },
      ]}
    />
  );
}
