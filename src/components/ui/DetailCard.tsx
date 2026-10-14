"use client";

import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { MD, useMediaQuery } from "@/lib/useMedia";
import { Card } from "./Card";

/**
 * DetailCard — a titled card on a record page.
 *
 * The card anatomy every record page repeats: a `card-surface` with a title
 * (`text-md font-semibold`) in its header, an optional action at the end of
 * that row, and a padded body. Put a {@link FactGrid} in it for facts, an
 * {@link ActivityList} (or use `TimelineCard`) for dated events, or anything
 * else.
 *
 * • fold  → on a phone (below `md`) the card becomes a labelled disclosure
 *           with one line of `summary` under its title, closed by default. A
 *           count or a code tells the reader whether there is anything to open.
 * • bare  → the content draws its own surface (the ticket stub). On a computer
 *           it sits under a plain heading; on a phone the fold is the card and
 *           the content opens beneath it.
 */
export function DetailCard({
  title,
  description,
  actions,
  fold = false,
  summary,
  bare = false,
  id,
  className,
  children,
}: {
  title: ReactNode;
  /** One sentence under the header: what this card is, or what to do with it. */
  description?: ReactNode;
  /** Controls at the end of the header row. */
  actions?: ReactNode;
  fold?: boolean;
  /** The line shown under the title while folded (a count, a code). */
  summary?: ReactNode;
  bare?: boolean;
  id?: string;
  className?: string;
  children?: ReactNode;
}) {
  const auto = useId();
  const headingId = id ?? auto;
  const wide = useMediaQuery(MD);
  const [open, setOpen] = useState(false);

  const intro = description ? <p className="mb-comfortable text-sm text-muted">{description}</p> : null;

  if (!fold || wide) {
    if (bare) {
      return (
        <section aria-labelledby={headingId} className={className}>
          <div className="mb-comfortable flex items-center justify-between gap-tight">
            <h2 id={headingId} className="min-w-0 flex-1 text-md font-semibold text-fg">{title}</h2>
            {actions && <div className="flex shrink-0 items-center gap-tight">{actions}</div>}
          </div>
          {intro}
          {children}
        </section>
      );
    }
    return (
      <Card as="section" title={title} actions={actions} className={className}>
        {intro}
        {children}
      </Card>
    );
  }

  /* Folded on a phone. */
  const bodyId = `${headingId}-body`;
  const head = (
    <h2 id={headingId}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-14 w-full items-center gap-tight px-card py-comfortable text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-md font-semibold text-fg">{title}</span>
          {summary != null && <span className="block break-all text-sm font-normal text-muted">{summary}</span>}
        </span>
        <ChevronDown size={18} strokeWidth={1.5} aria-hidden className={cn("shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
    </h2>
  );

  if (bare) {
    return (
      <section className={className}>
        <div className="card-surface">{head}</div>
        {open && (
          <div id={bodyId} className="mt-tight">
            {intro}
            {children}
          </div>
        )}
      </section>
    );
  }
  return (
    <section className={cn("card-surface", className)} aria-labelledby={headingId}>
      {head}
      {open && (
        <div id={bodyId} className="border-t border-hairline p-card">
          {intro}
          {children}
        </div>
      )}
    </section>
  );
}

/* ── Facts ─────────────────────────────────────────────────────────────── */

export interface Fact {
  key: string;
  /** What it is: "Ticket type". Sentence case, never uppercase. */
  label: string;
  /** What it says. Text, a pill, or any node. Empty reads "Not recorded". */
  value?: ReactNode;
  /** Makes the value a link (an order, a customer). */
  href?: string;
  /** An identifier (a reference, a code) — DM Mono, and only for those. */
  mono?: boolean;
  /** Columns taken: 2 on a long value (a name, an address), "full" for a whole row. */
  span?: 2 | "full";
}

const COLS = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 xl:grid-cols-4",
} as const;

const isEmpty = (v: ReactNode) => v == null || v === false || v === "";

/**
 * FactGrid — a label/value grid.
 *
 * `primary` is for the few facts a reader opens the page for: the value is set
 * at `text-md font-semibold`. `secondary` is the rest: `text-base`. Labels are
 * always `text-sm text-muted`. A missing value reads "Not recorded" in muted
 * text rather than leaving a hole, so a row never looks like it failed to load.
 */
export function FactGrid({
  facts,
  tone = "secondary",
  columns = 4,
  className,
}: {
  facts: Array<Fact | null | undefined | false>;
  tone?: "primary" | "secondary";
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const t = useTranslations("common");
  const list = facts.filter((f): f is Fact => !!f);
  const valueCls = tone === "primary" ? "text-md font-semibold leading-snug text-fg" : "text-base text-fg";

  return (
    <dl className={cn("grid grid-cols-2 gap-x-section gap-y-comfortable", COLS[columns], className)}>
      {list.map((f) => {
        const empty = isEmpty(f.value);
        const body = empty ? (
          <span className="font-normal text-muted">{t("ui.notRecorded")}</span>
        ) : f.href ? (
          <Link
            href={f.href}
            className={cn(
              "inline-flex min-h-11 items-center text-brand-foreground hover:underline sm:min-h-0",
              f.mono && "font-mono",
            )}
          >
            {f.value}
          </Link>
        ) : (
          f.value
        );
        return (
          <div
            key={f.key}
            className={cn(
              "flex min-w-0 flex-col gap-inline",
              f.span === "full" ? "col-span-full" : f.span === 2 ? "col-span-2" : null,
            )}
          >
            <dt className="text-sm text-muted">{f.label}</dt>
            <dd className={cn("min-w-0 break-words", valueCls, !empty && !f.href && f.mono && "font-mono")}>{body}</dd>
          </div>
        );
      })}
    </dl>
  );
}
