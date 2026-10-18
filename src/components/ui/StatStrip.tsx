"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { setPrefs, usePrefs } from "@/lib/prefs";

export type StatIconTone = "ember" | "success" | "info" | "warning" | "danger" | "neutral";

/** Wash and foreground for a figure's 32px icon. Each pair is a token the rest of the kit already uses. */
export const ICON_TONE: Record<StatIconTone, string> = {
  ember: "bg-ember-wash text-brand-foreground",
  success: "bg-success-wash text-success",
  info: "bg-info-wash text-info",
  warning: "bg-warning-wash text-warning",
  danger: "bg-danger-wash text-danger",
  neutral: "bg-subtle text-fg-secondary",
};

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
  /** The tone of the soft round icon on a phone (the wash behind it and its glyph). Defaults to neutral. */
  iconTone?: StatIconTone;
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
    /* From sm: one card divided by hairlines. On a phone: no frame of its own, because each figure is a card
       (see Cell) and the grid's gap shows the page between them. */
    <div role={label ? "group" : undefined} aria-label={label} className={cn("card-surface overflow-hidden max-sm:overflow-visible max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:shadow-none", className)}>
      <div id={fold.id} data-stat-band className={cn("grid grid-cols-[repeat(2,minmax(min-content,1fr))] gap-px bg-hairline max-sm:gap-tight max-sm:bg-transparent", gridClassName)} style={gridStyle}>
        {items.map((item, i) => (
          <Cell key={item.key} item={item} loading={loading} folded={fold.folds && !fold.open && i >= FIGURES_SHOWN} />
        ))}
      </div>
      {fold.folds && <FigureToggle fold={fold} total={items.length} className="sm:border-t sm:border-hairline sm:bg-card" />}
    </div>
  );
}

/** How many figures a phone draws before the rest wait behind "Show all N". Four cards fill a 2 x 2 grid. */
export const FIGURES_SHOWN = 4;

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
        // A phone draws each figure as its own card (docs/mobile.md section 6):
        // an optional soft icon and the change pill on the top line, then the
        // label, then the value. From sm it is the roomier label-over-figure
        // cell of the one banded card. An odd last card takes both columns.
        "card-surface relative min-w-0 p-comfortable text-left transition-colors duration-quick max-sm:last:odd:col-span-2 sm:block sm:rounded-none sm:border-0 sm:bg-card sm:px-card sm:py-comfortable sm:shadow-none",
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
      {/* The soft round icon, then the label under it, at every width. */}
      {item.icon && (
        <span aria-hidden className={cn("mb-tight flex h-8 w-8 items-center justify-center rounded-full [&>svg]:h-4 [&>svg]:w-4", ICON_TONE[item.iconTone ?? "neutral"])}>
          {item.icon}
        </span>
      )}
      {/* Wraps on a phone rather than truncating: a label cut to "Transa…" is
          the fault this layout exists to remove. With no icon the delta pill
          sits where the icon would be, so the label keeps clear of it. */}
      <span className={cn("block text-sm text-muted sm:truncate sm:font-medium sm:leading-6", !!item.delta && !item.icon && "max-sm:pr-14")}>{item.label}</span>
      <span className="mt-inline flex flex-wrap items-baseline gap-x-tight gap-y-inline">
        {loading ? (
          <span className="my-1 block h-6 w-20 animate-pulse rounded-xs bg-line" />
        ) : (
          <span
            className={cn(
              "type-figure block whitespace-nowrap text-xl font-semibold leading-tight min-[360px]:max-sm:text-2xl sm:text-2xl",
              item.tone === "warning" && "text-warning",
              item.tone === "danger" && "text-danger",
            )}
          >
            {item.value}
          </span>
        )}
        {/* Beside an icon the pill sits in the top-right corner at every width; without one it leaves the value line only on a phone. */}
        {item.delta && <span className={item.icon ? "absolute right-comfortable top-comfortable sm:right-card" : "max-sm:absolute max-sm:right-comfortable max-sm:top-comfortable"}>{item.delta}</span>}
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
      {/* The soft round icon top left and the change top right, as a phone draws them.
          The row keeps its height whether or not there is a delta, so four tiles stay one size. */}
      {item.icon ? (
        <>
          <span className="flex min-h-8 items-start justify-between gap-tight">
            <span aria-hidden className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full [&>svg]:h-4 [&>svg]:w-4", ICON_TONE[item.iconTone ?? "neutral"])}>{item.icon}</span>
            {item.delta}
          </span>
          <span className="mt-tight block truncate text-sm font-medium text-muted">{item.label}</span>
        </>
      ) : (
        <span className="flex h-[22px] items-center gap-tight">
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-muted">{item.label}</span>
          {item.delta}
        </span>
      )}
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
/** Whether DeltaPill would draw anything for these figures. A caller uses it to drop the "vs ..." line that explains a pill that is not there. */
export function deltaShows(now: number, then: number, goodWhen: "up" | "down" = "up"): boolean {
  if (then <= 0) return false;
  if (now === 0 && goodWhen === "up") return false;
  return Math.round(((now - then) / then) * 100) !== 0;
}

export function DeltaPill({ now, then, goodWhen = "up", since }: { now: number; then: number; goodWhen?: "up" | "down"; /** What it is measured against — "vs last week". Carried by the pill so a band of four figures does not print it four times. */ since?: string }) {
  if (!deltaShows(now, then, goodWhen)) return null;
  const pct = Math.round(((now - then) / then) * 100);
  const up = pct > 0;
  const good = goodWhen === "up" ? up : !up;
  return (
    <span title={since} className={cn("inline-flex shrink-0 items-center gap-inline rounded-full px-tight py-0.5 text-xs", good ? "bg-success-wash text-success" : "bg-danger-wash text-danger")}>
      {up ? "↗" : "↘"} {Math.abs(pct)}%
      {since && <span className="sr-only">{` ${since}`}</span>}
    </span>
  );
}
