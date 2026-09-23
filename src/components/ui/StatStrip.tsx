"use client";

import { cn } from "@/lib/cn";

export interface StatItem {
  key: string;
  /** The tinted glyph beside the label. Every figure on every page has one. */
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  /** The line under the figure — what the figure does not say on its own. */
  context?: React.ReactNode;
  /** A class for that line where it is a problem rather than a fact. */
  contextTone?: string;
  /** A change against the period before, hard right of the label. */
  delta?: React.ReactNode;
  /** Draws the figure as a problem rather than a fact. */
  tone?: "warning";
  /** A qualifier on the figure — shown as the card's tooltip, not as a line. */
  note?: string | null;
  /** A figure that is also a filter: pressing it shows the rows it counts.
   *  Opt-in; a card without one stays a plain figure. */
  onClick?: () => void;
  /** Whether that filter is the one applied. */
  pressed?: boolean;
}

/**
 * The row of figures at the top of a page — one card, everywhere.
 *
 * There were three of these: the dashboard's tile, this strip (orders,
 * customers, catalog, an event) and the calendar's own copy. They disagreed
 * about every measurement that shows: the dashboard drew a tinted icon beside
 * a sentence-case label and a 28px figure over a line of context; the other
 * two drew an uppercase tracked label over a 24px figure and no icon, in a
 * card 35px shorter. The owner asked for one. The dashboard's is it, because
 * it is the one that was measured against the reference and the type spec —
 * 12px/500 label, 28px/600 figure, 20px padding.
 *
 * Two shapes, one list, as the dashboard's tiles have had since the mobile
 * pass: a card per figure from `sm`, and on a phone one card of rows, because
 * four full-width tiles cost about 800px before the page's actual content and
 * no figure may shrink to win that back — "৳462,206.03" does not fit half a
 * 390px screen at 28px.
 *
 * Two rules the older copies agreed on and this keeps: the figures describe
 * the whole filtered set rather than the page on screen, and a figure that is
 * also a filter says so by being a button.
 */
export function StatStrip({
  items,
  loading = false,
}: {
  items: StatItem[];
  loading?: boolean;
}) {
  return (
    <>
      {/* A phone: one card, a row per figure. */}
      <div className="card-surface overflow-hidden sm:hidden">
        {items.map((item) => (
          <StatBox key={item.key} item={item} loading={loading} row />
        ))}
      </div>
      {/* From sm: a card each — two across, then one column per figure from xl,
          so three figures do not leave a hole where a fourth would be. */}
      <div
        className="hidden gap-section sm:grid sm:grid-cols-2 xl:[grid-template-columns:repeat(var(--stat-n),minmax(0,1fr))]"
        style={{ "--stat-n": Math.min(items.length, 4) } as React.CSSProperties}
      >
        {items.map((item) => (
          <StatBox key={item.key} item={item} loading={loading} />
        ))}
      </div>
    </>
  );
}

function StatBox({ item, loading, row = false }: { item: StatItem; loading: boolean; row?: boolean }) {
  const Tag = item.onClick ? "button" : "div";
  const figure = loading ? (
    <span className={cn("block animate-pulse rounded-xs bg-line", row ? "h-6 w-28" : "h-7 w-24")} />
  ) : (
    <span className={cn("type-figure block whitespace-nowrap font-semibold leading-tight", row ? "text-[26px]" : "text-[28px]", item.tone === "warning" && "text-warning")}>
      {item.value}
    </span>
  );

  return (
    <Tag
      title={item.note ?? undefined}
      {...(item.onClick ? { type: "button" as const, onClick: item.onClick, "aria-pressed": !!item.pressed } : {})}
      className={cn(
        "text-left",
        row
          ? "flex w-full items-start gap-comfortable border-b border-hairline px-card py-comfortable last:border-b-0"
          : "card-surface flex flex-col p-card",
        item.onClick && "transition-colors duration-quick hover:border-strong",
        item.pressed && !row && "border-inverse",
        item.pressed && row && "bg-subtle",
      )}
    >
      {item.icon && (
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-sm bg-ember/10 text-brand-foreground",
            row ? "mt-0.5 h-9 w-9" : "h-7 w-7 [&>svg]:h-4 [&>svg]:w-4",
          )}
        >
          {item.icon}
        </span>
      )}
      {row ? (
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-tight">
            <span className="min-w-0 truncate text-[12px] font-medium text-muted">{item.label}</span>
            {item.delta}
          </span>
          <span className="mt-inline flex flex-wrap items-baseline gap-x-comfortable gap-y-inline">
            {figure}
            {item.context && <span className={cn("text-[12px]", item.contextTone ?? "text-muted")}>{item.context}</span>}
          </span>
        </span>
      ) : (
        <>
          {/* The row keeps the delta pill's height whether or not there is a
              delta, so a card with a comparison and one without are the same
              size — four cards in a row that differ by 4px read as a mistake. */}
          <span className="flex h-[22px] items-center gap-tight">
            <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-muted">{item.label}</span>
            {item.delta}
          </span>
          <span className="mt-tight block">{figure}</span>
          {/* The line is always drawn, empty where a figure has nothing more to
              say: it is what keeps every card on every page the same height as
              the dashboard's, rather than each page's row finding its own. */}
          <span className={cn("mt-inline block text-[12px]", item.contextTone ?? "text-muted")}>{item.context ?? " "}</span>
        </>
      )}
    </Tag>
  );
}

/**
 * The change against the period before, as the dashboard has drawn it since
 * the Aura pass: fully rounded, a diagonal arrow for direction.
 *
 * `goodWhen` is why this is shared rather than copied: more bookings is good
 * and more no-shows is not, so the arrow follows the number while the colour
 * follows whether that direction is welcome. Nothing is drawn where there is
 * no prior period — inventing one to fill the corner would be inventing the
 * comparison.
 */
export function DeltaPill({ now, then, goodWhen = "up" }: { now: number; then: number; goodWhen?: "up" | "down" }) {
  if (then <= 0) return null;
  const pct = Math.round(((now - then) / then) * 100);
  if (pct === 0) return null;
  const up = pct > 0;
  const good = goodWhen === "up" ? up : !up;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-inline rounded-full px-tight py-0.5 text-[12px]", good ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>
      {up ? "↗" : "↘"} {Math.abs(pct)}%
    </span>
  );
}
