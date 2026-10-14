"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { DetailCard } from "./DetailCard";

/**
 * ActivityList — dated events in the order they happened.
 *
 * Each row reads the same way: what happened (and its status) on the first
 * line with the moment at the end, a muted line of detail under it, and an
 * optional note in the operator's own words. `tone` colours only the word that
 * says what happened — the row itself stays neutral, and the word (never the
 * colour alone) carries the meaning.
 */
export interface ActivityItem {
  id: string;
  /** What happened: a word ("Admitted"), or an identifier (a code). */
  title: ReactNode;
  /** The title is an identifier — DM Mono, and only for those. */
  mono?: boolean;
  /** Struck through: a code that has been replaced, an event that was undone. */
  struck?: boolean;
  /** Colours the title: success or danger. Neutral by default. */
  tone?: "success" | "danger";
  /** A glyph before the title (it never stands alone). */
  icon?: ReactNode;
  /** A pill or tag after the title. */
  status?: ReactNode;
  /** The moment, aligned to the end of the first line. */
  time?: ReactNode;
  /** Muted line under the first: who, where, why. */
  detail?: ReactNode;
  /** Free text in the operator's own words (a reason). */
  note?: ReactNode;
}

export function ActivityList({ items, className }: { items: ActivityItem[]; className?: string }) {
  return (
    <ul className={cn("flex flex-col", className)}>
      {items.map((e) => (
        <li key={e.id} className="flex flex-col gap-inline border-b border-hairline py-comfortable first:pt-0 last:border-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-x-tight gap-y-inline">
            <span
              className={cn(
                "flex min-w-0 flex-1 items-center gap-inline text-base font-medium",
                e.mono && "break-all font-mono",
                e.tone === "success" ? "text-success" : e.tone === "danger" ? "text-danger" : "text-fg",
                e.struck && "text-muted line-through",
              )}
            >
              {e.icon}
              {e.title}
            </span>
            {e.status}
            {e.time != null && <span className="shrink-0 text-sm text-muted">{e.time}</span>}
          </div>
          {e.detail != null && e.detail !== "" && <p className="text-sm text-muted">{e.detail}</p>}
          {e.note != null && e.note !== "" && <p className="text-base text-fg">{e.note}</p>}
        </li>
      ))}
    </ul>
  );
}

/**
 * TimelineCard — a {@link DetailCard} around an {@link ActivityList}, with the
 * empty sentence ready ("Never scanned.") so a record with nothing to show says
 * so instead of drawing an empty card.
 */
export function TimelineCard({
  title,
  description,
  items,
  empty,
  fold,
  summary,
  actions,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  items: ActivityItem[];
  empty: ReactNode;
  fold?: boolean;
  summary?: ReactNode;
  actions?: ReactNode;
  id?: string;
}) {
  return (
    <DetailCard id={id} title={title} description={description} actions={actions} fold={fold} summary={summary}>
      {items.length === 0 ? <p className="text-sm text-muted">{empty}</p> : <ActivityList items={items} />}
    </DetailCard>
  );
}
