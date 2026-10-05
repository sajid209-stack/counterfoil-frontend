"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

/* The small shapes the analytics cards are made of. Every chart here is a
 * nominal or ranked one, so every bar is one brand hue: the label beside it
 * says which is which, and a second colour would only invite a legend. Marks
 * are thin, ends are rounded, text is in the ink tokens and never in a series
 * colour. */

/** A titled card: the heading is the question, the body is the answer. */
export function Section({
  id,
  title,
  sub,
  view,
  className,
  children,
}: {
  id: string;
  title: string;
  sub?: React.ReactNode;
  /** Where "View" goes, and the name of that place for the accessible name. */
  view?: { href: string; where: string };
  className?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("analytics");
  return (
    <section data-card={id} aria-labelledby={`an-${id}`} className={cn("card-surface min-w-0 p-card", className)}>
      <div className="mb-comfortable flex items-start justify-between gap-tight">
        <div className="min-w-0">
          <h2 id={`an-${id}`} className="min-w-0 text-base font-semibold tracking-[-0.4px]">
            {title}
          </h2>
          {sub && <p className="mt-inline text-[0.75rem] text-muted">{sub}</p>}
        </div>
        {view && (
          <Link
            href={view.href}
            aria-label={t("viewIn", { where: view.where })}
            className="sm:-my-0 -my-tight flex min-h-11 min-w-11 shrink-0 items-center justify-end whitespace-nowrap px-tight text-[0.75rem] text-muted transition-colors duration-quick hover:text-fg sm:min-h-6 sm:min-w-0 sm:px-0"
          >
            {t("view")}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** One line saying a card has nothing to show for the period. */
export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-comfortable text-[0.8125rem] text-muted">{children}</p>;
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
 *  neutral: arrived against didn't come, new against returning. */
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
    <div className={cn("card-surface min-w-0 p-card", className)} aria-hidden>
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
