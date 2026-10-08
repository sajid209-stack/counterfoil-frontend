"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { setPrefs, usePrefs } from "@/lib/prefs";

export interface StatItem {
  key: string;
  /** The tinted glyph beside the label. Drawn by the dashboard's tiles only. */
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  /** The line under the figure — what the figure does not say on its own. */
  context?: React.ReactNode;
  /** A class for that line where it is a problem rather than a fact. */
  contextTone?: string;
  /** A change against the period before. */
  delta?: React.ReactNode;
  /** Draws the figure as a problem rather than a fact. */
  tone?: "warning";
  /** A qualifier on the figure — shown as the card's tooltip, not as a line. */
  note?: string | null;
  /** A figure that is also a filter: pressing it shows the rows it counts.
   *  Opt-in; a figure without one stays a plain figure. */
  onClick?: () => void;
  /** Whether that filter is the one applied. */
  pressed?: boolean;
}

/**
 * The figures at the top of a page.
 *
 * Two layouts, one component, because they answer different questions.
 *
 * **`band`** — every page but the dashboard. One full-width card divided by
 * hairlines, a figure per cell: label, number, and a line under it only where
 * there is something to say. It replaced four separate tiles that cost 157px
 * and left a band of empty card under three of the four figures: the tile
 * anatomy belongs to a dashboard where every metric carries a glyph, a delta
 * and a sentence, and a list page's figures carry none of those. A summary bar
 * is what a mature SaaS list puts over its table — one object, read across,
 * and the table starts 70px sooner.
 *
 * **`tiles`** — the dashboard, unchanged: a card per metric with its tinted
 * glyph, its delta and its context, and one card of rows on a phone. It is the
 * cockpit's hero band, measured against the reference and the type spec, and
 * the owner asked for it to stay exactly as it is.
 *
 * Both live in this file so that a page cannot invent a third.
 *
 * **On a phone the band folds.** Four figures, one per row at 390px, measured
 * 238px — and on /orders that put the first row of the list 451px down a 735px
 * screen. So the lead figure stays at full size and the rest sit behind a
 * disclosure that states how many they are: `progressive-disclosure` says
 * reveal progressively, and `chip-collection-reflow` says an overflow summary
 * has to be operable rather than a way of hiding values. It is remembered, so
 * somebody who wants all four keeps them.
 *
 * The lead figure is `items[0]`, which every page already orders by importance
 * — spend and orders lead, a count of nothing goes quiet.
 */
export function StatStrip({
  items,
  loading = false,
  variant = "band",
  columns,
  wideColumns,
}: {
  items: StatItem[];
  loading?: boolean;
  variant?: "band" | "tiles";
  /** Band only: how many figures sit across from xl. Defaults to up to four.
   *  A page with six figures asks for three, because six across cannot hold a
   *  money figure at 24px and a fifth and sixth cell would leave the band
   *  showing its hairline colour through two empty slots. */
  columns?: number;
  /** Band only: how many sit across from 2xl (1536px), where six money figures
   *  do fit in a row. Unset, the band keeps `columns` at every width. */
  wideColumns?: number;
}) {
  // Read here rather than inside the fold, so the grid and the disclosure
  // cannot disagree about which state they are in.
  const { statsOpen: open } = usePrefs();

  if (variant === "tiles") {
    return (
      <>
        {/* A phone: one card, a row per figure. */}
        <div className="card-surface overflow-hidden sm:hidden">
          {items.map((item) => (
            <Tile key={item.key} item={item} loading={loading} row />
          ))}
        </div>
        <div
          className="hidden gap-section sm:grid sm:grid-cols-2 xl:[grid-template-columns:repeat(var(--stat-n),minmax(0,1fr))]"
          style={{ "--stat-n": Math.min(items.length, 4) } as React.CSSProperties}
        >
          {items.map((item) => (
            <Tile key={item.key} item={item} loading={loading} />
          ))}
        </div>
      </>
    );
  }

  return (
    /* The rules between figures are the grid's own 1px gaps showing the card
       through, so they land between cells however the row wraps — a per-cell
       border draws a stray edge the moment two figures sit on a second row. */
    <div className="card-surface overflow-hidden">
      {items.length > 1 && <FoldedLead items={items} loading={loading} />}
      {/* One figure a row on a phone, two across from sm, one column each
          from xl. Measured, not guessed: four columns of a 768px screen leave
          146px of cell, and "৳462,206.03" at 26px needed 150 (24px, now, needs ~138) — the card clips,
          so the figure would be silently wrong rather than merely cramped. */}
      <div
        id={GRID_ID}
        className={cn(
          "grid gap-px bg-hairline sm:[grid-template-columns:repeat(2,minmax(0,1fr))] xl:[grid-template-columns:repeat(var(--stat-n),minmax(0,1fr))]",
          !!wideColumns && "2xl:[grid-template-columns:repeat(var(--stat-wide),minmax(0,1fr))]",
          // Folded on a phone only; from sm there is room for two across and
          // the disclosure does not exist.
          items.length > 1 && !open && "max-sm:hidden",
        )}
        style={{ "--stat-n": columns ?? Math.min(items.length, 4), "--stat-wide": wideColumns } as React.CSSProperties}
      >
        {items.map((item) => (
          <Cell key={item.key} item={item} loading={loading} />
        ))}
      </div>
    </div>
  );
}

/** The id the disclosure controls, so a screen reader is told what it opens. */
const GRID_ID = "stat-band-figures";

/**
 * The phone's folded band: the lead figure, and a count of the rest.
 *
 * It states what is hidden ("3 more") rather than offering a bare chevron — a
 * disclosure that does not say what is behind it is a control nobody presses.
 */
function FoldedLead({ items, loading }: { items: StatItem[]; loading: boolean }) {
  const t = useTranslations("common");
  const { statsOpen: open } = usePrefs();
  const lead = items[0];
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={GRID_ID}
      onClick={() => setPrefs({ statsOpen: !open })}
      className={cn(
        "flex w-full items-center gap-section px-card py-comfortable text-left transition-colors duration-quick active:bg-muted-wash sm:hidden",
        open && "border-b border-hairline",
      )}
    >
      <span className="min-w-0 flex-1">
        {/* Open, the grid below draws every figure including this one, so the
            header states what it is rather than repeating the number. */}
        {open ? (
          <span className="block truncate text-[0.8125rem] font-medium text-fg">{t("figures")}</span>
        ) : (
          <>
            <span className="block truncate text-[0.8125rem] font-medium text-muted">{lead.label}</span>
            {loading ? (
              <span className="mt-inline block h-6 w-24 animate-pulse rounded-xs bg-line" />
            ) : (
              <span className={cn("type-figure mt-inline block truncate text-[1.5rem] font-semibold leading-tight", lead.tone === "warning" && "text-warning")}>
                {lead.value}
              </span>
            )}
          </>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-inline text-[0.8125rem] font-medium text-muted">
        {!open && t("moreCount", { count: items.length - 1 })}
        <ChevronDown size={16} strokeWidth={1.75} aria-hidden className={cn("transition-transform duration-quick", open && "rotate-180")} />
      </span>
    </button>
  );
}

function Cell({ item, loading }: { item: StatItem; loading: boolean }) {
  const Tag = item.onClick ? "button" : "div";
  return (
    <Tag
      title={item.note ?? undefined}
      {...(item.onClick ? { type: "button" as const, onClick: item.onClick, "aria-pressed": !!item.pressed, "data-focus-inset": "" } : {})}
      className={cn(
        // A phone reads a cell as a row — what it is on the left, the figure
        // hard right — which is the tightest shape and the one that cannot
        // crowd a long figure. From sm it stacks, label over figure.
        "grid min-w-0 grid-cols-[1fr_auto] items-baseline gap-x-section bg-card px-card py-comfortable text-left transition-colors duration-quick sm:block",
        // The ring is drawn INSIDE: the band clips its corners, so a 2px
        // outline on the first or last cell is painted outside the card and
        // thrown away — the same clip that ate the till's selected-card ring.
        // Tailwind v4 resets a button to the default cursor, and a cell that
        // looks like content has nothing else to say it can be pressed.
        item.onClick && "cursor-pointer hover:bg-fg/[0.03]",
        item.pressed && "bg-subtle",
      )}
    >
      <span className="col-start-1 min-w-0 truncate text-[0.8125rem] font-medium text-muted">{item.label}</span>
      {/* On a phone the figure sits in the second column across both rows, so
          a context line tucks under the label rather than under the number. */}
      <span className="col-start-2 row-start-1 row-end-3 flex flex-wrap items-baseline justify-end gap-x-tight self-center sm:mt-inline sm:justify-start">
        {loading ? (
          <span className="my-1 block h-6 w-20 animate-pulse rounded-xs bg-line" />
        ) : (
          <span className={cn("type-figure block whitespace-nowrap text-[1.5rem] font-semibold leading-tight", item.tone === "warning" && "text-warning")}>
            {item.value}
          </span>
        )}
        {item.delta}
      </span>
      {/* Only where there is something to say — an empty line under three of
          four figures is the white space this band exists to remove. */}
      {item.context && !loading && (
        <span className={cn("col-start-1 mt-inline block truncate text-[0.75rem]", item.contextTone ?? "text-muted")}>{item.context}</span>
      )}
    </Tag>
  );
}

/** The dashboard's tile, and only the dashboard's. */
function Tile({ item, loading, row = false }: { item: StatItem; loading: boolean; row?: boolean }) {
  const Tag = item.onClick ? "button" : "div";
  const figure = loading ? (
    <span className={cn("block animate-pulse rounded-xs bg-line", row ? "h-6 w-28" : "h-7 w-24")} />
  ) : (
    <span className={cn("type-figure block whitespace-nowrap font-semibold leading-tight", row ? "text-[1.625rem]" : "text-[1.75rem]", item.tone === "warning" && "text-warning")}>
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
        item.pressed && !row && "border-strong",
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
            <span className="min-w-0 truncate text-[0.75rem] font-medium text-muted">{item.label}</span>
            {item.delta}
          </span>
          <span className="mt-inline flex flex-wrap items-baseline gap-x-comfortable gap-y-inline">
            {figure}
            {item.context && <span className={cn("text-[0.75rem]", item.contextTone ?? "text-muted")}>{item.context}</span>}
          </span>
        </span>
      ) : (
        <>
          {/* The row keeps the delta pill's height whether or not there is a
              delta, so a tile with a comparison and one without are the same
              size — four tiles that differ by 4px read as a mistake. */}
          <span className="flex h-[22px] items-center gap-tight">
            <span className="min-w-0 flex-1 truncate text-[0.75rem] font-medium text-muted">{item.label}</span>
            {item.delta}
          </span>
          <span className="mt-tight block">{figure}</span>
          <span className={cn("mt-inline block text-[0.75rem]", item.contextTone ?? "text-muted")}>{item.context ?? " "}</span>
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
export function DeltaPill({ now, then, goodWhen = "up", since }: { now: number; then: number; goodWhen?: "up" | "down"; /** What it is measured against — "vs last week". Carried by the pill so a band of four figures does not print it four times. */ since?: string }) {
  if (then <= 0) return null;
  const pct = Math.round(((now - then) / then) * 100);
  if (pct === 0) return null;
  const up = pct > 0;
  const good = goodWhen === "up" ? up : !up;
  return (
    <span title={since} className={cn("inline-flex shrink-0 items-center gap-inline rounded-full px-tight py-0.5 text-[0.75rem]", good ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>
      {up ? "↗" : "↘"} {Math.abs(pct)}%
      {since && <span className="sr-only">{` ${since}`}</span>}
    </span>
  );
}
