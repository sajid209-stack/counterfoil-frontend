"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
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
  tone?: "warning" | "danger";
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
 * glyph, its delta and its context. It is the cockpit's hero band, measured
 * against the reference and the type spec, and the owner asked for it to stay
 * exactly as it is.
 *
 * Both live in this file so that a page cannot invent a third.
 *
 * **On a phone, two figures — and a button that names the rest.** A number is
 * never cut mid-word (a clipped "Transa…" reads as a fault, and a clipped
 * figure is a different figure), so below `sm` both layouts are one card, two
 * cells across, a hairline between them, a 12px label over an 18px figure.
 * The calm pass (docs/mobile.md §4) decided which few deserve the first
 * screen: the caller orders `items` so the two that matter come first, a
 * phone draws those, and a quiet full-width "Show all N" under them reveals
 * the rest in the same grid. It is a disclosure, not a deletion — the button
 * says how many there are. The open state is remembered per browser
 * (`statsOpen`) because somebody who wants all of them wants them every time.
 * From `sm` nothing folds.
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
  if (variant === "tiles") {
    return (
      <>
        {/* A phone: the compact grid, like every other band. */}
        <FigureBand items={items} loading={loading} className="sm:hidden" />
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
    <FigureBand
      items={items}
      loading={loading}
      /* Two across from sm, one column each from xl. Measured, not guessed:
         four columns of a 768px screen leave 146px of cell, and "৳462,206.03"
         at 26px needed 150 (24px, now, needs ~138) — the card clips, so the
         figure would be silently wrong rather than merely cramped. */
      gridClassName={cn(
        "sm:[grid-template-columns:repeat(2,minmax(0,1fr))] xl:[grid-template-columns:repeat(var(--stat-n),minmax(0,1fr))]",
        !!wideColumns && "2xl:[grid-template-columns:repeat(var(--stat-wide),minmax(0,1fr))]",
      )}
      gridStyle={{ "--stat-n": columns ?? Math.min(items.length, 4), "--stat-wide": wideColumns } as React.CSSProperties}
    />
  );
}

/**
 * One card of figures, divided by hairlines — and the only shape a figure band
 * takes on a phone.
 *
 * Two columns from the first pixel; `gridClassName` re-times them for the wider
 * screens that ask (a band that wants four across from xl). The rules between
 * figures are the grid's own 1px gaps showing the card through, so they land
 * between cells however the row wraps — a per-cell border draws a stray edge
 * the moment two figures sit on a second row.
 *
 * Exported so the dashboard's and Analytics' phone strips draw the same cell as
 * the band does, instead of each page keeping its own copy that drifts.
 */
export function FigureBand({
  items,
  loading = false,
  label,
  className,
  gridClassName,
  gridStyle,
}: {
  items: StatItem[];
  loading?: boolean;
  /** Names the group for a screen reader. */
  label?: string;
  className?: string;
  gridClassName?: string;
  gridStyle?: React.CSSProperties;
}) {
  const fold = useFigureFold(items.length);
  return (
    <div role={label ? "group" : undefined} aria-label={label} className={cn("card-surface overflow-hidden", className)}>
      <div id={fold.id} data-stat-band className={cn("grid grid-cols-[repeat(2,minmax(min-content,1fr))] gap-px bg-hairline", gridClassName)} style={gridStyle}>
        {items.map((item, i) => (
          <Cell key={item.key} item={item} loading={loading} folded={fold.folds && !fold.open && i >= FIGURES_SHOWN} />
        ))}
      </div>
      {fold.folds && <FigureToggle fold={fold} total={items.length} className="border-t border-hairline bg-card" />}
    </div>
  );
}

/** How many figures a phone draws before the rest wait behind "Show all N". */
export const FIGURES_SHOWN = 2;

/**
 * The fold state for one band of figures. `statsOpen` is the app's own
 * remembered preference (an earlier fold wrote it), so the choice follows the
 * browser; the server and the first client render both see it closed.
 */
export function useFigureFold(total: number) {
  const { statsOpen } = usePrefs();
  const id = useId();
  const folds = total > FIGURES_SHOWN;
  return { id, folds, open: !folds || statsOpen, toggle: () => setPrefs({ statsOpen: !statsOpen }) };
}

/**
 * The quiet button that names what is folded. Phone only (`sm:hidden`): from
 * `sm` every figure is drawn and there is nothing to open. 44px tall, text and
 * a chevron, no fill — it must not compete with the figures above it.
 */
export function FigureToggle({ fold, total, className }: { fold: ReturnType<typeof useFigureFold>; total: number; className?: string }) {
  const t = useTranslations("common");
  return (
    <button
      type="button"
      aria-expanded={fold.open}
      aria-controls={fold.id}
      onClick={fold.toggle}
      className={cn(
        "flex h-11 w-full items-center justify-center gap-inline text-sm font-medium text-muted transition-colors duration-quick hover:text-fg sm:hidden",
        className,
      )}
    >
      {fold.open ? t("ui.figureBand.showFewer") : t("ui.figureBand.showAll", { count: total })}
      <ChevronDown size={16} strokeWidth={1.75} aria-hidden className={cn("transition-transform duration-quick", fold.open && "rotate-180")} />
    </button>
  );
}

function Cell({ item, loading, folded = false }: { item: StatItem; loading: boolean; folded?: boolean }) {
  const Tag = item.onClick ? "button" : "div";
  return (
    <Tag
      title={item.note ?? undefined}
      {...(item.onClick ? { type: "button" as const, onClick: item.onClick, "aria-pressed": !!item.pressed, "data-focus-inset": "" } : {})}
      data-metric={item.key}
      className={cn(
        // A phone reads a cell as a compact stack — a 12px label, an 18px
        // figure, the delta and its context wrapping underneath — so that two
        // fit across 288px and nothing is ever cut. From sm it opens up to the
        // roomier label-over-figure cell the page has always had. An odd last
        // cell takes both columns rather than leaving the card showing through.
        "min-w-0 bg-card px-comfortable py-comfortable text-left transition-colors duration-quick max-sm:last:odd:col-span-2 sm:block sm:px-card",
        folded && "max-sm:hidden",
        // The ring is drawn INSIDE: the band clips its corners, so a 2px
        // outline on the first or last cell is painted outside the card and
        // thrown away — the same clip that ate the till's selected-card ring.
        // Tailwind v4 resets a button to the default cursor, and a cell that
        // looks like content has nothing else to say it can be pressed.
        item.onClick && "cursor-pointer hover:bg-muted-wash",
        item.pressed && "bg-ember-wash",
      )}
    >
      {/* Wraps on a phone rather than truncating: a label cut to "Transa…" is
          the fault this layout exists to remove. */}
      <span className="block text-xs text-muted sm:truncate sm:text-sm sm:font-medium sm:leading-6">{item.label}</span>
      <span className="mt-inline flex flex-wrap items-baseline gap-x-tight gap-y-inline">
        {loading ? (
          <span className="my-1 block h-6 w-20 animate-pulse rounded-xs bg-line" />
        ) : (
          <span
            className={cn(
              "type-figure block whitespace-nowrap text-lg font-semibold leading-tight sm:text-2xl",
              item.tone === "warning" && "text-warning",
              item.tone === "danger" && "text-danger",
            )}
          >
            {item.value}
          </span>
        )}
        {item.delta}
      </span>
      {/* Only where there is something to say — an empty line under three of
          four figures is the white space this band exists to remove. */}
      {item.context && !loading && (
        <span className={cn("mt-inline block text-xs sm:truncate", item.contextTone ?? "text-muted")}>{item.context}</span>
      )}
    </Tag>
  );
}

/** The dashboard's tile, and only the dashboard's. */
function Tile({ item, loading }: { item: StatItem; loading: boolean }) {
  const Tag = item.onClick ? "button" : "div";
  const figure = loading ? (
    <span className="block h-7 w-24 animate-pulse rounded-xs bg-line" />
  ) : (
    <span className={cn("type-figure block whitespace-nowrap text-3xl font-semibold leading-tight", item.tone === "warning" && "text-warning", item.tone === "danger" && "text-danger")}>
      {item.value}
    </span>
  );

  return (
    <Tag
      title={item.note ?? undefined}
      {...(item.onClick ? { type: "button" as const, onClick: item.onClick, "aria-pressed": !!item.pressed } : {})}
      className={cn(
        "card-surface flex flex-col p-card text-left",
        item.onClick && "transition-colors duration-quick hover:border-strong",
        item.pressed && "border-strong",
      )}
    >
      {item.icon && (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-ember-wash text-brand-foreground [&>svg]:h-4 [&>svg]:w-4">{item.icon}</span>
      )}
      {/* The row keeps the delta pill's height whether or not there is a
          delta, so a tile with a comparison and one without are the same
          size — four tiles that differ by 4px read as a mistake. */}
      <span className="flex h-[22px] items-center gap-tight">
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-muted">{item.label}</span>
        {item.delta}
      </span>
      <span className="mt-tight block">{figure}</span>
      <span className={cn("mt-inline block text-xs", item.contextTone ?? "text-muted")}>{item.context ?? " "}</span>
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
  /* A red "down 100%" on a figure that is simply nothing yet is noise. Only the
     figure whose fall is welcome (refunds, no-shows) may announce reaching zero. */
  if (now === 0 && goodWhen === "up") return null;
  const pct = Math.round(((now - then) / then) * 100);
  if (pct === 0) return null;
  const up = pct > 0;
  const good = goodWhen === "up" ? up : !up;
  return (
    <span title={since} className={cn("inline-flex shrink-0 items-center gap-inline rounded-full px-tight py-0.5 text-xs", good ? "bg-success-wash text-success" : "bg-danger-wash text-danger")}>
      {up ? "↗" : "↘"} {Math.abs(pct)}%
      {since && <span className="sr-only">{` ${since}`}</span>}
    </span>
  );
}
