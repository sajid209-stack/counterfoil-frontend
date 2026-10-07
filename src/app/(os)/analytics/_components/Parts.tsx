"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { niceScale, smoothPath, useWidth } from "@/components/ui/charts";
import { cn } from "@/lib/cn";

/* The small shapes the analytics cards are made of. Almost every chart here is
 * a nominal or ranked one, so every bar is one brand hue: the label beside it
 * says which is which, and a second colour would only invite a legend. The one
 * place two series are told apart by colour is new against returning
 * customers, and that pair (the validated chart-1 and chart-2 slots) was run
 * through the palette check. Marks are thin, ends are rounded, text is in the
 * ink tokens and never in a series colour. */

/** A small heading over a group of cards: Sales, Visitors, Timing. */
export function GroupHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-comfortable pt-tight">
      <h2 id={`an-group-${id}`} className="type-label shrink-0 text-[0.75rem] text-fg">
        {children}
      </h2>
      <span aria-hidden className="h-px min-w-0 flex-1 bg-line" />
    </div>
  );
}

/** A titled card: the heading is the question, the body is the answer. `info`
 *  is what is counted, behind an "i" so the card itself stays quiet. */
export function Section({
  id,
  title,
  sub,
  view,
  info,
  className,
  children,
}: {
  id: string;
  title: string;
  sub?: React.ReactNode;
  /** Where "View" goes, and the name of that place for the accessible name. */
  view?: { href: string; where: string };
  /** What the card counts, in plain words; paragraphs are split on a newline. */
  info?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("analytics");
  return (
    <section data-card={id} aria-labelledby={`an-${id}`} className={cn("card-surface relative min-w-0 p-card", className)}>
      <div className="mb-comfortable flex items-start justify-between gap-tight">
        <div className="min-w-0">
          <h3 id={`an-${id}`} className="min-w-0 text-base font-semibold tracking-[-0.4px]">
            {title}
          </h3>
          {sub && <p className="mt-inline text-[0.75rem] text-muted">{sub}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-tight">
          {view && (
            <Link
              href={view.href}
              aria-label={t("viewIn", { where: view.where })}
              className="sm:-my-0 -my-tight flex min-h-11 min-w-11 shrink-0 items-center justify-end whitespace-nowrap px-tight text-[0.75rem] text-muted transition-colors duration-quick hover:text-fg sm:min-h-6 sm:min-w-0 sm:px-0"
            >
              {t("view")}
            </Link>
          )}
          {info && <InfoPopover title={title} text={info} />}
        </div>
      </div>
      {children}
    </section>
  );
}

/** A small "i" that opens a note. A button rather than a hover tip, so a phone
 *  can open it too. Escape closes it and returns focus to the button; a click
 *  elsewhere closes it. The note hangs from the card, not the button, so it has
 *  room on a narrow one. */
function InfoPopover({ title, text }: { title: string; text: string }) {
  const t = useTranslations("analytics");
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const label = t("info.label", { title });
  return (
    <span ref={wrap} className="flex">
      <button
        ref={trigger}
        type="button"
        data-info
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        className="-my-3 -mr-3 flex h-11 w-11 items-center justify-center rounded-sm text-muted transition-colors duration-quick hover:text-fg sm:-my-2 sm:-mr-2 sm:h-8 sm:w-8"
      >
        <Info size={16} strokeWidth={1.5} aria-hidden />
      </button>
      {open && (
        <div
          id={id}
          role="group"
          aria-label={label}
          data-info-panel
          className="absolute right-3 top-12 z-30 w-[min(21rem,calc(100%-1.5rem))] rounded-md border border-line bg-card p-comfortable text-[0.8125rem] leading-snug text-fg shadow-lg"
        >
          {text.split("\n").map((p, i) => (
            <p key={i} className={i > 0 ? "mt-tight" : undefined}>
              {p}
            </p>
          ))}
        </div>
      )}
    </span>
  );
}

/** One line saying a card has nothing to show for the period. */
export function Empty({ children }: { children: React.ReactNode }) {
  return <p data-empty className="py-comfortable text-[0.8125rem] text-muted">{children}</p>;
}

/** Two or three views of one card, as a pill: "Share · Over time". */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="mb-comfortable inline-flex rounded-full border border-line bg-subtle p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-11 min-w-11 rounded-full px-comfortable text-[0.8125rem] font-medium transition-colors duration-quick sm:min-h-8",
            value === o.value ? "bg-card text-fg shadow-sm ring-1 ring-strong" : "text-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The two periods, keyed as lines: solid for this period, dashed for the one
 *  it is compared with. For cards that draw lines; the page's own legend above
 *  names them once for the whole page. */
function LineKey({ dashed }: { dashed?: boolean }) {
  return (
    <svg width="20" height="4" aria-hidden className="shrink-0">
      {dashed ? (
        <line x1="0" x2="20" y1="2" y2="2" stroke="var(--color-muted)" strokeWidth="2" strokeDasharray="4 3" />
      ) : (
        <line x1="0" x2="20" y1="2" y2="2" stroke="var(--color-ember)" strokeWidth="2.5" strokeLinecap="round" />
      )}
    </svg>
  );
}

/** The two periods, keyed as bars: filled for this period, a dashed outline for
 *  the one before. */
function BarKey({ dashed }: { dashed?: boolean }) {
  return (
    <svg width="18" height="10" aria-hidden className="shrink-0">
      {dashed ? (
        <rect x="0.75" y="0.75" width="16.5" height="8.5" rx="4.25" fill="none" stroke="var(--color-muted)" strokeWidth="1.5" strokeDasharray="3 2" />
      ) : (
        <rect x="0" y="1" width="18" height="8" rx="4" fill="var(--color-ember)" />
      )}
    </svg>
  );
}

export function PairLegend({ kind, now, then }: { kind: "line" | "bar"; now: string; then: string }) {
  const Key = kind === "line" ? LineKey : BarKey;
  return (
    <p data-chart-legend className="mb-comfortable flex flex-wrap items-center gap-x-section gap-y-inline text-[0.75rem] text-muted">
      <span className="flex items-center gap-tight">
        <Key />
        <span className="tabular-nums text-fg">{now}</span>
      </span>
      <span className="flex items-center gap-tight">
        <Key dashed />
        <span className="tabular-nums text-fg">{then}</span>
      </span>
    </p>
  );
}

/** The figures of a chart as a table, for a screen reader that browses rather
 *  than hovers: every value a tooltip shows is here too. */
export function TableTwin({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface BarRow {
  key: string;
  label: string;
  /** The length of the bar. */
  value: number;
  /** What sits on the right of the label: the figure, and its share. */
  figure: React.ReactNode;
  /** A fold-everything-else row: its bar is neutral and it goes last. */
  muted?: boolean;
  /** A small marker after the figure: the change against the comparison. */
  change?: React.ReactNode;
  /** The comparison's value, in the same units as `value`: drawn as a thin
   *  tick across the bar. */
  tick?: number;
}

/** Ranked horizontal bars: the name and the figures on one line, a thin bar
 *  under them. The name wraps rather than being cut — it is what tells two
 *  rows apart. */
export function BarList({ rows }: { rows: BarRow[] }) {
  const max = Math.max(...rows.flatMap((r) => [r.value, r.tick ?? 0]), 0);
  return (
    <ul className="flex flex-col gap-comfortable">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between gap-tight text-[0.8125rem]">
            <span className={cn("min-w-0 flex-1 break-words", r.muted && "text-muted")}>{r.label}</span>
            <span className="shrink-0 whitespace-nowrap text-right">
              {r.figure}
              {r.change}
            </span>
          </div>
          <div className="relative mt-inline h-1.5 rounded-full bg-line" aria-hidden>
            <div
              className={cn("h-full rounded-full", r.muted ? "bg-muted" : "bg-ember")}
              style={{ width: `${max > 0 && r.value > 0 ? Math.max(2, (r.value / max) * 100) : 0}%` }}
            />
            {r.tick !== undefined && max > 0 && (
              <span
                data-tick
                className="absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg"
                style={{ left: `${Math.min(100, Math.max(0, (r.tick / max) * 100))}%` }}
              />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export interface PairRow {
  key: string;
  label: string;
  /** Small muted text after the label: "24 sold". */
  meta?: string;
  value: number;
  /** The comparison's value: a dashed outline under the bar. Absent while not comparing. */
  previous?: number;
  /** The formatted figures, printed at the end of each bar. */
  figure: string;
  previousFigure?: string;
  /** The change marker after the label. */
  change?: React.ReactNode;
  /** A fold-everything-else row: its bar is neutral. */
  muted?: boolean;
  /** A row with nothing to compare is one quiet line instead of two empty bars. */
  quiet?: string;
  /** What the tooltip and a screen reader say for each period, and the change. */
  now: string;
  then?: string;
  changeText?: string;
}

/**
 * Two periods, row by row: this period is a filled bar in the brand hue, the
 * comparison a dashed outline in the neutral. They are not two hues because
 * the second is not a second thing, it is the same thing earlier; the dash
 * says "before" even in grayscale. Both bars share one scale and one baseline,
 * so a longer outline than bar is a fall at a glance, and the figure and the
 * change sit on the row. A row is a focus stop, and hover or focus opens
 * the tooltip with both figures and the change.
 */
export function PairedBars({ rows, nowLabel, thenLabel }: { rows: PairRow[]; nowLabel: string; thenLabel: string }) {
  const [tip, setTip] = useState<string | null>(null);
  const max = Math.max(...rows.flatMap((r) => [r.value, r.previous ?? 0]), 0);
  const paired = rows.some((r) => r.previous !== undefined);
  // A bar that exists is never thinner than a dot, or a small sale vanishes
  // beside a large one: the width is a share of the track, with a 6px floor.
  const wide = (v: number) => (max > 0 && v > 0 ? `max(6px, ${(v / max) * 100}%)` : "0px");
  return (
    <>
      {paired && <PairLegend kind="bar" now={nowLabel} then={thenLabel} />}
      <ul className="flex flex-col gap-comfortable">
        {rows.map((r) => {
          const sentence = [r.label, r.meta, `${nowLabel}: ${r.now}`, r.then !== undefined ? `${thenLabel}: ${r.then}` : "", r.changeText].filter(Boolean).join(". ");
          if (r.quiet) {
            return (
              <li key={r.key} data-pair-quiet className="flex items-baseline justify-between gap-tight text-[0.8125rem] text-muted">
                <span className="min-w-0 break-words">
                  {r.label}
                  {r.meta && ` · ${r.meta}`}
                </span>
                <span className="shrink-0">{r.quiet}</span>
              </li>
            );
          }
          return (
            <li key={r.key} className="relative">
              <div
                tabIndex={0}
                role="group"
                aria-label={sentence}
                data-pair-row
                onPointerEnter={() => setTip(r.key)}
                onPointerLeave={() => setTip((k) => (k === r.key ? null : k))}
                onFocus={() => setTip(r.key)}
                onBlur={() => setTip((k) => (k === r.key ? null : k))}
                className="rounded-xs"
              >
              <div className="flex items-baseline justify-between gap-tight text-[0.8125rem]">
                <span className={cn("min-w-0 flex-1 break-words", r.muted && "text-muted")}>
                  {r.label}
                  {r.meta && <span className="text-muted"> · {r.meta}</span>}
                </span>
                {r.change && <span className="shrink-0 whitespace-nowrap text-right">{r.change}</span>}
              </div>
              <div aria-hidden className="mt-inline grid grid-cols-[minmax(0,1fr)_6.5rem] items-center gap-x-tight gap-y-[3px]">
                <span className="block h-2">
                  {r.value > 0 && <span data-pair-now className={cn("block h-full rounded-r-full", r.muted ? "bg-muted" : "bg-ember")} style={{ width: wide(r.value) }} />}
                </span>
                <span className="text-right text-[0.75rem] font-medium">{r.figure}</span>
                {r.previous !== undefined && (
                  <>
                    <span className="block h-2">
                      {r.previous > 0 && <span data-pair-then className="block h-full rounded-r-full border-[1.5px] border-dashed border-muted" style={{ width: wide(r.previous) }} />}
                    </span>
                    <span className="text-right text-[0.75rem] text-muted">{r.previousFigure}</span>
                  </>
                )}
              </div>
              </div>
              {tip === r.key && (
                <div
                  role="tooltip"
                  data-pair-tip
                  className="pointer-events-none absolute right-0 top-full z-20 mt-inline w-max max-w-full rounded-xs border border-line bg-card px-tight py-inline text-[0.75rem] shadow-sm"
                >
                  <p className="text-muted">
                    {r.label}
                    {r.meta && ` · ${r.meta}`}
                  </p>
                  <p className="flex items-center gap-tight whitespace-nowrap">
                    <LineKey />
                    <span className="font-medium">{r.now}</span>
                  </p>
                  {r.then !== undefined && (
                    <p className="flex items-center gap-tight whitespace-nowrap text-muted">
                      <LineKey dashed />
                      <span>{r.then}</span>
                    </p>
                  )}
                  {r.changeText && <p className="text-muted">{r.changeText}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** A figure and its share, the way a bar row ends: "৳12,000.00 · 23%". */
export function Figure({ main, share }: { main: React.ReactNode; share: string }) {
  return (
    <>
      <span className="font-medium">{main}</span>
      <span className="text-muted"> · {share}</span>
    </>
  );
}

export interface ColumnItem {
  key: string;
  label: string;
  /** The height of the bar. */
  value: number;
  /** Printed above the bar. */
  figure: string;
  /** The whole sentence, for a tooltip and a screen reader. */
  title: string;
  /** The comparison's value, in the same units as `value`: a dashed outline. */
  ghost?: number;
}

/** A handful of vertical bars, labelled underneath: the five lead-time
 *  buckets. Labels wrap, because "Over 30 days" is five characters wider than
 *  the column it sits in on a phone. */
export function ColumnBars({ items }: { items: ColumnItem[] }) {
  const max = Math.max(...items.flatMap((i) => [i.value, i.ghost ?? 0]), 0);
  const pctOf = (v: number) => (max > 0 && v > 0 ? `${Math.max(2, (v / max) * 100)}%` : 2);
  return (
    <ul className="grid grid-cols-5 gap-tight">
      {items.map((i) => (
        <li key={i.key} title={i.title} aria-label={i.title} className="flex min-w-0 flex-col items-center gap-inline">
          <span className="text-[0.75rem] font-medium" aria-hidden>
            {i.figure}
          </span>
          <span className="relative flex h-28 w-full items-end justify-center" aria-hidden>
            <span className="block w-full max-w-11 rounded-t-sm bg-ember" style={{ height: pctOf(i.value) }} />
            {/* Drawn over the bar, not behind it, so it still shows where the
                comparison is the shorter of the two. */}
            {i.ghost !== undefined && (
              <span
                data-ghost
                className="absolute bottom-0 block w-full max-w-11 rounded-t-sm border-2 border-dashed border-fg"
                style={{ height: pctOf(i.ghost) }}
              />
            )}
          </span>
          <span className="text-center text-[0.75rem] leading-tight text-muted" aria-hidden>
            {i.label}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The change against the comparison, after a row's figure: "▲ 12%" in the
 *  success ink, "▼ 8%" in the danger ink, "New" where there was nothing before,
 *  and nothing where it did not move. The arrow is the meaning; the colour only
 *  says whether that direction is welcome. */
export function Change({
  now,
  then,
  range,
  goodWhen = "up",
}: {
  now: number;
  /** Absent while not comparing: nothing is drawn. */
  then: number | undefined;
  /** The comparison range as text, for the sentence a screen reader hears. */
  range: string;
  goodWhen?: "up" | "down";
}) {
  const t = useTranslations("analytics");
  if (then === undefined) return null;
  if (then <= 0) {
    if (now <= 0) return null;
    return (
      <span data-change="new" title={t("change.newTitle", { range })} className="ml-tight text-[0.75rem] font-medium text-muted">
        <span aria-hidden>{t("change.new")}</span>
        <span className="sr-only">{t("change.newTitle", { range })}</span>
      </span>
    );
  }
  const pct = Math.round(((now - then) / then) * 100);
  if (pct === 0) return null;
  const up = pct > 0;
  const good = goodWhen === "up" ? up : !up;
  const sentence = t(up ? "change.up" : "change.down", { pct: Math.abs(pct), range });
  return (
    <span data-change={up ? "up" : "down"} title={sentence} className={cn("ml-tight text-[0.75rem] font-medium", good ? "text-success" : "text-danger")}>
      <span aria-hidden>
        {up ? "▲" : "▼"} {Math.abs(pct)}%
      </span>
      <span className="sr-only">{sentence}</span>
    </span>
  );
}

/** A thin bar split in two, the first part in the brand hue and the second
 *  neutral: arrived against didn't come. */
export function SplitBar({ a, b, label }: { a: number; b: number; label: string }) {
  const total = a + b;
  return (
    <div role="img" aria-label={label} className="mt-tight flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-line">
      {total > 0 && (
        <>
          <span className="block h-full rounded-full bg-ember" style={{ width: `${(a / total) * 100}%` }} />
          <span className="block h-full rounded-full bg-muted" style={{ width: `${(b / total) * 100}%` }} />
        </>
      )}
    </div>
  );
}

/** A pulse block, for the first load only. */
export const Pulse = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <span style={style} className={cn("block animate-pulse rounded-xs bg-line", className)} />
);

/** A card-shaped skeleton: a heading bar and a few rows. */
export function CardSkeleton({ rows = 5, tall, className }: { rows?: number; tall?: number; className?: string }) {
  return (
    <div className={cn("card-surface min-w-0 p-card", className)} aria-hidden data-skeleton>
      <Pulse className="mb-section h-4 w-40" />
      {tall ? (
        <Pulse style={{ height: tall }} className="w-full" />
      ) : (
        <div className="flex flex-col gap-comfortable">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i}>
              <div className="flex justify-between gap-tight">
                <Pulse className="h-3.5 w-1/3" />
                <Pulse className="h-3.5 w-20" />
              </div>
              <Pulse className="mt-inline h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Stacked columns: new against returning ────────────────────────────────
 *
 * One axis, counts, whole-number ticks. The bottom series is the first in
 * `series`. Segments are separated by 2px of the surface, the top one has a
 * rounded end and every column sits on one baseline. Hovering a column opens
 * a tooltip with every series at that point.
 */
export interface StackedPoint {
  /** Axis tick. */
  label: string;
  /** Tooltip heading. */
  title: string;
  /** One value per series, bottom to top. */
  parts: number[];
  /** A last line in the tooltip: what the comparison range had at this point. */
  note?: string;
}

const topRounded = (x: number, y: number, w: number, h: number, r: number) => {
  const k = Math.max(0, Math.min(r, w / 2, h));
  return `M${x},${y + h} L${x},${y + k} Q${x},${y} ${x + k},${y} L${x + w - k},${y} Q${x + w},${y} ${x + w},${y + k} L${x + w},${y + h} Z`;
};

export function StackedColumns({
  points,
  series,
  height = 190,
  ariaLabel,
  valueText,
}: {
  points: StackedPoint[];
  series: { label: string; color: string }[];
  height?: number;
  ariaLabel: string;
  /** "3 new customers" for series s, count n. */
  valueText: (s: number, n: number) => string;
}) {
  const [box, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const padL = 34, padR = 8, padT = 10, padB = 28;
  const plotW = Math.max(0, w - padL - padR);
  const plotH = Math.max(0, height - padT - padB);
  const totals = points.map((p) => p.parts.reduce((s, v) => s + v, 0));
  const peak = Math.max(...totals, 0);
  const tk = Math.max(1, Math.min(4, Math.ceil(peak)));
  const { top, step } = niceScale(peak, tk, true);
  const slot = points.length ? plotW / points.length : 0;
  const bw = Math.max(2, Math.min(24, slot * 0.72));
  const y = (v: number) => padT + (1 - v / top) * plotH;
  const every = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(plotW / 52))));
  const active = hover !== null ? points[hover] : null;
  const cx = (i: number) => padL + slot * i + slot / 2;

  return (
    <div ref={box} className="relative w-full">
      {active && w > 0 && (
        <div
          role="tooltip"
          data-stack-tip
          className="pointer-events-none absolute z-10 rounded-xs border border-line bg-card px-tight py-inline shadow-sm"
          style={{ left: Math.min(Math.max(cx(hover!), 74), w - 74), top: 0, transform: "translateX(-50%)" }}
        >
          <p className="text-[0.75rem] text-muted">{active.title}</p>
          {series.map((s, i) => (
            <p key={s.label} className="flex items-center gap-tight whitespace-nowrap text-[0.8125rem]">
              <span aria-hidden className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="font-medium">{valueText(i, active.parts[i])}</span>
            </p>
          ))}
          {active.note && <p className="whitespace-nowrap text-[0.75rem] text-muted">{active.note}</p>}
        </div>
      )}
      <div className="relative w-full" style={{ height }}>
        {w > 0 && (
          <svg className="absolute left-0 top-0" width={w} height={height} role="img" aria-label={ariaLabel}>
            {Array.from({ length: tk + 1 }, (_, i) => i * step).map((v) => (
              <g key={v}>
                <line x1={padL} x2={padL + plotW} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeWidth="1" />
                <text x={padL - 8} y={y(v) + 4} textAnchor="end" className="fill-[var(--color-muted)] text-[0.75rem]">
                  {v}
                </text>
              </g>
            ))}
            {hover !== null && <rect x={padL + slot * hover} y={padT} width={slot} height={plotH} fill="var(--color-hairline)" />}
            {points.map((p, i) => {
              let used = 0;
              const lastFilled = p.parts.reduce((m, v, s) => (v > 0 ? s : m), -1);
              return (
                <g key={i}>
                  {p.parts.map((v, s) => {
                    if (v <= 0) return null;
                    const h = (v / top) * plotH;
                    const yTop = y(used + v);
                    used += v;
                    // A 2px gap of surface between segments: the upper one is
                    // shortened from its bottom edge.
                    const gap = s > 0 && p.parts.slice(0, s).some((x) => x > 0) ? 2 : 0;
                    const hh = Math.max(1.5, h - gap);
                    return s === lastFilled ? (
                      <path key={s} d={topRounded(cx(i) - bw / 2, yTop, bw, hh, 4)} fill={series[s].color} />
                    ) : (
                      <rect key={s} x={cx(i) - bw / 2} y={yTop} width={bw} height={hh} fill={series[s].color} />
                    );
                  })}
                </g>
              );
            })}
            {points.map((p, i) => {
              const isLast = i === points.length - 1;
              const isTick = i % every === 0;
              if (!isTick && !isLast) return null;
              if (isTick && !isLast && points.length - 1 - i < every) return null;
              return (
                <text key={`x${i}`} x={cx(i)} y={height - 8} textAnchor={isLast && i > 0 ? "end" : "middle"} className="fill-[var(--color-muted)] text-[0.75rem]">
                  {p.label}
                </text>
              );
            })}
            {points.map((_, i) => (
              <rect
                key={`h${i}`}
                x={padL + slot * i}
                y={padT}
                width={Math.max(4, slot)}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}

/* ── Small multiples: one panel per series, one shared scale ───────────────
 *
 * Where a share becomes a story over time, the honest form for a handful of
 * categories is a panel each, not a stack: every panel reads from its own
 * baseline, the comparison period sits behind it as a dashed line, and the
 * name beside the panel carries identity, so no colour has to. All panels use
 * the same vertical scale, which is what makes them comparable.
 */
export interface MiniPoint {
  label: string;
  title: string;
  value: number;
  previous?: number;
  previousTitle?: string;
}

export interface MiniPanel {
  key: string;
  label: string;
  /** The panel's total, formatted. */
  total: string;
  change?: React.ReactNode;
  points: MiniPoint[];
}

function MiniArea({ points, max, fmt }: { points: MiniPoint[]; max: number; fmt: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 100, H = 40;
  const n = points.length;
  const x = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => H - 1.5 - (max > 0 ? (v / max) * (H - 5) : 0);
  const pts = (get: (p: MiniPoint) => number | undefined) => points.flatMap((p, i) => (get(p) === undefined ? [] : [[x(i), y(get(p)!)] as const]));
  const line = smoothPath(pts((p) => p.value));
  const compare = points.some((p) => p.previous !== undefined) ? smoothPath(pts((p) => p.previous)) : "";
  const area = `${line} L${x(n - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`;
  const at = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const f = r.width > 0 ? (e.clientX - r.left) / r.width : 0;
    setHover(Math.min(n - 1, Math.max(0, Math.round(f * (n - 1)))));
  };
  const p = hover !== null ? points[hover] : null;
  const edge = hover !== null && n > 1 ? hover / (n - 1) : 0.5;
  return (
    <div
      className="relative h-16 touch-pan-y"
      onPointerMove={at}
      onPointerDown={at}
      onPointerLeave={() => setHover(null)}
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden className="absolute inset-0 h-full w-full overflow-visible">
        <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} stroke="var(--color-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {compare && <path d={compare} fill="none" stroke="var(--color-muted)" strokeWidth="1.5" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />}
        <path d={area} fill="var(--color-ember)" fillOpacity="0.1" />
        <path d={line} fill="none" stroke="var(--color-ember)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {p && hover !== null && (
        <>
          <span aria-hidden className="pointer-events-none absolute top-0 h-full w-px bg-strong" style={{ left: `${(x(hover) / W) * 100}%` }} />
          <span
            aria-hidden
            className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-ember box-content"
            style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(p.value) / H) * 100}%` }}
          />
          <div
            role="tooltip"
            data-mini-tip
            className={cn(
              "pointer-events-none absolute bottom-full z-10 mb-inline w-max max-w-[14rem] rounded-xs border border-line bg-card px-tight py-inline shadow-sm",
              edge < 0.34 ? "left-0" : edge > 0.66 ? "right-0" : "left-1/2 -translate-x-1/2",
            )}
          >
            <p className="text-[0.75rem] text-muted">{p.title}</p>
            <p className="whitespace-nowrap text-[0.8125rem] font-medium">{fmt(p.value)}</p>
            {p.previous !== undefined && (
              <p className="whitespace-nowrap text-[0.75rem] text-muted">
                {p.previousTitle ? `${p.previousTitle} ` : ""}
                {fmt(p.previous)}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function MiniMultiples({ panels, fmt, caption }: { panels: MiniPanel[]; fmt: (v: number) => string; caption: (max: string) => string }) {
  const max = Math.max(...panels.flatMap((pn) => pn.points.flatMap((p) => [p.value, p.previous ?? 0])), 0);
  return (
    <div>
      <ul className="grid grid-cols-2 gap-x-section gap-y-section">
        {panels.map((pn) => (
          <li key={pn.key} data-mini={pn.key} className="min-w-0">
            <p className="break-words text-[0.8125rem] leading-tight">{pn.label}</p>
            <p className="text-[0.8125rem]">
              <span className="font-medium">{pn.total}</span>
              {pn.change}
            </p>
            <div className="mt-tight">
              <MiniArea points={pn.points} max={max} fmt={fmt} />
              <p aria-hidden className="mt-inline flex justify-between gap-tight text-[0.75rem] text-muted">
                <span>{pn.points[0]?.label}</span>
                <span>{pn.points.length > 1 ? pn.points[pn.points.length - 1].label : ""}</span>
              </p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-comfortable text-[0.75rem] text-muted">{caption(fmt(max))}</p>
    </div>
  );
}
